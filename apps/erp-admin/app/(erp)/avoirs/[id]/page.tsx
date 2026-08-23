import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FileDown, Printer } from 'lucide-react'
import { PageHeader, Card, CardHeader, Badge, Table, THead, TR, TH, TD, Button } from '@/components/ui'
import { ActionButton } from '@/components/ui/action-button'
import { DocumentTotals } from '@/components/documents/document-totals'
import { validateCreditNoteAction } from '@/lib/actions/erp'
import { db } from '@elec/db'
import { money, formatDate, STATUS_LABELS } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function CreditNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const note = await db.creditNote.findUnique({
    where: { id },
    include: {
      items: { include: { taxRate: true } },
      invoice: true,
      customer: true,
      createdBy: { select: { name: true } },
    },
  })
  if (!note) notFound()

  return (
    <div>
      <PageHeader
        title={note.number}
        description={`Créé par ${note.createdBy.name} le ${formatDate(note.createdAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a href={`/api/pdf/credit-note?id=${note.id}`} target="_blank" rel="noreferrer">
              <Button variant="outline">
                <FileDown className="h-4 w-4" /> PDF
              </Button>
            </a>
            <a href={`/print/avoir/${note.id}`} target="_blank" rel="noreferrer">
              <Button variant="outline">
                <Printer className="h-4 w-4" /> Imprimer
              </Button>
            </a>
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <Badge tone={note.status === 'VALIDATED' ? 'green' : note.status === 'CANCELLED' ? 'red' : 'slate'}>
          {STATUS_LABELS[note.status] ?? note.status}
        </Badge>
        <Link href={`/factures/${note.invoiceId}`} className="text-sm font-medium text-brand-700 hover:underline">
          ← Facture {note.invoice.number}
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Motif du retour" />
            <div className="grid gap-4 p-5 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-400">Motif</p>
                <p className="font-medium text-slate-900">{note.reason}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Client</p>
                <p>
                  {note.customer.companyName ||
                    [note.customer.firstName, note.customer.lastName].filter(Boolean).join(' ') ||
                    'Client'}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title={`Articles (${note.items.length})`} />
            <Table>
              <THead>
                <TR>
                  <TH>Réf.</TH>
                  <TH>Désignation</TH>
                  <TH className="text-right">Qté</TH>
                  <TH className="text-right">PU HT</TH>
                  <TH className="text-right">Total HT</TH>
                  <TH className="text-right">TVA</TH>
                </TR>
              </THead>
              <tbody>
                {note.items.map((i) => (
                  <TR key={i.id}>
                    <TD className="font-mono text-xs text-slate-500">{i.sku}</TD>
                    <TD className="font-medium text-slate-900">{i.designation}</TD>
                    <TD className="text-right">{Number(i.quantity).toLocaleString('fr-FR')}</TD>
                    <TD className="text-right">{money(i.unitPriceHT)}</TD>
                    <TD className="text-right font-medium">{money(i.lineHT)}</TD>
                    <TD className="text-right text-slate-500">{Number(i.taxRate.rate)}%</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>

        <div className="space-y-6">
          <DocumentTotals
            totalHT={Number(note.totalHT)}
            totalTVA={Number(note.totalTVA)}
            totalTTC={Number(note.totalTTC)}
            timbreFiscal={Number(note.timbreFiscal)}
            vatBreakdown={note.vatBreakdown}
          />

          {note.status === 'DRAFT' ? (
            <Card>
              <CardHeader title="Actions" />
              <div className="p-5">
                <ActionButton
                  action={validateCreditNoteAction.bind(null, id)}
                  label="Valider l&apos;avoir (réincrémente le stock)"
                  variant="primary"
                  confirm="Valider cet avoir ? Le stock sera réincrémenté et la facture marquée « avoir émis »."
                />
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}