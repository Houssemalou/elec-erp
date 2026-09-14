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

const fmt = (n: number | string | Prisma.Decimal) => {
  const fixed = Number(n).toFixed(3)
  const stripped = fixed.replace(/\.?0+$/, '')
  return stripped.replace('.', ',')
}

/** Permet au moteur PDF de couper une référence trop longue sur plusieurs lignes. */
const breakable = (s: string) => (s.length > 9 ? s.split('').join('\u200B') : s)

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    color: '#000000',
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    paddingTop: 36,
    paddingBottom: 20,
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
  rowHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    fontWeight: 700,
    paddingVertical: 4,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 4,
    alignItems: 'center',
  },
  cell: {
    paddingHorizontal: 3,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  cellLast: { paddingHorizontal: 3 },
  num: { textAlign: 'right' },
  colSku: { width: '9%' },
  colDesignation: { width: '28%' },
  colQty: { width: '7%' },
  colPu: { width: '10%' },
  colRemise: { width: '9%' },
  colPrixHT: { width: '11%' },
  colTva: { width: '9%' },
  colMtTva: { width: '9%' },
  colTtc: { width: '8%' },
  colSkuN: { width: '12%' },
  colDesignationN: { width: '32%' },
  colQtyN: { width: '8%' },
  colPuN: { width: '14%' },
  colRemiseN: { width: '10%' },
  colPrixHTN: { width: '24%' },
  cellCenter: { textAlign: 'center' },
  noticeBox: {
    borderWidth: 1,
    borderColor: '#000000',
    padding: 6,
    marginBottom: 10,
    alignItems: 'center',
  },
  noticeText: { fontSize: 8, fontWeight: 700, textAlign: 'center' },
  sommeBox: {
    borderWidth: 1,
    borderColor: '#000000',
    borderStyle: 'dashed',
    padding: 4,
    marginTop: 6,
    alignItems: 'center',
  },
  sommeText: { fontSize: 8, fontWeight: 700, textAlign: 'center' },
  bottomRow: {
    position: 'absolute',
    left: 40,
    right: 40,
    bottom: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  signatureBlock: { width: '38%' },
  recapBlock: { width: '42%' },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  recapRowTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, marginTop: 4, borderTopWidth: 1, borderTopColor: '#000000', fontWeight: 700 },
  signatureSpace: { height: 54, marginTop: 4 },
  footer: {
    position: 'absolute',
    bottom: 20,
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
  showVat?: boolean
  nonAssujettiTva?: boolean
  sommeEnLettres?: string
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
  const emptyRows = Math.max(0, 12 - data.lines.length)
  const showVat = data.showVat !== false
  const netAPayer = data.totalTTC
  const grossTTC = data.lines.reduce((s, l) => s + l.lineTTC, 0)
  const netTTCExclTimbre = data.totalHTBeforeGlobal - data.discountGlobal + data.totalTVA
  const discountTTC = Math.max(0, grossTTC - netTTCExclTimbre)
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

        {/* Tableau des lignes — vertical lines extend through all rows */}
        <View style={styles.table}>
          {showVat ? (
            <View style={styles.rowHeader}>
              <Text style={[styles.cell, styles.colSku, styles.cellCenter]}>Référence</Text>
              <Text style={[styles.cell, styles.colDesignation, styles.cellCenter]}>Désignation</Text>
              <Text style={[styles.cell, styles.colQty, styles.cellCenter]}>Qté</Text>
              <Text style={[styles.cell, styles.colPu, styles.cellCenter]}>P.U. HT</Text>
              <Text style={[styles.cell, styles.colRemise, styles.cellCenter]}>Remise</Text>
              <Text style={[styles.cell, styles.colPrixHT, styles.cellCenter]}>Prix HT</Text>
              <Text style={[styles.cell, styles.colTva, styles.cellCenter]}>TVA %</Text>
              <Text style={[styles.cell, styles.colMtTva, styles.cellCenter]}>Mt TVA</Text>
              <Text style={[styles.cellLast, styles.colTtc, styles.cellCenter]}>TTC</Text>
            </View>
          ) : (
            <View style={styles.rowHeader}>
              <Text style={[styles.cell, styles.colSkuN, styles.cellCenter]}>Référence</Text>
              <Text style={[styles.cell, styles.colDesignationN, styles.cellCenter]}>Désignation</Text>
              <Text style={[styles.cell, styles.colQtyN, styles.cellCenter]}>Qté</Text>
              <Text style={[styles.cell, styles.colPuN, styles.cellCenter]}>P.U. HT</Text>
              <Text style={[styles.cell, styles.colRemiseN, styles.cellCenter]}>Remise</Text>
              <Text style={[styles.cellLast, styles.colPrixHTN, styles.cellCenter]}>Montant</Text>
            </View>
          )}
          {data.lines.map((l, i) => (
            <View key={i} style={styles.row}>
              <Text style={[styles.cell, showVat ? styles.colSku : styles.colSkuN]}>{breakable(l.sku)}</Text>
              <Text style={[styles.cell, showVat ? styles.colDesignation : styles.colDesignationN]}>{l.designation}</Text>
              <Text style={[styles.cell, showVat ? styles.colQty : styles.colQtyN, styles.cellCenter]}>{fmt(l.quantity)}</Text>
              <Text style={[styles.cell, showVat ? styles.colPu : styles.colPuN, styles.cellCenter]}>
                {fmt(showVat ? l.unitPriceHT : l.unitPriceHT * (1 + l.taxRate / 100))}
              </Text>
              <Text style={[styles.cell, showVat ? styles.colRemise : styles.colRemiseN, styles.cellCenter]}>{l.discountLabel || '-'}</Text>
              <Text style={[showVat ? styles.cell : styles.cellLast, showVat ? styles.colPrixHT : styles.colPrixHTN, styles.cellCenter]}>
                {fmt(showVat ? l.lineHT : l.lineTTC)}
              </Text>
              {showVat ? (
                <>
                  <Text style={[styles.cell, styles.colTva, styles.cellCenter]}>{fmt(l.taxRate)}</Text>
                  <Text style={[styles.cell, styles.colMtTva, styles.cellCenter]}>{fmt(l.lineTVA)}</Text>
                  <Text style={[styles.cellLast, styles.colTtc, styles.cellCenter]}>{fmt(l.lineTTC)}</Text>
                </>
              ) : null}
            </View>
          ))}
          {Array.from({ length: emptyRows }).map((_, i) => (
            <View key={`empty-${i}`} style={styles.row}>
              <Text style={[styles.cell, showVat ? styles.colSku : styles.colSkuN]}>&#8203;</Text>
              <Text style={[styles.cell, showVat ? styles.colDesignation : styles.colDesignationN]}>&#8203;</Text>
              <Text style={[styles.cell, showVat ? styles.colQty : styles.colQtyN, styles.cellCenter]}>&#8203;</Text>
              <Text style={[styles.cell, showVat ? styles.colPu : styles.colPuN, styles.cellCenter]}>&#8203;</Text>
              <Text style={[styles.cell, showVat ? styles.colRemise : styles.colRemiseN, styles.cellCenter]}>&#8203;</Text>
              <Text style={[showVat ? styles.cell : styles.cellLast, showVat ? styles.colPrixHT : styles.colPrixHTN, styles.cellCenter]}>&#8203;</Text>
              {showVat ? (
                <>
                  <Text style={[styles.cell, styles.colTva, styles.cellCenter]}>&#8203;</Text>
                  <Text style={[styles.cell, styles.colMtTva, styles.cellCenter]}>&#8203;</Text>
                  <Text style={[styles.cellLast, styles.colTtc, styles.cellCenter]}>&#8203;</Text>
                </>
              ) : null}
            </View>
          ))}
        </View>

        {/* Mention entreprise non assujettie à la TVA (facture sans TVA) */}
        {data.nonAssujettiTva ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>
              Entreprise non assujettie à la TVA conformément à l'article 18 du Code de la TVA
            </Text>
          </View>
        ) : null}

        {/* Bottom row: Signature (left) + Totals (right) — absolutely positioned */}
        <View style={styles.bottomRow}>
          {/* Signature — bottom left */}
          <View style={styles.signatureBlock}>
            <Text style={styles.blockLabel}>Cachet &amp; signature</Text>
            <Text style={{ fontSize: 8, fontWeight: 700, marginTop: 2 }}>{data.store.name}</Text>
            <View style={styles.signatureSpace} />
          </View>

          {/* Totals — bottom right */}
          <View style={styles.recapBlock}>
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
            {showVat ? (
            <>
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
            </>
          ) : (
            <>
              <View style={styles.recapRow}>
                <Text>Total</Text>
                <Text>{fmt(grossTTC)} DT</Text>
              </View>
              {discountTTC > 0.001 ? (
                <View style={styles.recapRow}>
                  <Text>Remise globale</Text>
                  <Text>-{fmt(discountTTC)} DT</Text>
                </View>
              ) : null}
              <View style={styles.recapRow}>
                <Text>Total après remise</Text>
                <Text>{fmt(netTTCExclTimbre)} DT</Text>
              </View>
            </>
          )}
            {data.timbreFiscal > 0 ? (
              <View style={styles.recapRow}>
                <Text>Timbre fiscal</Text>
                <Text>{fmt(data.timbreFiscal)} DT</Text>
              </View>
            ) : null}
            {data.sommeEnLettres ? (
              <View style={styles.sommeBox}>
                <Text style={styles.sommeText}>{data.sommeEnLettres}</Text>
              </View>
            ) : null}
            <View style={styles.recapRowTotal}>
              <Text>{showVat ? 'Total TTC — Net à payer' : 'Net à payer'}</Text>
              <Text>{fmt(netAPayer)} DT</Text>
            </View>
          </View>
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

export async function generateInvoicePdf(
  invoiceId: string,
  options?: { withVat?: boolean; sommeEnLettres?: string },
): Promise<Buffer> {
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
      name:
        invoice.customerName ||
        (invoice.customer
          ? invoice.customer.companyName ||
            [invoice.customer.firstName, invoice.customer.lastName].filter(Boolean).join(' ')
          : null) ||
        'Client',
      matriculeFiscal: invoice.customerMatricule ?? invoice.customer?.matriculeFiscal ?? null,
      cin: invoice.customer?.cin ?? null,
      address: invoice.customerAddress ?? invoice.customer?.address ?? null,
      city: invoice.customerCity ?? invoice.customer?.city ?? null,
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
    showVat: options?.withVat !== false,
    nonAssujettiTva: options?.withVat === false,
    sommeEnLettres: options?.sommeEnLettres,
    store,
  }
  return renderToBuffer(<PdfDocumentView data={data} />)
}

