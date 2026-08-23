import { PageHeader, Card } from '@/components/ui'
import { DocumentForm } from '@/components/documents/document-form'
import { createPurchaseOrderAction } from '@/lib/actions/erp'
import { db } from '@elec/db'

export const dynamic = 'force-dynamic'

export default async function NewPurchaseOrderPage() {
  const [suppliers, products] = await Promise.all([
    db.supplier.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    db.product.findMany({
      where: { isActive: true },
      include: { taxRate: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const supplierLabel = (s: (typeof suppliers)[number]) => (s.company ? `${s.name} (${s.company})` : s.name)

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Nouveau bon de commande" description="Commandez de la marchandise à un fournisseur." />
      <Card className="p-6">
        <DocumentForm
          partyLabel="Fournisseur"
          partyFieldName="supplierId"
          partyOptions={suppliers.map((s) => ({ id: s.id, label: supplierLabel(s) }))}
          products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name, priceHT: Number(p.priceHT), taxRate: Number(p.taxRate.rate) }))}
          submitAction={createPurchaseOrderAction}
          successPath="/achats"
          submitLabel="Créer le bon de commande"
          dateLabel="Livraison prévue"
          dateName="expectedDate"
          defaultConditions=""
        />
      </Card>
    </div>
  )
}