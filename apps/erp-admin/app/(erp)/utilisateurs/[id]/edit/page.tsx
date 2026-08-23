import { notFound } from 'next/navigation'
import { PageHeader, Card, Label, Input, Select } from '@/components/ui'
import { EntityForm } from '@/components/ui/entity-form'
import { updateUser } from '@/lib/actions/erp'
import { db } from '@elec/db'

export const dynamic = 'force-dynamic'

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await db.user.findUnique({ where: { id } })
  if (!user) notFound()

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={`Modifier — ${user.name}`} description="Mettez à jour le compte." />
      <Card className="p-6">
        <EntityForm action={updateUser.bind(null, id)} submitLabel="Enregistrer" cancelHref="/utilisateurs">
          <div>
            <Label>Nom complet *</Label>
            <Input name="name" required defaultValue={user.name} />
          </div>
          <div>
            <Label>Email (non modifiable)</Label>
            <Input defaultValue={user.email} disabled />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Rôle</Label>
              <Select name="role" defaultValue={user.role}>
                <option value="ADMIN">Administrateur</option>
                <option value="MANAGER">Manager</option>
                <option value="VENDEUR">Vendeur</option>
              </Select>
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input name="phone" defaultValue={user.phone ?? ''} />
            </div>
          </div>
          <div>
            <Label>Nouveau mot de passe (laisser vide pour conserver)</Label>
            <Input type="password" name="password" placeholder="••••••••" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="isActive" defaultChecked={user.isActive} className="h-4 w-4 rounded border-slate-300" />
            Compte actif
          </label>
        </EntityForm>
      </Card>
    </div>
  )
}