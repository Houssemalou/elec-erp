import { notFound } from 'next/navigation'
import { PageHeader, Card } from '@/components/ui'
import { EntityForm } from '@/components/ui/entity-form'
import { PartyFormFields } from '@/components/parties/party-form-fields'
import { updateSupplier } from '@/lib/actions/erp'
import { db } from '@elec/db'

export const dynamic = 'force-dynamic'

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supplier = await db.supplier.findUnique({ where: { id } })
  if (!supplier) notFound()

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={`Modifier — ${supplier.name}`} description="Mettez à jour les informations du fournisseur." />
      <Card className="p-6">
        <EntityForm action={updateSupplier.bind(null, id)} submitLabel="Enregistrer" cancelHref="/fournisseurs">
          <PartyFormFields
            kind="supplier"
            data={{
              firstName: supplier.name,
              companyName: supplier.company,
              matriculeFiscal: supplier.matriculeFiscal,
              email: supplier.email,
              phone: supplier.phone,
              address: supplier.address,
              city: supplier.city,
              notes: supplier.notes,
              active: supplier.active,
            }}
          />
        </EntityForm>
      </Card>
    </div>
  )
}