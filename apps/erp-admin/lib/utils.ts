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