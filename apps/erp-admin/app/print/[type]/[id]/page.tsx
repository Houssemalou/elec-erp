import { redirect, notFound } from 'next/navigation'
import { auth } from '@/auth'
import { STAFF_ROLES } from '@/lib/session'
import { db } from '@elec/db'
import { getStoreSettings } from '@elec/services'
import {
  DocumentPrintSheet,
  type PrintDocument,
  type PrintLine,
} from '@/components/print/document-print-sheet'
import { PrintToolbar } from '@/components/print/print-toolbar'

export const dynamic = 'force-dynamic'

function discountLabel(line: {
  discountType: string | null
  discountValue: { toString(): string }
}) {
  if (!line.discountType || Number(line.discountValue) === 0) return ''
  if (line.discountType === 'PERCENT') return `${Number(line.discountValue).toLocaleString('fr-FR')}%`
  return `${Number(line.discountValue).toLocaleString('fr-FR')} DT`
}

function partyName(p: {
  companyName: string | null
  firstName: string | null
  lastName: string | null
}) {
  return p.companyName || [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Client'
}

function mapLines<T extends { taxRate: { rate: { toString(): string } } }>(
  items: Array<
    T & {
      sku: string
      designation: string
      quantity: { toString(): string }
      netUnitPrice: { toString(): string }
      discountType: string | null
      discountValue: { toString(): string }
      lineHT: { toString(): string }
      lineTVA: { toString(): string }
      lineTTC: { toString(): string }
    }
  >,
): PrintLine[] {
  return items.map((i) => ({
    sku: i.sku,
    designation: i.designation,
    quantity: Number(i.quantity),
    unitPriceHT: Number(i.netUnitPrice),
    discountLabel: discountLabel(i),
    lineHT: Number(i.lineHT),
    taxRate: Number(i.taxRate.rate),
    lineTVA: Number(i.lineTVA),
    lineTTC: Number(i.lineTTC),
  }))
}

function vatRows(breakdown: unknown) {
  return Object.entries((breakdown ?? {}) as Record<string, string>).map(([rate, tva]) => ({
    rate: Number(rate),
    tva: Number(tva),
  }))
}

export default async function PrintPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>
}) {
  const session = await auth()
  if (!session?.user || !STAFF_ROLES.includes(session.user.role)) redirect('/login')

  const { type, id } = await params
  const settings = await getStoreSettings()
  const store = {
    name: settings.storeName,
    activity: settings.activity,
    address: settings.address,
    city: settings.city,
    phone: settings.phone,
    email: settings.email,
    matriculeFiscal: settings.matriculeFiscal,
    rib: settings.rib,
    legalNotes: settings.legalNotes,
    paymentTerms: settings.paymentTerms,
  }

  let doc: PrintDocument

  if (type === 'devis') {
    const quote = await db.quote.findUnique({
      where: { id },
      include: { customer: true, items: { include: { taxRate: true } } },
    })
    if (!quote) notFound()
    doc = {
      title: 'DEVIS',
      number: quote.number,
      date: quote.createdAt,
      secondaryDate: quote.validUntil
        ? `Valable jusqu'au ${quote.validUntil.toLocaleDateString('fr-FR')}`
        : undefined,
      party: {
        name: partyName(quote.customer),
        matriculeFiscal: quote.customer.matriculeFiscal,
        cin: quote.customer.cin,
        address: quote.customer.address,
        city: quote.customer.city,
      },
      lines: mapLines(quote.items),
      totalHT: Number(quote.totalHT) + Number(quote.discountGlobal),
      discountGlobal: Number(quote.discountGlobal),
      totalHTAfterDiscount: Number(quote.totalHT),
      vatBreakdown: vatRows(quote.vatBreakdown),
      totalTVA: Number(quote.totalTVA),
      timbreFiscal: 0,
      totalTTC: Number(quote.totalTTC),
      notes: quote.notes,
      conditions: quote.conditions,
      store,
    }
  } else if (type === 'facture') {
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: { customer: true, items: { include: { taxRate: true } } },
    })
    if (!invoice) notFound()
    doc = {
      title: 'FACTURE',
      number: invoice.number,
      date: invoice.issueDate,
      secondaryDate: invoice.dueDate
        ? `Échéance : ${invoice.dueDate.toLocaleDateString('fr-FR')}`
        : undefined,
      party: {
        name: partyName(invoice.customer),
        matriculeFiscal: invoice.customer.matriculeFiscal,
        cin: invoice.customer.cin,
        address: invoice.customer.address,
        city: invoice.customer.city,
      },
      lines: mapLines(invoice.items),
      totalHT: Number(invoice.totalHT) + Number(invoice.discountGlobal),
      discountGlobal: Number(invoice.discountGlobal),
      totalHTAfterDiscount: Number(invoice.totalHT),
      vatBreakdown: vatRows(invoice.vatBreakdown),
      totalTVA: Number(invoice.totalTVA),
      timbreFiscal: Number(invoice.timbreFiscal),
      totalTTC: Number(invoice.totalTTC),
      notes: invoice.notes,
      conditions: null,
      store,
    }
  } else if (type === 'avoir') {
    const note = await db.creditNote.findUnique({
      where: { id },
      include: { customer: true, items: { include: { taxRate: true } }, invoice: true },
    })
    if (!note) notFound()
    doc = {
      title: 'AVOIR',
      number: note.number,
      date: note.createdAt,
      secondaryDate: note.invoice ? `Facture d'origine : ${note.invoice.number}` : undefined,
      party: {
        name: partyName(note.customer),
        matriculeFiscal: note.customer.matriculeFiscal,
        cin: note.customer.cin,
        address: note.customer.address,
        city: note.customer.city,
      },
      reason: note.reason,
      lines: mapLines(note.items),
      totalHT: Number(note.totalHT),
      discountGlobal: 0,
      totalHTAfterDiscount: Number(note.totalHT),
      vatBreakdown: vatRows(note.vatBreakdown),
      totalTVA: Number(note.totalTVA),
      timbreFiscal: 0,
      totalTTC: Number(note.totalTTC),
      notes: null,
      conditions: null,
      store,
    }
  } else {
    notFound()
  }

  return (
    <div className="min-h-screen bg-slate-200 py-8">
      <PrintToolbar />
      <DocumentPrintSheet doc={doc} />
    </div>
  )
}