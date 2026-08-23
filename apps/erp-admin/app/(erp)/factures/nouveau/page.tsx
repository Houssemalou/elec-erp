import { PageHeader, Card } from '@/components/ui'
import { DocumentForm } from '@/components/documents/document-form'
import { createInvoiceAction } from '@/lib/actions/erp'
import { db } from '@elec/db'

export const dynamic = 'force-dynamic'

export default async function NewInvoicePage() {
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
      <PageHeader title="Nouvelle facture" description="Créez une facture (timbre fiscal 1 DT inclus)." />
      <Card className="p-6">
        <DocumentForm
          partyLabel="Client"
          partyOptions={customers.map((c) => ({ id: c.id, label: customerName(c), companyName: c.companyName }))}
          products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name, priceHT: Number(p.priceHT), taxRate: Number(p.taxRate.rate) }))}
          submitAction={createInvoiceAction}
          successPath="/factures"
          submitLabel="Créer la facture"
          dateLabel="Date d&apos;émission"
          dateName="issueDate"
          partyCompanyName
          extraDate={{ label: 'Échéance', name: 'dueDate', default: '' }}
        />
      </Card>
    </div>
  )
}