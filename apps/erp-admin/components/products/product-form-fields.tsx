import { Label, Input, Select, Textarea } from '@/components/ui'

export interface ProductFormFieldsProps {
  product?: {
    sku: string
    name: string
    slug: string
    description: string | null
    brand: string | null
    barcode: string | null
    priceHT: number
    costPrice: number | null
    unit: string
    weightKg: number | null
    categoryId: string | null
    taxRateId: string
    isActive: boolean
    isFeatured: boolean
    minStockAlert: number
    images: Array<{ url: string; isPrimary: boolean }>
  }
  categories: Array<{ id: string; name: string }>
  taxRates: Array<{ id: string; label: string; rate: number }>
}

export function ProductFormFields({ product, categories, taxRates }: ProductFormFieldsProps) {
  const imageList = product ? product.images.map((i) => i.url).join('\n') : ''
  const toDate = (v: unknown) => (typeof v === 'number' ? String(v) : String(v ?? ''))
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Référence (SKU) *</Label>
          <Input name="sku" required defaultValue={product?.sku} placeholder="Ex : EL-CAB-001" />
        </div>
        <div>
          <Label>Nom *</Label>
          <Input name="name" required defaultValue={product?.name} placeholder="Nom du produit" />
        </div>
      </div>
      <div>
        <Label>Slug (optionnel, auto si vide)</Label>
        <Input name="slug" defaultValue={product?.slug} placeholder="URL unique" />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea name="description" rows={3} defaultValue={product?.description ?? ''} placeholder="Description du produit…" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Marque</Label>
          <Input name="brand" defaultValue={product?.brand ?? ''} placeholder="Ex : Schneider, Legrand…" />
        </div>
        <div>
          <Label>Code-barres (EAN)</Label>
          <Input name="barcode" defaultValue={product?.barcode ?? ''} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Prix HT (DT) *</Label>
          <Input type="number" step="0.001" min="0" name="priceHT" required defaultValue={toDate(product?.priceHT)} placeholder="0.000" />
        </div>
        <div>
          <Label>Prix de revient (DT)</Label>
          <Input type="number" step="0.001" min="0" name="costPrice" defaultValue={toDate(product?.costPrice ?? '')} placeholder="Optionnel" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>Unité</Label>
          <Input name="unit" defaultValue={product?.unit ?? 'unité'} />
        </div>
        <div>
          <Label>Poids (kg)</Label>
          <Input type="number" step="0.001" min="0" name="weightKg" defaultValue={toDate(product?.weightKg ?? '')} placeholder="Optionnel" />
        </div>
        <div>
          <Label>Seuil d&apos;alerte stock</Label>
          <Input type="number" step="0.001" min="0" name="minStockAlert" defaultValue={toDate(product?.minStockAlert ?? 0)} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Catégorie</Label>
          <Select name="categoryId" defaultValue={product?.categoryId ?? ''}>
            <option value="">— Aucune —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Taux de TVA *</Label>
          <Select name="taxRateId" required defaultValue={product?.taxRateId}>
            <option value="">— Choisir —</option>
            {taxRates.map((t) => (
              <option key={t.id} value={t.id}>{t.label} ({Number(t.rate)}%)</option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label>Images (URLs, une par ligne — la première est l&apos;image principale)</Label>
        <Textarea name="images" rows={3} defaultValue={imageList} placeholder={'https://…/photo1.jpg\nhttps://…/photo2.jpg'} />
      </div>
      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="isActive" defaultChecked={product?.isActive ?? true} className="h-4 w-4 rounded border-slate-300" />
          Produit actif
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="isFeatured" defaultChecked={product?.isFeatured ?? false} className="h-4 w-4 rounded border-slate-300" />
          Mis en avant
        </label>
      </div>
    </>
  )
}