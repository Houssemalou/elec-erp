import { getDashboardKpis, getMarginKpi } from '@elec/services'
import { db } from '@elec/db'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import {
  PageHeader,
  Card,
  CardHeader,
  Badge,
  Table,
  THead,
  TR,
  TH,
  TD,
} from '@/components/ui'
import { RevenueChart } from '@/components/charts/revenue-chart'
import { TopProductsChart } from '@/components/charts/top-products-chart'
import { money, formatDate, STATUS_LABELS } from '@/lib/utils'
import { Wallet, TrendingUp, PackageX, ShoppingBag, Percent, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

function KpiCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-white/50">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold text-white">{value}</p>
          {sub ? <p className="mt-1 text-xs text-white/50">{sub}</p> : null}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-400/10 text-accent-400">
          {icon}
        </div>
      </div>
    </Card>
  )
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const [kpis, margin] = await Promise.all([getDashboardKpis(), getMarginKpi()])

  const monthKeys = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - (5 - i), 1)
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString('fr-FR', { month: 'short' }),
    }
  })
  const monthlyMap = new Map(monthKeys.map((m) => [m.key, 0]))
  const invoices = await db.invoice.findMany({
    where: { validatedAt: { not: null } },
    select: { totalTTC: true, validatedAt: true },
  })
  for (const inv of invoices) {
    const d = inv.validatedAt as Date
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (monthlyMap.has(key)) monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + Number(inv.totalTTC))
  }
  const revenueSeries = monthKeys.map((m) => ({
    month: m.label,
    revenue: Math.round((monthlyMap.get(m.key) ?? 0) * 100) / 100,
  }))

  return (
    <div>
      <PageHeader
        title={`Bonjour, ${session.user.name ?? 'utilisateur'}`}
        description="Voici l'activité de votre magasin aujourd'hui."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Chiffre d'affaires"
          value={money(kpis.revenue)}
          sub={`${kpis.confirmedOrders} commandes`}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <KpiCard label="Encaissé" value={money(kpis.collected)} icon={<Wallet className="h-5 w-5" />} />
        <KpiCard
          label="Commandes en attente"
          value={String(kpis.pendingOrders)}
          icon={<ShoppingBag className="h-5 w-5" />}
        />
        <KpiCard
          label="Stock critique"
          value={String(kpis.criticalStockCount)}
          sub="sous le seuil d'alerte"
          icon={<PackageX className="h-5 w-5" />}
        />
        <KpiCard
          label="Marge"
          value={`${margin.marginRate.toFixed(1)} %`}
          sub={`Coût total : ${money(margin.totalCost)}`}
          icon={<Percent className="h-5 w-5" />}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Chiffre d'affaires (6 derniers mois)" subtitle="Factures validées" />
          <div className="p-5">
            <RevenueChart data={revenueSeries} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Produits les plus vendus" subtitle="Par quantité" />
          <div className="p-5">
            <TopProductsChart data={kpis.topSelling.map((p) => ({ name: p.name, quantity: p.quantity }))} />
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Dernières commandes en ligne"
            action={
              <Link href="/commandes" className="flex items-center gap-1 text-xs font-medium text-accent-400 hover:text-accent-300">
                Tout voir <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <Table>
            <THead>
              <TR>
                <TH>N°</TH>
                <TH>Client</TH>
                <TH>Montant</TH>
                <TH>Statut</TH>
              </TR>
            </THead>
            <tbody>
              {kpis.recentOrders.map((o) => (
                <TR key={o.id}>
                  <TD className="font-medium text-white">{o.number}</TD>
                  <TD className="text-white/70">{o.shippingFullName}</TD>
                  <TD className="text-white/70">{money(o.totalTTC)}</TD>
                  <TD>
                    <Badge tone="blue">{STATUS_LABELS[o.status] ?? o.status}</Badge>
                  </TD>
                </TR>
              ))}
              {kpis.recentOrders.length === 0 ? (
                <TR>
                  <TD colSpan={4} className="py-8 text-center text-white/40">Aucune commande</TD>
                </TR>
              ) : null}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader
            title="Dernières factures"
            action={
              <Link href="/factures" className="flex items-center gap-1 text-xs font-medium text-accent-400 hover:text-accent-300">
                Tout voir <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <Table>
            <THead>
              <TR>
                <TH>N°</TH>
                <TH>Date</TH>
                <TH>Montant</TH>
                <TH>Statut</TH>
              </TR>
            </THead>
            <tbody>
              {kpis.recentInvoices.map((inv) => (
                <TR key={inv.id}>
                  <TD className="font-medium text-white">{inv.number}</TD>
                  <TD className="text-white/70">{formatDate(inv.issueDate)}</TD>
                  <TD className="text-white/70">{money(inv.totalTTC)}</TD>
                  <TD>
                    <Badge tone="green">{STATUS_LABELS[inv.status] ?? inv.status}</Badge>
                  </TD>
                </TR>
              ))}
              {kpis.recentInvoices.length === 0 ? (
                <TR>
                  <TD colSpan={4} className="py-8 text-center text-white/40">Aucune facture</TD>
                </TR>
              ) : null}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
