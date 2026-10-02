import { db, InvoiceStatus, OnlineOrderStatus, OnlinePaymentStatus, Prisma } from '@elec/db'
import { calculateDocumentTotals, calculateLineTotal, roundMoney, toDecimalString, type DocumentLineInput } from '@elec/contracts'
import { currentYear, nextSequenceNumber, serializeVatBreakdown, getDefaultWarehouseId } from './helpers'
import {
  reserveStockCore,
  sellReservedCore,
  releaseReservedClampedCore,
  reverseSalesForReferenceCore,
  StockMovementType,
  type ReverseSalesResult,
} from './stock.service'
import { cancelInvoiceCore } from './invoice.service'
import { createNotification } from './notification.service'
import { sendOrderEmail } from './mail.service'

type ProductWithTax = Prisma.ProductGetPayload<{ include: { taxRate: true } }>

// ============================================================================
// Commandes en ligne (boutique) :
//   - Création : réservation du stock (anti-survente) + notification temps
//     réel au back-office (NEW_ORDER)
//   - Confirmation : la réservation est consommée et le stock décrémenté
//   - Annulation : libération des réservations
//   - La TVA est TOUJOURS incluse (les prix affichés en boutique sont TTC) ;
//     le timbre fiscal de 1 DT s'applique uniquement si une facture est
//     demandée ; frais de livraison soumis à la TVA 19%.
// ============================================================================

export interface CreateOnlineOrderInput {
  customerId: string
  shippingFullName: string
  shippingAddress: string
  shippingCity: string
  shippingPhone: string
  shippingNote?: string | null
  shippingCost?: number
  paymentMethod: 'COD'
  deliveryMethod?: 'DELIVERY' | 'PICKUP'
  pickupTime?: string | Date | null
  withInvoice?: boolean
  lines: Array<{ productId: string; quantity: number }>
}

async function computeOrderTotals(lines: DocumentLineInput[], shippingCost: number, withInvoice: boolean) {
  const base = calculateDocumentTotals({ lines, timbreFiscal: 0 })
  const shippingHT = roundMoney(shippingCost)
  const shippingTVA = roundMoney(shippingHT * 0.19)

  const breakdown = base.vatBreakdown.map((b) => ({ ...b }))
  const r19 = breakdown.find((b) => b.rate === 19)
  if (shippingHT > 0) {
    if (r19) {
      r19.baseHT = roundMoney(r19.baseHT + shippingHT)
      r19.tva = roundMoney(r19.baseHT * 0.19)
    } else {
      breakdown.push({ rate: 19, baseHT: shippingHT, tva: shippingTVA })
    }
  }
  breakdown.sort((a, b) => b.rate - a.rate)

  const totalHT = roundMoney(base.totalHT + shippingHT)
  const timbreFiscal = withInvoice ? 1 : 0
  const totalTVA = roundMoney(breakdown.reduce((s, b) => s + b.tva, 0))
  const totalTTC = roundMoney(totalHT + totalTVA + timbreFiscal)

  return { subtotalHT: base.totalHT, totalHT, totalTVA, totalTTC, timbreFiscal, vatBreakdown: breakdown }
}

