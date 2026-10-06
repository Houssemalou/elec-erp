import { notFound } from 'next/navigation'
import { PageHeader, Card } from '@/components/ui'
import { EntityForm } from '@/components/ui/entity-form'
import { ReceivableFormFields } from '@/components/receivables/receivable-form-fields'
import { updateReceivableAction } from '@/lib/actions/erp'
import { getReceivable } from '@elec/services'

export const dynamic = 'force-dynamic'

export default async function EditReceivablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const receivable = await getReceivable(id)
  if (!receivable) notFound()

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={`Modifier — ${receivable.number}`}
        description={receivable.customerName}
      />
      <Card className="p-6">
        <EntityForm action={updateReceivableAction.bind(null, id)} submitLabel="Enregistrer" cancelHref="/creances">
          <ReceivableFormFields
            data={{
              customerName: receivable.customerName,
              customerId: receivable.customerId,
              amountTTC: String(receivable.amountTTC),
              dueDate: receivable.dueDate,
              notes: receivable.notes,
            }}
          />
        </EntityForm>
      </Card>
    </div>
  )
}