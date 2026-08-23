import { db, CreditNoteStatus, Prisma } from '@elec/db'
import { calculateDocumentTotals, toDecimalString, type DocumentLineInput } from '@elec/contracts'
import { currentYear, nextSequenceNumber, serializeVatBreakdown } from './helpers'
import { buildLineRows } from './quote.service'
import { incrementStockCore, StockMovementType } from './stock.service'
import { createNotification } from './notification.service'

// ============================================================================
// Avoirs (retours) — réincrémentent le stock à la validation.
// L'avoir ne porte pas de timbre fiscal (celui de la facture d'origine
// reste acquis). Le calcul TVA suit les mêmes règles (remise avant TVA).
// ============================================================================

export async function createCreditNote(input: {
  invoiceId: string
  reason: string
  createdById: string
  lines: DocumentLineInput[]
}) {
  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId } })
    if (!invoice) throw new Error('Facture introuvable')

    const rows = await buildLineRows(tx, input.lines)
    const totals = calculateDocumentTotals({
      lines: input.lines,
      timbreFiscal: 0,
    })
    const number = await nextSequenceNumber('AV', currentYear(), tx)

    return tx.creditNote.create({
      data: {
        number,
        invoiceId: input.invoiceId,
        customerId: invoice.customerId,
        createdById: input.createdById,
        reason: input.reason,
        totalHT: toDecimalString(totals.totalHT),
        totalTVA: toDecimalString(totals.totalTVA),
        totalTTC: toDecimalString(totals.totalTTC),
        timbreFiscal: '0.000',
        vatBreakdown: serializeVatBreakdown(totals.vatBreakdown),
        items: {
          create: rows.map((r) => ({
            productId: r.productId,
            sku: r.sku,
            designation: r.designation,
            quantity: toDecimalString(r.quantity),
            unitPriceHT: toDecimalString(r.unitPriceHT),
            discountType: r.discountType,
            discountValue: toDecimalString(r.discountValue),
            netUnitPrice: toDecimalString(r.netUnitPrice),
            lineHT: toDecimalString(r.lineHT),
            taxRateId: r.taxRateId,
            lineTVA: toDecimalString(r.lineTVA),
            lineTTC: toDecimalString(r.lineTTC),
          })),
        },
      },
      include: { items: { include: { taxRate: true } }, invoice: true },
    })
  })
}

/** Validation de l'avoir : réincrémentation automatique du stock (RETURN). */
export async function validateCreditNote(id: string, warehouseId?: string) {
  return db.$transaction(async (tx) => {
    const note = await tx.creditNote.findUnique({ where: { id }, include: { items: true } })
    if (!note) throw new Error('Avoir introuvable')
    if (note.status !== CreditNoteStatus.DRAFT) throw new Error('L\'avoir a déjà été validé')

    const wId =
      warehouseId ??
      (await tx.warehouse.findFirst({ where: { isDefault: true } }))?.id ??
      (await tx.warehouse.findFirst())?.id
    if (!wId) throw new Error('Aucun dépôt configuré')

    for (const item of note.items) {
      if (item.productId) {
        await incrementStockCore(tx, {
          productId: item.productId,
          warehouseId: wId,
          quantity: Number(item.quantity),
          type: StockMovementType.RETURN,
          reference: note.number,
          reason: `Retour (avoir ${note.number}) — ${note.reason}`,
          userId: null,
        })
      }
    }

    const updated = await tx.creditNote.update({
      where: { id },
      data: { status: CreditNoteStatus.VALIDATED },
      include: { invoice: true },
    })

    await tx.invoice.update({ where: { id: note.invoiceId }, data: { status: 'CREDITED' } })

    await createNotification({
      type: 'SYSTEM',
      title: 'Avoir validé',
      message: `L\'avoir ${note.number} a été validé et le stock réincrémenté.`,
      link: `/avoirs/${note.id}`,
    })

    return updated
  })
}

export async function listCreditNotes(options?: { search?: string; limit?: number }) {
  const where: Prisma.CreditNoteWhereInput = {}
  if (options?.search) {
    where.OR = [{ number: { contains: options.search } }, { invoice: { number: { contains: options.search } } }]
  }
  return db.creditNote.findMany({
    where,
    include: { invoice: true, customer: true },
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 100,
  })
}

export async function getCreditNote(id: string) {
  return db.creditNote.findUnique({
    where: { id },
    include: { items: { include: { taxRate: true } }, invoice: true, customer: true },
  })
}