// ============================================================================
// Rentabilité d'une facture — FONCTIONS PURES
//
// Trois montants par ligne, tous exprimés en DT :
//
//   Gain brut TTC = prix de vente TTC − coût d'achat TTC
//   TVA collectée  = TVA facturée au client        (connue : lineTVA)
//   TVA déductible = TVA payée sur l'achat        (coût d'achat HT × taux)
//
// Le gain net de TVA, celui qui revient réellement à l'entreprise :
//
//   gain net = gain brut TTC − TVA collectée + TVA déductible
//            = HT vendu − coût d'achat HT
//
// C'est bien l'équivalent du HT vendu moins le coût HT : la TVA collectée
// n'est que reversée à l'État et la TVA déductible vient en compensation.
//
// ATTENTION : le prix de revient vient de `Product.costPrice`, c'est-à-dire le
// coût SAISIR AUJOURD'HUI, pas celui en vigueur à la date de la facture. Une
// facture ancienne dont les prix d'achat ont changé depuis affichera donc une
// marge indicative. Un coût reste inconnu si le produit a été supprimé
// (`productId` nul) ou si aucun prix de revient n'a été renseigné : dans ce cas
// la marge de la ligne est `null` et les totaux sont `null` plutôt que
// partiels — un sous-total de marge serait pire qu'aucun chiffre.
// ============================================================================

import { roundMoney, toNumber } from './money'

/** Convertit une valeur éventuellement nulle/absente en nombre (0 par défaut). */
function num(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  return toNumber(value)
}

export interface MarginLineInput {
  /** Quantité vendue. */
  quantity: number | string
  /**
   * Prix de revient unitaire HT du produit.
   * `null` / `undefined` / `''` = coût inconnu → marge `null`.
   */
  costPriceHT?: number | string | null
  /** Base HT de la ligne. */
  lineHT: number | string
  /** Base TTC de la ligne. */
  lineTTC: number | string
  /** TVA de la ligne telle que stockée sur le document. */
  lineTVA: number | string
  /** Taux de TVA en nombre (ex : 19, 13, 7, 0). */
  taxRate: number | string
}

export interface LineMargin {
  /** Coût d'achat HT de la ligne, ou `null` si le coût est inconnu. */
  costHT: number | null
  /** Coût d'achat TTC de la ligne. */
  costTTC: number | null
  /** TVA payée sur l'achat, récupérable auprès de l'État. */
  tvaDeductible: number | null
  /** TVA facturée au client, à reverser à l'État. */
  tvaCollected: number
  /** Gain brut TTC = vente TTC − coût d'achat TTC. */
  gainGrossTTC: number | null
  /** Gain net = gain brut TTC − TVA collectée + TVA déductible. */
  gainNet: number | null
  /** Taux de marge sur le coût d'achat, en %. `null` si coût nul ou inconnu. */
  marginRate: number | null
}

function hasCost(costPriceHT: MarginLineInput['costPriceHT']): boolean {
  if (costPriceHT === null || costPriceHT === undefined || costPriceHT === '') return false
  return Number.isFinite(num(costPriceHT))
}

/**
 * Marge d'une ligne de facture.
 *
 * `lineHT` / `lineTTC` / `lineTVA` doivent être les valeurs effectives de la
 * ligne, remise globale déjà proratisée (voir `calculateMarginTotals`).
 */
export function calculateLineMargin(input: MarginLineInput): LineMargin {
  const tvaCollected = roundMoney(num(input.lineTVA))

  if (!hasCost(input.costPriceHT)) {
    return {
      costHT: null,
      costTTC: null,
      tvaDeductible: null,
      tvaCollected,
      gainGrossTTC: null,
      gainNet: null,
      marginRate: null,
    }
  }

  const qty = num(input.quantity)
  const rate = num(input.taxRate)
  const lineTTC = num(input.lineTTC)

  const costHT = roundMoney(num(input.costPriceHT) * qty)
  const costTTC = roundMoney(costHT * (1 + rate / 100))
  const tvaDeductible = roundMoney(costTTC - costHT)
  const gainGrossTTC = roundMoney(lineTTC - costTTC)
  const gainNet = roundMoney(gainGrossTTC - tvaCollected + tvaDeductible)
  const marginRate = costHT > 0 ? roundMoney((gainNet / costHT) * 100) : null

  return { costHT, costTTC, tvaDeductible, tvaCollected, gainGrossTTC, gainNet, marginRate }
}

