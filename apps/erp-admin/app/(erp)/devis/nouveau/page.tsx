import { PageHeader, Card } from '@/components/ui'
import { DocumentForm } from '@/components/documents/document-form'
import { createQuoteAction } from '@/lib/actions/erp'
import { db } from '@elec/db'

export const dynamic = 'force-dynamic'

export default async function NewQuotePage() {
  const products = await db.product.findMany({
    where: { isActive: true },
    include: { taxRate: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Nouveau devis" description="Créez un devis pour un client." />
      <Card className="p-6">
        <DocumentForm
          partyLabel="Client"
          partyFreeText
          showVatOption
          products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name, priceHT: Number(p.priceHT), taxRate: Number(p.taxRate.rate) }))}
          submitAction={createQuoteAction}
          successPath="/devis"
          submitLabel="Créer le devis"
          dateLabel="Valide jusqu&apos;au"
          dateName="validUntil"
          defaultConditions=""
        />
      </Card>
    </div>
  )
}