import React from 'react'
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { db, Prisma } from '@elec/db'
import { getStoreSettings } from './helpers'

// ============================================================================
// PDF Devis / Facture — IMPRESSION NOIR & BLANC STRICT
//   - Fond blanc, texte noir, bordures fines noires
//   - Aucun fond gris/coloré : mise en valeur par gras et encadré uniquement
//   - Mentions légales obligatoires en bas de page (matricule fiscal, RIB,
//     conditions de règlement)
// ============================================================================

const fmt = (n: number | string | Prisma.Decimal) =>
  Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).replace(/\u00A0/g, ' ')

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    color: '#000000',
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    paddingTop: 36,
    paddingBottom: 150,
    paddingHorizontal: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 10,
    marginBottom: 14,
  },
  storeName: { fontSize: 16, fontWeight: 700 },
  storeMeta: { marginTop: 2, fontSize: 8 },
  docTitle: { fontSize: 14, fontWeight: 700, textAlign: 'right' },
  docMeta: { marginTop: 2, fontSize: 8, textAlign: 'right' },
  section: { flexDirection: 'row', marginBottom: 12 },
  block: { flex: 1 },
  blockLabel: { fontSize: 7, fontWeight: 700, marginBottom: 3, textTransform: 'uppercase' },
  table: { borderTopWidth: 1, borderTopColor: '#000000' },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#000000',
    paddingVertical: 4,
    alignItems: 'center',
  },
  rowHeader: { borderBottomWidth: 1, borderBottomColor: '#000000', fontWeight: 700 },
  cell: { paddingHorizontal: 3 },
  num: { textAlign: 'right' },
  colSku: { width: '9%' },
  colDesignation: { width: '30%' },
  colQty: { width: '7%' },
  colPu: { width: '10%' },
  colRemise: { width: '8%' },
  colPrixHT: { width: '11%' },
  colTva: { width: '8%' },
  colMtTva: { width: '9%' },
  colTtc: { width: '8%' },
  recap: { marginTop: 16, flexDirection: 'row', justifyContent: 'flex-end' },
  recapBox: { width: '38%' },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  recapRowTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, marginTop: 4, borderTopWidth: 1, borderTopColor: '#000000', fontWeight: 700 },
  signature: { position: 'absolute', right: 40, bottom: 74, width: '38%', alignItems: 'flex-end' },
  signatureSpace: { height: 54, marginTop: 4 },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#000000',
    paddingTop: 6,
    fontSize: 7,
  },
})

