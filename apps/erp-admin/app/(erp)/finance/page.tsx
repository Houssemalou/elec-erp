import { PageHeader, Card, CardHeader, Badge, Table, THead, TR, TH, TD } from '@/components/ui'
import { RevenueChart } from '@/components/charts/revenue-chart'
import { getFinanceSummary } from '@elec/services'
import { money } from '@/lib/utils'
import { Wallet, TrendingUp, ArrowDownLeft, ArrowUpRight, Receipt, PackageSearch, PiggyBank, Percent } from 'lucide-react'

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
    brand: 'bg-accent-400/10 text-accent-400',
    green: 'bg-emerald-500/10 text-emerald-400',
    red: 'bg-red-500/10 text-red-400',
    amber: 'bg-amber-500/10 text-amber-400',
  }
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-white/50">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold text-white">{value}</p>
          {sub ? <p className="mt-1 text-xs text-white/50">{sub}</p> : null}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</div>
      </div>
    </Card>
  )
}

export default async function FinancePage() {
  const s = await getFinanceSummary()

  const collectionRate = s.revenueTTC > 0 ? Math.round((s.collectedTTC / s.revenueTTC) * 100) : 0
  const gainTone = s.gainTTC >= 0 ? 'green' : 'red'
  const expenseShare = s.revenueTTC > 0 ? Math.round((s.expensesTTC / s.revenueTTC) * 100) : 0
  const maxCategory = Math.max(...s.expensesByCategory.map((c) => c.amountTTC), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        description="Synthèse financière TTC : chiffre d'affaires, charges, gain et créances."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Chiffre d'affaires TTC"
          value={money(s.revenueTTC)}
          sub="Factures et ventes en caisse validées"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <KpiCard
          label="Gain TTC"
          value={money(s.gainTTC)}
          sub={`${s.gainRate.toFixed(1)} % du CA · après ${money(s.expensesTTC)} de dépenses`}
          icon={<Percent className="h-5 w-5" />}
          tone={gainTone}
        />
        <KpiCard
          label="Encaissé TTC"
          value={money(s.collectedTTC)}
          sub={`Taux d'encaissement ${collectionRate}%`}
          icon={<Wallet className="h-5 w-5" />}
          tone="green"
        />
        <KpiCard
          label="Créances clients"
          value={money(s.receivableTTC)}
          sub="Factures validées non encaissées"
          icon={<ArrowDownLeft className="h-5 w-5" />}
          tone="amber"
        />
        <KpiCard
          label="Achats TTC"
          value={money(s.purchasesTTC)}
          sub="Factures d'achat validées"
          icon={<PackageSearch className="h-5 w-5" />}
          tone="red"
        />
        <KpiCard
          label="Dépenses TTC"
          value={money(s.expensesTTC)}
          sub={`${expenseShare}% du CA · ${s.expensesByCategory.length} catégorie(s)`}
          icon={<ArrowUpRight className="h-5 w-5" />}
          tone="red"
        />
        <KpiCard
          label="Avoirs émis"
          value={`− ${money(s.creditsTTC)}`}
          sub="Retours validés"
          icon={<Receipt className="h-5 w-5" />}
          tone="red"
        />
        <KpiCard
          label="Coût de revient TTC"
          value={money(s.costOfGoodsTTC)}
          sub={
            s.missingCostLines > 0
              ? `${s.missingCostLines} ligne(s) sans coût renseigné`
              : 'Coût des articles vendus'
          }
          icon={<PiggyBank className="h-5 w-5" />}
          tone="amber"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Chiffre d'affaires mensuel"
            subtitle="6 derniers mois (TTC, factures et ventes en caisse validées)"
          />
          <div className="p-5">
            <RevenueChart data={s.monthly} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Dépenses par catégorie" subtitle="Répartition des charges saisies" />
          <div className="p-5">
            {s.expensesByCategory.length === 0 ? (
              <p className="text-sm text-white/40">Aucune dépense enregistrée</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {s.expensesByCategory.map((c) => (
                  <li key={c.category}>
                    <div className="mb-1 flex items-center justify-between">
                      <Badge tone="blue">{c.label}</Badge>
                      <span className="font-semibold text-white">{money(c.amountTTC)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#222222]">
                      <div
                        className="h-full rounded-full bg-accent-400/70"
                        style={{ width: `${maxCategory > 0 ? (c.amountTTC / maxCategory) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-white/40">{c.count} dépense(s)</p>
                  </li>
                ))}
                <li className="flex items-center justify-between border-t border-[#2A2A2A] pt-3">
                  <span className="text-white/50">Total</span>
                  <span className="font-bold text-accent-400">{money(s.expensesTTC)}</span>
                </li>
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Meilleurs clients" subtitle="Top 5 par chiffre d'affaires TTC" />
        <Table>
          <THead>
            <TR>
              <TH>Client</TH>
              <TH className="text-right">Chiffre d'affaires TTC</TH>
              <TH className="text-right">Part</TH>
            </TR>
          </THead>
          <tbody>
            {s.topCustomers.map((c, i) => (
              <TR key={c.name}>
                <TD className="font-medium text-white">
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-400/10 text-xs font-semibold text-accent-400">
                    {i + 1}
                  </span>
                  {c.name}
                </TD>
                <TD className="text-right font-semibold text-white">{money(c.total)}</TD>
                <TD className="text-right text-white/50">{c.share}%</TD>
              </TR>
            ))}
            {s.topCustomers.length === 0 ? (
              <TR>
                <TD colSpan={3} className="py-12 text-center text-white/40">
                  Aucune vente
                </TD>
              </TR>
            ) : null}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
