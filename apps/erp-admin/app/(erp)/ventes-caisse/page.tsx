import Link from 'next/link'
import { Eye, Search } from 'lucide-react'
import { db } from '@elec/db'
import { weekStartOf } from '@elec/services'
import { PageHeader, Card, Badge, Table, THead, TR, TH, TD, Input } from '@/components/ui'
import { Pagination, PAGE_SIZE, pageNumber } from '@/components/ui/pagination'
import { EditSaleDiscount } from '@/components/pos/edit-sale-discount'
import { updatePosSaleDiscountAction } from '@/lib/actions/erp'
import { money, formatDate, dateInputValue, parseDateInput } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function extractPayment(notes: string | null): { label: string; tone: 'green' | 'blue' | 'slate' } {
  if (!notes) return { label: '—', tone: 'slate' }
  if (notes.includes('Carte')) return { label: 'Carte', tone: 'blue' }
  if (notes.includes('Espèces')) return { label: 'Espèces', tone: 'green' }
  return { label: notes.slice(0, 30), tone: 'slate' }
}

/**
 * Coût de revient TTC d'une vente : somme des coûts d'achat (HT en base) des
 * articles, ramenés en TTC au taux de TVA de la ligne. `missing` compte les
 * lignes sans prix de revient pour signaler un montant partiel.
 */
function saleCostOfGoodsTTC(
  items: { quantity: unknown; product: { costPrice: unknown } | null; taxRate: { rate: unknown } }[],
): { costTTC: number; missing: number } {
  let costTTC = 0
  let missing = 0
  for (const item of items) {
    const costHT = item.product?.costPrice
    if (costHT === null || costHT === undefined) {
      missing += 1
      continue
    }
    costTTC += Number(costHT) * Number(item.quantity) * (1 + Number(item.taxRate.rate) / 100)
  }
  return { costTTC: Math.round(costTTC * 1000) / 1000, missing }
}

/**
 * Remise TTC consentie sur une vente = somme des lignes brutes − total TTC payé
 * (la remise POS s'applique sur le TTC affiché). Bornée à 0.
 */
function saleDiscountTTC(items: { lineTTC: unknown }[], totalTTC: unknown): number {
  const grossTTC = items.reduce((s, i) => s + Number(i.lineTTC), 0)
  const discount = grossTTC - Number(totalTTC)
  return discount > 0 ? Math.round(discount * 1000) / 1000 : 0
}

