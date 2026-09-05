'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPosSaleAction } from '@/lib/actions/erp'
import { money } from '@/lib/utils'
import { ReceiptPrint } from '@/components/print/receipt-print'
import { createPortal } from 'react-dom'
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Banknote,
  CreditCard,
  Loader2,
  CheckCircle2,
  User,
  FileText,
  Receipt,
  Printer,
} from 'lucide-react'

type Product = {
  id: string
  sku: string
  name: string
  priceHT: number
  unit: string
  taxRate: number
  categoryName: string | null
  stock: number
}

type CartItem = {
  productId: string
  sku: string
  name: string
  priceHT: number
  taxRate: number
  quantity: number
}

type Customer = {
  id: string
  firstName: string | null
  lastName: string | null
  companyName: string | null
  email: string | null
  phone: string | null
}

type SuccessResult = {
  deliveryNoteId: string
  deliveryNoteNumber: string
  invoiceId?: string
  invoiceNumber?: string
  receiptData?: {
    storeName: string
    storeAddress?: string | null
    storePhone?: string | null
    storeMatricule?: string | null
    number: string
    date: Date
    items: Array<{ name: string; quantity: number; unitPriceTTC: number; lineTTC: number }>
    totalTTC: number
    paymentMethod: 'CASH' | 'CARD'
  }
}

