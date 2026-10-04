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

/** Base sur laquelle la remise globale est déduite. */
export type DiscountBasis = 'HT' | 'TTC'

export interface DocumentInput {
  lines: LineInput[]
  globalDiscount?: GlobalDiscount | null
  /** Timbre fiscal : 1 DT sur les factures, 0 sur les devis. */
  timbreFiscal?: number | string
  /**
   * Base de la remise globale.
   *
   * `'HT'` (défaut) : la remise réduit la base HT et la TVA suit. C'est la
   * base des documents fiscaux.
   *
   * `'TTC'` : la remise réduit le TTC affiché au client ; le HT et la TVA de
   * chaque taux sont déduits du TTC réduit. Utilisé au POS, où le caissier
   * raisonne en TTC (prix des articles, ticket, encaissement).
   */
  discountBasis?: DiscountBasis
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
  /** Montant de la remise globale en DT, toujours exprimé en HT. */
  discountGlobal: number
  /**
   * Montant réellement déduit du TTC. Diffère de `discountGlobal` quand la
   * remise est calculée sur le TTC : 10 DT de remise TTC HT 100 / TVA 19
   * donnent `discountGlobal` 8,40 et `discountGlobalTTC` 10,000.
   */
  discountGlobalTTC: number
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
 * - `discountBasis: 'HT'` (défaut) : remise globale appliquée sur le total HT,
 *   la TVA est recalculée sur la base réduite, répartie proportionnellement
 *   entre les taux utilisés, chaque taux arrondi au millime (pour que la
 *   ventilation "TVA 19% : X DT, TVA 13% : Y DT" affichée dans le récapitulatif
 *   somme exactement au total TVA).
 * - `discountBasis: 'TTC'` : la remise est déduite du TTC, le HT et la TVA de
 *   chaque taux sont déduits du TTC réduit (voir {@link DocumentTotals}).
 *
 * Dans les deux cas `totalHT + totalTVA + timbre === totalTTC` au millime et
 * `totalHTBeforeGlobal - discountGlobal === totalHT`, invariants dont dépendent
 * le PDF, le récapitulatif et le détail des documents.
 */
export function calculateDocumentTotals(input: DocumentInput): DocumentTotals {
  const lines = input.lines.map((line) => calculateLineTotal(line))

  const totalHTBeforeGlobal = roundMoney(lines.reduce((sum, l) => sum + l.lineHT, 0))
  const totalTTCBeforeGlobal = roundMoney(lines.reduce((sum, l) => sum + l.lineTTC, 0))

  // Bases HT et TTC par taux AVANT remise globale (répartition proportionnelle).
  const basesBefore = new Map<number, { baseHT: number; baseTTC: number }>()
  input.lines.forEach((line, i) => {
    const totals = lines[i]
    if (!totals) return
    const rate = toNumber(line.taxRate)
    const entry = basesBefore.get(rate) ?? { baseHT: 0, baseTTC: 0 }
    entry.baseHT += totals.lineHT
    entry.baseTTC += totals.lineTTC
    basesBefore.set(rate, entry)
  })
  const groups = [...basesBefore.entries()].sort((a, b) => b[0] - a[0])

  let totalHT: number
  let vatBreakdown: RateBreakdown[]
  let discountGlobalTTC: number

  if (input.discountBasis === 'TTC') {
    // Sens inversé : on part du TTC net et on en déduit le HT de chaque taux.
    const discountOnTTC = calculateGlobalDiscountAmount(totalTTCBeforeGlobal, input.globalDiscount)
    // Une remise supérieure au TTC (saisie abusive au POS) ne doit pas produire
    // un document négatif : la base nette est ramenée à zéro.
    const reducedTTC = roundMoney(Math.max(0, totalTTCBeforeGlobal - discountOnTTC))
    const ttcRatio = totalTTCBeforeGlobal > 0 ? reducedTTC / totalTTCBeforeGlobal : 0

    const reducedTTCByRate = groups.map(([, b]) => roundMoney(b.baseTTC * ttcRatio))

    // Les arrondis au millime laissent parfois une dérive d'un centime entre la
    // somme des bases TTC et le TTC net : on la réimpute sur le plus gros taux
    // pour que la ventilation somme exactement au total.
    const drift = roundMoney(reducedTTC - reducedTTCByRate.reduce((s, v) => s + v, 0))
    if (reducedTTCByRate.length > 0 && drift !== 0) {
      let largest = 0
      for (let i = 1; i < reducedTTCByRate.length; i++) {
        if ((reducedTTCByRate[i] ?? 0) > (reducedTTCByRate[largest] ?? 0)) largest = i
      }
      reducedTTCByRate[largest] = roundMoney((reducedTTCByRate[largest] ?? 0) + drift)
    }

    vatBreakdown = groups.map(([rate], i) => {
      const groupTTC = reducedTTCByRate[i] ?? 0
      const factor = 1 + rate / 100
      const baseHT = factor > 0 ? roundMoney(groupTTC / factor) : groupTTC
      return { rate, baseHT, tva: roundMoney(groupTTC - baseHT) }
    })

    totalHT = roundMoney(vatBreakdown.reduce((sum, b) => sum + b.baseHT, 0))
    discountGlobalTTC = discountOnTTC
  } else {
    const discountOnHT = calculateGlobalDiscountAmount(totalHTBeforeGlobal, input.globalDiscount)
    totalHT = roundMoney(totalHTBeforeGlobal - discountOnHT)
    const ratio = totalHTBeforeGlobal > 0 ? totalHT / totalHTBeforeGlobal : 0
    vatBreakdown = groups.map(([rate, b]) => {
      const reducedBase = roundMoney(b.baseHT * ratio)
      return { rate, baseHT: reducedBase, tva: roundMoney(reducedBase * (rate / 100)) }
    })
    discountGlobalTTC = roundMoney(totalTTCBeforeGlobal - totalHT - roundMoney(vatBreakdown.reduce((s, b) => s + b.tva, 0)))
  }

  // Toujours exprimé en HT : c'est la base attendue par le stockage et l'affichage
  // des documents, quelle que soit la base de saisie de la remise.
  const discountGlobal = roundMoney(totalHTBeforeGlobal - totalHT)
  const totalTVA = roundMoney(vatBreakdown.reduce((sum, b) => sum + b.tva, 0))
  const timbreFiscal = roundMoney(toNumber(input.timbreFiscal ?? 0))
  const totalTTC = roundMoney(totalHT + totalTVA + timbreFiscal)

  return {
    lines,
    totalHTBeforeGlobal,
    discountGlobal,
    discountGlobalTTC,
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