import { PageHeader, Card, Label, Input, Select } from '@/components/ui'
import { EntityForm } from '@/components/ui/entity-form'
import { createUser } from '@/lib/actions/erp'

export default function NewUserPage() {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Nouvel utilisateur" description="Créez un compte pour le personnel." />
      <Card className="p-6">
        <EntityForm action={createUser} submitLabel="Créer l'utilisateur" cancelHref="/utilisateurs">
          <div>
            <Label>Nom complet *</Label>
            <Input name="name" required placeholder="Nom et prénom" />
          </div>
          <div>
            <Label>Email *</Label>
            <Input type="email" name="email" required placeholder="user@magasin.tn" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Rôle</Label>
              <Select name="role" defaultValue="VENDEUR">
                <option value="ADMIN">Administrateur</option>
                <option value="MANAGER">Manager</option>
                <option value="VENDEUR">Vendeur</option>
              </Select>
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input name="phone" placeholder="+216 …" />
            </div>
          </div>
          <div>
            <Label>Mot de passe * (8 caractères min.)</Label>
            <Input type="password" name="password" required placeholder="••••••••" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4 rounded border-slate-300" />
            Compte actif
          </label>
        </EntityForm>
      </Card>
    </div>
  )
}