export default function PosTerminal({
  products,
  customers,
}: {
  products: Product[]
  customers: Customer[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerId, setCustomerId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH')
  const [generateInvoice, setGenerateInvoice] = useState(false)
  const [generateReceipt, setGenerateReceipt] = useState(false)
  const [success, setSuccess] = useState<SuccessResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Manual client fields (for invoice)
  const [manualFirstName, setManualFirstName] = useState('')
  const [manualLastName, setManualLastName] = useState('')
  const [manualCompany, setManualCompany] = useState('')
  const [manualAddress, setManualAddress] = useState('')
  const [manualMatricule, setManualMatricule] = useState('')
  const [manualCin, setManualCin] = useState('')
  const [discountType, setDiscountType] = useState<'NONE' | 'PERCENT' | 'AMOUNT'>('NONE')
  const [discountValue, setDiscountValue] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return products
    const q = search.toLowerCase()
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.categoryName ?? '').toLowerCase().includes(q),
    )
  }, [products, search])

  const handlePrintReceipt = useCallback(() => {
    const receiptEl = document.getElementById('pos-receipt-print')
    if (!receiptEl) return
    const content = receiptEl.innerHTML
    const printWindow = window.open('', '_blank', 'width=400,height=600')
    if (!printWindow) return
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Ticket de caisse</title>
      <style>
        @media print { @page { size: 72mm auto; margin: 2mm; } body { margin: 0; } }
        body { font-family: monospace; font-size: 9px; line-height: 1.3; color: #000; display: flex; justify-content: center; }
        .print-receipt { width: 64mm; padding: 3mm; }
      </style></head><body>${content}</body></html>`)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300)
  }, [])

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) {
        return prev.map((i) => (i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i))
      }
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          priceHT: product.priceHT,
          taxRate: product.taxRate,
          quantity: 1,
        },
      ]
    })
  }, [])

  const updateQty = useCallback((productId: string, qty: number) => {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((i) => i.productId !== productId)
        : prev.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i)),
    )
  }, [])

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId))
  }, [])

  const subtotalHT = cart.reduce((s, i) => s + i.priceHT * i.quantity, 0)
  const discountAmount = discountType === 'PERCENT'
    ? subtotalHT * (parseFloat(discountValue || '0') / 100)
    : discountType === 'AMOUNT'
      ? parseFloat(discountValue || '0')
      : 0
  const totalHTAfterDiscount = Math.max(0, subtotalHT - discountAmount)
  const totalTVA = cart.reduce((s, i) => {
    const ratio = subtotalHT > 0 ? totalHTAfterDiscount / subtotalHT : 1
    return s + i.priceHT * i.quantity * ratio * (i.taxRate / 100)
  }, 0)
  const totalTTC = totalHTAfterDiscount + totalTVA

  const handleSubmit = async () => {
    if (cart.length === 0) return

    // Stock validation
    const stockIssues: string[] = []
    for (const item of cart) {
      const product = products.find((p) => p.id === item.productId)
      if (product && item.quantity > product.stock) {
        stockIssues.push(`${item.name} (disponible: ${product.stock})`)
      }
    }
    if (stockIssues.length > 0) {
      setError(`Stock insuffisant : ${stockIssues.join(', ')}`)
      return
    }

    // Invoice requires client
    if (generateInvoice) {
      if (!customerId && !manualFirstName.trim()) {
        setError('Sélectionnez un client ou saisissez ses informations')
        return
      }
    }

    setError(null)

    const fd = new FormData()
    fd.set('customerId', customerId)
    fd.set('paymentMethod', paymentMethod)
    fd.set('generateInvoice', String(generateInvoice))
    fd.set('generateReceipt', String(generateReceipt))
    fd.set('lines', JSON.stringify(cart.map((i) => ({ productId: i.productId, quantity: i.quantity }))))
    fd.set('discountType', discountType === 'NONE' ? '' : discountType)
    fd.set('discountValue', discountValue || '0')

    // Manual client info for invoice
    if (generateInvoice && !customerId) {
      fd.set('manualFirstName', manualFirstName.trim())
      fd.set('manualLastName', manualLastName.trim())
      fd.set('manualCompany', manualCompany.trim())
      fd.set('manualAddress', manualAddress.trim())
      fd.set('manualMatricule', manualMatricule.trim())
      fd.set('manualCin', manualCin.trim())
    }

    startTransition(async () => {
      const res = await createPosSaleAction(fd)
      if (res.success && res.deliveryNoteId) {
        // Store receipt data before clearing cart
        const receiptItems = cart.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPriceTTC: item.priceHT * (1 + item.taxRate / 100),
          lineTTC: item.priceHT * item.quantity * (1 + item.taxRate / 100),
        }))
        const receiptTotalTTC = totalTTC

        setSuccess({
          deliveryNoteId: res.deliveryNoteId,
          deliveryNoteNumber: res.deliveryNoteNumber ?? '',
          invoiceId: res.invoiceId,
          invoiceNumber: res.invoiceNumber,
          receiptData: generateReceipt ? {
            storeName: 'ElectroNova HA',
            storeAddress: null,
            storePhone: null,
            storeMatricule: null,
            number: res.deliveryNoteNumber ?? '',
            date: new Date(),
            items: receiptItems,
            totalTTC: receiptTotalTTC,
            paymentMethod,
          } : undefined,
        })
        setCart([])
        setCustomerId('')
        setPaymentMethod('CASH')
        setGenerateInvoice(false)
        setGenerateReceipt(false)
        setManualFirstName('')
        setManualLastName('')
        setManualCompany('')
        setManualAddress('')
        setManualMatricule('')
        setManualCin('')
        setDiscountType('NONE')
        setDiscountValue('')
        setSearch('')
      } else {
        setError(res.error ?? 'Erreur lors de la vente')
      }
    })
  }

  if (success) {
    return (
      <>
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold text-white">Vente enregistrée !</h2>
            <p className="mt-2 text-sm text-white/50">
              {success.invoiceId
                ? `Facture ${success.invoiceNumber} + Bon de livraison ${success.deliveryNoteNumber}`
                : `Bon de livraison ${success.deliveryNoteNumber}`}
              <br />
              Stock mis à jour, paiement enregistré.
            </p>
            <div className="mt-6 flex gap-3 justify-center flex-wrap">
              <button
                onClick={() => {
                  setSuccess(null)
                  router.refresh()
                }}
                className="rounded-xl bg-accent-400 px-5 py-2.5 text-sm font-semibold text-[#0B0B0B] hover:bg-accent-300"
              >
                Nouvelle vente
              </button>
              {success.invoiceId && (
                <button
                  onClick={() => router.push(`/factures/${success.invoiceId}`)}
                  className="flex items-center gap-2 rounded-xl border border-[#2A2A2A] px-5 py-2.5 text-sm font-semibold text-white/70 hover:bg-[#1A1A1A]"
                >
                  <FileText className="h-4 w-4" /> Voir la facture
                </button>
              )}
              {success.receiptData && (
                <button
                  onClick={handlePrintReceipt}
                  className="flex items-center gap-2 rounded-xl border border-[#2A2A2A] px-5 py-2.5 text-sm font-semibold text-white/70 hover:bg-[#1A1A1A]"
                >
                  <Printer className="h-4 w-4" /> Imprimer le ticket
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Hidden receipt for printing */}
        {success.receiptData && (
          <div className="hidden">
            <div id="pos-receipt-print">
              <ReceiptPrint data={success.receiptData} />
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 overflow-hidden">
      {/* Left: Products */}
      <div className="flex flex-1 flex-col overflow-hidden border-r border-[#2A2A2A] bg-[#0B0B0B]">
        <div className="border-b border-[#2A2A2A] p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un produit (nom, réf., catégorie)..."
              className="h-11 w-full rounded-xl border border-[#2A2A2A] bg-[#151515] pl-10 pr-4 text-sm text-white placeholder-white/40 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-400/20"
              autoFocus
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="flex flex-col items-start rounded-xl border border-[#2A2A2A] bg-[#151515] p-3 text-left transition-colors hover:border-accent-400/50 hover:bg-[#1A1A1A]"
              >
                <span className="text-[10px] font-medium text-white/40">{p.sku}</span>
                <span className="mt-0.5 line-clamp-2 text-sm font-semibold text-white">{p.name}</span>
                {p.categoryName ? (
                  <span className="mt-0.5 text-[10px] text-white/40">{p.categoryName}</span>
                ) : null}
                <span className="mt-auto pt-2 font-display text-base font-bold text-accent-400">
                  {money(p.priceHT * (1 + p.taxRate / 100))}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full py-10 text-center text-sm text-white/40">Aucun produit trouvé</p>
            )}
          </div>
        </div>
      </div>

      {/* Right: Cart + Payment */}
      <div className="flex w-[380px] flex-col bg-[#151515]">
        {/* Customer — only shown when invoice is requested */}
        {generateInvoice && (
          <div className="border-b border-[#2A2A2A] bg-[#1A1A1A] p-4 space-y-3">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-white/60">
              <User className="h-3.5 w-3.5" /> Client
            </label>
            {customerId ? (
              <div className="flex items-center gap-2">
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="h-10 flex-1 rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 text-sm text-white focus:border-accent-400 focus:outline-none"
                >
                  <option value="">— Sélectionner un client existant —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                      {c.companyName ? ` (${c.companyName})` : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => { setCustomerId(''); setManualFirstName(''); setManualLastName(''); setManualCompany(''); setManualAddress(''); setManualMatricule(''); setManualCin(''); }}
                  className="text-xs text-white/40 hover:text-accent-400 whitespace-nowrap"
                >
                  Saisie manuelle
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualLastName}
                    onChange={(e) => setManualLastName(e.target.value)}
                    placeholder="Nom *"
                    className="h-9 flex-1 rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 text-sm text-white placeholder-white/30 focus:border-accent-400 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={manualFirstName}
                    onChange={(e) => setManualFirstName(e.target.value)}
                    placeholder="Prénom *"
                    className="h-9 flex-1 rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 text-sm text-white placeholder-white/30 focus:border-accent-400 focus:outline-none"
                  />
                </div>
                <input
                  type="text"
                  value={manualCompany}
                  onChange={(e) => setManualCompany(e.target.value)}
                  placeholder="Raison sociale"
                  className="h-9 w-full rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 text-sm text-white placeholder-white/30 focus:border-accent-400 focus:outline-none"
                />
                <input
                  type="text"
                  value={manualMatricule}
                  onChange={(e) => setManualMatricule(e.target.value)}
                  placeholder="Matricule fiscal *"
                  className="h-9 w-full rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 text-sm text-white placeholder-white/30 focus:border-accent-400 focus:outline-none"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    placeholder="Adresse"
                    className="h-9 flex-1 rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 text-sm text-white placeholder-white/30 focus:border-accent-400 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={manualCin}
                    onChange={(e) => setManualCin(e.target.value)}
                    placeholder="CIN"
                    className="h-9 flex-1 rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 text-sm text-white placeholder-white/30 focus:border-accent-400 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => { setManualFirstName(''); setManualLastName(''); setManualCompany(''); setManualAddress(''); setManualMatricule(''); setManualCin(''); }}
                  className="text-xs text-white/40 hover:text-accent-400"
                >
                  Choisir un client existant
                </button>
              </>
            )}
          </div>
        )}

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ShoppingCart className="h-10 w-10 text-white/20" />
              <p className="mt-2 text-sm text-white/40">Panier vide</p>
              <p className="text-xs text-white/30">Cliquez sur un produit pour l&apos;ajouter</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {cart.map((item) => {
                const lineTTC = item.priceHT * item.quantity * (1 + item.taxRate / 100)
                return (
                  <li key={item.productId} className="rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                        <p className="text-[11px] text-white/40">
                          {money(item.priceHT * (1 + item.taxRate / 100))} &times; {item.quantity}
                        </p>
                      </div>
                      <button onClick={() => removeFromCart(item.productId)} className="text-white/30 hover:text-red-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center rounded-lg border border-[#2A2A2A]">
                        <button
                          onClick={() => updateQty(item.productId, item.quantity - 1)}
                          className="px-2 py-1 text-white/50 hover:text-accent-400"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium text-white">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.productId, item.quantity + 1)}
                          className="px-2 py-1 text-white/50 hover:text-accent-400"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-accent-400">{money(lineTTC)}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Totals + Payment */}
        <div className="border-t border-[#2A2A2A] bg-[#1A1A1A] p-4">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-white/50">
              <span>Total HT</span>
              <span>{money(subtotalHT)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-red-400">
                <span>Remise</span>
                <span>-{money(discountAmount)}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between text-white/50">
                <span>Net HT</span>
                <span>{money(totalHTAfterDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-white/50">
              <span>TVA</span>
              <span>{money(totalTVA)}</span>
            </div>
            <div className="flex justify-between border-t border-[#2A2A2A] pt-1 text-base font-bold text-white">
              <span>Total TTC</span>
              <span>{money(totalTTC)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setPaymentMethod('CASH')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors ${
                paymentMethod === 'CASH'
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                  : 'border-[#2A2A2A] text-white/50 hover:border-[#3A3A3A]'
              }`}
            >
              <Banknote className="h-4 w-4" /> Espèces
            </button>
            <button
              onClick={() => setPaymentMethod('CARD')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors ${
                paymentMethod === 'CARD'
                  ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                  : 'border-[#2A2A2A] text-white/50 hover:border-[#3A3A3A]'
              }`}
            >
              <CreditCard className="h-4 w-4" /> Carte
            </button>
          </div>

          {/* Discount */}
          <div className="mt-4 flex items-center gap-2">
            <select
              value={discountType}
              onChange={(e) => { setDiscountType(e.target.value as 'NONE' | 'PERCENT' | 'AMOUNT'); setDiscountValue(''); }}
              className="h-10 w-32 rounded-lg border border-[#2A2A2A] bg-[#151515] px-2 text-sm text-white focus:border-accent-400 focus:outline-none"
            >
              <option value="NONE">Pas de remise</option>
              <option value="PERCENT">Remise %</option>
              <option value="AMOUNT">Remise DT</option>
            </select>
            {discountType !== 'NONE' && (
              <input
                type="number"
                min="0"
                step="any"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'PERCENT' ? '%' : 'DT'}
                className="h-10 flex-1 rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 text-sm text-white placeholder-white/30 focus:border-accent-400 focus:outline-none"
              />
            )}
          </div>
          {discountAmount > 0 && (
            <div className="mt-1 text-[11px] text-red-400">
              Remise : -{money(discountAmount)}
            </div>
          )}

          {/* Document options */}
          <div className="mt-4 space-y-2">
            {/* Invoice toggle */}
            <label className="flex items-center gap-3 rounded-xl border border-[#2A2A2A] bg-[#151515] px-4 py-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={generateInvoice}
                onChange={(e) => {
                  setGenerateInvoice(e.target.checked)
                  if (e.target.checked) setGenerateReceipt(false)
                }}
                className="h-4 w-4 rounded border-[#2A2A2A] bg-[#0B0B0B] text-accent-400 focus:ring-accent-400/30"
              />
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-white/50" />
                <span className="text-white/70">Générer une facture</span>
              </div>
            </label>

            {/* Receipt toggle — only when invoice is NOT selected */}
            {!generateInvoice && (
              <label className="flex items-center gap-3 rounded-xl border border-[#2A2A2A] bg-[#151515] px-4 py-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={generateReceipt}
                  onChange={(e) => setGenerateReceipt(e.target.checked)}
                  className="h-4 w-4 rounded border-[#2A2A2A] bg-[#0B0B0B] text-accent-400 focus:ring-accent-400/30"
                />
                <div className="flex items-center gap-2 text-sm">
                  <Receipt className="h-4 w-4 text-white/50" />
                  <span className="text-white/70">Imprimer un ticket</span>
                </div>
              </label>
            )}
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={cart.length === 0 || isPending}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-400 py-3.5 text-sm font-bold text-[#0B0B0B] transition-colors hover:bg-accent-300 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isPending ? 'Enregistrement...' : `Encaisser ${money(totalTTC)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
