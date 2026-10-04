import type { ExpenseCategory, PaymentMethod } from '@elec/db'

/** Libellés français des catégories de dépenses (miroir du service). */
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  LOYER: 'Loyer',
  SALAIRES: 'Salaires',
  ELECTRICITE: 'Électricité',
  TRANSPORT: 'Transport',
  FOURNITURES: 'Fournitures',
  IMPOTS: 'Impôts',
  AUTRE: 'Autre',
}

/** Libellés français des moyens de règlement. */
export const EXPENSE_PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Espèces',
  CARD: 'Carte bancaire',
  BANK_TRANSFER: 'Virement bancaire',
  CHEQUE: 'Chèque',
  EDAHABIA: 'Edahabia',
  ONLINE: 'En ligne',
}
