import { db, OnlineOrderStatus, OnlinePaymentStatus, Prisma } from '@elec/db'
import { calculateDocumentTotals, roundMoney, toDecimalString, type DocumentLineInput } from '@elec/contracts'
import { currentYear, nextSequenceNumber, serializeVatBreakdown, getDefaultWarehouseId } from './helpers'
import { reserveStockCore, sellReservedCore, releaseReservedCore, StockMovementType } from './stock.service'
import { createNotification } from './notification.service'
import { sendOrderEmail } from './mail.service'

type ProductWithTax = Prisma.ProductGetPayload<{ include: { taxRate: true } }>

// ============================================================================
// Commandes en ligne (boutique) :
//   - Création : réservation du stock (anti-survente) + notification temps
//     réel au back-office (NEW_ORDER)
//   - Confirmation : la réservation est consommée et le stock décrémenté
//   - Annulation : libération des réservations
//   - Frais de livraison soumis à la TVA 19% ; timbre fiscal 1 DT inclus
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
  const totalTVA = withInvoice ? roundMoney(breakdown.reduce((s, b) => s + b.tva, 0)) : 0
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
            const price = Number(product.priceHT)
            const rate = Number(product.taxRate.rate)
            const lineHT = roundMoney(price * quantity)
            const lineTVA = withInvoice ? roundMoney(lineHT * (rate / 100)) : 0
            return {
              productId: product.id,
              sku: product.sku,
              designation: product.name,
              quantity: toDecimalString(quantity),
              unitPriceHT: toDecimalString(price),
              netUnitPrice: toDecimalString(price),
              lineHT: toDecimalString(lineHT),
              taxRateId: product.taxRateId,
              lineTVA: toDecimalString(lineTVA),
              lineTTC: withInvoice ? toDecimalString(roundMoney(lineHT + lineTVA)) : toDecimalString(lineHT),
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

export async function cancelOrder(id: string, reason?: string | null) {
  const warehouseId = await getDefaultWarehouseId()
  return db.$transaction(async (tx) => {
    const order = await tx.onlineOrder.findUnique({ where: { id }, include: { items: true } })
    if (!order) throw new Error('Commande introuvable')
    const locked: OnlineOrderStatus[] = [OnlineOrderStatus.DELIVERED, OnlineOrderStatus.CANCELLED, OnlineOrderStatus.REFUNDED]
    if (locked.includes(order.status)) {
      throw new Error('La commande ne peut plus être annulée')
    }

    for (const item of order.items) {
      await releaseReservedCore(tx, {
        productId: item.productId,
        warehouseId,
        quantity: Number(item.quantity),
        type: StockMovementType.RELEASE,
        reference: order.number,
        reason: `Annulation commande ${order.number}${reason ? ` — ${reason}` : ''}`,
        userId: null,
      })
    }

    return tx.onlineOrder.update({ where: { id }, data: { status: OnlineOrderStatus.CANCELLED } })
  })
}

export async function updateOrderStatus(id: string, status: OnlineOrderStatus) {
  const order = await db.onlineOrder.update({ where: { id }, data: { status } })
  return order
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