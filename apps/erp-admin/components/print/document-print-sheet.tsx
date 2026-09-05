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

const fmt = (n: number) => {
  const fixed = n.toFixed(3)
  const stripped = fixed.replace(/\.?0+$/, '')
  return stripped.replace('.', ',')
}

function buildColumns(lines: PrintLine[]): string {
  const maxLen = lines.reduce((max, l) => Math.max(max, l.sku.length), 4)
  const refW = Math.max(maxLen * 5.5 + 8, 36)
  return [
    `${refW}px`,
    'minmax(80px, 1fr)',
    '38px',
    '52px',
    '42px',
    '58px',
    '38px',
    '52px',
    '56px',
  ].join(' ')
}

const C = 'px-1 py-1 min-w-0 flex items-start'
const CN = `${C} justify-end text-right tabular-nums whitespace-nowrap`
const CT = `${C} text-left`
const H = 'bg-slate-50 text-[9px] font-semibold uppercase tracking-wide text-slate-600 border-b-2 border-slate-800'
const BR = 'border-r border-slate-200'
const BRH = 'border-r border-slate-300'

export function DocumentPrintSheet({ doc }: { doc: PrintDocument }) {
  const dateStr = doc.date.toLocaleDateString('fr-FR')
  const gridCols = buildColumns(doc.lines)

  return (
    <div className="print-sheet mx-auto flex h-[275mm] w-[210mm] flex-col overflow-hidden rounded-lg bg-white p-[10mm_12mm_0] shadow-lifted">

      {/* ── Header ── */}
      <div className="flex shrink-0 items-start justify-between border-b-2 border-slate-800 pb-2">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">{doc.store.name}</h1>
          {doc.store.activity ? <p className="text-[9px] text-slate-600">Activité : {doc.store.activity}</p> : null}
          {doc.store.address || doc.store.city ? (
            <p className="text-[9px] text-slate-600">Adresse : {[doc.store.address, doc.store.city].filter(Boolean).join(', ')}</p>
          ) : null}
          {doc.store.phone ? <p className="text-[9px] text-slate-600">Tél : {doc.store.phone}</p> : null}
          {doc.store.matriculeFiscal ? <p className="text-[9px] text-slate-600">MF : {doc.store.matriculeFiscal}</p> : null}
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-bold tracking-tight text-slate-900">{doc.title}</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-700">N° : {doc.number}</p>
          <p className="text-[9px] text-slate-600">Date : {dateStr}</p>
          {doc.secondaryDate ? <p className="text-[9px] text-slate-600">{doc.secondaryDate}</p> : null}
        </div>
      </div>

      {/* ── Client ── */}
      <div className="mt-2 flex shrink-0 gap-8">
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">Adressé à</p>
          <p className="text-[11px] font-bold text-slate-900">{doc.party.name}</p>
          {doc.party.matriculeFiscal ? <p className="text-[9px] text-slate-600">MF : {doc.party.matriculeFiscal}</p> : null}
          {doc.party.cin ? <p className="text-[9px] text-slate-600">CIN : {doc.party.cin}</p> : null}
          {doc.party.address || doc.party.city ? (
            <p className="text-[9px] text-slate-600">{[doc.party.address, doc.party.city].filter(Boolean).join(', ')}</p>
          ) : null}
        </div>
        {doc.reason ? (
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">Motif</p>
            <p className="text-[9px] text-slate-700">{doc.reason}</p>
          </div>
        ) : null}
      </div>

      {/* ── Grid — fills remaining space, vertical lines stop at its bottom border ── */}
      <div
        className="mt-2 grid min-h-0 flex-1 items-stretch border-y-2 border-slate-800 text-[10px]"
        style={{
          gridTemplateColumns: gridCols,
          gridTemplateRows: `auto repeat(${doc.lines.length}, auto) 1fr`,
        }}
      >
        {/* Header row */}
        <div className={`${CT} ${BRH} ${H}`}>Ref</div>
        <div className={`${CT} ${BRH} ${H}`}>Désignation</div>
        <div className={`${CN} ${BRH} ${H}`}>Qté</div>
        <div className={`${CN} ${BRH} ${H}`}>P.U. HT</div>
        <div className={`${CN} ${BRH} ${H}`}>Remise</div>
        <div className={`${CN} ${BRH} ${H}`}>Prix HT</div>
        <div className={`${CN} ${BRH} ${H}`}>TVA</div>
        <div className={`${CN} ${BRH} ${H}`}>Mt TVA</div>
        <div className={`${CN} ${H}`}>TTC</div>

        {/* Data rows */}
        {doc.lines.map((l, i) => (
          <div key={`row-${i}`} style={{ display: 'contents' }}>
            <div className={`${CT} ${BR} text-[9px] text-slate-500`} title={l.sku}>{l.sku}</div>
            <div className={`${CT} ${BR} break-words text-slate-900`} title={l.designation}>{l.designation}</div>
            <div className={`${CN} ${BR}`}>{fmt(l.quantity)}</div>
            <div className={`${CN} ${BR}`}>{fmt(l.unitPriceHT)}</div>
            <div className={`${CN} ${BR}`}>{l.discountLabel || '—'}</div>
            <div className={`${CN} ${BR}`}>{fmt(l.lineHT)}</div>
            <div className={`${CN} ${BR}`}>{fmt(l.taxRate)}</div>
            <div className={`${CN} ${BR}`}>{fmt(l.lineTVA)}</div>
            <div className={CN}>{fmt(l.lineTTC)}</div>
          </div>
        ))}

        {/* Fill row — 1fr extends vertical lines to grid bottom border */}
        <div className={BR} />
        <div className={BR} />
        <div className={BR} />
        <div className={BR} />
        <div className={BR} />
        <div className={BR} />
        <div className={BR} />
        <div className={BR} />
        <div />
      </div>

      {/* ── Bottom zone — normal flow on screen, fixed at page bottom in print ── */}
      <div className="print-footer shrink-0 pt-2">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Cachet &amp; signature</p>
            <p className="text-[10px] font-bold text-slate-800">{doc.store.name}</p>
            <div className="mt-1 h-10" />
          </div>

          <div className="w-[42%] space-y-0.5 text-[9px]">
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
            <div className="flex justify-between border-t border-slate-800 pt-0.5 text-[10px] font-bold text-slate-900">
              <span>Total TTC — Net à payer</span>
              <span>{money(doc.totalTTC)}</span>
            </div>
          </div>
        </div>

        <div className="mt-0.5 text-[7px] leading-relaxed text-slate-500">
          {doc.store.rib ? <p>RIB : {doc.store.rib}</p> : null}
          {doc.conditions ? <p>Conditions : {doc.conditions}</p> : null}
          {doc.store.paymentTerms ? <p>Conditions : {doc.store.paymentTerms}</p> : null}
          {doc.store.legalNotes ? <p>{doc.store.legalNotes}</p> : null}
        </div>
      </div>

    </div>
  )
}