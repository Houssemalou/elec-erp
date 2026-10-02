import { describe, it, expect } from 'vitest'
import { calculateLineMargin, calculateMarginTotals, allocateGlobalDiscountRatio } from '../src/margin'
import { roundMoney } from '../src/money'

describe('calculateLineMargin', () => {
  it('calcule gain brut TTC, TVA collectée, TVA déductible et gain net', () => {
    // Vente HT 100 (TTC 119), coût d'achat HT 70 (TTC 83,300).
    const r = calculateLineMargin({ quantity: 1, costPriceHT: 70, lineHT: 100, lineTTC: 119, lineTVA: 19, taxRate: 19 })
    expect(r.costHT).toBe(70)
    expect(r.costTTC).toBe(83.3)
    expect(r.tvaDeductible).toBe(13.3)
    expect(r.tvaCollected).toBe(19)
    expect(r.gainGrossTTC).toBe(35.7)
    // 35,700 − 19 + 13,300 = 30,000 → équivalent au HT vendu − coût HT.
    expect(r.gainNet).toBe(30)
    expect(r.marginRate).toBe(42.857)
  })

  it('multiplie le coût par la quantité', () => {
    const r = calculateLineMargin({ quantity: 3, costPriceHT: 10, lineHT: 150, lineTTC: 178.5, lineTVA: 28.5, taxRate: 19 })
    expect(r.costHT).toBe(30)
    expect(r.costTTC).toBe(35.7)
    expect(r.tvaDeductible).toBe(5.7)
    expect(r.gainGrossTTC).toBe(142.8)
    expect(r.gainNet).toBe(120)
  })

  it('gère le taux 0 (non assujetti) sans TVA déductible', () => {
    const r = calculateLineMargin({ quantity: 2, costPriceHT: 50, lineHT: 200, lineTTC: 200, lineTVA: 0, taxRate: 0 })
    expect(r.costTTC).toBe(100)
    expect(r.tvaDeductible).toBe(0)
    expect(r.gainGrossTTC).toBe(100)
    expect(r.gainNet).toBe(100)
  })

  it('retourne des valeurs null quand le prix de revient est inconnu', () => {
    const r = calculateLineMargin({ quantity: 1, costPriceHT: null, lineHT: 100, lineTTC: 119, lineTVA: 19, taxRate: 19 })
    expect(r.costHT).toBeNull()
    expect(r.gainGrossTTC).toBeNull()
    expect(r.gainNet).toBeNull()
    // La TVA collectée reste connue : elle ne dépend pas du coût.
    expect(r.tvaCollected).toBe(19)
  })

  it('traite le coût à 0 comme une valeur connue (marge = vente entière)', () => {
    const r = calculateLineMargin({ quantity: 1, costPriceHT: 0, lineHT: 100, lineTTC: 119, lineTVA: 19, taxRate: 19 })
    expect(r.costHT).toBe(0)
    expect(r.gainNet).toBe(100)
    // Taux de marge indéfini sur un coût nul.
    expect(r.marginRate).toBeNull()
  })

  it('donne une marge négative si le coût dépasse le prix de vente', () => {
    const r = calculateLineMargin({ quantity: 1, costPriceHT: 150, lineHT: 100, lineTTC: 119, lineTVA: 19, taxRate: 19 })
    expect(r.gainGrossTTC).toBe(-59.5)
    expect(r.gainNet).toBe(-50)
  })
})

describe('calculateMarginTotals', () => {
  const lines = [
    { quantity: 2, costPriceHT: 30, lineHT: 200, lineTTC: 238, lineTVA: 38, taxRate: 19 },
    { quantity: 1, costPriceHT: 10, lineHT: 100, lineTTC: 100, lineTVA: 0, taxRate: 0 },
  ]

  it('agrège les marges des lignes', () => {
    const r = calculateMarginTotals({ lines })
    expect(r.complete).toBe(true)
    expect(r.costHT).toBe(70)
    expect(r.tvaCollected).toBe(38)
    expect(r.gainNet).toBe(230)
  })

  it('proratise la remise globale sur le prix de vente', () => {
    // Remise de 30 DT sur 300 DT HT → ratio 0,9.
    expect(allocateGlobalDiscountRatio(lines, 30)).toBeCloseTo(0.9, 6)

    const r = calculateMarginTotals({ lines, discountGlobal: 30 })
    const [line1, line2] = r.lines
    // Ligne 1 : 200 → 180 HT, TVA 34,2 ; ligne 2 : 100 → 90 HT.
    expect(line1?.tvaCollected).toBe(34.2)
    expect(line1?.gainNet).toBe(120)
    expect(line2?.tvaCollected).toBe(0)
    expect(line2?.gainNet).toBe(80)
    expect(r.gainNet).toBe(200)
    // Le prix d'achat n'est pas remarché.
    expect(r.costHT).toBe(70)
  })

  it('ne renvoie aucun total si une seule ligne a un coût inconnu', () => {
    const r = calculateMarginTotals({
      lines: [...lines, { quantity: 1, costPriceHT: null, lineHT: 50, lineTTC: 59.5, lineTVA: 9.5, taxRate: 19 }],
    })
    expect(r.complete).toBe(false)
    expect(r.linesWithoutCost).toBe(1)
    expect(r.costHT).toBeNull()
    expect(r.gainNet).toBeNull()
    // TVA collectée toujours connue.
    expect(r.tvaCollected).toBe(47.5)
  })

  it('renvoie des zéros pour une facture sans ligne', () => {
    const r = calculateMarginTotals({ lines: [] })
    expect(r.complete).toBe(true)
    expect(r.costHT).toBe(0)
    expect(r.gainNet).toBe(0)
    expect(r.marginRate).toBeNull()
  })

  it('arrondit les totaux au millime', () => {
    const r = calculateMarginTotals({
      lines: [{ quantity: 3, costPriceHT: 9.9, lineHT: 29.7, lineTTC: 35.343, lineTVA: 5.643, taxRate: 19 }],
    })
    expect(r.costHT).toBe(29.7)
    expect(r.gainNet).toBe(roundMoney(r.gainNet ?? 0))
  })
})