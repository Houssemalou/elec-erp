import { PageHeader, Card, Label, Input, Select, Textarea } from '@/components/ui'
import { EntityForm } from '@/components/ui/entity-form'
import { createCategory } from '@/lib/actions/erp'
import { db } from '@elec/db'

export const dynamic = 'force-dynamic'

export default async function NewCategoryPage() {
  const [parents, taxRates] = await Promise.all([
    db.category.findMany({ orderBy: { name: 'asc' } }),
    db.taxRate.findMany({ where: { active: true }, orderBy: { rate: 'asc' } }),
  ])

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Nouvelle catégorie" description="Créez une catégorie de produits." />
      <Card className="p-6">
        <EntityForm action={createCategory} submitLabel="Créer la catégorie" cancelHref="/categories">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nom *</Label>
              <Input name="name" required placeholder="Ex : Disjoncteurs" />
            </div>
            <div>
              <Label>Slug (optionnel, auto si vide)</Label>
              <Input name="slug" placeholder="ex : disjoncteurs" />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea name="description" rows={2} placeholder="Description courte…" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Catégorie parente</Label>
              <Select name="parentId">
                <option value="">Aucune (racine)</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>TVA par défaut</Label>
              <Select name="taxRateId">
                <option value="">Héritée des produits</option>
                {taxRates.map((t) => (
                  <option key={t.id} value={t.id}>{t.label} ({Number(t.rate)}%)</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Ordre d&apos;affichage</Label>
              <Input type="number" name="sortOrder" defaultValue="0" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="active" defaultChecked className="h-4 w-4 rounded border-slate-300" />
            Catégorie active
          </label>
        </EntityForm>
      </Card>
    </div>
  )
}