import { notFound } from 'next/navigation'
import { PageHeader, Card, Label, Input, Select, Textarea } from '@/components/ui'
import { EntityForm } from '@/components/ui/entity-form'
import { updateCategory } from '@/lib/actions/erp'
import { db } from '@elec/db'

export const dynamic = 'force-dynamic'

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [category, parents, taxRates] = await Promise.all([
    db.category.findUnique({ where: { id } }),
    db.category.findMany({ where: { NOT: { id } }, orderBy: { name: 'asc' } }),
    db.taxRate.findMany({ where: { active: true }, orderBy: { rate: 'asc' } }),
  ])
  if (!category) notFound()

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={`Modifier — ${category.name}`} description="Mettez à jour la catégorie." />
      <Card className="p-6">
        <EntityForm action={updateCategory.bind(null, id)} submitLabel="Enregistrer" cancelHref="/categories">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nom *</Label>
              <Input name="name" required defaultValue={category.name} />
            </div>
            <div>
              <Label>Slug</Label>
              <Input name="slug" defaultValue={category.slug} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea name="description" rows={2} defaultValue={category.description ?? ''} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Catégorie parente</Label>
              <Select name="parentId" defaultValue={category.parentId ?? ''}>
                <option value="">Aucune (racine)</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>TVA par défaut</Label>
              <Select name="taxRateId" defaultValue={category.taxRateId ?? ''}>
                <option value="">Héritée des produits</option>
                {taxRates.map((t) => (
                  <option key={t.id} value={t.id}>{t.label} ({Number(t.rate)}%)</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Ordre d&apos;affichage</Label>
              <Input type="number" name="sortOrder" defaultValue={category.sortOrder} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="active" defaultChecked={category.active} className="h-4 w-4 rounded border-slate-300" />
            Catégorie active
          </label>
        </EntityForm>
      </Card>
    </div>
  )
}