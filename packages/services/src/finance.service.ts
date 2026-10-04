import { db, InvoiceStatus, PurchaseInvoiceStatus, CreditNoteStatus, DeliveryNoteStatus } from '@elec/db'
import { getExpenseSummary } from './expense.service'

// ============================================================================
// Finance — chiffres clés de l'onglet Finance
//
// L'entreprise n'est pas assujettie à la TVA : tous les montants affichés sont
// en TTC (ce que le client paie, ce que le fournisseur facture, ce que la
// dépense coûte). Aucun montant de TVA collectée ou déductible n'est calculé.
// ============================================================================

/** États de facture qui comptent dans le chiffre d'affaires. */
export const REVENUE_STATUSES = [
  InvoiceStatus.VALIDATED,
  InvoiceStatus.PAID,
  InvoiceStatus.PARTIALLY_PAID,
] as const

/**
 * Ventes en caisse SANS facture.
 *
 * Une vente POS crée TOUJOURS un bon de livraison ; la facture n'est créée que
 * si le client la demande. Les tableaux de bord ne lisaient que les factures :
 * une vente en caisse sans facture était donc invisible du chiffre d'affaires
 * alors qu'elle sort réellement de stock et est encaissée.
 *
 * On ne retient que les BL sans facture liée (`invoiceId: null`) pour ne pas
 * compter deux fois les ventes qui ont, elles, une facture déjà prise en compte.
 */
export const CASH_SALES_WITHOUT_INVOICE = {
  source: 'POS',
  status: DeliveryNoteStatus.VALIDATED,
  invoiceId: null,
} as const

/**
 * Coût de revient TTC des articles vendus.
 *
 * `Product.costPrice` est un coût HT (déduit du prix d'achat TTC saisi) : il
 * est reconverti en TTC au taux de la ligne vendue avant d'être déduit du
 * chiffre d'affaires, pour que gain et chiffre d'affaires soient tous deux en
 * TTC. Les articles sans coût de revient renseigné ne sont pas comptés, le
 * résultat indique alors que la marge est partielle.
 */
export async function getCostOfGoodsTTC(): Promise<{ costTTC: number; missingCostLines: number }> {
  const [invoiceLines, cashLines] = await Promise.all([
    db.invoiceItem.findMany({
      where: { invoice: { status: { in: [...REVENUE_STATUSES] } } },
      select: {
        quantity: true,
        lineTTC: true,
        taxRate: { select: { rate: true } },
        product: { select: { costPrice: true } },
      },
    }),
    db.deliveryNoteItem.findMany({
      where: { deliveryNote: CASH_SALES_WITHOUT_INVOICE },
      select: {
        quantity: true,
        lineTTC: true,
        taxRate: { select: { rate: true } },
        product: { select: { costPrice: true } },
      },
    }),
  ])

  let costTTC = 0
  let missingCostLines = 0
  for (const line of [...invoiceLines, ...cashLines]) {
    const costHT = line.product?.costPrice
    if (costHT === null || costHT === undefined) {
      missingCostLines += 1
      continue
    }
    const factor = 1 + Number(line.taxRate.rate) / 100
    costTTC += Number(costHT) * Number(line.quantity) * factor
  }
  return { costTTC: Math.round(costTTC * 1000) / 1000, missingCostLines }
}

export interface FinanceSummary {
  /** Chiffre d'affaires TTC (factures + ventes en caisse sans facture). */
  revenueTTC: number
  /** Encaissé TTC. Une vente en caisse est encaissée comptant. */
  collectedTTC: number
  /** Factures validées non encaissées. */
  receivableTTC: number
  /** Achats TTC (factures d'achat validées). */
  purchasesTTC: number
  /** Avoirs TTC émis. */
  creditsTTC: number
  /** Dépenses TTC saisies. */
  expensesTTC: number
  /** Dépenses TTC par catégorie, de la plus élevée à la plus faible. */
  expensesByCategory: Array<{ category: string; label: string; amountTTC: number; count: number }>
  /** Coût de revient TTC des articles vendus. */
  costOfGoodsTTC: number
  /** Lignes vendues sans coût de revient renseigné. */
  missingCostLines: number
  /** Gain TTC = CA TTC − coût de revient TTC − dépenses TTC. */
  gainTTC: number
  /** Taux de marge sur le CA, en pourcentage. */
  gainRate: number
  /** Série mensuelle du CA TTC sur les 6 derniers mois. */
  monthly: Array<{ month: string; revenue: number }>
  /** Meilleurs clients par CA TTC. */
  topCustomers: Array<{ name: string; total: number; share: number }>
}

