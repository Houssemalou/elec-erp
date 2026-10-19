import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@elec/db'
import { PageHeader, Card, Badge, Table, THead, TR, TH, TD } from '@/components/ui'
import { CancelSaleButton } from '@/components/pos/cancel-sale-button'
import { RestoreSaleButton } from '@/components/pos/restore-sale-button'
import { EditSaleDiscount } from '@/components/pos/edit-sale-discount'
import { cancelPosSaleAction, restorePosSaleAction, updatePosSaleDiscountAction } from '@/lib/actions/erp'
import { EXPENSE_CATEGORY_LABELS } from '@/lib/labels'
import { money, formatDate } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function VenteCaisseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const sale = await db.deliveryNote.findUnique({
    where: { id },
    include: {
      customer: true,
      createdBy: { select: { name: true } },
      invoice: { select: { id: true, number: true, totalTTC: true, paidAmount: true, status: true } },
      items: { include: { taxRate: true } },
      expenses: {
        select: { id: true, number: true, label: true, category: true, amountTTC: true, expenseDate: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!sale || sale.source !== 'POS') notFound()

  const customerName = sale.customer
    ? (sale.customer.companyName || [sale.customer.firstName, sale.customer.lastName].filter(Boolean).join(' ') || null)
    : null

  const payment = sale.notes?.includes('Carte') ? 'Carte' : sale.notes?.includes('Espèces') ? 'Espèces' : '—'
  const isCancelled = sale.status === 'CANCELLED'
  const invoiceCancelled = sale.invoice?.status === 'CANCELLED'

  const grossTTC = Math.round(sale.items.reduce((s, i) => s + Number(i.lineTTC), 0) * 1000) / 1000
  const discountTTC = grossTTC - Number(sale.totalTTC) > 0 ? Math.round((grossTTC - Number(sale.totalTTC)) * 1000) / 1000 : 0
  const cashOutTotalTTC = sale.expenses.reduce((s, e) => s + Number(e.amountTTC), 0)

  return (
    <div>
      <PageHeader
        title={`Vente caisse ${sale.number}`}
        description={`Bon de livraison du ${formatDate(sale.issueDate)}`}
        actions={
          <div className="flex items-center gap-2">
            {isCancelled ? (
              <RestoreSaleButton id={sale.id} action={restorePosSaleAction} hasInvoice={Boolean(sale.invoice)} />
            ) : (
              <CancelSaleButton id={sale.id} action={cancelPosSaleAction} hasInvoice={Boolean(sale.invoice)} />
            )}
            <Link href="/ventes-caisse" className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A2A] px-3 py-2 text-sm text-white/60 hover:bg-white/5">
              <ArrowLeft className="h-4 w-4" /> Retour
            </Link>
          </div>
        }
      />

      {isCancelled ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Cette vente en caisse est annulée : elle n&apos;est plus comptée dans le chiffre d&apos;affaires et le
          stock des articles concerned a été réintégré.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Table>
            <THead>
              <TR>
                <TH>Réf.</TH>
                <TH>Désignation</TH>
                <TH className="text-right">Qté</TH>
                <TH className="text-right">PU TTC</TH>
                <TH className="text-right">TVA</TH>
                <TH className="text-right">Ligne TTC</TH>
              </TR>
            </THead>
            <tbody>
              {sale.items.map((item) => (
                <TR key={item.id}>
                  <TD className="font-mono text-xs text-white/70">{item.sku}</TD>
                  <TD className="font-medium text-white">{item.designation}</TD>
                  <TD className="text-right">{Number(item.quantity)}</TD>
                  <TD className="text-right">{money(item.unitPriceTTC ?? item.unitPriceHT)}</TD>
                  <TD className="text-right text-white/60">{Number(item.taxRate.rate)}%</TD>
                  <TD className="text-right font-semibold">{money(item.lineTTC)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <div className="space-y-1.5 border-t border-[#2A2A2A] px-5 py-4 text-sm">
            <div className="flex justify-between text-white/60"><span>Sous-total HT</span><span>{money(sale.totalHT)}</span></div>
            <div className="flex justify-between text-white/60"><span>TVA</span><span>{money(sale.totalTVA)}</span></div>
            <EditSaleDiscount
              saleId={sale.id}
              discountTTC={discountTTC}
              grossTTC={grossTTC}
              disabled={isCancelled}
              action={updatePosSaleDiscountAction}
            />
            <div className="flex justify-between border-t border-[#2A2A2A] pt-2 text-base font-bold text-white">
              <span>Total TTC</span>
              <span>{money(sale.totalTTC)}</span>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <h3 className="border-b border-[#2A2A2A] px-5 py-3 text-sm font-semibold text-white">Informations</h3>
            <div className="space-y-3 px-5 py-4 text-sm">
              <div className="flex justify-between"><span className="text-white/60">Date</span><span className="font-medium text-white">{formatDate(sale.issueDate)}</span></div>
              <div className="flex justify-between"><span className="text-white/60">Client</span><span className="font-medium text-white">{customerName ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-white/60">Paiement</span>
                <Badge tone={payment === 'Carte' ? 'blue' : 'green'}>{payment}</Badge>
              </div>
              <div className="flex justify-between"><span className="text-white/60">Créé par</span><span className="text-white">{sale.createdBy.name}</span></div>
              <div className="flex justify-between"><span className="text-white/60">Statut</span>
                <Badge tone={sale.status === 'VALIDATED' ? 'green' : 'red'}>{sale.status === 'VALIDATED' ? 'Validé' : 'Annulé'}</Badge>
              </div>
            </div>
          </Card>

          {sale.invoice && (
            <Card>
              <h3 className="border-b border-[#2A2A2A] px-5 py-3 text-sm font-semibold text-white">Facture liée</h3>
              <div className="space-y-3 px-5 py-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">N° facture</span>
                  <Link href={`/factures/${sale.invoice.id}`} className="font-mono font-medium text-accent-400 hover:text-accent-300">{sale.invoice.number}</Link>
                </div>
                <div className="flex justify-between"><span className="text-white/60">Montant facturé</span><span className="font-medium text-white">{money(sale.invoice.totalTTC)}</span></div>
                <div className="flex justify-between"><span className="text-white/60">Payé</span><span className="font-medium text-white">{money(sale.invoice.paidAmount)}</span></div>
              <div className="flex justify-between"><span className="text-white/60">Statut facture</span>
                <Badge
                  tone={
                    invoiceCancelled
                      ? 'red'
                      : sale.invoice.status === 'VALIDATED' || sale.invoice.status === 'PAID'
                        ? 'green'
                        : 'amber'
                  }
                >
                  {invoiceCancelled ? 'ANNULÉE' : sale.invoice.status}
                </Badge>
              </div>
              </div>
            </Card>
          )}

          {sale.expenses.length > 0 ? (
            <Card>
              <h3 className="border-b border-[#2A2A2A] px-5 py-3 text-sm font-semibold text-white">
                Décaissements liés
              </h3>
              <div className="space-y-3 px-5 py-4 text-sm">
                {sale.expenses.map((e) => (
                  <div key={e.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-white">{e.label}</p>
                      <p className="text-xs text-white/50">
                        {EXPENSE_CATEGORY_LABELS[e.category]} • {formatDate(e.expenseDate)} • {e.number}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold text-white/80">{money(e.amountTTC)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-[#2A2A2A] pt-2 font-semibold text-white">
                  <span>Total affecté</span>
                  <span>{money(cashOutTotalTTC)}</span>
                </div>
                <p className="text-xs text-white/40">Ces décaissements sont suivis dans le module Dépenses.</p>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
