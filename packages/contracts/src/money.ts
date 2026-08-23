// ---------------------------------------------------------------------------
// Arithmétique monétaire (DT, précision au millime = 3 décimales)
// ---------------------------------------------------------------------------

/** Arrondi monétaire au millime (half-up). */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000
}

/** Convertit une entrée (number | string) en nombre. */
export function toNumber(value: number | string): number {
  return typeof value === 'string' ? Number(value) : value
}

/** Série le montant pour Prisma (Decimal) : "123.450" (3 décimales). */
export function toDecimalString(value: number | string): string {
  return roundMoney(toNumber(value)).toFixed(3)
}

/**
 * Formate un montant en DT pour l'affichage français.
 * Ex : formatMoney(89.5) => "89,500 DT"
 */
export function formatMoney(value: number | string, currency = 'DT'): string {
  return `${roundMoney(toNumber(value)).toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).replace(/\u00A0/g, ' ')} ${currency}`
}

/** Formate une quantité. */
export function formatQuantity(value: number | string): string {
  const n = toNumber(value)
  return Number.isInteger(n) ? String(n) : n.toLocaleString('fr-FR', { maximumFractionDigits: 3 }).replace(/\u00A0/g, ' ')
}