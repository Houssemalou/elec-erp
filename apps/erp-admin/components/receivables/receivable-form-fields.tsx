import { Label, Input, Select, Textarea } from '@/components/ui'
import { db } from '@elec/db'
import { dateInputValue } from '@/lib/utils'

export interface ReceivableFormData {
  customerName?: string
  customerId?: string | null
  amountTTC?: string
  dueDate?: Date | string | null
  notes?: string | null
}

export async function ReceivableFormFields({ data }: { data?: ReceivableFormData }) {
  // Le client est facultatif : une créance saisie au comptant peut concerner
  // quelqu'un qui n'a pas encore de fiche client.
  const customers = await db.customer.findMany({
    where: { active: true },
    orderBy: [{ companyName: 'asc' }, { lastName: 'asc' }],
    select: { id: true, firstName: true, lastName: true, companyName: true },
  })

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="customerName">Nom du client *</Label>
        <Input
          id="customerName"
          name="customerName"
          required
          list="customer-suggestions"
          defaultValue={data?.customerName ?? ''}
          placeholder="Ex : Atelier Ben Salah"
        />
        <datalist id="customer-suggestions">
          {customers.map((c) => {
            const name =
              c.companyName || [c.firstName, c.lastName].filter(Boolean).join(' ') || c.id
            return <option key={c.id} value={name} />
          })}
        </datalist>
        <p className="mt-1 text-xs text-white/40">
          Renseignez le nom tel qu&apos;il apparaît sur vos créances : c&apos;est lui qui regroupe les factures et
          les créances libres.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="customerId">Fiche client (optionnel)</Label>
          <Select id="customerId" name="customerId" defaultValue={data?.customerId ?? ''}>
            <option value="">— Aucune —</option>
            {customers.map((c) => {
              const name =
                c.companyName || [c.firstName, c.lastName].filter(Boolean).join(' ') || c.id
              return (
                <option key={c.id} value={c.id}>
                  {name}
                </option>
              )
            })}
          </Select>
        </div>
        <div>
          <Label htmlFor="amountTTC">Montant TTC *</Label>
          <Input
            id="amountTTC"
            name="amountTTC"
            type="number"
            step="0.001"
            min="0.001"
            required
            defaultValue={data?.amountTTC ?? ''}
            placeholder="0,000"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="dueDate">Échéance</Label>
        <Input id="dueDate" name="dueDate" type="date" defaultValue={data?.dueDate ? dateInputValue(data.dueDate) : ''} />
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={data?.notes ?? ''}
          placeholder="Ex : vente au comptant non facturée, accord de paiement…"
        />
      </div>

      <p className="text-xs text-white/40">
        Montant TTC tel que facturé. Vous encaisserez ensuite les règlements depuis la fiche de la créance.
      </p>
    </div>
  )
}