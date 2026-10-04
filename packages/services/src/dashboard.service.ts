import { db, InvoiceStatus, OnlineOrderStatus } from '@elec/db'
import {
  getCostOfGoodsTTC,
  REVENUE_STATUSES as REVENUE_STATUSES_REF,
  CASH_SALES_WITHOUT_INVOICE as CASH_SALES_WITHOUT_INVOICE_REF,
} from './finance.service'

// ============================================================================
// Tableau de bord — KPIs (chiffre d'affaires, produits vendus, stock critique,
// marge, commandes en attente)
// ============================================================================

// Les critères de chiffre d'affaires sont définis une seule fois dans le
// service finance, qui en est la source de vérité : le tableau de bord et
// l'onglet Finance doivent compter exactement les mêmes ventes.
const REVENUE_STATUSES = REVENUE_STATUSES_REF
const CASH_SALES_WITHOUT_INVOICE = CASH_SALES_WITHOUT_INVOICE_REF

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
  // Les totaux sont affichés en TTC partout dans l'onglet Finance : la carte
  // « CA » n'expose plus de sous-titre HT, qui mélangeait deux bases.
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
 * Marge brute sur le chiffre d'affaires TTC.
 *
 * Le coût de revient est ramené en TTC par `getCostOfGoodsTTC` (coût produit HT
 * × taux de la ligne), ce qui rend le gain comparable au chiffre d'affaires
 * affiché. Les ventes en caisse sans facture sont incluses : leur TTC est une
 * vente réelle, les exclure gonflerait le taux de marge.
 */
export async function getMarginKpi() {
  const [invoices, cashSales, cost] = await Promise.all([
    db.invoice.findMany({ where: { status: { in: [...REVENUE_STATUSES] } }, select: { totalTTC: true } }),
    db.deliveryNote.findMany({ where: CASH_SALES_WITHOUT_INVOICE, select: { totalTTC: true } }),
    getCostOfGoodsTTC(),
  ])
  const revenueTTC =
    invoices.reduce((s, i) => s + Number(i.totalTTC), 0) +
    cashSales.reduce((s, p) => s + Number(p.totalTTC), 0)
  const gainTTC = revenueTTC - cost.costTTC
  const marginRate = revenueTTC > 0 ? (gainTTC / revenueTTC) * 100 : 0
  return {
    totalCost: cost.costTTC,
    revenueTTC,
    gainTTC: Math.round(gainTTC * 1000) / 1000,
    marginRate: Math.round(marginRate * 100) / 100,
    missingCostLines: cost.missingCostLines,
  }
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
