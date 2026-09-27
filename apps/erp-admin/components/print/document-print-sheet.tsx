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
  name: string | null
  matriculeFiscal?: string | null
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
  showVat?: boolean
  nonAssujettiTva?: boolean
  sommeEnLettres?: string
  notes?: string | null
  conditions?: string | null
  store: PrintStore
}

const NON_ASSUJETTI =
  'Entreprise non assujettie à la TVA conformément à l’article 18 du Code de la TVA'

const fmt = (n: number) => {
  const fixed = n.toFixed(3)
  const stripped = fixed.replace(/\.?0+$/, '')
  return stripped.replace('.', ',')
}

function buildColumns(showVat: boolean): string {
  if (!showVat) {
    return ['12%', '44%', '8%', '14%', '10%', '12%'].join(' ')
  }
  return ['9%', '28%', '7%', '10%', '9%', '11%', '9%', '9%', '8%'].join(' ')
}

const C = 'px-1 py-1 min-w-0 flex items-start'
const CN = `${C} justify-end text-right tabular-nums whitespace-nowrap`
const CNY = `${C} items-center justify-center text-center tabular-nums whitespace-nowrap`
const CT = `${C} text-left`
const CH = `${C} items-center justify-center text-center`
const H = 'bg-slate-50 text-[9px] font-semibold uppercase tracking-wide text-slate-600 border-b-2 border-slate-800'
const BR = 'border-r border-slate-800'
const BRH = 'border-r border-slate-800'

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function DocumentPrintSheet({ doc }: { doc: PrintDocument }) {
  const dateStr = doc.date.toLocaleDateString('fr-FR')
  const showVat = doc.showVat !== false
  const netAPayer = doc.totalTTC
  const grossTTC = doc.lines.reduce((s, l) => s + l.lineTTC, 0)
  const netTTCExclTimbre = doc.totalHTAfterDiscount + doc.totalTVA
  const discountTTC = Math.max(0, grossTTC - netTTCExclTimbre)
  const partyName = cleanText(doc.party.name)
  const partyMatriculeFiscal = cleanText(doc.party.matriculeFiscal)
  const partyAddress = cleanText(doc.party.address)
  const partyCity = cleanText(doc.party.city)
  const partyLocation = [partyAddress, partyCity].filter(Boolean).join(', ') || null
  const hasPartyInfo = Boolean(partyName || partyMatriculeFiscal || partyLocation)
  const reason = cleanText(doc.reason)
  const fillCells = showVat ? 9 : 6
  const gridCols = buildColumns(showVat)

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
      {hasPartyInfo || reason ? (
        <div className="mt-2 flex shrink-0 gap-8">
          {hasPartyInfo ? (
            <div>
              {partyName ? (
                <>
                  <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">Adressé à</p>
                  <p className="text-[11px] font-bold text-slate-900">{partyName}</p>
                </>
              ) : null}
              {partyMatriculeFiscal ? <p className="text-[9px] text-slate-600">MF : {partyMatriculeFiscal}</p> : null}
              {partyLocation ? <p className="text-[9px] text-slate-600">{partyLocation}</p> : null}
            </div>
          ) : null}
          {reason ? (
            <div>
              <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">Motif</p>
              <p className="text-[9px] text-slate-700">{reason}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Grid — fills remaining space, vertical lines stop at its bottom edge ── */}
      <div
        className="mt-2 grid min-h-0 flex-1 items-stretch border-t-2 border-slate-800 text-[10px]"
        style={{
          gridTemplateColumns: gridCols,
          gridTemplateRows: `auto repeat(${doc.lines.length}, auto) 1fr`,
        }}
      >
        {/* Header row */}
        <div className={`${CH} ${BRH} ${H}`}>Ref</div>
        <div className={`${CH} ${BRH} ${H}`}>Désignation</div>
        <div className={`${CH} ${BRH} ${H}`}>Qté</div>
        <div className={`${CH} ${BRH} ${H}`}>P.U. HT</div>
        <div className={`${CH} ${BRH} ${H}`}>Remise</div>
        <div className={`${CH} ${showVat ? BR : ''} ${H}`}>{showVat ? 'Prix HT' : 'Montant'}</div>
        {showVat ? (
          <>
            <div className={`${CH} ${BRH} ${H}`}>TVA</div>
            <div className={`${CH} ${BRH} ${H}`}>Mt TVA</div>
            <div className={`${CH} ${H}`}>TTC</div>
          </>
        ) : null}

        {/* Data rows */}
        {doc.lines.map((l, i) => (
          <div key={`row-${i}`} style={{ display: 'contents' }}>
            <div className={`${CT} ${BR} break-all text-[9px] text-slate-500`} title={l.sku}>{l.sku}</div>
            <div className={`${CT} ${BR} break-words text-slate-900`} title={l.designation}>{l.designation}</div>
            <div className={`${CNY} ${BR}`}>{fmt(l.quantity)}</div>
            <div className={`${CNY} ${BR}`}>{fmt(showVat ? l.unitPriceHT : l.unitPriceHT * (1 + l.taxRate / 100))}</div>
            <div className={`${CNY} ${BR}`}>{l.discountLabel || '—'}</div>
            {showVat ? (
              <>
                <div className={`${CNY} ${BR}`}>{fmt(l.lineHT)}</div>
                <div className={`${CNY} ${BR}`}>{fmt(l.taxRate)}</div>
                <div className={`${CNY} ${BR}`}>{fmt(l.lineTVA)}</div>
                <div className={CNY}>{fmt(l.lineTTC)}</div>
              </>
            ) : (
              <div className={CNY}>{fmt(l.lineTTC)}</div>
            )}
          </div>
        ))}

        {/* Fill row — 1fr extends vertical lines to grid bottom edge */}
        {Array.from({ length: fillCells - 1 }).map((_, i) => (
          <div key={`fill-${i}`} className={BR} />
        ))}
        <div />
      </div>

      {/* ── Bottom zone — normal flow on screen, fixed at page bottom in print ── */}
      <div className="print-footer shrink-0 pt-2">
        {doc.nonAssujettiTva ? (
          <p className="mx-auto mb-2 flex w-fit items-center justify-center rounded border border-slate-800 px-4 py-1 text-center text-[9px] font-bold text-slate-900">
            {NON_ASSUJETTI}
          </p>
        ) : null}

        <div className="flex items-end justify-between">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Cachet &amp; signature</p>
            <p className="text-[10px] font-bold text-slate-800">{doc.store.name}</p>
            <div className="mt-1 h-10" />
          </div>

          <div className="w-[42%] space-y-0.5 text-[9px]">
            {showVat ? (
              <>
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
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total</span>
                  <span className="font-medium">{money(grossTTC)}</span>
                </div>
                {discountTTC > 0.001 ? (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Remise globale</span>
                    <span className="font-medium text-red-600">-{money(discountTTC)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span className="text-slate-500">Total après remise</span>
                  <span className="font-medium">{money(netTTCExclTimbre)}</span>
                </div>
              </>
            )}
            {doc.timbreFiscal > 0 ? (
              <div className="flex justify-between">
                <span className="text-slate-500">Timbre fiscal</span>
                <span className="font-medium">{money(doc.timbreFiscal)}</span>
              </div>
            ) : null}
            {doc.sommeEnLettres ? (
              <div className="mt-1 rounded border border-slate-300 px-2 py-1 text-[9px] font-medium leading-snug text-slate-800">
                {doc.sommeEnLettres}
              </div>
            ) : null}
            <div className="flex justify-between border-t border-slate-800 pt-0.5 text-[10px] font-bold text-slate-900">
              <span>{showVat ? 'Total TTC — Net à payer' : 'Net à payer'}</span>
              <span>{money(netAPayer)}</span>
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
