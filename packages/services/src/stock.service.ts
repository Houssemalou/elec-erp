import { db, Prisma, StockMovementType } from '@elec/db'
import { DbClient, nextSequenceNumber } from './helpers'
import { checkAndNotifyStockAlerts } from './notification.service'

export { StockMovementType }

// ============================================================================
// Stock — SERVICE CENTRAL.
// Toute variation de stock (vente, réception, ajustement, transfert,
// inventaire, réservation) passe obligatoirement par ce service :
//   - Transaction Prisma (atomicité)
//   - Journalisation dans StockMovement (traçabilité / audit fiscal)
//   - Mouvements automatiques : userId = null ("système")
//   - Ajustements manuels : motif obligatoire
// ============================================================================

export class StockError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StockError'
  }
}

export interface StockOpInput {
  productId: string
  warehouseId: string
  /** Quantité positive (le signe est géré par l'opération). */
  quantity: number
  type: StockMovementType
  reference?: string | null
  reason?: string | null
  /** Responsable ; null = "système". */
  userId?: string | null
}

async function getOrCreateStockLevel(client: DbClient, productId: string, warehouseId: string) {
  const existing = await client.stockLevel.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  })
  if (existing) return existing
  return client.stockLevel.create({
    data: { productId, warehouseId, quantity: 0, reservedQuantity: 0 },
  })
}

async function logMovement(client: DbClient, op: StockOpInput, signedQuantity: number) {
  await client.stockMovement.create({
    data: {
      type: op.type,
      productId: op.productId,
      warehouseId: op.warehouseId,
      quantity: signedQuantity,
      reason: op.reason ?? null,
      reference: op.reference ?? null,
      userId: op.userId ?? null,
    },
  })
}

export async function getAvailableQuantity(client: DbClient, productId: string, warehouseId: string): Promise<number> {
  const level = await getOrCreateStockLevel(client, productId, warehouseId)
  return Number(level.quantity) - Number(level.reservedQuantity)
}

// ---------------------------------------------------------------------------
// Décrémentation (vente directe / POS) — type SALE par défaut
// ---------------------------------------------------------------------------

export async function decrementStockCore(client: DbClient, input: StockOpInput) {
  if (input.quantity <= 0) throw new StockError('La quantité doit être positive')
  const level = await getOrCreateStockLevel(client, input.productId, input.warehouseId)
  if (Number(level.quantity) < input.quantity) {
    throw new StockError(
      `Stock insuffisant pour ${input.productId} (${Number(level.quantity)} disponibles)`,
    )
  }
  await client.stockLevel.update({
    where: { id: level.id },
    data: { quantity: { decrement: input.quantity } },
  })
  await logMovement(client, input, -input.quantity)
}

export async function decrementStock(input: StockOpInput) {
  const result = await db.$transaction((tx) => decrementStockCore(tx, input))
  await checkAndNotifyStockAlerts()
  return result
}

// ---------------------------------------------------------------------------
// Incrémentation (réception fournisseur, retour/avoir)
// ---------------------------------------------------------------------------

export async function incrementStockCore(client: DbClient, input: StockOpInput) {
  if (input.quantity <= 0) throw new StockError('La quantité doit être positive')
  const level = await getOrCreateStockLevel(client, input.productId, input.warehouseId)
  await client.stockLevel.update({
    where: { id: level.id },
    data: { quantity: { increment: input.quantity } },
  })
  await logMovement(client, input, input.quantity)
}

export async function incrementStock(input: StockOpInput) {
  const result = await db.$transaction((tx) => incrementStockCore(tx, input))
  await checkAndNotifyStockAlerts()
  return result
}

// ---------------------------------------------------------------------------
// Réservation (commande en ligne non confirmée) et libération
// ---------------------------------------------------------------------------

/**
 * Réservation d'une quantité pour une commande en ligne.
 * Toujours acceptée, même si le stock disponible est insuffisant (backorder) :
 * les commandes en ligne passent même hors stock. Le disponible peut donc
 * devenir négatif, signalant une commande à honorer dès réapprovisionnement.
 */