export async function createOnlineOrder(input: CreateOnlineOrderInput) {
  const warehouseId = await getDefaultWarehouseId()
  const deliveryMethod = input.deliveryMethod === 'PICKUP' ? 'PICKUP' : 'DELIVERY'
  const shippingCost = deliveryMethod === 'PICKUP' ? 0 : (input.shippingCost ?? 0)
  const pickupTime = input.pickupTime ? new Date(input.pickupTime) : null
  const withInvoice = input.withInvoice ?? false

  return db.$transaction(async (tx) => {
    const number = await nextSequenceNumber('OC', currentYear(), tx)

    // Résolution des produits + réservation du stock AVANT création de la
    // commande (anti-survente : le stock n'est disponible qu'une fois).
    const items: Array<{ product: ProductWithTax; quantity: number }> = []
    for (const line of input.lines) {
      const product = await tx.product.findUnique({
        where: { id: line.productId },
        include: { taxRate: true },
      })
      if (!product || !product.isActive) throw new Error(`Produit introuvable : ${line.productId}`)
      await reserveStockCore(tx, {
        productId: product.id,
        warehouseId,
        quantity: line.quantity,
        type: StockMovementType.RESERVATION,
        reference: number,
        reason: `Réservation commande ${number}`,
        userId: null,
      })
      items.push({ product, quantity: line.quantity })
    }

    const lines: DocumentLineInput[] = items.map(({ product, quantity }) => ({
      productId: product.id,
      sku: product.sku,
      designation: product.name,
      quantity,
      unitPriceTTC: Number(product.priceTTC ?? 0) > 0 ? Number(product.priceTTC) : null,
      unitPriceHT: Number(product.priceHT),
      discountValue: 0,
      discountType: null,
      taxRate: Number(product.taxRate.rate),
    }))

    const totals = await computeOrderTotals(lines, shippingCost, withInvoice)

    const order = await tx.onlineOrder.create({
      data: {
        number,
        customerId: input.customerId,
        status: OnlineOrderStatus.PENDING,
        paymentMethod: input.paymentMethod,
        paymentStatus: OnlinePaymentStatus.PENDING,
        deliveryMethod,
        pickupTime,
        shippingFullName: input.shippingFullName,
        shippingAddress: input.shippingAddress,
        shippingCity: input.shippingCity,
        shippingPhone: input.shippingPhone,
        shippingNote: input.shippingNote ?? null,
        shippingCost: toDecimalString(shippingCost),
        subtotalHT: toDecimalString(totals.subtotalHT),
        totalHT: toDecimalString(totals.totalHT),
        totalTVA: toDecimalString(totals.totalTVA),
        totalTTC: toDecimalString(totals.totalTTC),
        timbreFiscal: toDecimalString(totals.timbreFiscal),
        vatBreakdown: serializeVatBreakdown(totals.vatBreakdown),
        withInvoice,
        items: {
          create: items.map(({ product, quantity }) => {
            const rate = Number(product.taxRate.rate)
            const priceTTC = Number(product.priceTTC ?? 0)
            const t = calculateLineTotal({
              quantity,
              unitPriceHT: Number(product.priceHT),
              unitPriceTTC: priceTTC > 0 ? priceTTC : null,
              taxRate: rate,
            })
            return {
              productId: product.id,
              sku: product.sku,
              designation: product.name,
              quantity: toDecimalString(quantity),
              unitPriceHT: toDecimalString(priceTTC > 0 ? t.netUnitPrice : Number(product.priceHT)),
              unitPriceTTC: toDecimalString(priceTTC > 0 ? priceTTC : t.netUnitPriceTTC),
              netUnitPrice: toDecimalString(t.netUnitPrice),
              netUnitPriceTTC: toDecimalString(t.netUnitPriceTTC),
              lineHT: toDecimalString(t.lineHT),
              taxRateId: product.taxRateId,
              lineTVA: toDecimalString(t.lineTVA),
              lineTTC: toDecimalString(t.lineTTC),
            }
          }),
        },
      },
      include: { items: true, customer: true },
    })

    // Notification temps réel au back-office.
    await createNotification({
      type: 'NEW_ORDER',
      title: 'Nouvelle commande en ligne',
      message: `Commande ${number} — ${order.shippingFullName} (${order.shippingCity}) — ${Number(order.totalTTC).toFixed(3)} DT${withInvoice ? ' (avec facture)' : ''}`,
      link: `/commandes/${order.id}`,
    })

    return order
  })
}

export async function confirmOrder(id: string) {
  const warehouseId = await getDefaultWarehouseId()
  return db.$transaction(async (tx) => {
    const order = await tx.onlineOrder.findUnique({ where: { id }, include: { items: true, customer: true } })
    if (!order) throw new Error('Commande introuvable')
    if (order.status !== OnlineOrderStatus.PENDING && order.status !== OnlineOrderStatus.PREPARING) {
      throw new Error('La commande ne peut pas être confirmée dans son état actuel')
    }

    for (const item of order.items) {
      await sellReservedCore(tx, {
        productId: item.productId,
        warehouseId,
        quantity: Number(item.quantity),
        type: StockMovementType.SALE,
        reference: order.number,
        reason: `Confirmation commande ${order.number}`,
        userId: null,
      })
    }

    const updated = await tx.onlineOrder.update({
      where: { id },
      data: { status: OnlineOrderStatus.CONFIRMED },
      include: { customer: true, items: true },
    })

    if (order.customer.email) {
      await sendOrderEmail({
        to: order.customer.email,
        orderNumber: order.number,
        status: 'confirmée',
        totalTTC: Number(order.totalTTC),
      }).catch(() => {})
    }

    return updated
  })
}

/**
 * ANNULATION d'une commande — retour complet à l'état antérieur :
 *   - si le stock avait déjà été DÉBITÉ (commande confirmée) : les quantités
 *     réellement sorties sont réintégrées ;
 *   - si le stock était encore RÉSERVÉ (commande en attente) : la réservation
 *     est libérée, sans jamais faire de négatif ;
 *   - la facture liée est annulée si elle existe (elle sort alors du chiffre
 *     d'affaires) ;
 *   - un paiement déjà encaissé passe en REMBOURSÉ ;
 *   - le motif est journalisé dans les notes de la commande.
 */
