import { notFound } from 'next/navigation'
import { PageHeader, Card } from '@/components/ui'
import { EntityForm } from '@/components/ui/entity-form'
import { ExpenseFormFields } from '@/components/expenses/expense-form-fields'
import { updateExpenseAction } from '@/lib/actions/erp'
import { getExpense } from '@elec/services'

export const dynamic = 'force-dynamic'

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const expense = await getExpense(id)
  if (!expense) notFound()

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={`Modifier — ${expense.label}`}
        description={`Référence ${expense.number}`}
      />
      <Card className="p-6">
        <EntityForm action={updateExpenseAction.bind(null, id)} submitLabel="Enregistrer" cancelHref="/depenses">
          <ExpenseFormFields
            data={{
              label: expense.label,
              category: expense.category,
              amountTTC: String(expense.amountTTC),
              expenseDate: expense.expenseDate,
              paymentMethod: expense.paymentMethod,
              notes: expense.notes,
            }}
          />
        </EntityForm>
      </Card>
    </div>
  )
}