export interface MarginInput {
  /** Lignes avec leurs montants AVANT remise globale. */
  lines: MarginLineInput[]
  /** Remise globale en DT (le même montant que `DocumentTotals.discountGlobal`). */
  discountGlobal?: number | string
}

export interface MarginTotals {
  /** Marge par ligne, dans l'ordre d'entrée. */
  lines: LineMargin[]
  /** Coût d'achat HT total. `null` si une seule ligne a un coût inconnu. */
  costHT: number | null
  /** Coût d'achat TTC total. */
  costTTC: number | null
  /** TVA déductible totale (supportée à l'achat). */
  tvaDeductible: number | null
  /** TVA collectée totale = `invoice.totalTVA`. */
  tvaCollected: number
  /** Gain brut TTC total = chiffre d'affaires TTC − coût d'achat TTC. */
  gainGrossTTC: number | null
  /** Gain net total de TVA. */
  gainNet: number | null
  /** Taux de marge global sur le coût d'achat, en %. */
  marginRate: number | null
  /** Nombre de lignes dont le prix de revient est inconnu. */
  linesWithoutCost: number
  /** `false` dès qu'une ligne a un coût inconnu : les totaux sont alors `null`. */
  complete: boolean
}

/**
 * Répartit une remise globale au prorata des montants HT de ligne.
 * Même méthode que le prorata de la TVA dans `calculateDocumentTotals`.
 */
export function allocateGlobalDiscountRatio(lines: MarginLineInput[], discountGlobal?: number | string): number {
  const totalHTBeforeGlobal = roundMoney(lines.reduce((sum, l) => sum + num(l.lineHT), 0))
  if (totalHTBeforeGlobal <= 0) return 0
  const totalHT = roundMoney(totalHTBeforeGlobal - num(discountGlobal))
  return totalHT / totalHTBeforeGlobal
}

/**
 * Rentabilité d'une facture : marge par ligne et totaux.
 *
 * La remise globale est proratisée sur les prix de vente (le prix d'achat, lui,
 * ne se remarche pas), puis chaque ligne est passée dans `calculateLineMargin`.
 */
export function calculateMarginTotals(input: MarginInput): MarginTotals {
  const ratio = allocateGlobalDiscountRatio(input.lines, input.discountGlobal)

  const lines = input.lines.map((line) => {
    const qty = num(line.quantity)
    const lineHT = num(line.lineHT)
    const lineTTC = num(line.lineTTC)
    const rate = num(line.taxRate)
    const factor = 1 + rate / 100

    // TVA recalculée sur la base réduite, comme le fait calculateDocumentTotals.
    const reducedHT = roundMoney(lineHT * ratio)
    const tvaCollected = factor > 0 ? roundMoney(reducedHT * (rate / 100)) : 0

    return calculateLineMargin({
      quantity: qty,
      costPriceHT: line.costPriceHT,
      lineHT: reducedHT,
      lineTTC: factor > 0 ? roundMoney(reducedHT * factor) : reducedHT,
      lineTVA: tvaCollected,
      taxRate: rate,
    })
  })

  const linesWithoutCost = lines.filter((l) => l.costHT === null).length
  const complete = linesWithoutCost === 0
  const tvaCollected = roundMoney(lines.reduce((sum, l) => sum + l.tvaCollected, 0))

  if (!complete) {
    return {
      lines,
      costHT: null,
      costTTC: null,
      tvaDeductible: null,
      tvaCollected,
      gainGrossTTC: null,
      gainNet: null,
      marginRate: null,
      linesWithoutCost,
      complete,
    }
  }

  const costHT = roundMoney(lines.reduce((sum, l) => sum + num(l.costHT), 0))
  const costTTC = roundMoney(lines.reduce((sum, l) => sum + num(l.costTTC), 0))
  const tvaDeductible = roundMoney(lines.reduce((sum, l) => sum + num(l.tvaDeductible), 0))
  const gainGrossTTC = roundMoney(lines.reduce((sum, l) => sum + num(l.gainGrossTTC), 0))
  const gainNet = roundMoney(lines.reduce((sum, l) => sum + num(l.gainNet), 0))

  return {
    lines,
    costHT,
    costTTC,
    tvaDeductible,
    tvaCollected,
    gainGrossTTC,
    gainNet,
    marginRate: costHT > 0 ? roundMoney((gainNet / costHT) * 100) : null,
    linesWithoutCost,
    complete,
  }
}