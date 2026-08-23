import { PageHeader, Card, Label, Input, Select, Textarea } from '@/components/ui'
import { EntityForm } from '@/components/ui/entity-form'
import { updateStoreSettings } from '@/lib/actions/erp'
import { db } from '@elec/db'
import { getStoreSettings } from '@elec/services'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const [settings, warehouses] = await Promise.all([
    getStoreSettings().catch(() => null),
    db.warehouse.findMany({ orderBy: { name: 'asc' } }),
  ])

  const s = settings
  const val = (v: string | null | undefined) => v ?? ''

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Paramètres" description="Configuration du magasin (utilisée sur les documents PDF et la facturation)." />
      <Card className="p-6">
        <EntityForm action={updateStoreSettings} submitLabel="Enregistrer les paramètres">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nom du magasin</Label>
              <Input name="storeName" defaultValue={val(s?.storeName)} />
            </div>
            <div>
              <Label>Activité</Label>
              <Input name="activity" defaultValue={val(s?.activity)} placeholder="Vente de matériel électrique" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Slogan</Label>
              <Input name="slogan" defaultValue={val(s?.slogan)} />
            </div>
            <div>
              <Label>Adresse</Label>
              <Input name="address" defaultValue={val(s?.address)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Ville</Label>
              <Input name="city" defaultValue={val(s?.city)} />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input name="phone" defaultValue={val(s?.phone)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Email</Label>
              <Input type="email" name="email" defaultValue={val(s?.email)} />
            </div>
            <div>
              <Label>Matricule fiscal</Label>
              <Input name="matriculeFiscal" defaultValue={val(s?.matriculeFiscal)} placeholder="1234567/A/M/000" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>RIB</Label>
              <Input name="rib" defaultValue={val(s?.rib)} placeholder="RIB pour virement" />
            </div>
            <div>
              <Label>Dépôt par défaut</Label>
              <Select name="defaultWarehouseId" defaultValue={s?.defaultWarehouseId ?? ''}>
                <option value="">— Aucun —</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Logo (URL)</Label>
              <Input name="logoUrl" defaultValue={val(s?.logoUrl)} />
            </div>
            <div>
              <Label>Texte de pied de page des factures</Label>
              <Input name="invoiceFooterText" defaultValue={val(s?.invoiceFooterText)} />
            </div>
          </div>
          <div>
            <Label>Conditions de règlement</Label>
            <Textarea name="paymentTerms" rows={2} defaultValue={val(s?.paymentTerms)} />
          </div>
          <div>
            <Label>Mentions légales (pied de page PDF)</Label>
            <Textarea name="legalNotes" rows={2} defaultValue={val(s?.legalNotes)} />
          </div>
          <div>
            <Label>Texte de pied de page des factures</Label>
            <Textarea name="invoiceFooterText" rows={2} defaultValue={val(s?.invoiceFooterText)} />
          </div>
        </EntityForm>
      </Card>
    </div>
  )
}