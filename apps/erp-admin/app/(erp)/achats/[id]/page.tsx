import { notFound } from 'next/navigation'
import { PageHeader, Card, CardHeader, Badge, Table, THead, TR, TH, TD } from '@/components/ui'
import { ActionButton } from '@/components/ui/action-button'
import { DocumentTotals } from '@/components/documents/document-totals'
import { validatePurchaseInvoiceAction, cancelPurchaseInvoiceAction } from '@/lib/actions/erp'
import { db } from '@elec/db'
import { money, formatDate, STATUS_LABELS } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const statusTone: Record<string, 'green' | 'blue' | 'amber' | 'red' | 'slate' | 'accent'> = {
  DRAFT: 'slate',
  VALIDATED: 'green',
  CANCELLED: 'red',
}

export default async function PurchaseInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = await db.purchaseInvoice.findUnique({
    where: { id },
    include: {
      supplier: true,
      createdBy: { select: { name: true } },
      items: { include: { product: true, taxRate: true } },
    },
  })
  if (!invoice) notFound()

  return (
    <div>
      <PageHeader
        title={invoice.number}
        description={`Créée par ${invoice.createdBy.name} le ${formatDate(invoice.createdAt)}`}
      />

      <div className="mb-4 flex items-center gap-3">
        <Badge tone={statusTone[invoice.status] ?? 'slate'}>{STATUS_LABELS[invoice.status] ?? invoice.status}</Badge>
        <span className="text-sm text-white/50">Facturée le {formatDate(invoice.issueDate)}</span>
        {invoice.receivedAt ? (
          <span className="text-sm text-white/50">Reçue le {formatDate(invoice.receivedAt)}</span>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Fournisseur" />
            <div className="grid gap-4 p-5 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-white/40">Nom</p>
                <p className="font-medium text-white">{invoice.supplier.name}</p>
              </div>
              <div>
                <p className="text-xs text-white/40">Matricule fiscal</p>
                <p className="font-mono text-white/70">{invoice.supplier.matriculeFiscal ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-white/40">Contact</p>
                <p>{invoice.supplier.phone ?? invoice.supplier.email ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-white/40">Échéance</p>
                <p>{invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title={`Articles (${invoice.items.length})`} />
            <Table>
              <THead>
                <TR>
                  <TH>Réf.</TH>
                  <TH>Désignation</TH>
                  <TH className="text-right">Qté</TH>
                  <TH className="text-right">PU HT (coût)</TH>
                  <TH className="text-right">Remise</TH>
                  <TH className="text-right">Total HT</TH>
                  <TH className="text-right">TVA</TH>
                </TR>
              </THead>
              <tbody>
                {invoice.items.map((i) => (
                  <TR key={i.id}>
                    <TD className="font-mono text-xs text-white/50">{i.sku}</TD>
                    <TD className="font-medium text-white">{i.designation}</TD>
                    <TD className="text-right">{Number(i.quantity).toLocaleString('fr-FR')}</TD>
                    <TD className="text-right">{money(i.unitPriceHT)}</TD>
                    <TD className="text-right">
                      {i.discountType ? (
                        <span className="text-red-600">
                          {i.discountType === 'PERCENT' ? `${Number(i.discountValue)}%` : money(i.discountValue)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TD>
                    <TD className="text-right font-medium">{money(i.lineHT)}</TD>
                    <TD className="text-right text-white/50">{Number(i.taxRate.rate)}%</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </Card>

          {invoice.notes ? (
            <Card className="p-5">
              <p className="text-xs text-white/40">Notes</p>
              <p className="text-sm text-white/70">{invoice.notes}</p>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <DocumentTotals
            totalHT={Number(invoice.totalHT)}
            totalTVA={Number(invoice.totalTVA)}
            totalTTC={Number(invoice.totalTTC)}
            timbreFiscal={Number(invoice.timbreFiscal)}
            discountGlobal={Number(invoice.discountGlobal)}
            vatBreakdown={invoice.vatBreakdown}
          />

          <Card>
            <CardHeader title="Actions" />
            <div className="flex flex-col gap-2 p-5">
              {invoice.status === 'DRAFT' ? (
                <ActionButton
                  action={validatePurchaseInvoiceAction.bind(null, id)}
                  label="Valider (incrémente le stock)"
                  variant="primary"
                  confirm="Valider cette facture d'achat ? Le stock sera automatiquement incrémenté."
                />
              ) : null}
              {invoice.status === 'DRAFT' || invoice.status === 'VALIDATED' ? (
                <ActionButton
                  action={cancelPurchaseInvoiceAction.bind(null, id)}
                  label="Annuler la facture d'achat"
                  variant="danger"
                  confirm="Annuler cette facture d'achat ?"
                />
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}