export default async function VentesCaissePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; semaine?: string }>
}) {
  const params = await searchParams
  const q = params.q
  const page = pageNumber(params.page)

  const monday = params.semaine ? weekStartOf(parseDateInput(params.semaine)) : null
  const weekEnd = monday ? new Date(monday.getTime() + 7 * 86400000) : null
  const semaineParam = monday ? dateInputValue(monday) : undefined

  const where = { source: 'POS' as const }
  if (monday && weekEnd) Object.assign(where, { issueDate: { gte: monday, lt: weekEnd } })
  if (q) {
    Object.assign(where, {
      OR: [
        { number: { contains: q, mode: 'insensitive' as const } },
        { customer: { OR: [{ firstName: { contains: q, mode: 'insensitive' as const } }, { lastName: { contains: q, mode: 'insensitive' as const } }] } },
      ],
    })
  }

  const [total, sales, weekAgg, weekItems] = await Promise.all([
    db.deliveryNote.count({ where }),
    db.deliveryNote.findMany({
      where,
      include: {
        customer: true,
        invoice: { select: { id: true, number: true } },
        items: {
          select: {
            quantity: true,
            lineTTC: true,
            product: { select: { costPrice: true } },
            taxRate: { select: { rate: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    monday && weekEnd
      ? db.deliveryNote.aggregate({
          where: { source: 'POS', status: { not: 'CANCELLED' }, issueDate: { gte: monday, lt: weekEnd } },
          _sum: { totalTTC: true },
          _count: { _all: true },
        })
      : Promise.resolve(null),
    monday && weekEnd
      ? db.deliveryNoteItem.findMany({
          where: { deliveryNote: { source: 'POS', status: { not: 'CANCELLED' }, issueDate: { gte: monday, lt: weekEnd } } },
          select: { quantity: true, product: { select: { costPrice: true } }, taxRate: { select: { rate: true } } },
        })
      : Promise.resolve([]),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const anyMissingCost = sales.some((sale) => saleCostOfGoodsTTC(sale.items).missing > 0)

  // GAIN de la semaine = CA TTC − prix de revient TTC des articles vendus.
  const weekRevenue = Number(weekAgg?._sum.totalTTC ?? 0)
  const weekCost = saleCostOfGoodsTTC(weekItems)
  const weekGainTTC = Math.round((weekRevenue - weekCost.costTTC) * 1000) / 1000

  const thisMonday = weekStartOf(new Date())
  const prevMonday = new Date(thisMonday.getTime() - 7 * 86400000)
  const qSuffix = q ? `&q=${encodeURIComponent(q)}` : ''

  return (
    <div>
      <PageHeader title="Ventes en caisse" description={`${total} vente${total > 1 ? 's' : ''}`} />
      <Card>
        <form className="flex flex-wrap items-end gap-3 border-b border-[#2A2A2A] p-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input name="q" defaultValue={q} placeholder="N° de bon, client…" className="pl-9" />
          </div>
          <div>
            <label htmlFor="semaine" className="mb-1 block text-xs text-white/50">
              Semaine (mardi)
            </label>
            <Input id="semaine" name="semaine" type="date" defaultValue={semaineParam} className="w-40" />
          </div>
          <button type="submit" className="rounded-lg border border-[#2A2A2A] bg-[#151515] px-4 py-2 text-sm font-medium text-white/70 hover:bg-[#1A1A1A]">
            Filtrer
          </button>
          <div className="flex items-center gap-3 text-xs text-white/50">
            <Link href={`?semaine=${dateInputValue(thisMonday)}${qSuffix}`} className="hover:text-white">
              Cette semaine
            </Link>
            <Link href={`?semaine=${dateInputValue(prevMonday)}${qSuffix}`} className="hover:text-white">
              Semaine passée
            </Link>
            <Link href={q ? `?q=${encodeURIComponent(q)}` : '?'} className="hover:text-white">
              Tout
            </Link>
          </div>
        </form>
        {monday && weekEnd ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2A2A2A] bg-[#151515] px-4 py-3 text-sm">
            <span className="text-white/60">
              Semaine du {formatDate(monday)} au {formatDate(new Date(weekEnd.getTime() - 86400000))}
            </span>
            <span className="text-white/60">
              {weekAgg?._count._all ?? 0} vente{(weekAgg?._count._all ?? 0) > 1 ? 's' : ''} • CA TTC{' '}
              <span className="font-semibold text-white">{money(weekRevenue)}</span>
            </span>
            <span className="text-white/60">
              Gain TTC{' '}
              <span className={`font-semibold ${weekGainTTC >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {money(weekGainTTC)}
                {weekCost.missing > 0 ? <span className="text-amber-400"> *</span> : null}
              </span>
            </span>
          </div>
        ) : null}
        <Table>
          <THead>
            <TR>
              <TH>N° BL</TH>
              <TH>Date</TH>
              <TH>Client</TH>
              <TH>Paiement</TH>
              <TH className="text-right">HT</TH>
              <TH className="text-right">TVA</TH>
              <TH className="text-right">Remise TTC</TH>
              <TH className="text-right">TTC</TH>
              <TH className="text-right">Prix de revient TTC</TH>
              <TH className="text-right">Marge TTC</TH>
              <TH>Facture</TH>
              <TH>Statut</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <tbody>
            {sales.map((sale) => {
              const pay = extractPayment(sale.notes)
              const cancelled = sale.status === 'CANCELLED'
              const customerName = sale.customer
                ? (sale.customer.companyName || [sale.customer.firstName, sale.customer.lastName].filter(Boolean).join(' ') || null)
                : null
              const { costTTC, missing } = saleCostOfGoodsTTC(sale.items)
              const marginTTC = Math.round((Number(sale.totalTTC) - costTTC) * 1000) / 1000
              const discountTTC = saleDiscountTTC(sale.items, sale.totalTTC)
              const grossTTC = Math.round(sale.items.reduce((s, i) => s + Number(i.lineTTC), 0) * 1000) / 1000
              return (
                <TR key={sale.id} className={cancelled ? 'opacity-50' : undefined}>
                  <TD className="font-mono text-xs font-medium text-white/70">{sale.number}</TD>
                  <TD>{formatDate(sale.issueDate)}</TD>
                  <TD className="font-medium text-white">{customerName ?? <span className="text-white/40">—</span>}</TD>
                  <TD>
                    <Badge tone={pay.tone}>{pay.label}</Badge>
                  </TD>
                  <TD className="text-right">{money(sale.totalHT)}</TD>
                  <TD className="text-right">{money(sale.totalTVA)}</TD>
                  <TD className="text-right">
                    <EditSaleDiscount
                      saleId={sale.id}
                      discountTTC={discountTTC}
                      grossTTC={grossTTC}
                      disabled={cancelled}
                      variant="inline"
                      action={updatePosSaleDiscountAction}
                    />
                  </TD>
                  <TD className="text-right font-semibold">{money(sale.totalTTC)}</TD>
                  <TD className="text-right">
                    {missing > 0 ? <span className="text-amber-400">{money(costTTC)} *</span> : money(costTTC)}
                  </TD>
                  <TD className={`text-right font-semibold ${marginTTC >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {money(marginTTC)}
                  </TD>
                  <TD>
                    {sale.invoice ? (
                      <Link
                        href={`/factures/${sale.invoice.id}`}
                        className="font-mono text-xs font-medium text-accent-400 hover:text-accent-300"
                      >
                        {sale.invoice.number}
                      </Link>
                    ) : (
                      <span className="text-xs text-white/40">—</span>
                    )}
                  </TD>
                  <TD>
                    <Badge tone={cancelled ? 'red' : 'green'}>{cancelled ? 'Annulée' : 'Validée'}</Badge>
                  </TD>
                  <TD className="text-right">
                    <Link
                      href={`/ventes-caisse/${sale.id}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-white/60 hover:bg-white/5"
                    >
                      <Eye className="h-3.5 w-3.5" /> Voir
                    </Link>
                  </TD>
                </TR>
              )
            })}
            {sales.length === 0 ? (
              <TR>
                <TD colSpan={13} className="py-12 text-center text-white/40">Aucune vente en caisse</TD>
              </TR>
            ) : null}
          </tbody>
        </Table>
        {anyMissingCost ? (
          <p className="border-t border-[#2A2A2A] px-4 py-2 text-xs text-amber-400">
            * Prix de revient partiel : certains articles n&apos;ont pas de coût d&apos;achat renseigné.
          </p>
        ) : null}
        <Pagination page={page} totalPages={totalPages} total={total} params={{ q, semaine: semaineParam }} />
      </Card>
    </div>
  )
}
