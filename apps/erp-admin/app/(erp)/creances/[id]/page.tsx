import { notFound } from 'next/navigation'
import { PageHeader, Card, CardHeader, Badge, Table, THead, TR, TH, TD } from '@/components/ui'
import { DeleteButton } from '@/components/ui/delete-button'
import { ReceivablePaymentForm } from '@/components/receivables/receivable-payment-form'
import { registerReceivablePaymentAction, deleteReceivableAction } from '@/lib/actions/erp'
import { getReceivable, RECEIVABLE_STATUS_LABELS } from '@elec/services'
import { money, formatDate } from '@/lib/utils'
import { roundMoney } from '@elec/contracts'

export const dynamic = 'force-dynamic'

const statusTone: Record<string, 'green' | 'blue' | 'amber' | 'red' | 'slate' | 'accent'> = {
  OPEN: 'red',
  PARTIALLY_PAID: 'amber',
  PAID: 'green',
  CANCELLED: 'slate',
}

const methodLabels: Record<string, string> = {
  CASH: 'Espèces',
  CARD: 'Carte',
  BANK_TRANSFER: 'Virement',
  CHEQUE: 'Chèque',
  EDAHABIA: 'E-dahabia',
  ONLINE: 'En ligne',
}

export default async function ReceivableDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const receivable = await getReceivable(id)
  if (!receivable) notFound()

  const total = Number(receivable.amountTTC)
  const paid = Number(receivable.paidAmount)
  const remaining = roundMoney(total - paid)
  const payable = receivable.status === 'OPEN' || receivable.status === 'PARTIALLY_PAID'

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Créance ${receivable.number}`}
        description={receivable.customerName}
        actions={
          <DeleteButton
            id={receivable.id}
            action={deleteReceivableAction}
            label="Supprimer"
            message="La créance et ses encaissements seront supprimés définitivement."
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Détail" />
            <div className="space-y-3 p-5 text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">Client</span>
                <span className="font-medium text-white">{receivable.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Montant TTC</span>
                <span className="text-white">{money(total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Déjà réglé</span>
                <span className="text-emerald-400">{money(paid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Reste dû</span>
                <span className="font-semibold text-white">{money(remaining)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Échéance</span>
                <span className={receivable.dueDate && receivable.dueDate < new Date() && remaining > 0 ? 'text-red-400' : 'text-white'}>
                  {receivable.dueDate ? formatDate(receivable.dueDate) : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Statut</span>
                <Badge tone={statusTone[receivable.status]}>{RECEIVABLE_STATUS_LABELS[receivable.status]}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Saisie par</span>
                <span className="text-white">{receivable.createdBy.name}</span>
              </div>
              {receivable.notes ? (
                <div className="pt-2">
                  <p className="text-white/50">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-white/70">{receivable.notes}</p>
                </div>
              ) : null}
            </div>
          </Card>

          {receivable.payments.length > 0 ? (
            <Card>
              <CardHeader title="Encaissements" />
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Mode</TH>
                    <TH>Référence</TH>
                    <TH>Saisi par</TH>
                    <TH className="text-right">Montant</TH>
                  </TR>
                </THead>
                <tbody>
                  {receivable.payments.map((p) => (
                    <TR key={p.id}>
                      <TD>{formatDate(p.receivedAt)}</TD>
                      <TD>{methodLabels[p.method] ?? p.method}</TD>
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
          {payable ? (
            <Card>
              <CardHeader title="Encaisser un paiement" />
              <ReceivablePaymentForm
                receivableId={receivable.id}
                remaining={remaining}
                action={registerReceivablePaymentAction}
              />
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}