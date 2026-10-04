import { PageHeader, Card } from '@/components/ui'
import { DocumentForm } from '@/components/documents/document-form'
import { createPurchaseInvoiceAction } from '@/lib/actions/erp'
import { db } from '@elec/db'

export const dynamic = 'force-dynamic'

export default async function NewPurchaseInvoicePage() {
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
      <PageHeader
        title="Nouvelle facture d'achat"
        description="Enregistrez une facture reçue de votre fournisseur. Le prix d'achat se saisit en TTC, comme sur une facture de vente."
      />
      <Card className="p-6">
        <DocumentForm
          partyLabel="Fournisseur"
          partyFieldName="supplierId"
          partyOptions={suppliers.map((s) => ({ id: s.id, label: supplierLabel(s) }))}
          products={products.map((p) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            priceHT: Number(p.priceHT),
            priceTTC: p.priceTTC != null ? Number(p.priceTTC) : null,
            costPrice: p.costPrice != null ? Number(p.costPrice) : null,
            taxRate: Number(p.taxRate.rate),
          }))}
          submitAction={createPurchaseInvoiceAction}
          successPath="/achats"
          submitLabel="Créer la facture d'achat"
          dateLabel="Date de la facture"
          dateName="issueDate"
          extraDate={{ label: 'Échéance', name: 'dueDate', default: '' }}
          unitPriceFrom="cost"
          totalsInTTC
        />
      </Card>
    </div>
  )
}