import { PageHeader, Card } from '@/components/ui'
import { EntityForm } from '@/components/ui/entity-form'
import { PartyFormFields } from '@/components/parties/party-form-fields'
import { createSupplier } from '@/lib/actions/erp'

export default function NewSupplierPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Nouveau fournisseur" description="Ajoutez un fournisseur." />
      <Card className="p-6">
        <EntityForm action={createSupplier} submitLabel="Créer le fournisseur" cancelHref="/fournisseurs">
          <PartyFormFields kind="supplier" />
        </EntityForm>
      </Card>
    </div>
  )
}