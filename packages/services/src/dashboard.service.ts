import { db, InvoiceStatus, OnlineOrderStatus } from '@elec/db'

// ============================================================================
// Tableau de bord — KPIs (chiffre d'affaires, produits vendus, stock critique,
// marge, commandes en attente)
// ============================================================================

const REVENUE_STATUSES = [
  InvoiceStatus.VALIDATED,
  InvoiceStatus.PAID,
  InvoiceStatus.PARTIALLY_PAID,
] as const

/**
 * Ventes en caisse SANS facture.
 *
 * Une vente POS crée TOUJOURS un bon de livraison ; la facture n'est créée que
 * si le client la demande. Les dashboards ne lisaient que `invoices` : une vente
 * en caisse sans facture était donc invisible du chiffre d'affaires alors
 * qu'elle sort réellement de stock et est encaissée.
 *
 * On ne retient que les BL sans facture liée (`invoiceId: null`) pour ne pas
 * compter deux fois les ventes qui ont, elles, une facture déjà prise en compte.
 */
const CASH_SALES_WITHOUT_INVOICE = {
  source: 'POS',
  status: 'VALIDATED',
  invoiceId: null,
} as const

export async function getDashboardKpis() {
  const [invoices, cashSales, orders, stockAlerts, lowStockCount, topProducts, topCashItems] = await Promise.all([
    db.invoice.findMany({
      where: { status: { in: [...REVENUE_STATUSES] } },
      include: { items: true },
    }),
    db.deliveryNote.findMany({
      where: CASH_SALES_WITHOUT_INVOICE,
      select: { totalHT: true, totalTTC: true },
    }),
    db.onlineOrder.findMany({ where: { status: { notIn: [OnlineOrderStatus.CANCELLED, OnlineOrderStatus.REFUNDED] } } }),
    db.stockLevel.findMany({ include: { product: true } }),
    db.stockLevel.count(),
    // Uniquement les factures qui comptent réellement au chiffre d'affaires :
    // une facture annulée ne doit plus apparaître dans les meilleures ventes.
    db.invoiceItem.groupBy({
      by: ['productId'],
      where: { invoice: { status: { in: [...REVENUE_STATUSES] } } },
      _sum: { quantity: true, lineHT: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
    // Mêmes agrégats sur les ventes en caisse sans facture, pour que le
    // classement des produits soldés ne soit pas amputé de la caisse.
    // `delivery_note_items` n'a pas de `lineHT` : le HT ligne se déduit du
    // PU HT du snapshot, comme le fait l'impression du BL.
    db.deliveryNoteItem.groupBy({
      by: ['productId'],
      where: { deliveryNote: CASH_SALES_WITHOUT_INVOICE },
      _sum: { quantity: true, unitPriceHT: true },
    }),
  ])

  const revenue =
    invoices.reduce((sum, inv) => sum + Number(inv.totalTTC), 0) +
    cashSales.reduce((sum, sale) => sum + Number(sale.totalTTC), 0)
  // Une vente en caisse est encaissée comptant : le BL n'a pas de `paidAmount`,
  // son TTC est donc l'encaissé du jour.
  const collected =
    invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0) +
    cashSales.reduce((sum, sale) => sum + Number(sale.totalTTC), 0)
  const salesHT =
    invoices.reduce((sum, inv) => sum + Number(inv.totalHT), 0) +
    cashSales.reduce((sum, sale) => sum + Number(sale.totalHT), 0)

  const pendingOrders = orders.filter((o) => o.status === OnlineOrderStatus.PENDING).length
  const confirmedOrders = orders.length

  const criticalStock = stockAlerts.filter((l) => {
    const available = Number(l.quantity) - Number(l.reservedQuantity)
    return Number(l.product.minStockAlert) > 0 && available < Number(l.product.minStockAlert)
  })

  const warehouseCount = await db.warehouse.count()
  const customerCount = await db.customer.count()

  // Fusion des deux sources avant le classement : une vente comptée à part
  // fausserait l'ordre (un article très vendu en caisse resterait invisible).
  const mergedSales = new Map<string, { quantity: number; salesHT: number }>()
  for (const t of [...topProducts, ...topCashItems]) {
    if (!t.productId) continue
    const entry = mergedSales.get(t.productId) ?? { quantity: 0, salesHT: 0 }
    entry.quantity += Number(t._sum.quantity ?? 0)
    // Pour les factures on a déjà le HT ligne ; pour les BL on le reconstitue.
    const lineHT = 'lineHT' in t._sum
      ? Number(t._sum.lineHT ?? 0)
      : Number(t._sum.quantity ?? 0) * Number(t._sum.unitPriceHT ?? 0)
    entry.salesHT += lineHT
    mergedSales.set(t.productId, entry)
  }
  const topRanked = [...mergedSales.entries()]
    .map(([productId, sums]) => ({ productId, ...sums }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)

  const topProductIds = topRanked.map((t) => t.productId)
  const topProductsDetail =
    topProductIds.length > 0
      ? await db.product.findMany({
          where: { id: { in: topProductIds } },
          include: { category: true },
        })
      : []

  const topSelling = topRanked.map((t) => {
    const product = topProductsDetail.find((p) => p.id === t.productId)
    return {
      productId: t.productId,
      sku: product?.sku ?? t.productId,
      name: product?.name ?? '—',
      quantity: t.quantity,
      salesHT: t.salesHT,
    }
  })

  return {
    revenue,
    collected,
    salesHT,
    margin: 0, // calculé par catégorie ci-dessous (coût fourni optionnellement)
    pendingOrders,
    confirmedOrders,
    criticalStockCount: criticalStock.length,
    lowStockCount,
    warehouseCount,
    customerCount,
    topSelling,
    recentInvoices: await db.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { customer: true },
    }),
    recentOrders: await db.onlineOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { customer: true },
    }),
  }
}

