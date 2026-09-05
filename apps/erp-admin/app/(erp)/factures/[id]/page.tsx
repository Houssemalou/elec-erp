import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FileDown, FileText, Printer } from 'lucide-react'
import { PageHeader, Card, CardHeader, Badge, Table, THead, TR, TH, TD, Button } from '@/components/ui'
import { ActionButton } from '@/components/ui/action-button'
import { DocumentTotals } from '@/components/documents/document-totals'
import { PaymentForm } from '@/components/documents/payment-form'
import {
  validateInvoiceAction,
  cancelInvoiceAction,
  registerPaymentAction,
} from '@/lib/actions/erp'
import { db } from '@elec/db'
import { money, formatDate, STATUS_LABELS } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const statusTone: Record<string, 'green' | 'blue' | 'amber' | 'red' | 'slate' | 'accent'> = {
  DRAFT: 'slate',
  VALIDATED: 'blue',
  PAID: 'green',
  PARTIALLY_PAID: 'accent',
  CANCELLED: 'red',
  CREDITED: 'amber',
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      createdBy: { select: { name: true } },
      items: { include: { taxRate: true } },
      payments: { include: { createdBy: { select: { name: true } } } },
      quote: true,
      creditNotes: true,
    },
  })
  if (!invoice) notFound()

  const customerName =
    invoice.customer.companyName ||
    [invoice.customer.firstName, invoice.customer.lastName].filter(Boolean).join(' ') ||
    'Client'

  const totalTTC = Number(invoice.totalTTC)
  const paid = Number(invoice.paidAmount)
  const remaining = Math.max(0, totalTTC - paid)
  const payable = ['VALIDATED', 'PARTIALLY_PAID', 'PAID'].includes(invoice.status) && remaining > 0.001

  return (
    <div>
      <PageHeader
        title={invoice.number}
        description={`Créée par ${invoice.createdBy.name} le ${formatDate(invoice.createdAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a href={`/api/pdf/invoice?id=${invoice.id}`} target="_blank" rel="noreferrer">
              <Button variant="outline">
                <FileDown className="h-4 w-4" /> PDF
              </Button>
            </a>
            <a href={`/print/facture/${invoice.id}`} target="_blank" rel="noreferrer">
              <Button variant="outline">
                <Printer className="h-4 w-4" /> Imprimer
              </Button>
            </a>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Badge tone={statusTone[invoice.status] ?? 'slate'}>{STATUS_LABELS[invoice.status] ?? invoice.status}</Badge>
        {invoice.quote ? (
          <Link href={`/devis/${invoice.quote.id}`} className="text-sm font-medium text-accent-400 hover:underline">
            ← Devis {invoice.quote.number}
          </Link>
        ) : null}
        {invoice.creditNotes.length > 0 ? (
          <span className="text-sm text-white/50">
            {invoice.creditNotes.length} avoir(s) émis
          </span>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Client" subtitle={invoice.customer.type === 'PROFESSIONNEL' ? 'Professionnel' : 'Particulier'} />
            <div className="grid gap-4 p-5 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-white/40">Nom</p>
                <p className="font-medium text-white">{customerName}</p>
              </div>
              <div>
                <p className="text-xs text-white/40">Matricule fiscal</p>
                <p className="font-mono text-white/70">{invoice.customer.matriculeFiscal ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-white/40">CIN</p>
                <p className="font-mono text-white/70">{invoice.customer.cin ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-white/40">Émise le</p>
                <p>{formatDate(invoice.issueDate)}</p>
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
                  <TH className="text-right">PU HT</TH>
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

          {invoice.payments.length > 0 ? (
            <Card>
              <CardHeader title={`Paiements (${invoice.payments.length})`} />
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Mode</TH>
                    <TH>Référence</TH>
                    <TH>Encaissé par</TH>
                    <TH className="text-right">Montant</TH>
                  </TR>
                </THead>
                <tbody>
                  {invoice.payments.map((p) => (
                    <TR key={p.id}>
                      <TD>{formatDate(p.receivedAt)}</TD>
                      <TD className="capitalize">{p.method.replaceAll('_', ' ').toLowerCase()}</TD>
                      <TD className="font-mono text-xs text-white/50">{p.reference ?? '—'}</TD>
                      <TD>{p.createdBy.name}</TD>
                      <TD className="text-right font-semibold text-emerald-400">{money(p.amount)}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <DocumentTotals
            totalHT={Number(invoice.totalHT)}
            totalTVA={Number(invoice.totalTVA)}
            totalTTC={totalTTC}
            timbreFiscal={Number(invoice.timbreFiscal)}
            discountGlobal={Number(invoice.discountGlobal)}
            vatBreakdown={invoice.vatBreakdown}
            paidAmount={paid}
          />

          <Card>
            <CardHeader title="Actions" />
            <div className="flex flex-col gap-2 p-5">
              {invoice.status === 'DRAFT' ? (
                <>
                  <ActionButton action={validateInvoiceAction.bind(null, id)} label="Valider la facture" variant="primary" />
                  <ActionButton action={cancelInvoiceAction.bind(null, id)} label="Annuler la facture" variant="danger" confirm="Annuler cette facture ?" />
                </>
              ) : null}
              {invoice.status === 'VALIDATED' ? (
                <ActionButton action={cancelInvoiceAction.bind(null, id)} label="Annuler la facture" variant="danger" confirm="Annuler cette facture ?" />
              ) : null}
              {['VALIDATED', 'PAID', 'PARTIALLY_PAID'].includes(invoice.status) && invoice.status !== 'CREDITED' ? (
                <Link href={`/avoirs/nouveau?invoice=${invoice.id}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#151515] px-4 text-sm font-medium text-white/70 hover:bg-[#1A1A1A]">
                  <FileText className="h-4 w-4" /> Émettre un avoir
                </Link>
              ) : null}
            </div>
          </Card>

          {payable ? (
            <Card>
              <CardHeader title="Encaisser un paiement" />
              <PaymentForm invoiceId={invoice.id} remaining={remaining} action={registerPaymentAction} />
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}