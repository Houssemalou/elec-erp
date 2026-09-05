export interface ReceiptLine {
  name: string
  quantity: number
  unitPriceTTC: number
  lineTTC: number
}

export interface ReceiptData {
  storeName: string
  storeAddress?: string | null
  storePhone?: string | null
  storeMatricule?: string | null
  number: string
  date: Date
  items: ReceiptLine[]
  totalTTC: number
  paymentMethod: 'CASH' | 'CARD'
}

const fmt = (n: number) => {
  const fixed = n.toFixed(3)
  const stripped = fixed.replace(/\.?0+$/, '')
  return stripped.replace('.', ',')
}

export function ReceiptPrint({ data }: { data: ReceiptData }) {
  const dateStr = data.date.toLocaleDateString('fr-FR')
  const timeStr = data.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="print-receipt mx-auto w-[72mm] bg-white p-[4mm] font-mono text-[9px] leading-tight text-slate-900">
      {/* Header */}
      <div className="text-center mb-2">
        <p className="text-xs font-bold tracking-wide">{data.storeName}</p>
        {data.storeAddress ? <p className="text-[8px] text-slate-500">{data.storeAddress}</p> : null}
        {data.storePhone ? <p className="text-[8px] text-slate-500">Tél: {data.storePhone}</p> : null}
        {data.storeMatricule ? <p className="text-[8px] text-slate-500">MF: {data.storeMatricule}</p> : null}
      </div>

      <div className="border-t border-dashed border-slate-300 my-1.5" />

      {/* Document info */}
      <div className="text-center mb-1.5">
        <p className="font-bold text-[10px]">TICKET DE CAISSE</p>
        <p className="text-[8px]">N° {data.number}</p>
        <p className="text-[8px]">{dateStr} {timeStr}</p>
      </div>

      <div className="border-t border-dashed border-slate-300 my-1.5" />

      {/* Items */}
      <table className="w-full text-[9px]">
        <thead>
          <tr className="border-b border-slate-300">
            <th className="text-left py-0.5">Désignation</th>
            <th className="text-right py-0.5 w-12">P.U.</th>
            <th className="text-right py-0.5 w-8">Qté</th>
            <th className="text-right py-0.5 w-14">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, i) => (
            <tr key={i} className="border-b border-dotted border-slate-200">
              <td className="py-0.5 pr-1 max-w-[30mm] truncate">{item.name}</td>
              <td className="text-right py-0.5">{fmt(item.unitPriceTTC)}</td>
              <td className="text-right py-0.5">{item.quantity}</td>
              <td className="text-right py-0.5 font-medium">{fmt(item.lineTTC)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-dashed border-slate-300 my-1.5" />

      {/* Total */}
      <div className="flex justify-between font-bold text-[10px]">
        <span>TOTAL TTC</span>
        <span>{fmt(data.totalTTC)}</span>
      </div>

      {/* Payment */}
      <div className="flex justify-between text-[8px] text-slate-500 mt-0.5">
        <span>Paiement</span>
        <span>{data.paymentMethod === 'CARD' ? 'Carte bancaire' : 'Espèces'}</span>
      </div>

      <div className="border-t border-dashed border-slate-300 my-1.5" />

      {/* Footer */}
      <div className="text-center text-[7px] text-slate-400 mt-1">
        <p>Merci de votre confiance !</p>
        <p className="mt-0.5">{data.storeName}</p>
      </div>
    </div>
  )
}
