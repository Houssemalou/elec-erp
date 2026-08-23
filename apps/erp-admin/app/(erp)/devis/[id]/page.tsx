import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FileDown, Pencil, Printer } from 'lucide-react'
import { PageHeader, Card, CardHeader, Badge, Table, THead, TR, TH, TD, Button } from '@/components/ui'
import { ActionButton } from '@/components/ui/action-button'
import { DeleteButton } from '@/components/ui/delete-button'
import { DocumentTotals } from '@/components/documents/document-totals'
import {
  setQuoteStatusAction,
  convertQuoteToInvoiceAction,
  deleteQuoteAction,
} from '@/lib/actions/erp'
import { db } from '@elec/db'
import { money, formatDate, STATUS_LABELS } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const statusTone: Record<string, 'green' | 'blue' | 'amber' | 'red' | 'slate' | 'accent'> = {
  DRAFT: 'slate',
  SENT: 'blue',
  ACCEPTED: 'green',
  REFUSED: 'red',
  CONVERTED: 'accent',
  EXPIRED: 'amber',
}

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const quote = await db.quote.findUnique({
    where: { id },
    include: {
      customer: true,
      createdBy: { select: { name: true } },
      items: { include: { taxRate: true } },
      invoice: true,
    },
  })
  if (!quote) notFound()

  const customerName =
    quote.customer.companyName ||
    [quote.customer.firstName, quote.customer.lastName].filter(Boolean).join(' ') ||
    'Client'

  const isDraft = quote.status === 'DRAFT'
  const canEdit = isDraft && !quote.invoiceId

  return (
    <div>
      <PageHeader
        title={quote.number}
        description={`Créé par ${quote.createdBy.name} le ${formatDate(quote.createdAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a href={`/api/pdf/quote?id=${quote.id}`} target="_blank" rel="noreferrer">
              <Button variant="outline">
                <FileDown className="h-4 w-4" /> PDF
              </Button>
            </a>
            <a href={`/print/devis/${quote.id}`} target="_blank" rel="noreferrer">
              <Button variant="outline">
                <Printer className="h-4 w-4" /> Imprimer
              </Button>
            </a>
            {canEdit ? (
              <Link href={`/devis/${quote.id}/edit`}>
                <Button variant="outline">
                  <Pencil className="h-4 w-4" /> Modifier
                </Button>
              </Link>
            ) : null}
            {isDraft ? <DeleteButton id={quote.id} action={deleteQuoteAction} label="Supprimer" /> : null}
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <Badge tone={statusTone[quote.status] ?? 'slate'}>{STATUS_LABELS[quote.status] ?? quote.status}</Badge>
        {quote.invoice ? (
          <Link href={`/factures/${quote.invoice.id}`} className="text-sm font-medium text-brand-700 hover:underline">
            → Facture {quote.invoice.number}
          </Link>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Client" subtitle={quote.customer.type === 'PROFESSIONNEL' ? 'Professionnel' : 'Particulier'} />
            <div className="grid gap-4 p-5 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-400">Nom</p>
                <p className="font-medium text-slate-900">{customerName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Matricule fiscal</p>
                <p className="font-mono text-slate-700">{quote.customer.matriculeFiscal ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">CIN</p>
                <p className="font-mono text-slate-700">{quote.customer.cin ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Email</p>
                <p>{quote.customer.email ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Téléphone</p>
                <p>{quote.customer.phone ?? '—'}</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title={`Articles (${quote.items.length})`} />
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
                {quote.items.map((i) => (
                  <TR key={i.id}>
                    <TD className="font-mono text-xs text-slate-500">{i.sku}</TD>
                    <TD className="font-medium text-slate-900">{i.designation}</TD>
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
                    <TD className="text-right text-slate-500">{Number(i.taxRate.rate)}%</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </Card>

          {quote.notes || quote.conditions ? (
            <Card className="p-5">
              {quote.notes ? (
                <div className="mb-3">
                  <p className="text-xs text-slate-400">Notes</p>
                  <p className="text-sm text-slate-700">{quote.notes}</p>
                </div>
              ) : null}
              {quote.conditions ? (
                <div>
                  <p className="text-xs text-slate-400">Conditions</p>
                  <p className="text-sm text-slate-700">{quote.conditions}</p>
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <DocumentTotals
            totalHT={Number(quote.totalHT)}
            totalTVA={Number(quote.totalTVA)}
            totalTTC={Number(quote.totalTTC)}
            timbreFiscal={Number(quote.timbreFiscal)}
            discountGlobal={Number(quote.discountGlobal)}
            vatBreakdown={quote.vatBreakdown}
          />

          <Card>
            <CardHeader title="Actions" />
            <div className="flex flex-col gap-2 p-5">
              {isDraft ? (
                <>
                  <ActionButton action={setQuoteStatusAction.bind(null, id, 'SENT')} label="Envoyer le devis" variant="secondary" />
                  <ActionButton action={setQuoteStatusAction.bind(null, id, 'ACCEPTED')} label="Marquer accepté" variant="outline" />
                  <ActionButton action={setQuoteStatusAction.bind(null, id, 'REFUSED')} label="Marquer refusé" variant="outline" />
                </>
              ) : null}
              {quote.status === 'SENT' ? (
                <>
                  <ActionButton action={setQuoteStatusAction.bind(null, id, 'ACCEPTED')} label="Marquer accepté" variant="secondary" />
                  <ActionButton action={setQuoteStatusAction.bind(null, id, 'REFUSED')} label="Marquer refusé" variant="outline" />
                </>
              ) : null}
              {(quote.status === 'ACCEPTED' || (quote.status === 'SENT')) && !quote.invoiceId ? (
                <ActionButton
                  action={convertQuoteToInvoiceAction.bind(null, id)}
                  label="Convertir en facture"
                  variant="primary"
                />
              ) : null}
              {quote.status === 'DRAFT' && !quote.invoiceId ? (
                <DeleteButton id={quote.id} action={deleteQuoteAction} label="Supprimer le devis" />
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}