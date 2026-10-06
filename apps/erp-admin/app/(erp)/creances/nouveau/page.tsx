import { PageHeader, Card } from '@/components/ui'
import { EntityForm } from '@/components/ui/entity-form'
import { ReceivableFormFields } from '@/components/receivables/receivable-form-fields'
import { createReceivableAction } from '@/lib/actions/erp'

export const dynamic = 'force-dynamic'

export default function NewReceivablePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Nouvelle créance"
        description="Enregistrez un montant dû par un client, hors facture."
      />
      <Card className="p-6">
        <EntityForm action={createReceivableAction} submitLabel="Créer la créance" cancelHref="/creances">
          <ReceivableFormFields />
        </EntityForm>
      </Card>
    </div>
  )
}