export async function cancelOrder(id: string, userId: string | null, reason?: string | null) {
  const warehouseId = await getDefaultWarehouseId()
  return db.$transaction(async (tx) => {
    const order = await tx.onlineOrder.findUnique({ where: { id }, include: { items: true } })
    if (!order) throw new Error('Commande introuvable')
    const locked: OnlineOrderStatus[] = [
      OnlineOrderStatus.DELIVERED,
      OnlineOrderStatus.CANCELLED,
      OnlineOrderStatus.REFUNDED,
    ]
    if (locked.includes(order.status)) {
      throw new Error('La commande ne peut plus être annulée')
    }

    const suffix = reason ? ` — ${reason}` : ''

    // Le stock a-t-il déjà été débité pour cette commande ?
    // On se base sur les mouvements réels plutôt que sur le statut, pour rester
    // exact même si le statut a été modifié manuellement.
    const sold = await tx.stockMovement.findFirst({
      where: { reference: order.number, type: StockMovementType.SALE, quantity: { lt: 0 } },
      select: { id: true },
    })

    let restored: ReverseSalesResult = { lines: 0, quantity: 0 }
    let released = 0

    if (sold) {
      restored = await reverseSalesForReferenceCore(tx, {
        reference: order.number,
        reason: `Annulation commande ${order.number}${suffix}`,
        userId,
      })
    } else {
      for (const item of order.items) {
        released += await releaseReservedClampedCore(tx, {
          productId: item.productId,
          warehouseId,
          quantity: Number(item.quantity),
          type: StockMovementType.RELEASE,
          reference: order.number,
          reason: `Annulation commande ${order.number}${suffix}`,
          userId: null,
        })
      }
    }

    // Facture issue de la commande : annulée pour sortir du chiffre d'affaires.
    const invoice = await tx.invoice.findFirst({
      where: { notes: { contains: order.number } },
      orderBy: { createdAt: 'desc' },
    })
    if (invoice) {
      const cancellable: InvoiceStatus[] = [
        InvoiceStatus.DRAFT,
        InvoiceStatus.VALIDATED,
        InvoiceStatus.PAID,
        InvoiceStatus.PARTIALLY_PAID,
      ]
      if (cancellable.includes(invoice.status)) {
        const result = await cancelInvoiceCore(tx, invoice.id, userId)
        restored.quantity += result.restored.quantity
        restored.lines += result.restored.lines
      }
    }

    const updated = await tx.onlineOrder.update({
      where: { id },
      data: {
        status: OnlineOrderStatus.CANCELLED,
        paymentStatus:
          order.paymentStatus === OnlinePaymentStatus.PAID
            ? OnlinePaymentStatus.REFUNDED
            : order.paymentStatus,
        notes: order.notes ? `${order.notes}${suffix}` : `Annulée${suffix}`,
      },
    })

    await createNotification({
      type: 'SYSTEM',
      title: 'Commande annulée',
      message: `Commande ${order.number} annulée${suffix} — ${Number(order.totalTTC).toFixed(3)} DT retirés, ${restored.quantity.toFixed(3)} unité(s) réintégrée(s) en stock, ${released.toFixed(3)} unité(s) de réservation libérée(s).`,
      link: `/commandes/${order.id}`,
    })

    return updated
  })
}

/**
 * Changement de statut « logistique » (préparation, expédition, livraison).
 * Les statuts Annulée / Remboursée passent obligatoirement par `cancelOrder`
 * afin que le stock, le chiffre d'affaires et les paiements soient restitués.
 */
export async function updateOrderStatus(id: string, status: OnlineOrderStatus) {
  if (status === OnlineOrderStatus.CANCELLED || status === OnlineOrderStatus.REFUNDED) {
    throw new Error(
      'Utilisez « Annuler la commande » : le stock, le chiffre d\'affaire et les paiements sont alors automatiquement restitués.',
    )
  }
  const order = await db.onlineOrder.findUnique({ where: { id }, select: { status: true } })
  if (!order) throw new Error('Commande introuvable')
  if (order.status === OnlineOrderStatus.CANCELLED || order.status === OnlineOrderStatus.REFUNDED) {
    throw new Error('Une commande annulée ou remboursée ne peut plus changer de statut')
  }
  const updated = await db.onlineOrder.update({ where: { id }, data: { status } })
  return updated
}

export async function markOrderPaid(id: string, method: 'CARD' | 'EDAHABIA' | 'BANK_TRANSFER' = 'CARD') {
  return db.onlineOrder.update({
    where: { id },
    data: { paymentStatus: OnlinePaymentStatus.PAID, paymentMethod: method },
  })
}

export async function listOrders(options?: { status?: OnlineOrderStatus; search?: string; limit?: number }) {
  const where: Prisma.OnlineOrderWhereInput = {}
  if (options?.status) where.status = options.status
  if (options?.search) {
    where.OR = [{ number: { contains: options.search } }, { shippingFullName: { contains: options.search } }]
  }
  return db.onlineOrder.findMany({
    where,
    include: { customer: true, _count: { select: { items: true } } },
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 100,
  })
}

export async function getOrder(id: string) {
  return db.onlineOrder.findUnique({
    where: { id },
    include: { items: { include: { product: true, taxRate: true } }, customer: true },
  })
}

export async function listOrdersForCustomer(customerId: string) {
  return db.onlineOrder.findMany({
    where: { customerId },
    include: { items: { include: { product: { include: { images: true } } } } },
    orderBy: { createdAt: 'desc' },
  })
}