type PdfLine = {
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

export interface PdfDocumentData {
  type: 'invoice' | 'quote' | 'creditnote'
  title: string
  number: string
  date: Date
  secondaryDate?: { label: string; value?: string }
  customer: { name: string; matriculeFiscal?: string | null; cin?: string | null; address?: string | null; city?: string | null }
  lines: PdfLine[]
  totalHTBeforeGlobal: number
  discountGlobal: number
  vatBreakdown: Array<{ rate: number; tva: number }>
  totalTVA: number
  timbreFiscal: number
  totalTTC: number
  store: {
    name: string
    slogan?: string | null
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
}

function PdfDocumentView({ data }: { data: PdfDocumentData }) {
  const dateStr = data.date.toLocaleDateString('fr-FR')
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        <View style={styles.header}>
          <View>
            <Text style={styles.storeName}>{data.store.name}</Text>
            {data.store.activity ? <Text style={styles.storeMeta}>Activité : {data.store.activity}</Text> : null}
            {data.store.slogan && data.store.slogan !== data.store.activity ? <Text style={styles.storeMeta}>{data.store.slogan}</Text> : null}
            {data.store.address ? <Text style={styles.storeMeta}>Adresse : {data.store.address}{data.store.city ? `, ${data.store.city}` : ''}</Text> : null}
            {data.store.phone ? <Text style={styles.storeMeta}>Tél : {data.store.phone}</Text> : null}
            {data.store.email ? <Text style={styles.storeMeta}>E-mail : {data.store.email}</Text> : null}
            {data.store.matriculeFiscal ? <Text style={styles.storeMeta}>Matricule fiscal : {data.store.matriculeFiscal}</Text> : null}
          </View>
          <View>
            <Text style={styles.docTitle}>{data.title}</Text>
            <Text style={styles.docMeta}>N° : {data.number}</Text>
            <Text style={styles.docMeta}>Date : {dateStr}</Text>
            {data.secondaryDate?.value ? (
              <Text style={styles.docMeta}>{data.secondaryDate.label} : {data.secondaryDate.value}</Text>
            ) : null}
          </View>
        </View>

        {/* Client */}
        <View style={styles.section}>
          <View style={styles.block}>
            <Text style={styles.blockLabel}>Adressé à</Text>
            <Text style={{ fontSize: 9, fontWeight: 700 }}>{data.customer.name}</Text>
            {data.customer.matriculeFiscal ? <Text>Matricule fiscal : {data.customer.matriculeFiscal}</Text> : null}
            {data.customer.cin ? <Text>CIN : {data.customer.cin}</Text> : null}
            {data.customer.address ? <Text>{data.customer.address}{data.customer.city ? `, ${data.customer.city}` : ''}</Text> : null}
          </View>
        </View>

        {/* Tableau des lignes */}
        <View style={styles.table}>
          <View style={[styles.row, styles.rowHeader]}>
            <Text style={[styles.cell, styles.colSku]}>Référence</Text>
            <Text style={[styles.cell, styles.colDesignation]}>Désignation</Text>
            <Text style={[styles.cell, styles.colQty, styles.num]}>Qté</Text>
            <Text style={[styles.cell, styles.colPu, styles.num]}>P.U. HT</Text>
            <Text style={[styles.cell, styles.colRemise, styles.num]}>Remise</Text>
            <Text style={[styles.cell, styles.colPrixHT, styles.num]}>Prix HT</Text>
            <Text style={[styles.cell, styles.colTva, styles.num]}>TVA %</Text>
            <Text style={[styles.cell, styles.colMtTva, styles.num]}>Mt TVA</Text>
            <Text style={[styles.cell, styles.colTtc, styles.num]}>TTC</Text>
          </View>
          {data.lines.map((l, i) => (
            <View key={i} style={styles.row}>
              <Text style={[styles.cell, styles.colSku]}>{l.sku}</Text>
              <Text style={[styles.cell, styles.colDesignation]}>{l.designation}</Text>
              <Text style={[styles.cell, styles.colQty, styles.num]}>{fmt(l.quantity)}</Text>
              <Text style={[styles.cell, styles.colPu, styles.num]}>{fmt(l.unitPriceHT)}</Text>
              <Text style={[styles.cell, styles.colRemise, styles.num]}>{l.discountLabel || '-'}</Text>
              <Text style={[styles.cell, styles.colPrixHT, styles.num]}>{fmt(l.lineHT)}</Text>
              <Text style={[styles.cell, styles.colTva, styles.num]}>{fmt(l.taxRate)}%</Text>
              <Text style={[styles.cell, styles.colMtTva, styles.num]}>{fmt(l.lineTVA)}</Text>
              <Text style={[styles.cell, styles.colTtc, styles.num]}>{fmt(l.lineTTC)}</Text>
            </View>
          ))}
        </View>

        {/* Récapitulatif */}
        <View style={styles.recap}>
          <View style={styles.recapBox}>
            <View style={styles.recapRow}>
              <Text>Total HT</Text>
              <Text>{fmt(data.totalHTBeforeGlobal)} DT</Text>
            </View>
            {data.discountGlobal > 0 ? (
              <View style={styles.recapRow}>
                <Text>Remise globale</Text>
                <Text>-{fmt(data.discountGlobal)} DT</Text>
              </View>
            ) : null}
            <View style={styles.recapRow}>
              <Text>Total HT après remise</Text>
              <Text>{fmt(data.totalHTBeforeGlobal - data.discountGlobal)} DT</Text>
            </View>
            {data.vatBreakdown.map((b) => (
              <View key={b.rate} style={styles.recapRow}>
                <Text>TVA {fmt(b.rate)}%</Text>
                <Text>{fmt(b.tva)} DT</Text>
              </View>
            ))}
            {data.timbreFiscal > 0 ? (
              <View style={styles.recapRow}>
                <Text>Timbre fiscal</Text>
                <Text>{fmt(data.timbreFiscal)} DT</Text>
              </View>
            ) : null}
            <View style={styles.recapRowTotal}>
              <Text>Total TTC — Net à payer</Text>
              <Text>{fmt(data.totalTTC)} DT</Text>
            </View>
          </View>
        </View>

        {/* Cachet & signature (magasin) — en bas à droite, juste au-dessus du pied de page */}
        <View style={styles.signature}>
          <Text style={styles.blockLabel}>Cachet &amp; signature</Text>
          <Text style={{ fontSize: 8, fontWeight: 700, marginTop: 2 }}>{data.store.name}</Text>
          <View style={styles.signatureSpace} />
        </View>

        {/* Pied de page : mentions légales obligatoires */}
        <View style={styles.footer}>
          {data.store.rib ? <Text>RIB : {data.store.rib}</Text> : null}
          {data.store.paymentTerms ? <Text>Conditions de règlement : {data.store.paymentTerms}</Text> : null}
          {data.store.legalNotes ? <Text>{data.store.legalNotes}</Text> : null}
        </View>
      </Page>
    </Document>
  )
}

async function loadStore() {
  const settings = await getStoreSettings()
  return {
    name: settings.storeName,
    slogan: settings.slogan,
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
}

function discountLabel(line: { discountType: string | null; discountValue: Prisma.Decimal }) {
  if (!line.discountType || Number(line.discountValue) === 0) return ''
  if (line.discountType === 'PERCENT') return `${fmt(line.discountValue)}%`
  return `${fmt(line.discountValue)} DT`
}

export async function generateInvoicePdf(invoiceId: string): Promise<Buffer> {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      items: { include: { taxRate: true } },
    },
  })
  if (!invoice) throw new Error('Facture introuvable')

  const store = await loadStore()
  const data: PdfDocumentData = {
    type: 'invoice',
    title: 'FACTURE',
    number: invoice.number,
    date: invoice.issueDate,
    secondaryDate: invoice.dueDate ? { label: 'Échéance', value: invoice.dueDate.toLocaleDateString('fr-FR') } : undefined,
    customer: {
      name: invoice.customer.companyName || [invoice.customer.firstName, invoice.customer.lastName].filter(Boolean).join(' ') || 'Client',
      matriculeFiscal: invoice.customer.matriculeFiscal,
      cin: invoice.customer.cin,
      address: invoice.customer.address,
      city: invoice.customer.city,
    },
    lines: invoice.items.map((i) => ({
      sku: i.sku,
      designation: i.designation,
      quantity: Number(i.quantity),
      unitPriceHT: Number(i.netUnitPrice),
      discountLabel: discountLabel(i),
      lineHT: Number(i.lineHT),
      taxRate: Number(i.taxRate.rate),
      lineTVA: Number(i.lineTVA),
      lineTTC: Number(i.lineTTC),
    })),
    totalHTBeforeGlobal: Number(invoice.totalHT) + Number(invoice.discountGlobal),
    discountGlobal: Number(invoice.discountGlobal),
    vatBreakdown: Object.entries(invoice.vatBreakdown as Record<string, string>).map(([rate, tva]) => ({ rate: Number(rate), tva: Number(tva) })),
    totalTVA: Number(invoice.totalTVA),
    timbreFiscal: Number(invoice.timbreFiscal),
    totalTTC: Number(invoice.totalTTC),
    store,
  }
  return renderToBuffer(<PdfDocumentView data={data} />)
}

