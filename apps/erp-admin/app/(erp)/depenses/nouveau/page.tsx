import { PageHeader, Card } from '@/components/ui'
import { EntityForm } from '@/components/ui/entity-form'
import { ExpenseFormFields } from '@/components/expenses/expense-form-fields'
import { createExpenseAction } from '@/lib/actions/erp'

export default function NewExpensePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Nouvelle dépense" description="Enregistrez une charge hors achat." />
      <Card className="p-6">
        <EntityForm action={createExpenseAction} submitLabel="Créer la dépense" cancelHref="/depenses">
          <ExpenseFormFields />
        </EntityForm>
      </Card>
    </div>
  )
}
