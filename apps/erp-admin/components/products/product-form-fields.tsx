'use client'

import { useState } from 'react'
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
    priceTTC?: number | null
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

function roundMillime(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000
}

/** Le prix saisi n'est jamais réécrit : au plus 3 décimales, sans zéro inutile. */
function formatPrice(value: number): string {
  return String(roundMillime(value))
}

/** Affichage en DT : 3 décimales, virgule française. */
function formatDT(value: number): string {
  return `${formatPrice(value).replace('.', ',')} DT`
}

export function ProductFormFields({ product, categories, taxRates }: ProductFormFieldsProps) {
  const imageList = product ? product.images.map((i) => i.url).join('\n') : ''
  const toNumberOrEmpty = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? formatPrice(v) : '')
  const initialTaxRateId = product?.taxRateId ?? taxRates.find((t) => t.isDefault)?.id ?? ''
  const initialTaxRate = taxRates.find((t) => t.id === initialTaxRateId)?.rate ?? 0
  const initialPriceTTC = toNumberOrEmpty(product?.priceTTC ?? (product ? product.priceHT * (1 + initialTaxRate / 100) : ''))
  const [priceTTC, setPriceTTC] = useState(initialPriceTTC)
  const [costPrice, setCostPrice] = useState(toNumberOrEmpty(product?.costPrice ?? ''))
  const [selectedCategoryId, setSelectedCategoryId] = useState(product?.categoryId ?? '')
  const [selectedTaxRateId, setSelectedTaxRateId] = useState(initialTaxRateId)

  const selectedPreRef = categories.find((c) => c.id === selectedCategoryId)?.preRef ?? null
  const selectedTaxRate = taxRates.find((t) => t.id === selectedTaxRateId)?.rate ?? 0
  const autoSku = !!selectedPreRef && !product

  const factor = 1 + selectedTaxRate / 100
  const priceTTCNumber = Number(priceTTC)
  const priceHTDisplay =
    priceTTC.trim() && Number.isFinite(priceTTCNumber) && factor > 0 ? roundMillime(priceTTCNumber / factor) : ''
  const costNumber = Number(costPrice)
  const costTTC =
    costPrice.trim() && Number.isFinite(costNumber) && factor > 0 ? roundMillime(costNumber * factor) : null
  const gainTTC =
    costTTC !== null && priceTTC.trim() && Number.isFinite(priceTTCNumber)
      ? roundMillime(priceTTCNumber - costTTC)
      : null

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
          <Label>Prix de revient HT (DT)</Label>
          <Input
            type="number"
            step="any"
            min="0"
            name="costPrice"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            onBlur={() => {
              const value = Number(costPrice)
              if (costPrice.trim() && Number.isFinite(value)) setCostPrice(formatPrice(value))
            }}
            placeholder="Optionnel"
            className="h-11"
          />
          <p className="mt-1 text-xs text-white/40">
            Prix de revient TTC :{' '}
            <span className="font-semibold text-accent-400">{costTTC === null ? '—' : formatDT(costTTC)}</span>
          </p>
        </div>
        <div>
          <Label>Prix de vente TTC (DT) *</Label>
          <Input
            type="number"
            step="any"
            min="0"
            name="priceTTC"
            value={priceTTC}
            onChange={(e) => setPriceTTC(e.target.value)}
            onBlur={() => {
              const value = Number(priceTTC)
              if (priceTTC.trim() && Number.isFinite(value)) setPriceTTC(formatPrice(value))
            }}
            required
            placeholder="0.000"
            className="h-11"
          />
          <p className="mt-1 text-xs text-white/40">
            Ce prix est repris tel quel sur les factures, les devis et le point de vente.
            {gainTTC !== null ? (
              <>
                {' '}
                Gain TTC : <span className="font-semibold text-emerald-400">{formatDT(gainTTC)}</span>
              </>
            ) : null}
          </p>
        </div>
        <div>
          <Label>Prix de vente HT (DT)</Label>
          <Input type="text" readOnly value={priceHTDisplay} placeholder="0.000" className="h-11 opacity-70" />
          <p className="mt-1 text-xs text-white/40">
            Base HT de la facture, déduite du prix TTC saisi (÷ {formatDT(factor)}). Aucun arrondi appliqué à votre
            prix.
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Catégorie</Label>
          <select
            name="categoryId"
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
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
            onChange={(e) => setSelectedTaxRateId(e.target.value)}
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
          <Input type="number" step="any" min="0" name="weightKg" defaultValue={String(product?.weightKg ?? '')} placeholder="Optionnel" />
        </div>
        <div>
          <Label>Seuil d&apos;alerte stock</Label>
          <Input type="number" step="any" min="0" name="minStockAlert" defaultValue={String(product?.minStockAlert ?? 0)} />
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
