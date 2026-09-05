import { PageHeader, Card } from '@/components/ui'
import { EntityForm } from '@/components/ui/entity-form'
import { ProductFormFields } from '@/components/products/product-form-fields'
import { createProduct } from '@/lib/actions/erp'
import { db } from '@elec/db'

export const dynamic = 'force-dynamic'

export default async function NewProductPage() {
  const [categories, taxRates] = await Promise.all([
    db.category.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    db.taxRate.findMany({ where: { active: true }, orderBy: { rate: 'asc' } }),
  ])

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nouveau produit" description="Ajoutez un produit au catalogue." />
      <Card className="p-6">
        <EntityForm action={createProduct} submitLabel="Créer le produit" cancelHref="/produits">
          <ProductFormFields
            categories={categories.map((c) => ({ id: c.id, name: c.name, markupPercent: c.markupPercent ? Number(c.markupPercent) : null }))}
            taxRates={taxRates.map((t) => ({ id: t.id, label: t.label, rate: Number(t.rate) }))}
          />
        </EntityForm>
      </Card>
    </div>
  )
}