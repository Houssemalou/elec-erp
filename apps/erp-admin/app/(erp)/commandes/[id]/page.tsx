import { notFound } from 'next/navigation'
import Link from 'next/link'
import { FileDown } from 'lucide-react'
import { PageHeader, Card, CardHeader, Badge, Table, THead, TR, TH, TD, Button } from '@/components/ui'
import { ActionButton } from '@/components/ui/action-button'
import { DocumentTotals } from '@/components/documents/document-totals'
import { CancelOrderButton, StatusUpdater } from '@/components/orders/order-actions'
import {
  confirmOrderAction,
  cancelOrderAction,
  updateOrderStatusAction,
  markOrderPaidAction,
  createInvoiceFromOrderAction,
} from '@/lib/actions/erp'
import { db } from '@elec/db'
import { money, formatDate, STATUS_LABELS } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const statusTone: Record<string, 'green' | 'blue' | 'amber' | 'red' | 'slate' | 'accent'> = {
  PENDING: 'accent',
  CONFIRMED: 'blue',
  PREPARING: 'amber',
  SHIPPED: 'blue',
  DELIVERED: 'green',
  CANCELLED: 'red',
  REFUNDED: 'slate',
}

const lockedStatuses = ['CANCELLED', 'DELIVERED', 'REFUNDED']

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const order = await db.onlineOrder.findUnique({
    where: { id },
    include: { items: { include: { product: true, taxRate: true } }, customer: true },
  })
  if (!order) notFound()

  const canConfirm = order.status === 'PENDING' || order.status === 'PREPARING'
  const canCancel = !lockedStatuses.includes(order.status)
  const invoice = await db.invoice.findFirst({
    where: { customerId: order.customerId, notes: { contains: order.number } },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div>
      <PageHeader
        title={order.number}
        description={`Passée le ${formatDate(order.createdAt)}`}
        actions={
          invoice ? (
            <Link href={`/factures/${invoice.id}`}>
              <Button variant="outline">
                <FileDown className="h-4 w-4" /> Facture {invoice.number}
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Badge tone={statusTone[order.status] ?? 'slate'}>{STATUS_LABELS[order.status] ?? order.status}</Badge>
        <Badge tone={order.paymentStatus === 'PAID' ? 'green' : 'amber'}>
          {order.paymentStatus === 'PAID' ? 'Payée' : 'Paiement en attente'}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={order.deliveryMethod === 'PICKUP' ? 'Retrait en magasin' : 'Livraison'} />
            <div className="grid gap-4 p-5 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-400">Destinataire</p>
                <p className="font-medium text-slate-900">{order.shippingFullName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Téléphone</p>
                <p>{order.shippingPhone}</p>
              </div>
              {order.deliveryMethod === 'PICKUP' ? (
                <div>
                  <p className="text-xs text-slate-400">Mode de réception</p>
                  <p className="font-medium text-slate-900">Retrait en magasin</p>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-slate-400">Adresse</p>
                    <p>{order.shippingAddress}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Ville</p>
                    <p>{order.shippingCity}</p>
                  </div>
                </>
              )}
              {order.pickupTime ? (
                <div>
                  <p className="text-xs text-slate-400">Heure de récupération</p>
                  <p className="font-medium text-slate-900">
                    {formatDate(order.pickupTime)} à{' '}
                    {new Date(order.pickupTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ) : null}
              <div>
                <p className="text-xs text-slate-400">Mode de paiement</p>
                <p className="capitalize">{order.paymentMethod === 'COD' ? 'Espèces (à la réception)' : order.paymentMethod.replaceAll('_', ' ').toLowerCase()}</p>
              </div>
              {order.shippingNote ? (
                <div>
                  <p className="text-xs text-slate-400">Note</p>
                  <p>{order.shippingNote}</p>
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title={`Articles (${order.items.length})`} />
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
                {order.items.map((i) => (
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
            totalHT={Number(order.totalHT)}
            totalTVA={Number(order.totalTVA)}
            totalTTC={Number(order.totalTTC)}
            timbreFiscal={Number(order.timbreFiscal)}
            discountGlobal={Number(order.discountGlobal)}
            vatBreakdown={order.vatBreakdown}
          />

          <Card>
            <CardHeader title="Actions" />
            <div className="flex flex-col gap-2 p-5">
              {canConfirm ? (
                <ActionButton
                  action={confirmOrderAction.bind(null, id)}
                  label="Confirmer la commande"
                  variant="primary"
                  confirm="Confirmer cette commande ? Le stock réservé sera débité."
                />
              ) : null}
              {canCancel ? <CancelOrderButton id={id} action={cancelOrderAction} /> : null}
              {order.paymentStatus !== 'PAID' ? (
                <ActionButton action={markOrderPaidAction.bind(null, id, 'CARD')} label="Marquer comme payée" variant="outline" />
              ) : null}
              {order.status === 'CONFIRMED' && !invoice ? (
                <ActionButton action={createInvoiceFromOrderAction.bind(null, id)} label="Générer la facture" variant="secondary" />
              ) : null}
            </div>
          </Card>

          {!lockedStatuses.includes(order.status) ? (
            <Card>
              <CardHeader title="Statut de la commande" />
              <StatusUpdater id={id} current={order.status} action={updateOrderStatusAction} />
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}