export async function generateQuotePdf(quoteId: string): Promise<Buffer> {
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: { customer: true, items: { include: { taxRate: true } } },
  })
  if (!quote) throw new Error('Devis introuvable')

  const store = await loadStore()
  const data: PdfDocumentData = {
    type: 'quote',
    title: 'DEVIS',
    number: quote.number,
    date: quote.createdAt,
    secondaryDate: quote.validUntil ? { label: 'Valable jusqu\'au', value: quote.validUntil.toLocaleDateString('fr-FR') } : undefined,
    customer: {
      name: quote.customer.companyName || [quote.customer.firstName, quote.customer.lastName].filter(Boolean).join(' ') || 'Client',
      matriculeFiscal: quote.customer.matriculeFiscal,
      cin: quote.customer.cin,
      address: quote.customer.address,
      city: quote.customer.city,
    },
    lines: quote.items.map((i) => ({
      sku: i.sku,
      designation: i.designation,
      quantity: Number(i.quantity),
      unitPriceHT: Number(i.netUnitPrice),
      discountLabel: discountLabel(i),
      lineHT: Number(i.lineHT),
      taxRate: Number(i.taxRate.rate),
      lineTVA: Number(i.lineTVA),
      lineTTC: Number(i.lineTTC),
    })),
    totalHTBeforeGlobal: Number(quote.totalHT) + Number(quote.discountGlobal),
    discountGlobal: Number(quote.discountGlobal),
    vatBreakdown: Object.entries(quote.vatBreakdown as Record<string, string>).map(([rate, tva]) => ({ rate: Number(rate), tva: Number(tva) })),
    totalTVA: Number(quote.totalTVA),
    timbreFiscal: 0,
    totalTTC: Number(quote.totalTTC),
    store,
  }
  return renderToBuffer(<PdfDocumentView data={data} />)
}

