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
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PREPARING: 'En préparation',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
  REFUNDED: 'Remboursée',
  DRAFT: 'Brouillon',
  VALIDATED: 'Validée',
  PAID: 'Payée',
  PARTIALLY_PAID: 'Partiellement payée',
}