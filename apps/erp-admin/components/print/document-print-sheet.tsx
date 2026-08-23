import { money } from '@/lib/utils'

export interface PrintLine {
  sku: string
  designation: string
  quantity: number
  unitPriceHT: number
  discountLabel: string
  lineHT: number
  taxRate: number
  lineTVA: number
  lineTTC: number
}

export interface PrintStore {
  name: string
  activity?: string | null
  address?: string | null
  city?: string | null
  phone?: string | null
  email?: string | null
  matriculeFiscal?: string | null
  rib?: string | null
  legalNotes?: string | null
  paymentTerms?: string | null
}

export interface PrintParty {
  name: string
  matriculeFiscal?: string | null
  cin?: string | null
  address?: string | null
  city?: string | null
}

export interface PrintDocument {
  title: string
  number: string
  date: Date
  secondaryDate?: string
  party: PrintParty
  reason?: string
  lines: PrintLine[]
  totalHT: number
  discountGlobal: number
  totalHTAfterDiscount: number
  vatBreakdown: Array<{ rate: number; tva: number }>
  totalTVA: number
  timbreFiscal: number
  totalTTC: number
  notes?: string | null
  conditions?: string | null
  store: PrintStore
}

const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).replace(/\u00A0/g, ' ')

const NUM = 'whitespace-nowrap text-right tabular-nums'

export function DocumentPrintSheet({ doc }: { doc: PrintDocument }) {
  const dateStr = doc.date.toLocaleDateString('fr-FR')
  return (
    <div className="print-sheet mx-auto flex w-[210mm] min-h-[297mm] flex-col rounded-lg bg-white p-[12mm] shadow-lifted">
      <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">{doc.store.name}</h1>
          {doc.store.activity ? <p className="text-xs text-slate-600">Activité : {doc.store.activity}</p> : null}
          {doc.store.address || doc.store.city ? (
            <p className="text-xs text-slate-600">
              Adresse : {[doc.store.address, doc.store.city].filter(Boolean).join(', ')}
            </p>
          ) : null}
          {doc.store.phone ? <p className="text-xs text-slate-600">Tél : {doc.store.phone}</p> : null}
          {doc.store.email ? <p className="text-xs text-slate-600">{doc.store.email}</p> : null}
          {doc.store.matriculeFiscal ? (
            <p className="text-xs text-slate-600">Matricule fiscal : {doc.store.matriculeFiscal}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-bold tracking-tight text-slate-900">{doc.title}</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">N° : {doc.number}</p>
          <p className="text-xs text-slate-600">Date : {dateStr}</p>
          {doc.secondaryDate ? <p className="text-xs text-slate-600">{doc.secondaryDate}</p> : null}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Adressé à</p>
          <p className="text-sm font-bold text-slate-900">{doc.party.name}</p>
          {doc.party.matriculeFiscal ? (
            <p className="text-xs text-slate-600">Matricule fiscal : {doc.party.matriculeFiscal}</p>
          ) : null}
          {doc.party.cin ? <p className="text-xs text-slate-600">CIN : {doc.party.cin}</p> : null}
          {doc.party.address || doc.party.city ? (
            <p className="text-xs text-slate-600">{[doc.party.address, doc.party.city].filter(Boolean).join(', ')}</p>
          ) : null}
        </div>
        {doc.reason ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Motif</p>
            <p className="text-xs text-slate-700">{doc.reason}</p>
          </div>
        ) : null}
      </div>

      <table className="mt-5 w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-y border-slate-800 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            <th className="px-1.5 py-1.5">Référence</th>
            <th className="px-1.5 py-1.5">Désignation</th>
            <th className={`${NUM} px-1.5 py-1.5`}>Qté</th>
            <th className={`${NUM} px-1.5 py-1.5`}>P.U. HT</th>
            <th className={`${NUM} px-1.5 py-1.5`}>Remise</th>
            <th className={`${NUM} px-1.5 py-1.5`}>Prix HT</th>
            <th className={`${NUM} px-1.5 py-1.5`}>TVA %</th>
            <th className={`${NUM} px-1.5 py-1.5`}>Mt TVA</th>
            <th className={`${NUM} px-1.5 py-1.5`}>TTC</th>
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((l, i) => (
            <tr key={i} className="border-b border-slate-200">
              <td className="px-1.5 py-1.5 text-[10px] text-slate-500">{l.sku}</td>
              <td className="px-1.5 py-1.5 text-slate-900">{l.designation}</td>
              <td className={`${NUM} px-1.5 py-1.5`}>{fmt(l.quantity)}</td>
              <td className={`${NUM} px-1.5 py-1.5`}>{fmt(l.unitPriceHT)}</td>
              <td className={`${NUM} px-1.5 py-1.5`}>{l.discountLabel || '—'}</td>
              <td className={`${NUM} px-1.5 py-1.5`}>{fmt(l.lineHT)}</td>
              <td className={`${NUM} px-1.5 py-1.5`}>{fmt(l.taxRate)}%</td>
              <td className={`${NUM} px-1.5 py-1.5`}>{fmt(l.lineTVA)}</td>
              <td className={`${NUM} px-1.5 py-1.5`}>{fmt(l.lineTTC)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <div className="w-[42%] space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span className="text-slate-500">Total HT</span>
            <span className="font-medium">{money(doc.totalHT)}</span>
          </div>
          {doc.discountGlobal > 0 ? (
            <div className="flex justify-between">
              <span className="text-slate-500">Remise globale</span>
              <span className="font-medium text-red-600">-{money(doc.discountGlobal)}</span>
            </div>
          ) : null}
          <div className="flex justify-between">
            <span className="text-slate-500">Total HT après remise</span>
            <span className="font-medium">{money(doc.totalHTAfterDiscount)}</span>
          </div>
          {doc.vatBreakdown.map((b) => (
            <div key={b.rate} className="flex justify-between">
              <span className="text-slate-500">TVA {fmt(b.rate)}%</span>
              <span className="font-medium">{money(b.tva)}</span>
            </div>
          ))}
          {doc.timbreFiscal > 0 ? (
            <div className="flex justify-between">
              <span className="text-slate-500">Timbre fiscal</span>
              <span className="font-medium">{money(doc.timbreFiscal)}</span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-slate-800 pt-1 text-sm font-bold text-slate-900">
            <span>Total TTC — Net à payer</span>
            <span>{money(doc.totalTTC)}</span>
          </div>
        </div>
      </div>

      <div className="mt-auto">
        <div className="print-sig ml-auto w-fit text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Cachet &amp; signature
          </p>
          <p className="text-xs font-bold text-slate-800">{doc.store.name}</p>
          <div className="mt-2 h-14" />
        </div>

        <div className="print-footer mt-6 border-t border-slate-200 pt-3 text-[9px] leading-relaxed text-slate-500">
          {doc.store.rib ? <p>RIB : {doc.store.rib}</p> : null}
          {doc.conditions ? <p>Conditions de règlement : {doc.conditions}</p> : null}
          {doc.store.paymentTerms ? <p>Conditions de règlement : {doc.store.paymentTerms}</p> : null}
          {doc.store.legalNotes ? <p>{doc.store.legalNotes}</p> : null}
        </div>
      </div>
    </div>
  )
}