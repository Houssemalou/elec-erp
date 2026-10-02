import { PageHeader, Card } from '@/components/ui'
import { DocumentForm } from '@/components/documents/document-form'
import { createInvoiceAction } from '@/lib/actions/erp'
import { db } from '@elec/db'

export const dynamic = 'force-dynamic'

export default async function NewInvoicePage() {
  const products = await db.product.findMany({
    where: { isActive: true },
    include: { taxRate: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Nouvelle facture" description="Créez une facture (timbre fiscal 1 DT inclus)." />
      <Card className="p-6">
        <DocumentForm
          partyLabel="Client"
          partyFreeText
          partyDetailsFields
          products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name, priceHT: Number(p.priceHT), priceTTC: p.priceTTC === null ? null : Number(p.priceTTC), taxRate: Number(p.taxRate.rate) }))}
          submitAction={createInvoiceAction}
          successPath="/factures"
          submitLabel="Créer la facture"
          dateLabel="Date d&apos;émission"
          dateName="issueDate"
          extraDate={{ label: 'Échéance', name: 'dueDate', default: '' }}
        />
      </Card>
    </div>
  )
}