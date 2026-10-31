import Link from 'next/link'
import { PageHeader, Card, CardHeader, Table, THead, TR, TH, TD, Badge } from '@/components/ui'
import { getFinanceSummary, getReceivablesOverview, listExpenses } from '@elec/services'
import { db } from '@elec/db'
import { money, formatDate, dateInputValue } from '@/lib/utils'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  TrendingUp,
  HandCoins,
  PackageSearch,
  Receipt,
  CalendarClock,
} from 'lucide-react'

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

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return undefined
  return d
}

function endOfDay(value?: string): Date | undefined {
  if (!value) return undefined
  const d = new Date(`${value}T23:59:59.999`)
  if (Number.isNaN(d.getTime())) return undefined
  return d
}

export default async function TresoreriePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const params = await searchParams
  const fromDate = parseDate(params.from)
  const toDate = endOfDay(params.to)

  const [s, receivables, purchaseInvoices, expensesRes] = await Promise.all([
    getFinanceSummary({ from: fromDate, to: toDate }),
    getReceivablesOverview(),
    db.purchaseInvoice.findMany({
      where: {
        status: 'VALIDATED',
        ...(fromDate || toDate ? { receivedAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } } : {}),
      },
      select: { totalTTC: true },
    }),
    listExpenses({ take: 50 }),
  ])

  const ventesTTC = s.revenueTTC
  const achatsTTC = s.purchasesTTC
  const depensesTTC = s.expensesTTC
  const creancesTTC = receivables.totals.remainingTTC
  const encaisséTTC = s.collectedTTC
  const avoirsTTC = s.creditsTTC
  const gainTTC = s.gainTTC

  const soldeTheorique = ventesTTC - achatsTTC - depensesTTC
  const netDisponible = encaisséTTC - achatsTTC - depensesTTC

  const expensesList = expensesRes.expenses

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trésorerie"
        description="Vue globale : ventes (CA), achats, dépenses, créances et encours. Tous les montants sont en TTC."
        actions={
          <form className="flex items-center gap-2">
            <input
              type="date"
              name="from"
              defaultValue={params.from ?? dateInputValue(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))}
              className="rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 py-2 text-sm text-white"
            />
            <input
              type="date"
              name="to"
              defaultValue={params.to ?? dateInputValue(new Date())}
              className="rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 py-2 text-sm text-white"
            />
            <button type="submit" className="rounded-lg bg-accent-400 px-3 py-2 text-sm font-medium text-black hover:bg-accent-300">
              Appliquer
            </button>
          </form>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Ventes / CA TTC" value={money(ventesTTC)} sub="Factures et ventes en caisse validées" icon={<TrendingUp className="h-5 w-5" />} tone="brand" />
        <KpiCard label="Encaissé TTC" value={money(encaisséTTC)} sub="Règlements reçus" icon={<ArrowDownCircle className="h-5 w-5" />} tone="green" />
        <KpiCard label="Achats TTC" value={money(achatsTTC)} sub="Factures d'achat validées" icon={<PackageSearch className="h-5 w-5" />} tone="red" />
        <KpiCard label="Dépenses TTC" value={money(depensesTTC)} sub="Charges saisies" icon={<ArrowUpCircle className="h-5 w-5" />} tone="red" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Créances clients (encours)" value={money(creancesTTC)} sub="Factures et créances libres non soldées" icon={<HandCoins className="h-5 w-5" />} tone="amber" />
        <KpiCard label="Avoirs émis TTC" value={`− ${money(avoirsTTC)}`} sub="Retours validés" icon={<Receipt className="h-5 w-5" />} tone="red" />
        <KpiCard label="Gain / Résultat TTC" value={money(gainTTC)} sub="CA − coût de revient − dépenses" icon={<Wallet className="h-5 w-5" />} tone={gainTTC >= 0 ? 'green' : 'red'} />
        <KpiCard label="Solde théorique (CA − achats − dépenses)" value={money(soldeTheorique)} sub="Hors encaissement effectif" icon={<Wallet className="h-5 w-5" />} tone={soldeTheorique >= 0 ? 'green' : 'red'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Mouvements par type" subtitle="Synthèse sur la période sélectionnée" />
          <Table>
            <THead>
              <TR>
                <TH>Rubrique</TH>
                <TH className="text-right">Montant TTC</TH>
                <TH className="text-right">Détail</TH>
              </TR>
            </THead>
            <tbody>
              <TR>
                <TD className="font-medium text-white">Entrées - Ventes (CA)</TD>
                <TD className="text-right font-semibold text-emerald-400">+{money(ventesTTC)}</TD>
                <TD className="text-right text-white/50">Factures + ventes en caisse</TD>
              </TR>
              <TR>
                <TD className="font-medium text-white">Entrées - Encaissé</TD>
                <TD className="text-right font-semibold text-emerald-400">+{money(encaisséTTC)}</TD>
                <TD className="text-right text-white/50">Règlements reçus (espèces/carte/virement/chèque)</TD>
              </TR>
              <TR>
                <TD className="font-medium text-white">Sorties - Achats</TD>
                <TD className="text-right font-semibold text-red-400">−{money(achatsTTC)}</TD>
                <TD className="text-right text-white/50">Factures d'achat validées</TD>
              </TR>
              <TR>
                <TD className="font-medium text-white">Sorties - Dépenses</TD>
                <TD className="text-right font-semibold text-red-400">−{money(depensesTTC)}</TD>
                <TD className="text-right text-white/50">Charges hors achats</TD>
              </TR>
              <TR>
                <TD className="font-medium text-white">En-cours - Créances clients</TD>
                <TD className="text-right font-semibold text-amber-400">{money(creancesTTC)}</TD>
                <TD className="text-right text-white/50">À encaisser</TD>
              </TR>
            </tbody>
          </Table>
          <div className="border-t border-[#2A2A2A] p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Disponible net (encaissé − achats − dépenses)</span>
              <span className={`font-semibold ${netDisponible >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{money(netDisponible)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-white/60">Solde théorique (CA − achats − dépenses)</span>
              <span className={`font-semibold ${soldeTheorique >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{money(soldeTheorique)}</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Créances clients"
            subtitle="Détail par client (factures + créances libres)"
            action={
              <Link href="/creances" className="text-xs text-accent-400 hover:text-accent-300">
                Gérer
              </Link>
            }
          />
          <Table>
            <THead>
              <TR>
                <TH>Client</TH>
                <TH className="text-center">Factures</TH>
                <TH className="text-center">Créances</TH>
                <TH className="text-right">Reste dû TTC</TH>
                <TH className="text-right">Échu</TH>
              </TR>
            </THead>
            <tbody>
              {receivables.byCustomer.slice(0, 10).map((c) => (
                <TR key={c.name}>
                  <TD className="font-medium text-white">{c.name}</TD>
                  <TD className="text-center text-white/60">{c.invoices}</TD>
                  <TD className="text-center text-white/60">{c.receivables}</TD>
                  <TD className="text-right font-semibold text-white">{money(c.remaining)}</TD>
                  <TD className="text-right text-red-400">{c.overdueTTC > 0 ? money(c.overdueTTC) : '—'}</TD>
                </TR>
              ))}
              {receivables.byCustomer.length === 0 ? (
                <TR>
                  <TD colSpan={5} className="py-12 text-center text-white/40">
                    Aucune créance en cours
                  </TD>
                </TR>
              ) : null}
            </tbody>
          </Table>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Dernières dépenses"
          subtitle="Charges enregistrées (hors achats)"
          action={
            <Link href="/depenses" className="text-xs text-accent-400 hover:text-accent-300">
              Voir tout
            </Link>
          }
        />
        <Table>
          <THead>
            <TR>
              <TH>Référence</TH>
              <TH>Libellé</TH>
              <TH>Catégorie</TH>
              <TH>Date</TH>
              <TH>Règlement</TH>
              <TH className="text-right">Montant TTC</TH>
            </TR>
          </THead>
          <tbody>
            {expensesList.slice(0, 10).map((e) => (
              <TR key={e.id}>
                <TD className="font-mono text-xs text-white/50">{e.number}</TD>
                <TD className="font-medium text-white">{e.label}</TD>
                <TD>
                  <Badge tone="slate">{(e as any).category}</Badge>
                </TD>
                <TD>{formatDate(e.expenseDate)}</TD>
                <TD>{(e as any).paymentMethod}</TD>
                <TD className="text-right font-semibold text-white">{money(e.amountTTC)}</TD>
              </TR>
            ))}
            {expensesList.length === 0 ? (
              <TR>
                <TD colSpan={6} className="py-12 text-center text-white/40">
                  Aucune dépense enregistrée
                </TD>
              </TR>
            ) : null}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
