import { PageHeader, Card } from '@/components/ui'
import { DocumentForm } from '@/components/documents/document-form'
import { createCreditNoteAction } from '@/lib/actions/erp'
import { db } from '@elec/db'

export const dynamic = 'force-dynamic'

export default async function NewCreditNotePage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string }>
}) {
  const { invoice } = await searchParams
  const [invoices, products] = await Promise.all([
    db.invoice.findMany({
      where: { status: { notIn: ['CANCELLED', 'CREDITED'] } },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.product.findMany({
      where: { isActive: true },
      include: { taxRate: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const invoiceLabel = (i: (typeof invoices)[number]) =>
    `${i.number} — ${i.customer.companyName || [i.customer.firstName, i.customer.lastName].filter(Boolean).join(' ') || 'Client'}`

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Nouvel avoir" description="Retour client lié à une facture — le stock sera réincrémenté à la validation." />
      <Card className="p-6">
        <DocumentForm
          partyLabel="Facture"
          partyFieldName="invoiceId"
          partyOptions={invoices.map((i) => ({ id: i.id, label: invoiceLabel(i) }))}
          products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name, priceHT: Number(p.priceHT), taxRate: Number(p.taxRate.rate) }))}
          submitAction={createCreditNoteAction}
          successPath="/avoirs"
          submitLabel="Créer l&apos;avoir"
          defaultPartyId={invoice || undefined}
          reason
        />
      </Card>
    </div>
  )
}