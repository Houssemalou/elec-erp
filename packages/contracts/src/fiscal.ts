// ============================================================================
// Logique fiscale tunisienne — FONCTIONS PURES
//
// Le prix saisi par l'utilisateur est le PRIX TTC : il est affiché tel quel sur
// la facture, le devis et le ticket de caisse, jamais recalculé. Le HT et la
// TVA en découlent : HT = TTC / (1 + taux) puis TVA = TTC - HT.
//
// Règle essentielle (conformité) : la remise (ligne et globale) est appliquée
// AVANT le calcul de la TVA. La TVA se calcule toujours sur le prix NET après
// remise, jamais sur le prix brut.
//
// Ces fonctions sont les SEULES sources de vérité du calcul. Le frontend
// (aperçu temps réel) et le backend (Server Actions, services) les importent
// depuis @elec/contracts : aucun recalcul divergent, donc aucun écart
// d'arrondi possible.
// ============================================================================

import { roundMoney, toNumber } from './money'

export type DiscountType = 'PERCENT' | 'AMOUNT'

export interface LineInput {
  quantity: number | string
  /** Prix unitaire HT (brut). Ignoré si unitPriceTTC est renseigné. */
  unitPriceHT?: number | string | null
  /** Prix unitaire TTC saisi (prix maître) : sert de base à toute la ligne. */
  unitPriceTTC?: number | string | null
  discountType?: DiscountType | null
  /** % si discountType = PERCENT, montant en DT si AMOUNT. */
  discountValue?: number | string | null
  /** Taux de TVA en nombre (ex : 19, 13, 7). */
  taxRate: number
}

export interface LineTotals {
  /** PU HT net après remise ligne. */
  netUnitPrice: number
  /** PU TTC net après remise ligne (jamais recalculé à l'affichage). */
  netUnitPriceTTC: number
  /** Prix HT de la ligne. */
  lineHT: number
  /** Montant TVA de la ligne. */
  lineTVA: number
  /** Prix TTC de la ligne = PU TTC saisi net × quantité. */
  lineTTC: number
}

/** Applique la remise ligne (%) ou en montant (DT) sur un prix de base. */
function applyDiscountOn(base: number, input: LineInput): number {
  const qty = toNumber(input.quantity)
  if (qty === 0) return roundMoney(base)

  if (input.discountType === 'PERCENT') {
    const percent = toNumber(input.discountValue ?? 0)
    return roundMoney(base * (1 - percent / 100))
  }
  if (input.discountType === 'AMOUNT') {
    const amount = toNumber(input.discountValue ?? 0)
    return roundMoney(base - amount)
  }
  return roundMoney(base)
}

/** Prix unitaire HT saisi, ou déduit du prix TTC saisi. */
export function unitPriceHTFrom(input: LineInput): number {
  const ttc = input.unitPriceTTC
  if (ttc === null || ttc === undefined || ttc === '') return toNumber(input.unitPriceHT ?? 0)
  const factor = 1 + toNumber(input.taxRate) / 100
  if (factor <= 0) return toNumber(input.unitPriceHT ?? 0)
  return roundMoney(toNumber(ttc) / factor)
}

/**
 * Calcule le prix unitaire net HT après remise ligne.
 * Cohérent avec calculateLineTotal : la remise s'applique sur le prix saisi
 * (TTC s'il est fourni), le HT net en découle.
 */
export function applyLineDiscount(input: LineInput): number {
  return calculateLineTotal(input).netUnitPrice
}

/**
 * Calcule les totaux d'une ligne de devis/facture.
 * Base : le PU TTC saisi quand il existe (sinon le PU HT saisi).
 * Ordre : remise sur le prix saisi → prix net → total de ligne → HT = TTC / (1 + taux)
 * → TVA = TTC - HT.
 */
export function calculateLineTotal(input: LineInput): LineTotals {
  const qty = toNumber(input.quantity)
  const rate = toNumber(input.taxRate)
  const factor = 1 + rate / 100
  const ttcSaisi = input.unitPriceTTC

  if (ttcSaisi !== null && ttcSaisi !== undefined && ttcSaisi !== '' && toNumber(ttcSaisi) > 0) {
    const netUnitPriceTTC = applyDiscountOn(toNumber(ttcSaisi), input)
    const lineTTC = roundMoney(netUnitPriceTTC * qty)
    const lineHT = factor > 0 ? roundMoney(lineTTC / factor) : lineTTC
    const lineTVA = roundMoney(lineTTC - lineHT)
    const netUnitPrice = qty !== 0 ? roundMoney(lineHT / qty) : lineHT
    return { netUnitPrice, netUnitPriceTTC, lineHT, lineTVA, lineTTC }
  }

  const netUnitPrice = applyDiscountOn(toNumber(input.unitPriceHT ?? 0), input)
  const lineHT = roundMoney(netUnitPrice * qty)
  const lineTVA = roundMoney(lineHT * (rate / 100))
  const lineTTC = roundMoney(lineHT + lineTVA)
  const netUnitPriceTTC = factor > 0 ? roundMoney(netUnitPrice * factor) : netUnitPrice
  return { netUnitPrice, netUnitPriceTTC, lineHT, lineTVA, lineTTC }
}

