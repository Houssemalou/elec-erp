'use client'

import { useState } from 'react'
import { FileDown, FileText, Printer, X } from 'lucide-react'
import { Button, Label, Textarea } from '@/components/ui'

// Modal de génération d'une facture (PDF / impression) : l'admin choisit la
// version (avec ou sans TVA) et saisit l'arrêté de la somme en toutes lettres.

const NON_ASSUJETTI =
  'Entreprise non assujettie à la TVA conformément à l’article 18 du Code de la TVA'

export function InvoiceGenerateDialog({ invoiceId }: { invoiceId: string }) {
  const [open, setOpen] = useState(false)
  const [withVat, setWithVat] = useState(false)
  const [somme, setSomme] = useState('')

  const params = new URLSearchParams({ vat: withVat ? '1' : '0' })
  if (somme.trim()) params.set('somme', somme.trim())

  const openPdf = () => window.open(`/api/pdf/invoice?${params.toString()}`, '_blank')
  const openPrint = () => window.open(`/print/facture/${invoiceId}?${params.toString()}`, '_blank')

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <FileText className="h-4 w-4" /> Générer (PDF / Imprimer)
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-[#2A2A2A] bg-[#151515] p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-white">Génération de la facture</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-1 text-sm text-white/50">
              Choisissez la version de la facture à générer, puis saisissez l'arrêté de la somme.
            </p>

            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setWithVat(false)}
                  className={`flex-1 rounded-xl border p-4 text-left transition ${
                    !withVat ? 'border-accent-400 bg-accent-400/10' : 'border-[#2A2A2A] hover:bg-[#1A1A1A]'
                  }`}
                >
                  <p className="text-sm font-semibold text-white">Sans TVA</p>
                  <p className="mt-1 text-xs text-white/50">Non assujetti — prix HT uniquement</p>
                </button>
                <button
                  type="button"
                  onClick={() => setWithVat(true)}
                  className={`flex-1 rounded-xl border p-4 text-left transition ${
                    withVat ? 'border-accent-400 bg-accent-400/10' : 'border-[#2A2A2A] hover:bg-[#1A1A1A]'
                  }`}
                >
                  <p className="text-sm font-semibold text-white">Avec TVA</p>
                  <p className="mt-1 text-xs text-white/50">HT + TVA + TTC</p>
                </button>
              </div>

              <div>
                <Label>Arrêté de la somme (en toutes lettres)</Label>
                <Textarea
                  rows={2}
                  value={somme}
                  onChange={(e) => setSomme(e.target.value)}
                  placeholder="Ex : Arrêté la présente facture à la somme de trois mille dinars"
                />
              </div>

              {!withVat ? (
                <p className="rounded-lg border border-[#2A2A2A] bg-[#0B0B0B] px-3 py-2 text-xs text-white/60">
                  {NON_ASSUJETTI}
                </p>
              ) : null}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="button" variant="outline" onClick={openPdf}>
                <FileDown className="h-4 w-4" /> PDF
              </Button>
              <Button type="button" onClick={openPrint}>
                <Printer className="h-4 w-4" /> Imprimer
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}