export async function generateQuotePdf(quoteId: string, options?: { withVat?: boolean }): Promise<Buffer> {
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: { customer: true, items: { include: { taxRate: true } } },
  })
  if (!quote) throw new Error('Devis introuvable')

  const store = await loadStore()
  const customerName =
    quote.customerName ||
    (quote.customer
      ? quote.customer.companyName ||
        [quote.customer.firstName, quote.customer.lastName].filter(Boolean).join(' ') ||
        'Client'
      : 'Client')
  const showVat = options?.withVat !== undefined ? options.withVat : !quote.nonAssujettiTva
  const data: PdfDocumentData = {
    type: 'quote',
    title: 'DEVIS',
    number: quote.number,
    date: quote.createdAt,
    secondaryDate: quote.validUntil ? { label: 'Valable jusqu\'au', value: quote.validUntil.toLocaleDateString('fr-FR') } : undefined,
    customer: {
      name: customerName,
      matriculeFiscal: quote.customer?.matriculeFiscal ?? null,
      cin: quote.customer?.cin ?? null,
      address: quote.customer?.address ?? null,
      city: quote.customer?.city ?? null,
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
    showVat,
    nonAssujettiTva: !showVat,
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
      name:
        note.customerName ||
        (note.customer
          ? note.customer.companyName || [note.customer.firstName, note.customer.lastName].filter(Boolean).join(' ')
          : null) ||
        'Client',
      matriculeFiscal: note.customerMatricule ?? note.customer?.matriculeFiscal ?? null,
      cin: note.customer?.cin ?? null,
      address: note.customerAddress ?? note.customer?.address ?? null,
      city: note.customerCity ?? note.customer?.city ?? null,
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