export interface GlobalDiscount {
  type: DiscountType
  value: number | string
}

export interface DocumentInput {
  lines: LineInput[]
  globalDiscount?: GlobalDiscount | null
  /** Timbre fiscal : 1 DT sur les factures, 0 sur les devis. */
  timbreFiscal?: number | string
}

export interface RateBreakdown {
  /** Taux (ex : 19). */
  rate: number
  /** Base HT (après remise globale) soumise à ce taux. */
  baseHT: number
  /** Montant TVA arrondi au millime pour ce taux. */
  tva: number
}

export interface DocumentTotals {
  lines: LineTotals[]
  /** Somme des lignes avant remise globale. */
  totalHTBeforeGlobal: number
  /** Montant de la remise globale en DT. */
  discountGlobal: number
  /** Total HT après remise globale. */
  totalHT: number
  /** Découpage TVA par taux (base réduite proportionnellement). */
  vatBreakdown: RateBreakdown[]
  /** Total TVA = somme des TVA par taux. */
  totalTVA: number
  timbreFiscal: number
  /** Net à payer = totalHT + totalTVA + timbre. */
  totalTTC: number
}

/** Montant de la remise globale en DT. */
export function calculateGlobalDiscountAmount(
  totalHTBeforeGlobal: number,
  globalDiscount?: GlobalDiscount | null,
): number {
  if (!globalDiscount) return 0
  if (globalDiscount.type === 'PERCENT') {
    return roundMoney(totalHTBeforeGlobal * (toNumber(globalDiscount.value) / 100))
  }
  return roundMoney(toNumber(globalDiscount.value))
}

/**
 * Calcule les totaux d'un document (devis ou facture).
 *
 * - Remise globale appliquée sur le total HT.
 * - La TVA est ensuite recalculée sur la base réduite, répartie
 *   proportionnellement entre les taux utilisés, chaque taux arrondi au
 *   millime (pour que la ventilation "TVA 19% : X DT, TVA 13% : Y DT"
 *   affichée dans le récapitulatif somme exactement au total TVA).
 */
export function calculateDocumentTotals(input: DocumentInput): DocumentTotals {
  const lines = input.lines.map((line) => calculateLineTotal(line))

  const totalHTBeforeGlobal = roundMoney(lines.reduce((sum, l) => sum + l.lineHT, 0))
  const discountGlobal = calculateGlobalDiscountAmount(totalHTBeforeGlobal, input.globalDiscount)
  const totalHT = roundMoney(totalHTBeforeGlobal - discountGlobal)

  // Base HT par taux AVANT remise globale (pour la répartition proportionnelle).
  const basesBefore = new Map<number, number>()
  for (const line of input.lines) {
    const totals = calculateLineTotal(line)
    const rate = toNumber(line.taxRate)
    basesBefore.set(rate, (basesBefore.get(rate) ?? 0) + totals.lineHT)
  }

  const ratio = totalHTBeforeGlobal > 0 ? totalHT / totalHTBeforeGlobal : 0
  const vatBreakdown: RateBreakdown[] = [...basesBefore.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, baseHT]) => {
      const reducedBase = roundMoney(baseHT * ratio)
      const tva = roundMoney(reducedBase * (rate / 100))
      return { rate, baseHT: reducedBase, tva }
    })

  const totalTVA = roundMoney(vatBreakdown.reduce((sum, b) => sum + b.tva, 0))
  const timbreFiscal = roundMoney(toNumber(input.timbreFiscal ?? 0))
  const totalTTC = roundMoney(totalHT + totalTVA + timbreFiscal)

  return {
    lines,
    totalHTBeforeGlobal,
    discountGlobal,
    totalHT,
    vatBreakdown,
    totalTVA,
    timbreFiscal,
    totalTTC,
  }
}

/**
 * Type d'une ligne stockée en base (snapshot SKU/designation + totaux).
 * Sert de contrat partagé entre services et UI.
 */
export interface DocumentLineRow {
  sku: string
  designation: string
  quantity: number
  unitPriceHT: number
  unitPriceTTC: number
  discountType: DiscountType | null
  discountValue: number
  netUnitPrice: number
  netUnitPriceTTC: number
  lineHT: number
  taxRate: number
  lineTVA: number
  lineTTC: number
}