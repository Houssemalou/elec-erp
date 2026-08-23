import { prisma, Prisma } from '@elec/db'

export type Tx = Prisma.TransactionClient
export type DbClient = Prisma.TransactionClient | PrismaClientLike

// PrismaClient-like for callers that pass the top-level client
type PrismaClientLike = typeof prisma

export const db = prisma

/** Année courante pour la numérotation. */
export function currentYear(): number {
  return new Date().getFullYear()
}

/**
 * Génère le numéro séquentiel suivant, de façon ATOMIQUE pour un préfixe et
 * une année donnés. Ex : nextSequenceNumber('FAC', 2026) => "FAC-2026-000123"
 * - Sans `client` : transaction autonome (verrou de ligne).
 * - Avec `client`  : s'exécute dans la transaction du caller.
 */
export async function nextSequenceNumber(
  prefix: string,
  year = currentYear(),
  client?: DbClient,
): Promise<string> {
  const compute = async (tx: DbClient) => {
    const row = await tx.sequence.upsert({
      where: { prefix_year: { prefix, year } },
      create: { prefix, year, lastNumber: 1 },
      update: {},
    })
    const updated = await tx.sequence.update({
      where: { id: row.id },
      data: { lastNumber: { increment: 1 } },
    })
    return `${prefix}-${year}-${String(updated.lastNumber).padStart(6, '0')}`
  }
  if (client) return compute(client)
  return prisma.$transaction(compute)
}

/** Résout l'id du taux de TVA à partir de sa valeur (ex : 19). */
export async function getTaxRateIdByRate(rate: number | string, client: Tx = prisma): Promise<string> {
  const numeric = Number(rate)
  const row = await client.taxRate.findFirst({ where: { rate: numeric, active: true } })
  if (!row) {
    const fallback = await client.taxRate.findFirst({ where: { isDefault: true } })
    if (!fallback) throw new Error(`Aucun taux de TVA ${numeric}% ni taux par défaut configuré`)
    return fallback.id
  }
  return row.id
}

/** Résout la valeur du taux (nombre) depuis son id. */
export async function getTaxRateValue(taxRateId: string, client: Tx = prisma): Promise<number> {
  const row = await client.taxRate.findUnique({ where: { id: taxRateId } })
  if (!row) throw new Error('Taux de TVA introuvable')
  return Number(row.rate)
}

export async function getStoreSettings(client: Tx = prisma) {
  const settings = await client.storeSettings.findUnique({ where: { id: 1 } })
  if (!settings) throw new Error('Paramètres du magasin non configurés (lancer le seed)')
  return settings
}

export async function getDefaultWarehouseId(client: Tx = prisma): Promise<string> {
  const settings = await getStoreSettings(client)
  if (settings.defaultWarehouseId) return settings.defaultWarehouseId
  const warehouse = await client.warehouse.findFirst({ where: { isDefault: true } })
  if (!warehouse) throw new Error('Aucun dépôt par défaut configuré')
  return warehouse.id
}

/** Série un découpage TVA { "19": "38.000" } pour Prisma Json. */
export function serializeVatBreakdown(breakdown: Array<{ rate: number; tva: number }>): Prisma.JsonObject {
  const out: Prisma.JsonObject = {}
  for (const b of breakdown) {
    out[String(b.rate)] = b.tva.toFixed(3)
  }
  return out
}