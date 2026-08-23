import { PageHeader, Card } from '@/components/ui'
import { EntityForm } from '@/components/ui/entity-form'
import { PartyFormFields } from '@/components/parties/party-form-fields'
import { createCustomer } from '@/lib/actions/erp'

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Nouveau client" description="Ajoutez un client au carnet." />
      <Card className="p-6">
        <EntityForm action={createCustomer} submitLabel="Créer le client" cancelHref="/clients">
          <PartyFormFields kind="client" />
        </EntityForm>
      </Card>
    </div>
  )
}