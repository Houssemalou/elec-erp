import { describe, it, expect } from 'vitest'
import {
  calculateLineTotal,
  calculateDocumentTotals,
  applyLineDiscount,
} from '../src/fiscal'
import { roundMoney, toDecimalString, formatMoney } from '../src/money'

describe('applyLineDiscount', () => {
  it('renvoie le PU brut sans remise', () => {
    expect(applyLineDiscount({ quantity: 1, unitPriceHT: 100, taxRate: 19 })).toBe(100)
  })

  it('applique une remise en pourcentage', () => {
    expect(
      applyLineDiscount({ quantity: 1, unitPriceHT: 100, discountType: 'PERCENT', discountValue: 10, taxRate: 19 }),
    ).toBe(90)
  })

  it('applique une remise en montant', () => {
    expect(
      applyLineDiscount({ quantity: 1, unitPriceHT: 100, discountType: 'AMOUNT', discountValue: 5, taxRate: 19 }),
    ).toBe(95)
  })

  it('n\'applique pas de remise si le type est inconnu', () => {
    expect(applyLineDiscount({ quantity: 1, unitPriceHT: 100, discountType: null, taxRate: 19 })).toBe(100)
  })
})

describe('calculateLineTotal', () => {
  it('calcule une ligne simple sans remise (HT 100 × 2, TVA 19%)', () => {
    const r = calculateLineTotal({ quantity: 2, unitPriceHT: 100, taxRate: 19 })
    expect(r.netUnitPrice).toBe(100)
    expect(r.lineHT).toBe(200)
    expect(r.lineTVA).toBe(38)
    expect(r.lineTTC).toBe(238)
  })

  it('calcule la TVA sur le prix NET après remise (conformité tunisienne)', () => {
    const r = calculateLineTotal({
      quantity: 10,
      unitPriceHT: 50,
      discountType: 'PERCENT',
      discountValue: 20,
      taxRate: 19,
    })
    // net = 40, ligne HT = 400, TVA = 76 (et NON 95 sur le brut)
    expect(r.netUnitPrice).toBe(40)
    expect(r.lineHT).toBe(400)
    expect(r.lineTVA).toBe(76)
    expect(r.lineTTC).toBe(476)
  })

  it('arrondit au millime', () => {
    const r = calculateLineTotal({ quantity: 3, unitPriceHT: 9.99, taxRate: 13 })
    expect(r.lineHT).toBe(roundMoney(29.97))
    expect(r.lineTVA).toBe(roundMoney(29.97 * 0.13))
    expect(r.lineTTC).toBe(roundMoney(r.lineHT + r.lineTVA))
  })
})

describe('calculateDocumentTotals', () => {
  const lines = [
    { quantity: 2, unitPriceHT: 100, taxRate: 19 },
    { quantity: 1, unitPriceHT: 50, taxRate: 13 },
  ]

  it('additionne les lignes et ventile la TVA par taux', () => {
    const r = calculateDocumentTotals({ lines, timbreFiscal: 1 })
    expect(r.totalHTBeforeGlobal).toBe(250)
    expect(r.discountGlobal).toBe(0)
    expect(r.totalHT).toBe(250)
    expect(r.vatBreakdown).toEqual([
      { rate: 19, baseHT: 200, tva: 38 },
      { rate: 13, baseHT: 50, tva: 6.5 },
    ])
    expect(r.totalTVA).toBe(44.5)
    expect(r.totalTTC).toBe(295.5) // 250 + 44.5 + 1 (timbre)
  })

  it('applique la remise globale AVANT la TVA (réduction proportionnelle par taux)', () => {
    const r = calculateDocumentTotals({ lines, globalDiscount: { type: 'PERCENT', value: 10 }, timbreFiscal: 1 })
    // HT avant = 250, remise = 25, HT = 225
    expect(r.totalHTBeforeGlobal).toBe(250)
    expect(r.discountGlobal).toBe(25)
    expect(r.totalHT).toBe(225)
    // Bases réduites proportionnellement : 200×0.9 = 180, 50×0.9 = 45
    expect(r.vatBreakdown).toEqual([
      { rate: 19, baseHT: 180, tva: 34.2 },
      { rate: 13, baseHT: 45, tva: 5.85 },
    ])
    expect(r.totalTVA).toBe(40.05)
    expect(r.totalTTC).toBe(266.05)
  })

  it('applique la remise globale en montant', () => {
    const r = calculateDocumentTotals({ lines, globalDiscount: { type: 'AMOUNT', value: 25 } })
    expect(r.discountGlobal).toBe(25)
    expect(r.totalHT).toBe(225)
  })

  it('le timbre fiscal s\'ajoute au total TTC sans affecter la TVA', () => {
    const withTimbre = calculateDocumentTotals({ lines, timbreFiscal: 1 })
    const withoutTimbre = calculateDocumentTotals({ lines, timbreFiscal: 0 })
    expect(withTimbre.totalTTC - withoutTimbre.totalTTC).toBe(1)
    expect(withTimbre.totalTVA).toBe(withoutTimbre.totalTVA)
  })

  it('document vide → totaux à zéro', () => {
    const r = calculateDocumentTotals({ lines: [], timbreFiscal: 1 })
    expect(r.totalHT).toBe(0)
    expect(r.totalTVA).toBe(0)
    expect(r.totalTTC).toBe(1)
  })
})

describe('sérialisation', () => {
  it('toDecimalString produit 3 décimales', () => {
    expect(toDecimalString(89.5)).toBe('89.500')
    expect(toDecimalString(0.1234)).toBe('0.123')
  })

  it('formatMoney affiche en français avec DT', () => {
    expect(formatMoney(89.5)).toBe('89,500 DT')
  })
})