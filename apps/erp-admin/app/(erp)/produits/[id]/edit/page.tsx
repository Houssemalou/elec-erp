import { notFound } from 'next/navigation'
import { PageHeader, Card } from '@/components/ui'
import { EntityForm } from '@/components/ui/entity-form'
import { ProductFormFields } from '@/components/products/product-form-fields'
import { updateProduct } from '@/lib/actions/erp'
import { db } from '@elec/db'

export const dynamic = 'force-dynamic'

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [product, categories, taxRates] = await Promise.all([
    db.product.findUnique({ where: { id }, include: { images: { orderBy: { sortOrder: 'asc' } } } }),
    db.category.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    db.taxRate.findMany({ where: { active: true }, orderBy: { rate: 'asc' } }),
  ])
  if (!product) notFound()

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Modifier — ${product.name}`} description={`Référence ${product.sku}`} />
      <Card className="p-6">
        <EntityForm action={updateProduct.bind(null, id)} submitLabel="Enregistrer" cancelHref="/produits">
          <ProductFormFields
            product={{
              ...product,
              priceHT: Number(product.priceHT),
              costPrice: product.costPrice === null ? null : Number(product.costPrice),
              weightKg: product.weightKg === null ? null : Number(product.weightKg),
              minStockAlert: Number(product.minStockAlert),
            }}
            categories={categories.map((c) => ({ id: c.id, name: c.name, markupPercent: c.markupPercent ? Number(c.markupPercent) : null }))}
            taxRates={taxRates.map((t) => ({ id: t.id, label: t.label, rate: Number(t.rate) }))}
          />
        </EntityForm>
      </Card>
    </div>
  )
}