export async function generateCreditNotePdf(creditNoteId: string): Promise<Buffer> {
  const note = await db.creditNote.findUnique({
    where: { id: creditNoteId },
    include: { customer: true, items: { include: { taxRate: true } }, invoice: true },
  })
  if (!note) throw new Error('Avoir introuvable')

  const store = await loadStore()
  const data: PdfDocumentData = {
    type: 'creditnote',
    title: 'AVOIR',
    number: note.number,
    date: note.createdAt,
    secondaryDate: note.invoice ? { label: 'Facture d\'origine', value: note.invoice.number } : undefined,
    customer: {
      name: note.customer.companyName || [note.customer.firstName, note.customer.lastName].filter(Boolean).join(' ') || 'Client',
      matriculeFiscal: note.customer.matriculeFiscal,
      cin: note.customer.cin,
      address: note.customer.address,
      city: note.customer.city,
    },
    lines: note.items.map((i) => ({
      sku: i.sku,
      designation: i.designation,
      quantity: Number(i.quantity),
      unitPriceHT: Number(i.netUnitPrice),
      discountLabel: discountLabel(i),
      lineHT: Number(i.lineHT),
      taxRate: Number(i.taxRate.rate),
      lineTVA: Number(i.lineTVA),
      lineTTC: Number(i.lineTTC),
    })),
    totalHTBeforeGlobal: Number(note.totalHT),
    discountGlobal: 0,
    vatBreakdown: Object.entries(note.vatBreakdown as Record<string, string>).map(([rate, tva]) => ({ rate: Number(rate), tva: Number(tva) })),
    totalTVA: Number(note.totalTVA),
    timbreFiscal: 0,
    totalTTC: Number(note.totalTTC),
    store,
  }
  return renderToBuffer(<PdfDocumentView data={data} />)
}

export { PdfDocumentView }