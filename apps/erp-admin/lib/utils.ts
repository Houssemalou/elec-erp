import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

/** Formate un montant en DT (sans zéros inutiles après la virgule). */
export function money(value: number | string | { toString(): string }): string {
  const n = typeof value === 'object' ? Number(value.toString()) : Number(value)
  const fixed = n.toFixed(3)
  const stripped = fixed.replace(/\.?0+$/, '')
  return `${stripped.replace('.', ',')} DT`
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Date au format `YYYY-MM-DD` en heure locale.
 *
 * `toISOString()` bascule en UTC : à Tunis (UTC+1) un lundi 00:00 ressort
 * dimanche. Les semaines de clôture sont des lundis, ce décalage envoyerait la
 * semaine précédente.
 */
export function dateInputValue(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const month = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/**
 * Convertit une valeur de `<input type="date">` en Date locale à 00:00.
 * `new Date('2026-02-02')` serait interprété en UTC.
 */
export function parseDateInput(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyé',
  ACCEPTED: 'Accepté',
  REFUSED: 'Refusé',
  CONVERTED: 'Converti',
  EXPIRED: 'Expiré',
  VALIDATED: 'Validée',
  PAID: 'Payée',
  PARTIALLY_PAID: 'Partiellement payée',
  CANCELLED: 'Annulée',
  CREDITED: 'Avoir émis',
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PREPARING: 'En préparation',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  REFUNDED: 'Remboursée',
  PARTIALLY_RECEIVED: 'Partiellement réçu',
  RECEIVED: 'Réçu',
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  MANAGER: 'Manager',
  VENDEUR: 'Vendeur',
  CLIENT: 'Client',
}