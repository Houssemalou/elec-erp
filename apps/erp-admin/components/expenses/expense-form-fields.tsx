import { Label, Input, Select, Textarea } from '@/components/ui'
import { ExpenseCategory } from '@elec/db'
import { EXPENSE_CATEGORY_LABELS } from '@/lib/labels'
import { EXPENSE_PAYMENT_LABELS } from '@/lib/labels'
import { PaymentMethod } from '@elec/db'

export interface ExpenseFormData {
  label?: string
  category?: ExpenseCategory
  amountTTC?: string
  expenseDate?: Date | string
  paymentMethod?: PaymentMethod
  notes?: string | null
}

function toDateInput(value: Date | string | undefined): string {
  if (!value) return new Date().toISOString().slice(0, 10)
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toISOString().slice(0, 10)
}

export function ExpenseFormFields({ data }: { data?: ExpenseFormData }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Libellé *</Label>
        <Input
          name="label"
          required
          defaultValue={data?.label ?? ''}
          placeholder="Ex : Loyer du local — octobre"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Catégorie</Label>
          <Select name="category" defaultValue={data?.category ?? 'AUTRE'}>
            {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Montant TTC *</Label>
          <Input
            name="amountTTC"
            type="number"
            step="0.001"
            min="0.001"
            required
            defaultValue={data?.amountTTC ?? ''}
            placeholder="0,000"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Date</Label>
          <Input name="expenseDate" type="date" defaultValue={toDateInput(data?.expenseDate)} />
        </div>
        <div>
          <Label>Règlement</Label>
          <Select name="paymentMethod" defaultValue={data?.paymentMethod ?? 'CASH'}>
            {(Object.keys(EXPENSE_PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {EXPENSE_PAYMENT_LABELS[m]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea name="notes" rows={3} defaultValue={data?.notes ?? ''} />
      </div>

      <p className="text-xs text-white/40">
        Montant TTC tel que payé : aucune TVA déductible n&apos;est calculée, l&apos;entreprise n&apos;étant pas
        assujettie.
      </p>
    </div>
  )
}
