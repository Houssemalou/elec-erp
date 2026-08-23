import { Label, Input, Select, Textarea } from '@/components/ui'

export interface PartyData {
  type?: 'PARTICULIER' | 'PROFESSIONNEL'
  firstName?: string | null
  lastName?: string | null
  companyName?: string | null
  matriculeFiscal?: string | null
  cin?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  notes?: string | null
  active?: boolean
}

export function PartyFormFields({
  kind,
  data,
}: {
  kind: 'client' | 'supplier'
  data?: PartyData
}) {
  const isClient = kind === 'client'
  return (
    <>
      {isClient ? (
        <div>
          <Label>Type de client</Label>
          <Select name="type" defaultValue={data?.type ?? 'PARTICULIER'}>
            <option value="PARTICULIER">Particulier</option>
            <option value="PROFESSIONNEL">Professionnel</option>
          </Select>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {!isClient ? (
          <div>
            <Label>Nom *</Label>
            <Input name="name" required defaultValue={data?.firstName ?? ''} placeholder="Nom du fournisseur" />
          </div>
        ) : null}
        {isClient ? (
          <>
            <div>
              <Label>Prénom</Label>
              <Input name="firstName" defaultValue={data?.firstName ?? ''} />
            </div>
            <div>
              <Label>Nom</Label>
              <Input name="lastName" defaultValue={data?.lastName ?? ''} />
            </div>
          </>
        ) : null}
        {isClient ? (
          <div className="sm:col-span-2">
            <Label>Société (si professionnel)</Label>
            <Input name="companyName" defaultValue={data?.companyName ?? ''} placeholder="Nom de la société" />
          </div>
        ) : (
          <div>
            <Label>Société (optionnel)</Label>
            <Input name="company" defaultValue={data?.companyName ?? ''} />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Email</Label>
          <Input type="email" name="email" defaultValue={data?.email ?? ''} />
        </div>
        <div>
          <Label>Téléphone</Label>
          <Input name="phone" defaultValue={data?.phone ?? ''} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Adresse</Label>
          <Input name="address" defaultValue={data?.address ?? ''} />
        </div>
        <div>
          <Label>Ville</Label>
          <Input name="city" defaultValue={data?.city ?? ''} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {isClient ? (
          <div>
            <Label>CIN</Label>
            <Input name="cin" defaultValue={data?.cin ?? ''} placeholder="Numéro de carte d'identité" />
          </div>
        ) : null}
        <div>
          <Label>Matricule fiscal</Label>
          <Input name="matriculeFiscal" defaultValue={data?.matriculeFiscal ?? ''} placeholder="1234567/A/M/000" />
        </div>
        <div>
          <Label>Notes</Label>
          <Input name="notes" defaultValue={data?.notes ?? ''} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="active" defaultChecked={data?.active ?? true} className="h-4 w-4 rounded border-slate-300" />
        {isClient ? 'Client actif' : 'Fournisseur actif'}
      </label>
    </>
  )
}