export async function reserveStockCore(client: DbClient, input: StockOpInput) {
  if (input.quantity <= 0) throw new StockError('La quantité doit être positive')
  const level = await getOrCreateStockLevel(client, input.productId, input.warehouseId)
  await client.stockLevel.update({
    where: { id: level.id },
    data: { reservedQuantity: { increment: input.quantity } },
  })
  await logMovement(client, {
    ...input,
    type: StockMovementType.RESERVATION,
    reason: input.reason ?? `Réservation de ${input.quantity}`,
  }, 0)
}

export async function reserveStock(input: StockOpInput) {
  return db.$transaction((tx) => reserveStockCore(tx, input))
}

export async function releaseReservedCore(client: DbClient, input: StockOpInput) {
  if (input.quantity <= 0) throw new StockError('La quantité doit être positive')
  const level = await getOrCreateStockLevel(client, input.productId, input.warehouseId)
  if (Number(level.reservedQuantity) < input.quantity) {
    throw new StockError(`Réservation insuffisante pour ${input.productId}`)
  }
  await client.stockLevel.update({
    where: { id: level.id },
    data: { reservedQuantity: { decrement: input.quantity } },
  })
  await logMovement(client, { ...input, type: StockMovementType.RELEASE }, 0)
}

export async function releaseReservedStock(input: StockOpInput) {
  return db.$transaction((tx) => releaseReservedCore(tx, input))
}

/**
 * Vente d'une quantité réservée (confirmation de commande en ligne) :
 * la réservation est consommée ET le stock physique décrémenté.
 */
export async function sellReservedCore(client: DbClient, input: StockOpInput) {
  if (input.quantity <= 0) throw new StockError('La quantité doit être positive')
  const level = await getOrCreateStockLevel(client, input.productId, input.warehouseId)
  if (Number(level.reservedQuantity) < input.quantity) {
    throw new StockError(`Réservation insuffisante pour ${input.productId}`)
  }
  await client.stockLevel.update({
    where: { id: level.id },
    data: {
      reservedQuantity: { decrement: input.quantity },
      quantity: { decrement: input.quantity },
    },
  })
  await logMovement(client, {
    ...input,
    type: StockMovementType.SALE,
    reason: input.reason ?? 'Confirmation de commande en ligne',
  }, -input.quantity)
}

export async function sellReservedStock(input: StockOpInput) {
  const result = await db.$transaction((tx) => sellReservedCore(tx, input))
  await checkAndNotifyStockAlerts()
  return result
}

// ---------------------------------------------------------------------------
// Ajustement manuel — motif OBLIGATOIRE
// ---------------------------------------------------------------------------

export async function adjustStockCore(client: DbClient, input: StockOpInput) {
  if (!input.reason || input.reason.trim().length < 3) {
    throw new StockError('Le motif est obligatoire pour un ajustement manuel (perte, casse, inventaire...)')
  }
  if (input.quantity === 0) throw new StockError('La quantité ne peut pas être nulle')
  const level = await getOrCreateStockLevel(client, input.productId, input.warehouseId)
  const target = Number(level.quantity) + input.quantity
  if (target < 0) throw new StockError('L\'ajustement ferait passer le stock en négatif')
  await client.stockLevel.update({ where: { id: level.id }, data: { quantity: { increment: input.quantity } } })
  await logMovement(client, input, input.quantity)
}

export async function adjustStock(input: StockOpInput) {
  const result = await db.$transaction((tx) => adjustStockCore(tx, input))
  await checkAndNotifyStockAlerts()
  return result
}

// ---------------------------------------------------------------------------
// Transfert entre dépôts — deux mouvements liés par la référence TRF
// ---------------------------------------------------------------------------

export interface StockTransferInput {
  productId: string
  fromWarehouseId: string
  toWarehouseId: string
  quantity: number
  userId?: string | null
}

