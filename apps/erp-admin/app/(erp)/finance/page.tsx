import { db, InvoiceStatus } from '@elec/db'
import { PageHeader, Card, CardHeader, Badge, Table, THead, TR, TH, TD } from '@/components/ui'
import { RevenueChart } from '@/components/charts/revenue-chart'
import { money } from '@/lib/utils'
import { Wallet, TrendingUp, ArrowDownLeft, ArrowUpRight, Landmark, Receipt, PackageSearch } from 'lucide-react'

export const dynamic = 'force-dynamic'

function KpiCard({
  label,
  value,
  sub,
  icon,
  tone = 'brand',
}: {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  tone?: 'brand' | 'green' | 'red' | 'amber'
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
  }
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold text-brand-950">{value}</p>
          {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</div>
      </div>
    </Card>
  )
}

export default async function FinancePage() {
  const [invoices, creditNotes, purchaseOrders] = await Promise.all([
    db.invoice.findMany({
      where: { status: { in: [InvoiceStatus.VALIDATED, InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID] } },
      include: { customer: true },
    }),
    db.creditNote.findMany({ where: { status: 'VALIDATED' } }),
    db.purchaseOrder.findMany({ where: { status: { in: ['RECEIVED', 'PARTIALLY_RECEIVED', 'SENT'] } } }),
  ])

  const revenue = invoices.reduce((s, i) => s + Number(i.totalTTC), 0)
  const collected = invoices.reduce((s, i) => s + Number(i.paidAmount), 0)
  const receivable = Math.max(0, revenue - collected)
  const tvaCollected = invoices.reduce((s, i) => s + Number(i.totalTVA), 0)
  const salesHT = invoices.reduce((s, i) => s + Number(i.totalHT), 0)
  const credits = creditNotes.reduce((s, n) => s + Number(n.totalTTC), 0)
  const purchases = purchaseOrders.reduce((s, p) => s + Number(p.totalTTC), 0)

  const monthKeys = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - (5 - i), 1)
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('fr-FR', { month: 'short' }) }
  })
  const monthly = monthKeys.map((m) => ({
    month: m.label,
    revenue: invoices
      .filter((i) => `${i.issueDate.getFullYear()}-${i.issueDate.getMonth()}` === m.key)
      .reduce((s, i) => s + Number(i.totalTTC), 0),
  }))

  const vatTotal: Record<string, number> = {}
  for (const inv of invoices) {
    if (inv.vatBreakdown && typeof inv.vatBreakdown === 'object') {
      for (const [rate, tva] of Object.entries(inv.vatBreakdown as Record<string, unknown>)) {
        vatTotal[rate] = (vatTotal[rate] ?? 0) + Number(tva)
      }
    }
  }

  const topCustomers = invoices
    .reduce<Record<string, { name: string; total: number }>>((acc, i) => {
      const name = i.customer.companyName || [i.customer.firstName, i.customer.lastName].filter(Boolean).join(' ') || 'Client'
      acc[i.customerId] = { name, total: (acc[i.customerId]?.total ?? 0) + Number(i.totalTTC) }
      return acc
    }, {})
  const topList = Object.values(topCustomers).sort((a, b) => b.total - a.total).slice(0, 5)

  const marginRate = salesHT > 0 ? Math.round(((salesHT - purchases) / salesHT) * 1000) / 10 : 0

  return (
    <div className="space-y-6">
      <PageHeader title="Finance" description="Synthèse financière : entrées, charges, TVA et créances." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Chiffre d'affaires TTC" value={money(revenue)} sub={`${money(salesHT)} HT`} icon={<TrendingUp className="h-5 w-5" />} />
        <KpiCard label="Encaissé" value={money(collected)} sub={`Taux d'encaissement ${salesHT > 0 ? Math.round((collected / revenue) * 100) : 0}%`} icon={<Wallet className="h-5 w-5" />} tone="green" />
        <KpiCard label="Créances clients" value={money(receivable)} sub="Factures validées non encaissées" icon={<ArrowDownLeft className="h-5 w-5" />} tone="amber" />
        <KpiCard label="TVA collectée" value={money(tvaCollected)} sub="À reverser à la recette" icon={<Landmark className="h-5 w-5" />} />
        <KpiCard label="Charges (achats)" value={money(purchases)} sub={`Marge brute estimée ${marginRate}%`} icon={<PackageSearch className="h-5 w-5" />} tone="red" />
        <KpiCard label="Avoirs émis" value={`− ${money(credits)}`} sub="Retours validés" icon={<Receipt className="h-5 w-5" />} tone="red" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Chiffre d'affaires mensuel" subtitle="6 derniers mois (factures validées)" />
          <div className="p-5">
            <RevenueChart data={monthly} />
          </div>
        </Card>

        <Card>
          <CardHeader title="TVA par taux" />
          <div className="p-5">
            {Object.entries(vatTotal).length === 0 ? (
              <p className="text-sm text-slate-400">Aucune donnée</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {Object.entries(vatTotal)
                  .sort((a, b) => Number(b[0]) - Number(a[0]))
                  .map(([rate, tva]) => (
                    <li key={rate} className="flex items-center justify-between">
                      <Badge tone="blue">TVA {rate}%</Badge>
                      <span className="font-semibold">{money(tva)}</span>
                    </li>
                  ))}
                <li className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-slate-500">Total TVA</span>
                  <span className="font-bold text-brand-900">{money(tvaCollected)}</span>
                </li>
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Meilleurs clients" subtitle="Top 5 par chiffre d'affaires" />
        <Table>
          <THead>
            <TR>
              <TH>Client</TH>
              <TH className="text-right">Chiffre d'affaires TTC</TH>
              <TH className="text-right">Part</TH>
            </TR>
          </THead>
          <tbody>
            {topList.map((c, i) => (
              <TR key={c.name}>
                <TD className="font-medium text-slate-900">
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{i + 1}</span>
                  {c.name}
                </TD>
                <TD className="text-right font-semibold">{money(c.total)}</TD>
                <TD className="text-right text-slate-500">{revenue > 0 ? Math.round((c.total / revenue) * 100) : 0}%</TD>
              </TR>
            ))}
            {topList.length === 0 ? (
              <TR>
                <TD colSpan={3} className="py-12 text-center text-slate-400">Aucune vente</TD>
              </TR>
            ) : null}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}