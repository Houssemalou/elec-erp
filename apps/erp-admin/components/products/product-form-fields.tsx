'use client'

import { useEffect, useRef } from 'react'
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
  categories: Array<{ id: string; name: string; markupPercent?: number | null }>
  taxRates: Array<{ id: string; label: string; rate: number }>
}

export function ProductFormFields({ product, categories, taxRates }: ProductFormFieldsProps) {
  const imageList = product ? product.images.map((i) => i.url).join('\n') : ''
  const toDate = (v: unknown) => (typeof v === 'number' ? String(v) : String(v ?? ''))
  const priceHTRef = useRef<HTMLInputElement>(null)
  const costPriceRef = useRef<HTMLInputElement>(null)
  const categoryRef = useRef<HTMLSelectElement>(null)
  const userEditedRef = useRef(false)

  useEffect(() => {
    const priceEl = priceHTRef.current
    const costEl = costPriceRef.current
    const catEl = categoryRef.current
    if (!priceEl || !costEl || !catEl) return

    const onInput = () => { userEditedRef.current = true }

    priceEl.addEventListener('input', onInput)
    return () => priceEl.removeEventListener('input', onInput)
  }, [])

  useEffect(() => {
    const priceEl = priceHTRef.current
    const costEl = costPriceRef.current
    const catEl = categoryRef.current
    if (!priceEl || !costEl || !catEl) return

    const recalc = () => {
      if (userEditedRef.current) return
      const cost = parseFloat(costEl.value)
      if (!cost || isNaN(cost)) return
      const catId = catEl.value
      const cat = categories.find((c) => c.id === catId)
      if (!cat?.markupPercent) return
      const markup = Number(cat.markupPercent)
      if (!markup || isNaN(markup)) return
      const computed = cost * (1 + markup / 100)
      priceEl.value = computed.toFixed(3)
    }

    costEl.addEventListener('input', recalc)
    catEl.addEventListener('change', () => { userEditedRef.current = false; recalc() })
    return () => {
      costEl.removeEventListener('input', recalc)
      catEl.removeEventListener('change', recalc)
    }
  }, [categories])

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
          <Label>Prix de revient (DT)</Label>
          <input ref={costPriceRef} type="number" step="0.001" min="0" name="costPrice" defaultValue={toDate(product?.costPrice ?? '')} placeholder="Optionnel" className="h-11 w-full rounded-xl border border-[#2A2A2A] bg-[#151515] px-3 text-sm text-white placeholder:text-white/40 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-400/20" />
        </div>
        <div>
          <Label>Prix HT (DT) *</Label>
          <input ref={priceHTRef} type="number" step="0.001" min="0" name="priceHT" required defaultValue={toDate(product?.priceHT)} placeholder="0.000" className="h-11 w-full rounded-xl border border-[#2A2A2A] bg-[#151515] px-3 text-sm text-white placeholder:text-white/40 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-400/20" />
          <p className="mt-1 text-xs text-white/40">Calculé automatiquement si la catégorie a une marge définie, ou saisi manuellement.</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Catégorie</Label>
          <select ref={categoryRef} name="categoryId" defaultValue={product?.categoryId ?? ''} className="h-11 w-full rounded-xl border border-[#2A2A2A] bg-[#151515] px-3 text-sm text-white focus:border-accent-400 focus:outline-none">
            <option value="">— Aucune —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.markupPercent ? ` (marge ${c.markupPercent}%)` : ''}</option>
            ))}
          </select>
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
      <div>
        <Label>Images (URLs, une par ligne — la première est l&apos;image principale)</Label>
        <Textarea name="images" rows={3} defaultValue={imageList} placeholder={'https://…/photo1.jpg\nhttps://…/photo2.jpg'} />
      </div>
      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input type="checkbox" name="isActive" defaultChecked={product?.isActive ?? true} className="h-4 w-4 rounded border-[#2A2A2A] accent-[#FFC400]" />
          Produit actif
        </label>
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input type="checkbox" name="isFeatured" defaultChecked={product?.isFeatured ?? false} className="h-4 w-4 rounded border-[#2A2A2A] accent-[#FFC400]" />
          Mis en avant
        </label>
      </div>
    </>
  )
}
