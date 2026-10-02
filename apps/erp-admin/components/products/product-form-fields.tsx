'use client'

import { useRef, useState } from 'react'
import { Label, Input, Textarea } from '@/components/ui'

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
  categories: Array<{ id: string; name: string; markupPercent?: number | null; preRef?: string | null }>
  taxRates: Array<{ id: string; label: string; rate: number; isDefault?: boolean }>
}

function roundPrice(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Au plus deux chiffres après la virgule, sans zéro inutile : 88, 1.4, 87.97. */
function formatPrice(value: number): string {
  return String(roundPrice(value))
}

function calculatePriceTTC(priceHT: string, rate: number | undefined): string {
  if (!priceHT.trim() || rate === undefined || !Number.isFinite(rate)) return ''
  const value = Number(priceHT)
  if (!Number.isFinite(value)) return ''
  return formatPrice(value * (1 + rate / 100))
}

function calculatePriceHT(priceTTC: string, rate: number | undefined): string {
  if (!priceTTC.trim() || rate === undefined || !Number.isFinite(rate)) return ''
  const value = Number(priceTTC)
  const factor = 1 + rate / 100
  if (!Number.isFinite(value) || factor <= 0) return ''
  return formatPrice(value / factor)
}

export function ProductFormFields({ product, categories, taxRates }: ProductFormFieldsProps) {
  const imageList = product ? product.images.map((i) => i.url).join('\n') : ''
  const toDate = (v: unknown) => (typeof v === 'number' ? String(v) : String(v ?? ''))
  const toPrice = (v: unknown) => (typeof v === 'number' ? formatPrice(v) : String(v ?? ''))
  const initialTaxRateId = product?.taxRateId ?? taxRates.find((t) => t.isDefault)?.id ?? ''
  const initialTaxRate = taxRates.find((t) => t.id === initialTaxRateId)?.rate
  const initialPriceHT = toPrice(product?.priceHT)
  const [priceHT, setPriceHT] = useState(initialPriceHT)
  const [priceTTC, setPriceTTC] = useState(() => calculatePriceTTC(initialPriceHT, initialTaxRate))
  const [costPrice, setCostPrice] = useState(toPrice(product?.costPrice ?? ''))
  const [selectedCategoryId, setSelectedCategoryId] = useState(product?.categoryId ?? '')
  const [selectedTaxRateId, setSelectedTaxRateId] = useState(initialTaxRateId)
  const priceHTUserEditedRef = useRef(false)

  const selectedPreRef = categories.find((c) => c.id === selectedCategoryId)?.preRef ?? null
  const selectedTaxRate = taxRates.find((t) => t.id === selectedTaxRateId)?.rate
  const autoSku = !!selectedPreRef && !product

  const updatePriceTTC = (nextPriceHT: string, rate = selectedTaxRate) => {
    setPriceTTC(calculatePriceTTC(nextPriceHT, rate))
  }

  const applyMarkup = (nextCostPrice: string, categoryId: string, rate = selectedTaxRate): string | null => {
    const cost = Number(nextCostPrice)
    const category = categories.find((c) => c.id === categoryId)
    const markup = Number(category?.markupPercent)
    if (!nextCostPrice.trim() || !Number.isFinite(cost) || cost <= 0 || !category?.markupPercent || !Number.isFinite(markup)) return null
    const computed = formatPrice(cost * (1 + markup / 100))
    setPriceHT(computed)
    updatePriceTTC(computed, rate)
    return computed
  }

  const handlePriceHTChange = (value: string) => {
    priceHTUserEditedRef.current = value.trim() !== ''
    setPriceHT(value)
    updatePriceTTC(value)
  }

  const handlePriceTTCChange = (value: string) => {
    priceHTUserEditedRef.current = value.trim() !== ''
    setPriceTTC(value)
    if (!value.trim()) {
      setPriceHT('')
      return
    }
    const nextPriceHT = calculatePriceHT(value, selectedTaxRate)
    if (nextPriceHT) setPriceHT(nextPriceHT)
  }

  const handleCostPriceChange = (value: string) => {
    setCostPrice(value)
    if (!priceHTUserEditedRef.current) applyMarkup(value, selectedCategoryId)
  }

  const handleCategoryChange = (value: string) => {
    setSelectedCategoryId(value)
    if (priceHTUserEditedRef.current) {
      updatePriceTTC(priceHT)
      return
    }
    const computedPriceHT = applyMarkup(costPrice, value)
    if (!computedPriceHT) updatePriceTTC(priceHT)
  }

  const handleTaxRateChange = (value: string) => {
    const rate = taxRates.find((t) => t.id === value)?.rate
    setSelectedTaxRateId(value)
    updatePriceTTC(priceHT, rate)
  }

  const handlePriceHTBlur = () => {
    const value = Number(priceHT)
    if (!priceHT.trim() || !Number.isFinite(value)) return
    const formatted = formatPrice(value)
    setPriceHT(formatted)
    updatePriceTTC(formatted)
  }

  const handlePriceTTCBlur = () => {
    const value = Number(priceTTC)
    if (!priceTTC.trim() || !Number.isFinite(value)) return
    const formatted = formatPrice(value)
    setPriceTTC(formatted)
    const nextPriceHT = calculatePriceHT(formatted, selectedTaxRate)
    if (nextPriceHT) setPriceHT(nextPriceHT)
  }

  const handleCostPriceBlur = () => {
    const value = Number(costPrice)
    if (!costPrice.trim() || !Number.isFinite(value)) return
    setCostPrice(formatPrice(value))
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Référence (SKU) *</Label>
          <Input
            name="sku"
            required={!autoSku}
            readOnly={autoSku}
            defaultValue={product?.sku}
            placeholder={autoSku ? `${selectedPreRef}001` : 'Ex : EL-CAB-001'}
            className={autoSku ? 'opacity-60' : ''}
          />
          {autoSku ? (
            <p className="mt-1 text-xs text-white/40">
              Référence auto-générée : {selectedPreRef}001, {selectedPreRef}002, … (saisie manuelle ignorée)
            </p>
          ) : null}
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
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>Prix de revient (DT)</Label>
          <Input
            type="number"
            step="any"
            min="0"
            name="costPrice"
            value={costPrice}
            onChange={(e) => handleCostPriceChange(e.target.value)}
            onBlur={handleCostPriceBlur}
            placeholder="Optionnel"
            className="h-11"
          />
        </div>
        <div>
          <Label>Prix de vente HT (DT) *</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            name="priceHT"
            value={priceHT}
            onChange={(e) => handlePriceHTChange(e.target.value)}
            onBlur={handlePriceHTBlur}
            required
            placeholder="0.00"
            className="h-11"
          />
          <p className="mt-1 text-xs text-white/40">Repris depuis le prix de revient et la marge de la catégorie tant que vous ne l'avez pas saisi. Dès que vous tapez un prix, il n'est plus modifié automatiquement.</p>
        </div>
        <div>
          <Label>Prix de vente TTC (DT) *</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            name="priceTTC"
            value={priceTTC}
            onChange={(e) => handlePriceTTCChange(e.target.value)}
            onBlur={handlePriceTTCBlur}
            required
            placeholder="0.00"
            className="h-11"
          />
          <p className="mt-1 text-xs text-white/40">Calculé automatiquement. Vous pouvez le modifier ; le prix HT sera ajusté.</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Catégorie</Label>
          <select
            name="categoryId"
            value={selectedCategoryId}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="h-11 w-full rounded-xl border border-[#2A2A2A] bg-[#151515] px-3 text-sm text-white focus:border-accent-400 focus:outline-none"
          >
            <option value="">— Aucune —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.markupPercent ? ` (marge ${c.markupPercent}%)` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Taux de TVA *</Label>
          <select
            name="taxRateId"
            value={selectedTaxRateId}
            onChange={(e) => handleTaxRateChange(e.target.value)}
            required
            className="h-11 w-full rounded-xl border border-[#2A2A2A] bg-[#151515] px-3 text-sm text-white focus:border-accent-400 focus:outline-none"
          >
            <option value="">— Choisir —</option>
            {taxRates.map((t) => (
              <option key={t.id} value={t.id}>{t.label} ({Number(t.rate)}%)</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>Unité</Label>
          <Input name="unit" defaultValue={product?.unit ?? 'unité'} />
        </div>
        <div>
          <Label>Poids (kg)</Label>
          <Input type="number" step="any" min="0" name="weightKg" defaultValue={toDate(product?.weightKg ?? '')} placeholder="Optionnel" />
        </div>
        <div>
          <Label>Seuil d&apos;alerte stock</Label>
          <Input type="number" step="any" min="0" name="minStockAlert" defaultValue={toDate(product?.minStockAlert ?? 0)} />
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
