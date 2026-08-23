import { notFound } from 'next/navigation'
import { PageHeader, Card, CardHeader, Badge, Table, THead, TR, TH, TD } from '@/components/ui'
import { ActionButton } from '@/components/ui/action-button'
import { DocumentTotals } from '@/components/documents/document-totals'
import {
  receivePurchaseOrderAction,
  setPurchaseOrderStatusAction,
} from '@/lib/actions/erp'
import { db } from '@elec/db'
import { money, formatDate, STATUS_LABELS } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const statusTone: Record<string, 'green' | 'blue' | 'amber' | 'red' | 'slate' | 'accent'> = {
  DRAFT: 'slate',
  SENT: 'blue',
  PARTIALLY_RECEIVED: 'amber',
  RECEIVED: 'green',
  CANCELLED: 'red',
}

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const po = await db.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      createdBy: { select: { name: true } },
      items: { include: { product: true, taxRate: true } },
    },
  })
  if (!po) notFound()

  const canReceive = po.status !== 'CANCELLED' && po.status !== 'RECEIVED'

  return (
    <div>
      <PageHeader
        title={po.number}
        description={`Créé par ${po.createdBy.name} le ${formatDate(po.createdAt)}`}
      />

      <div className="mb-4 flex items-center gap-3">
        <Badge tone={statusTone[po.status] ?? 'slate'}>{STATUS_LABELS[po.status] ?? po.status}</Badge>
        {po.expectedDate ? (
          <span className="text-sm text-slate-500">Livraison prévue : {formatDate(po.expectedDate)}</span>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Fournisseur" />
            <div className="grid gap-4 p-5 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-400">Nom</p>
                <p className="font-medium text-slate-900">{po.supplier.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Contact</p>
                <p>{po.supplier.phone ?? po.supplier.email ?? '—'}</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title={`Articles (${po.items.length})`} />
            <Table>
              <THead>
                <TR>
                  <TH>Réf.</TH>
                  <TH>Désignation</TH>
                  <TH className="text-right">Qté</TH>
                  <TH className="text-right">Reçue</TH>
                  <TH className="text-right">PU HT</TH>
                  <TH className="text-right">Total HT</TH>
                </TR>
              </THead>
              <tbody>
                {po.items.map((i) => (
                  <TR key={i.id}>
                    <TD className="font-mono text-xs text-slate-500">{i.product.sku}</TD>
                    <TD className="font-medium text-slate-900">{i.product.name}</TD>
                    <TD className="text-right">{Number(i.quantity).toLocaleString('fr-FR')}</TD>
                    <TD className="text-right text-emerald-700">{Number(i.receivedQuantity).toLocaleString('fr-FR')}</TD>
                    <TD className="text-right">{money(i.unitPriceHT)}</TD>
                    <TD className="text-right font-medium">{money(Number(i.unitPriceHT) * Number(i.quantity))}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </Card>

          {po.notes ? (
            <Card className="p-5">
              <p className="text-xs text-slate-400">Notes</p>
              <p className="text-sm text-slate-700">{po.notes}</p>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <DocumentTotals
            totalHT={Number(po.totalHT)}
            totalTVA={Number(po.totalTVA)}
            totalTTC={Number(po.totalTTC)}
            vatBreakdown={po.vatBreakdown}
          />

          <Card>
            <CardHeader title="Actions" />
            <div className="flex flex-col gap-2 p-5">
              {po.status === 'DRAFT' ? (
                <ActionButton action={setPurchaseOrderStatusAction.bind(null, id, 'SENT')} label="Envoyer la commande" variant="secondary" />
              ) : null}
              {canReceive ? (
                <ActionButton
                  action={receivePurchaseOrderAction.bind(null, id)}
                  label="Réceptionner (incrémente le stock)"
                  variant="primary"
                  confirm="Réceptionner cette commande ? Le stock sera automatiquement incrémenté."
                />
              ) : null}
              {(po.status === 'DRAFT' || po.status === 'SENT') ? (
                <ActionButton
                  action={setPurchaseOrderStatusAction.bind(null, id, 'CANCELLED')}
                  label="Annuler le bon de commande"
                  variant="danger"
                  confirm="Annuler ce bon de commande ?"
                />
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}