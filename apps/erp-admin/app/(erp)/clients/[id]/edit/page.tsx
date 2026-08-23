import { notFound } from 'next/navigation'
import { PageHeader, Card } from '@/components/ui'
import { EntityForm } from '@/components/ui/entity-form'
import { PartyFormFields } from '@/components/parties/party-form-fields'
import { updateCustomer } from '@/lib/actions/erp'
import { db } from '@elec/db'

export const dynamic = 'force-dynamic'

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const customer = await db.customer.findUnique({ where: { id } })
  if (!customer) notFound()

  const fullName = customer.companyName || [customer.firstName, customer.lastName].filter(Boolean).join(' ')

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={`Modifier — ${fullName}`} description="Mettez à jour les informations du client." />
      <Card className="p-6">
        <EntityForm action={updateCustomer.bind(null, id)} submitLabel="Enregistrer" cancelHref="/clients">
          <PartyFormFields
            kind="client"
            data={{
              type: customer.type,
              firstName: customer.firstName,
              lastName: customer.lastName,
              companyName: customer.companyName,
              matriculeFiscal: customer.matriculeFiscal,
              cin: customer.cin,
              email: customer.email,
              phone: customer.phone,
              address: customer.address,
              city: customer.city,
              notes: customer.notes,
              active: customer.active,
            }}
          />
        </EntityForm>
      </Card>
    </div>
  )
}