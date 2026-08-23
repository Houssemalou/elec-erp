import { notFound } from 'next/navigation'
import { PageHeader, Card } from '@/components/ui'
import { DocumentForm, type DocLine } from '@/components/documents/document-form'
import { updateQuoteAction } from '@/lib/actions/erp'
import { db } from '@elec/db'

export const dynamic = 'force-dynamic'

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [quote, customers, products] = await Promise.all([
    db.quote.findUnique({
      where: { id },
      include: { items: { include: { taxRate: true } }, customer: true },
    }),
    db.customer.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } }),
    db.product.findMany({
      where: { isActive: true },
      include: { taxRate: true },
      orderBy: { name: 'asc' },
    }),
  ])
  if (!quote) notFound()

  const customerName = (c: (typeof customers)[number]) =>
    c.companyName || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Client sans nom'

  const lines: DocLine[] = quote.items.map((i, idx) => ({
    key: `existing-${idx}`,
    productId: i.productId ?? '',
    sku: i.sku,
    designation: i.designation,
    quantity: String(Number(i.quantity)),
    unitPriceHT: String(Number(i.unitPriceHT)),
    discountType: i.discountType ?? '',
    discountValue: String(Number(i.discountValue)),
    taxRate: Number(i.taxRate.rate),
  }))

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title={`Modifier — ${quote.number}`} description="Seuls les devis brouillons sont modifiables." />
      <Card className="p-6">
        <DocumentForm
          partyLabel="Client"
          partyOptions={customers.map((c) => ({ id: c.id, label: customerName(c), companyName: c.companyName }))}
          products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name, priceHT: Number(p.priceHT), taxRate: Number(p.taxRate.rate) }))}
          submitAction={updateQuoteAction.bind(null, id)}
          successPath="/devis"
          submitLabel="Enregistrer les modifications"
          defaultPartyId={quote.customerId}
          defaultLines={lines}
          defaultGlobalDiscountType={Number(quote.discountGlobal) > 0 ? 'AMOUNT' : ''}
          defaultGlobalDiscountValue={String(Number(quote.discountGlobal) || '')}
          defaultNotes={quote.notes ?? ''}
          defaultConditions={quote.conditions ?? ''}
          dateLabel="Valide jusqu&apos;au"
          dateName="validUntil"
          defaultDate={quote.validUntil ? quote.validUntil.toISOString().slice(0, 10) : ''}
          partyCompanyName
        />
      </Card>
    </div>
  )
}