/**
 * Marge moyenne pondérée (si coût renseigné).
 *
 * Les ventes en caisse sans facture entrent aussi : leur HT est une vente
 * réelle, les exclure gonflerait le taux de marge. Le coût d'achat est pris
 * sur la fiche produit (coût actuel), comme pour les factures.
 */
export async function getMarginKpi() {
  const [invoices, cashSales] = await Promise.all([
    db.invoice.findMany({
      where: { status: { in: [...REVENUE_STATUSES] } },
      include: { items: { include: { product: true } } },
    }),
    db.deliveryNote.findMany({
      where: CASH_SALES_WITHOUT_INVOICE,
      include: { items: { include: { product: true } } },
    }),
  ])
  let totalCost = 0
  let totalHT = 0
  for (const inv of invoices) {
    totalHT += Number(inv.totalHT)
    for (const item of inv.items) {
      if (item.product?.costPrice) {
        totalCost += Number(item.product.costPrice) * Number(item.quantity)
      }
    }
  }
  for (const sale of cashSales) {
    totalHT += Number(sale.totalHT)
    for (const item of sale.items) {
      if (item.product?.costPrice) {
        totalCost += Number(item.product.costPrice) * Number(item.quantity)
      }
    }
  }
  const marginRate = totalHT > 0 ? ((totalHT - totalCost) / totalHT) * 100 : 0
  return { totalCost, totalHT, marginRate: Math.round(marginRate * 100) / 100 }
}

/** Série de chiffre d'affaires TTC par mois, factures + ventes en caisse. */
export async function getRevenueSeries(monthKeys: Array<{ key: string }>) {
  const monthlyMap = new Map(monthKeys.map((m) => [m.key, 0]))
  const add = (totalTTC: unknown, date: Date | null) => {
    if (!date) return
    const key = `${date.getFullYear()}-${date.getMonth()}`
    if (monthlyMap.has(key)) monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + Number(totalTTC))
  }

  const [invoices, cashSales] = await Promise.all([
    db.invoice.findMany({
      where: { validatedAt: { not: null } },
      select: { totalTTC: true, validatedAt: true },
    }),
    db.deliveryNote.findMany({
      where: CASH_SALES_WITHOUT_INVOICE,
      select: { totalTTC: true, validatedAt: true },
    }),
  ])
  for (const inv of invoices) add(inv.totalTTC, inv.validatedAt)
  for (const sale of cashSales) add(sale.totalTTC, sale.validatedAt)

  return monthlyMap
}
