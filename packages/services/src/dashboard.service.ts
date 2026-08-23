import { db, InvoiceStatus, OnlineOrderStatus } from '@elec/db'

// ============================================================================
// Tableau de bord — KPIs (chiffre d'affaires, produits vendus, stock critique,
// marge, commandes en attente)
// ============================================================================

export async function getDashboardKpis() {
  const [invoices, orders, stockAlerts, lowStockCount, topProducts] = await Promise.all([
    db.invoice.findMany({
      where: { status: { in: [InvoiceStatus.VALIDATED, InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID] } },
      include: { items: true },
    }),
    db.onlineOrder.findMany({ where: { status: { notIn: [OnlineOrderStatus.CANCELLED, OnlineOrderStatus.REFUNDED] } } }),
    db.stockLevel.findMany({ include: { product: true } }),
    db.stockLevel.count(),
    db.invoiceItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true, lineHT: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
  ])

  const revenue = invoices.reduce((sum, inv) => sum + Number(inv.totalTTC), 0)
  const collected = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0)
  const salesHT = invoices.reduce((sum, inv) => sum + Number(inv.totalHT), 0)

  const pendingOrders = orders.filter((o) => o.status === OnlineOrderStatus.PENDING).length
  const confirmedOrders = orders.length

  const criticalStock = stockAlerts.filter((l) => {
    const available = Number(l.quantity) - Number(l.reservedQuantity)
    return Number(l.product.minStockAlert) > 0 && available < Number(l.product.minStockAlert)
  })

  const warehouseCount = await db.warehouse.count()
  const customerCount = await db.customer.count()

  const topProductIds = topProducts.map((t) => t.productId).filter((id): id is string => id !== null)
  const topProductsDetail =
    topProductIds.length > 0
      ? await db.product.findMany({
          where: { id: { in: topProductIds } },
          include: { category: true },
        })
      : []

  const topSelling = topProducts
    .map((t) => {
      const product = topProductsDetail.find((p) => p.id === t.productId)
      return {
        productId: t.productId,
        sku: product?.sku ?? t.productId,
        name: product?.name ?? '—',
        quantity: Number(t._sum.quantity ?? 0),
        salesHT: Number(t._sum.lineHT ?? 0),
      }
    })
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)

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

/** Marge moyenne pondérée sur les factures validées (si coût renseigné). */
export async function getMarginKpi() {
  const invoices = await db.invoice.findMany({
    where: { status: { in: [InvoiceStatus.VALIDATED, InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID] } },
    include: { items: { include: { product: true } } },
  })
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
  const marginRate = totalHT > 0 ? ((totalHT - totalCost) / totalHT) * 100 : 0
  return { totalCost, totalHT, marginRate: Math.round(marginRate * 100) / 100 }
}