async function transferStockCore(client: DbClient, input: StockTransferInput, reference: string) {
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new StockError('Le dépôt de départ et d\'arrivée doivent être différents')
  }
  if (input.quantity <= 0) throw new StockError('La quantité doit être positive')

  const source = await getOrCreateStockLevel(client, input.productId, input.fromWarehouseId)
  if (Number(source.quantity) < input.quantity) {
    throw new StockError(`Stock insuffisant dans le dépôt source (${Number(source.quantity)} disponibles)`)
  }

  await client.stockLevel.update({
    where: { id: source.id },
    data: { quantity: { decrement: input.quantity } },
  })
  await logMovement(client, {
    productId: input.productId,
    warehouseId: input.fromWarehouseId,
    quantity: input.quantity,
    type: StockMovementType.TRANSFER_OUT,
    reference,
    reason: `Transfert vers ${input.toWarehouseId}`,
    userId: input.userId ?? null,
  }, -input.quantity)

  const target = await getOrCreateStockLevel(client, input.productId, input.toWarehouseId)
  await client.stockLevel.update({
    where: { id: target.id },
    data: { quantity: { increment: input.quantity } },
  })
  await logMovement(client, {
    productId: input.productId,
    warehouseId: input.toWarehouseId,
    quantity: input.quantity,
    type: StockMovementType.TRANSFER_IN,
    reference,
    reason: `Transfert depuis ${input.fromWarehouseId}`,
    userId: input.userId ?? null,
  }, input.quantity)
}

export async function transferStock(input: StockTransferInput): Promise<string> {
  const reference = await nextSequenceNumber('TRF')
  await db.$transaction(async (tx) => {
    await transferStockCore(tx, input, reference)
  })
  await checkAndNotifyStockAlerts()
  return reference
}

// ---------------------------------------------------------------------------
// Inventaire — calcule les écarts (théorique vs réel) et les journalise
// ---------------------------------------------------------------------------

export interface InventoryEntry {
  productId: string
  actualQuantity: number
}

export interface InventoryResult {
  productId: string
  theoretical: number
  actual: number
  delta: number
}

export async function runInventory(warehouseId: string, entries: InventoryEntry[], userId?: string | null): Promise<InventoryResult[]> {
  const results: InventoryResult[] = []
  await db.$transaction(async (tx) => {
    for (const entry of entries) {
      const level = await getOrCreateStockLevel(tx, entry.productId, warehouseId)
      const theoretical = Number(level.quantity)
      const delta = entry.actualQuantity - theoretical
      if (delta !== 0) {
        await tx.stockLevel.update({
          where: { id: level.id },
          data: { quantity: { increment: delta } },
        })
        await tx.stockMovement.create({
          data: {
            type: StockMovementType.INVENTORY,
            productId: entry.productId,
            warehouseId,
            quantity: delta,
            reason: `Inventaire : théorique ${theoretical.toFixed(3)}, réel ${entry.actualQuantity.toFixed(3)}`,
            reference: `INV-${warehouseId}`,
            userId: userId ?? null,
          },
        })
      }
      results.push({ productId: entry.productId, theoretical, actual: entry.actualQuantity, delta })
    }
  })
  await checkAndNotifyStockAlerts()
  return results
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export async function listStockLevels(options?: { warehouseId?: string; belowThreshold?: boolean; search?: string }) {
  const where: Prisma.StockLevelWhereInput = {}
  if (options?.warehouseId) where.warehouseId = options.warehouseId
  const levels = await db.stockLevel.findMany({
    where,
    include: {
      product: { include: { taxRate: true, category: true } },
      warehouse: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  if (options?.belowThreshold) {
    return levels.filter((l) => {
      const available = Number(l.quantity) - Number(l.reservedQuantity)
      const threshold = Number(l.product.minStockAlert)
      return threshold > 0 && available < threshold
    })
  }
  if (options?.search) {
    const q = options.search.toLowerCase()
    return levels.filter(
      (l) =>
        l.product.name.toLowerCase().includes(q) || l.product.sku.toLowerCase().includes(q),
    )
  }
  return levels
}

export async function listStockMovements(options?: { productId?: string; warehouseId?: string; limit?: number }) {
  const where: Prisma.StockMovementWhereInput = {}
  if (options?.productId) where.productId = options.productId
  if (options?.warehouseId) where.warehouseId = options.warehouseId
  return db.stockMovement.findMany({
    where,
    include: { product: { select: { sku: true, name: true } }, warehouse: { select: { name: true } }, user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 100,
  })
}