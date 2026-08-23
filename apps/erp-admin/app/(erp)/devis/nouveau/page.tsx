import { PageHeader, Card } from '@/components/ui'
import { DocumentForm } from '@/components/documents/document-form'
import { createQuoteAction } from '@/lib/actions/erp'
import { db } from '@elec/db'

export const dynamic = 'force-dynamic'

export default async function NewQuotePage() {
  const [customers, products] = await Promise.all([
    db.customer.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } }),
    db.product.findMany({
      where: { isActive: true },
      include: { taxRate: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const customerName = (c: (typeof customers)[number]) =>
    c.companyName || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Client sans nom'

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Nouveau devis" description="Créez un devis pour un client." />
      <Card className="p-6">
        <DocumentForm
          partyLabel="Client"
          partyOptions={customers.map((c) => ({ id: c.id, label: customerName(c), companyName: c.companyName }))}
          products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name, priceHT: Number(p.priceHT), taxRate: Number(p.taxRate.rate) }))}
          submitAction={createQuoteAction}
          successPath="/devis"
          submitLabel="Créer le devis"
          dateLabel="Valide jusqu&apos;au"
          dateName="validUntil"
          partyCompanyName
          defaultConditions=""
        />
      </Card>
    </div>
  )
}