export async function getFinanceSummary(options?: {
  months?: number
  from?: Date
  to?: Date
}): Promise<FinanceSummary> {
  const [invoices, cashSales, creditNotes, purchaseInvoices, expenseSummary, cost] = await Promise.all([
    db.invoice.findMany({
      where: { status: { in: [...REVENUE_STATUSES] } },
      include: { customer: true },
    }),
    db.deliveryNote.findMany({
      where: CASH_SALES_WITHOUT_INVOICE,
      select: { totalTTC: true, validatedAt: true, issueDate: true },
    }),
    db.creditNote.findMany({ where: { status: CreditNoteStatus.VALIDATED } }),
    db.purchaseInvoice.findMany({ where: { status: PurchaseInvoiceStatus.VALIDATED } }),
    getExpenseSummary({ from: options?.from, to: options?.to }),
    getCostOfGoodsTTC(),
  ])

  const revenueTTC =
    invoices.reduce((s, i) => s + Number(i.totalTTC), 0) +
    cashSales.reduce((s, p) => s + Number(p.totalTTC), 0)
  const collectedTTC =
    invoices.reduce((s, i) => s + Number(i.paidAmount), 0) +
    cashSales.reduce((s, p) => s + Number(p.totalTTC), 0)

  const purchasesTTC = purchaseInvoices.reduce((s, p) => s + Number(p.totalTTC), 0)
  const creditsTTC = creditNotes.reduce((s, n) => s + Number(n.totalTTC), 0)
  const expensesTTC = expenseSummary.totalTTC

  const gainTTC = revenueTTC - cost.costTTC - expensesTTC
  const gainRate = revenueTTC > 0 ? (gainTTC / revenueTTC) * 100 : 0

  // Série mensuelle : factures datées d'émission, BL datés de validation.
  const months = options?.months ?? 6
  const monthKeys: Array<{ key: string; label: string }> = []
  const now = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthKeys.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString('fr-FR', { month: 'short' }),
    })
  }
  const monthlyMap = new Map(monthKeys.map((m) => [m.key, 0]))
  const addMonth = (total: unknown, date: Date | null) => {
    if (!date) return
    const key = `${date.getFullYear()}-${date.getMonth()}`
    if (monthlyMap.has(key)) monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + Number(total))
  }
  for (const inv of invoices) addMonth(inv.totalTTC, inv.validatedAt ?? inv.issueDate)
  for (const sale of cashSales) addMonth(sale.totalTTC, sale.validatedAt ?? sale.issueDate)
  const monthly = monthKeys.map((m) => ({ month: m.label, revenue: round3(monthlyMap.get(m.key) ?? 0) }))

  // Meilleurs clients : les ventes en caisse sans facture n'ont pas de client
  // identifié, elles sont donc exclues de ce classement.
  const byCustomer = invoices.reduce<Record<string, { name: string; total: number }>>((acc, inv) => {
    const name =
      inv.customerName ||
      (inv.customer
        ? inv.customer.companyName || [inv.customer.firstName, inv.customer.lastName].filter(Boolean).join(' ')
        : null) ||
      'Client'
    const key = inv.customerId ?? `free|${name}`
    acc[key] = { name, total: (acc[key]?.total ?? 0) + Number(inv.totalTTC) }
    return acc
  }, {})
  const topCustomers = Object.values(byCustomer)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((c) => ({ ...c, share: revenueTTC > 0 ? Math.round((c.total / revenueTTC) * 100) : 0 }))

  return {
    revenueTTC,
    collectedTTC,
    receivableTTC: Math.max(0, revenueTTC - collectedTTC),
    purchasesTTC,
    creditsTTC,
    expensesTTC,
    expensesByCategory: expenseSummary.categories,
    costOfGoodsTTC: cost.costTTC,
    missingCostLines: cost.missingCostLines,
    gainTTC,
    gainRate: round3(gainRate),
    monthly,
    topCustomers,
  }
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}
