import { db, InvoiceStatus, InvoiceSource, DeliveryNoteSource, DeliveryNoteStatus, ExpenseCategory, PaymentMethod, Prisma } from '@elec/db'
import { calculateDocumentTotals, toDecimalString, type DocumentLineInput } from '@elec/contracts'
import { currentYear, nextSequenceNumber, serializeVatBreakdown, getDefaultWarehouseId } from './helpers'
import { buildLineRows } from './quote.service'
import {
  decrementStockCore,
  reverseSalesForReferenceCore,
  StockMovementType,
  type ReverseSalesResult,
} from './stock.service'
import { cancelInvoiceCore } from './invoice.service'
import { createNotification } from './notification.service'

// ============================================================================
// Point de Vente (POS) — Vente en caisse :
//   - Crée TOUJOURS un bon de livraison (BL) VALIDÉ
//   - Si le client demande une facture → crée aussi une facture VALIDÉE
//   - Décrémente le stock immédiatement
//   - Enregistre le paiement (espèces ou carte)
//   - Numérotation séquentielle BL-YYYY-######, et FAC-YYYY-###### pour la
//     facture : elle partage la série des factures classiques, avec ou sans TVA.
// ============================================================================

export interface PosSaleLine {
  productId: string
  quantity: number
}

export interface ManualClientInfo {
  firstName: string
  lastName?: string | null
  companyName?: string | null
  address?: string | null
  matriculeFiscal?: string | null
}

export interface CreatePosSaleInput {
  customerId?: string | null
  createdById: string
  lines: PosSaleLine[]
  paymentMethod: 'CASH' | 'CARD'
  generateInvoice?: boolean
  manualClient?: ManualClientInfo | null
  globalDiscountType?: 'PERCENT' | 'AMOUNT' | null
  globalDiscountValue?: number | null
  notes?: string | null
  /**
   * Décaissements affectés à cette vente : le caissier indique où va l'argent
   * encaissé (ex. payer une dette). Chaque affectation devient une dépense
   * liée au bon de livraison, suivie par le module Dépenses.
   */
  cashOutflows?: PosCashOutflow[] | null
}

export interface PosCashOutflow {
  label?: string | null
  amountTTC: number
  category?: ExpenseCategory | null
}

export interface PosSaleResult {
  deliveryNoteId: string
  deliveryNoteNumber: string
  invoiceId?: string
  invoiceNumber?: string
}

export async function createPosSale(input: CreatePosSaleInput): Promise<PosSaleResult> {
  const warehouseId = await getDefaultWarehouseId()

  return db.$transaction(async (tx) => {
    // 1. Résolution des produits
    const products = await tx.product.findMany({
      where: { id: { in: input.lines.map((l) => l.productId) }, isActive: true },
      include: { taxRate: true },
    })
    const productMap = new Map(products.map((p) => [p.id, p]))

    // 2. Construction des lignes
    const docLines: DocumentLineInput[] = input.lines.map((l) => {
      const product = productMap.get(l.productId)
      if (!product) throw new Error(`Produit introuvable : ${l.productId}`)
      return {
        productId: product.id,
        sku: product.sku,
        designation: product.name,
        quantity: l.quantity,
        unitPriceTTC: Number(product.priceTTC ?? Number(product.priceHT) * (1 + Number(product.taxRate.rate) / 100)),
        discountValue: 0,
        discountType: null,
        taxRate: Number(product.taxRate.rate),
      }
    })

    // 3. Calcul des totaux
    const rows = await buildLineRows(tx, docLines)
    const totals = calculateDocumentTotals({
      lines: docLines,
      globalDiscount: input.globalDiscountType
        ? { type: input.globalDiscountType, value: input.globalDiscountValue ?? 0 }
        : null,
      // Au POS le caissier saisit une remise en dinars sur le TTC affiché au
      // client. `discountGlobal` reste exprimé en HT : la facture générée
      // porte donc une remise cohérente avec son propre récapitulatif.
      discountBasis: 'TTC',
      timbreFiscal: 0,
    })

    // 4. Résolution du client
    let customerId = input.customerId ?? null

    if (input.generateInvoice && !customerId && input.manualClient) {
      // Créer un client à partir des informations manuelles
      const mc = input.manualClient
      const customer = await tx.customer.create({
        data: {
          firstName: mc.firstName || null,
          lastName: mc.lastName || null,
          companyName: mc.companyName || null,
          address: mc.address || null,
          matriculeFiscal: mc.matriculeFiscal || null,
        },
      })
      customerId = customer.id
    }

    if (input.generateInvoice && !customerId) {
      throw new Error('Client requis pour générer une facture')
    }

    const blNumber = await nextSequenceNumber('BL', currentYear(), tx)

    // 5. Création du bon de livraison (TOUJOURS)
    const deliveryNote = await tx.deliveryNote.create({
      data: {
        number: blNumber,
        customerId: customerId ?? undefined,
        createdById: input.createdById,
        source: DeliveryNoteSource.POS,
        status: DeliveryNoteStatus.VALIDATED,
        issueDate: new Date(),
        totalHT: toDecimalString(totals.totalHT),
        totalTVA: toDecimalString(totals.totalTVA),
        totalTTC: toDecimalString(totals.totalTTC),
        notes: input.notes ?? `Vente en caisse — ${input.paymentMethod === 'CARD' ? 'Carte' : 'Espèces'}`,
        validatedAt: new Date(),
        items: {
          create: rows.map((r) => ({
            productId: r.productId,
            sku: r.sku,
            designation: r.designation,
            quantity: toDecimalString(r.quantity),
            unitPriceHT: toDecimalString(r.unitPriceHT),
            unitPriceTTC: toDecimalString(r.unitPriceTTC),
            taxRateId: r.taxRateId,
            lineTVA: toDecimalString(r.lineTVA),
            lineTTC: toDecimalString(r.lineTTC),
          })),
        },
      },
    })

    let invoiceId: string | undefined
    let invoiceNumber: string | undefined

    // 5b. Décaissements rattachés à la vente : chaque affectation devient une
    // dépense liée au bon de livraison (d'où va l'argent encaissé).
    const outflows = (input.cashOutflows ?? []).filter((o) => Number(o.amountTTC) > 0)
    for (const outflow of outflows) {
      const depNumber = await nextSequenceNumber('DEP', currentYear(), tx)
      await tx.expense.create({
        data: {
          number: depNumber,
          label: outflow.label?.trim() || 'Décaissement vente',
          category: outflow.category ?? ExpenseCategory.AUTRE,
          amountTTC: toDecimalString(outflow.amountTTC),
          expenseDate: new Date(),
          paymentMethod: PaymentMethod.CASH,
          notes: `Affecté à la vente ${blNumber}`,
          deliveryNoteId: deliveryNote.id,
          createdById: input.createdById,
        },
      })
    }

    // 6. Création de la facture (SI demandée)
    // Même préfixe que les factures classiques : une seule série continue,
    // que la vente soit assujettie à la TVA ou non.
    if (input.generateInvoice && customerId) {
      const facNumber = await nextSequenceNumber('FAC', currentYear(), tx)
      const invoice = await tx.invoice.create({
        data: {
          number: facNumber,
          customerId,
          createdById: input.createdById,
          source: InvoiceSource.POS,
          status: InvoiceStatus.VALIDATED,
          issueDate: new Date(),
          totalHT: toDecimalString(totals.totalHT),
          totalTVA: toDecimalString(totals.totalTVA),
          totalTTC: toDecimalString(totals.totalTTC),
          timbreFiscal: 0,
          discountGlobal: toDecimalString(totals.discountGlobal),
          paidAmount: toDecimalString(totals.totalTTC),
          vatBreakdown: serializeVatBreakdown(totals.vatBreakdown),
          validatedAt: new Date(),
          notes: input.notes ?? `Vente en caisse — ${input.paymentMethod === 'CARD' ? 'Carte' : 'Espèces'}`,
          items: {
            create: rows.map((r) => ({
              productId: r.productId,
              sku: r.sku,
              designation: r.designation,
              quantity: toDecimalString(r.quantity),
              unitPriceHT: toDecimalString(r.unitPriceHT),
              unitPriceTTC: toDecimalString(r.unitPriceTTC),
              discountType: r.discountType,
              discountValue: toDecimalString(r.discountValue),
              netUnitPrice: toDecimalString(r.netUnitPrice),
              netUnitPriceTTC: toDecimalString(r.netUnitPriceTTC),
              lineHT: toDecimalString(r.lineHT),
              taxRateId: r.taxRateId,
              lineTVA: toDecimalString(r.lineTVA),
              lineTTC: toDecimalString(r.lineTTC),
            })),
          },
        },
        include: { items: true },
      })

      invoiceId = invoice.id
      invoiceNumber = invoice.number

      // Lier le bon de livraison à la facture
      await tx.deliveryNote.update({
        where: { id: deliveryNote.id },
        data: { invoiceId: invoice.id },
      })

      // 7. Enregistrement du paiement
      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: toDecimalString(totals.totalTTC),
          method: input.paymentMethod,
          receivedAt: new Date(),
          createdById: input.createdById,
          note: `Paiement caisse — ${input.paymentMethod === 'CARD' ? 'Carte' : 'Espèces'}`,
        },
      })

      // 8. Décrémentation du stock (via facture)
      for (const item of invoice.items) {
        if (item.productId) {
          await decrementStockCore(tx, {
            productId: item.productId,
            warehouseId,
            quantity: Number(item.quantity),
            type: StockMovementType.SALE,
            reference: invoice.number,
            reason: `Vente caisse ${invoice.number}`,
            userId: input.createdById,
          })
        }
      }

      // 9. Notification
      await createNotification({
        type: 'PAYMENT_RECEIVED',
        title: 'Vente en caisse',
        message: `Facture ${invoice.number} + Bon de livraison ${blNumber} — ${Number(invoice.totalTTC).toFixed(3)} DT (${input.paymentMethod === 'CARD' ? 'Carte' : 'Espèces'})`,
        link: `/factures/${invoice.id}`,
      })
    } else {
      // Pas de facture — décrémentation du stock via BL
      for (const row of rows) {
        if (row.productId) {
          await decrementStockCore(tx, {
            productId: row.productId,
            warehouseId,
            quantity: row.quantity,
            type: StockMovementType.SALE,
            reference: blNumber,
            reason: `Vente caisse ${blNumber} (sans facture)`,
            userId: input.createdById,
          })
        }
      }

      // Notification bon de livraison uniquement
      await createNotification({
        type: 'SYSTEM',
        title: 'Vente en caisse',
        message: `Bon de livraison ${blNumber} — ${Number(deliveryNote.totalTTC).toFixed(3)} DT (${input.paymentMethod === 'CARD' ? 'Carte' : 'Espèces'})`,
        link: null,
      })
    }

    return {
      deliveryNoteId: deliveryNote.id,
      deliveryNoteNumber: blNumber,
      invoiceId,
      invoiceNumber,
    }
  })
}

/**
 * ANNULATION d'une vente en caisse — retour complet à l'état antérieur :
 *   - le BL passe à CANCELLED ;
 *   - la facture liée (si elle existe) est annulée : elle sort du chiffre
 *     d'affaires, de l'encaissé et de la TVA ;
 *   - le stock débité est réintégré (mouvements SALE de la référence de la
 *     facture lorsqu'il y en a une, sinon ceux du BL). La réintégration est
 *     faite une seule fois, la facture étant la source unique de la sortie
 *     de stock d'une vente_POS avec facture.
 */
export async function cancelPosSale(id: string, userId: string, reason?: string | null) {
  return db.$transaction(async (tx) => {
    const sale = await tx.deliveryNote.findUnique({
      where: { id },
      include: { invoice: { select: { id: true, number: true, status: true } } },
    })
    if (!sale) throw new Error('Vente en caisse introuvable')
    if (sale.source !== DeliveryNoteSource.POS) {
      throw new Error('Ce bon de livraison ne provient pas d\'une vente en caisse')
    }
    if (sale.status === DeliveryNoteStatus.CANCELLED) {
      throw new Error('Cette vente en caisse est déjà annulée')
    }

    const suffix = reason ? ` — ${reason}` : ''
    let restored: ReverseSalesResult = { lines: 0, quantity: 0 }
    let invoiceStatus: InvoiceStatus | null = null

    if (sale.invoiceId && sale.invoice) {
      const allowed: InvoiceStatus[] = [
        InvoiceStatus.DRAFT,
        InvoiceStatus.VALIDATED,
        InvoiceStatus.PAID,
        InvoiceStatus.PARTIALLY_PAID,
      ]
      if (allowed.includes(sale.invoice.status)) {
        const result = await cancelInvoiceCore(tx, sale.invoice.id, userId)
        restored = result.restored
        invoiceStatus = result.invoice.status
      } else {
        invoiceStatus = sale.invoice.status
      }
    } else {
      restored = await reverseSalesForReferenceCore(tx, {
        reference: sale.number,
        reason: `Annulation vente caisse ${sale.number}`,
        userId,
      })
    }

    const updated = await tx.deliveryNote.update({
      where: { id },
      data: {
        status: DeliveryNoteStatus.CANCELLED,
        notes: `${sale.notes ?? 'Vente en caisse'} — annulée${suffix}`,
      },
    })

    await createNotification({
      type: 'SYSTEM',
      title: 'Vente en caisse annulée',
      message: `Bon de livraison ${sale.number} annulé${sale.invoice ? ` et facture ${sale.invoice.number} annulée` : ''}${suffix} — ${Number(sale.totalTTC).toFixed(3)} DT retirés du chiffre d'affaires, ${restored.quantity.toFixed(3)} unité(s) réintégrée(s) en stock.`,
      link: `/ventes-caisse/${sale.id}`,
    })

    return { sale: updated, invoiceStatus, restored }
  })
}

/**
 * RÉACTIVATION d'une vente en caisse annulée (« annuler l'annulation ») :
 * inverse `cancelPosSale`. La vente repasse VALIDATED, la facture liée est
 * rétablie (le statut est déduit du montant encaissé) et la sortie de stock
 * est rejouée à partir des lignes du bon de livraison : les articles sont à
 * nouveau déduits. Échoue si le stock disponible est insuffisant.
 */
export async function restorePosSale(id: string, userId: string) {
  const warehouseId = await getDefaultWarehouseId()

  return db.$transaction(async (tx) => {
    const sale = await tx.deliveryNote.findUnique({
      where: { id },
      include: { invoice: true, items: true },
    })
    if (!sale) throw new Error('Vente en caisse introuvable')
    if (sale.source !== DeliveryNoteSource.POS) {
      throw new Error('Ce bon de livraison ne provient pas d\'une vente en caisse')
    }
    if (sale.status !== DeliveryNoteStatus.CANCELLED) {
      throw new Error('Cette vente en caisse n\'est pas annulée')
    }

    // Même référence que la sortie d'origine : la facture si elle existe,
    // sinon le bon de livraison.
    const reference = sale.invoice ? sale.invoice.number : sale.number

    let quantity = 0
    for (const item of sale.items) {
      if (!item.productId) continue
      await decrementStockCore(tx, {
        productId: item.productId,
        warehouseId,
        quantity: Number(item.quantity),
        type: StockMovementType.SALE,
        reference,
        reason: `Réactivation vente caisse ${sale.number}`,
        userId,
      })
      quantity += Number(item.quantity)
    }

    let invoiceStatus: InvoiceStatus | null = null
    if (sale.invoice && sale.invoice.status === InvoiceStatus.CANCELLED) {
      const total = Number(sale.invoice.totalTTC)
      const paid = Number(sale.invoice.paidAmount)
      const status =
        total > 0 && paid >= total
          ? InvoiceStatus.PAID
          : paid > 0
            ? InvoiceStatus.PARTIALLY_PAID
            : InvoiceStatus.VALIDATED
      const inv = await tx.invoice.update({ where: { id: sale.invoice.id }, data: { status } })
      invoiceStatus = inv.status
    }

    // Retire la marque « — annulée … » apposée lors de l'annulation.
    const cleanedNotes = (sale.notes ?? 'Vente en caisse').replace(/\s*—\s*annulée(?:\s*—.*)?$/s, '')

    const updated = await tx.deliveryNote.update({
      where: { id },
      data: { status: DeliveryNoteStatus.VALIDATED, notes: cleanedNotes },
    })

    await createNotification({
      type: 'SYSTEM',
      title: 'Vente en caisse réactivée',
      message: `Bon de livraison ${sale.number} réactivé${sale.invoice ? ` et facture ${sale.invoice.number} rétablie` : ''} — ${Number(sale.totalTTC).toFixed(3)} DT réintégrés au chiffre d'affaires, ${quantity.toFixed(3)} unité(s) déduites du stock.`,
      link: `/ventes-caisse/${sale.id}`,
    })

    return { sale: updated, invoiceStatus, quantity }
  })
}

/**
 * Modifie la REMISE GLOBALE d'une vente en caisse (en DT sur le TTC affiché) et
 * recalcule les totaux HT/TVA/TTC du bon de livraison à partir de ses lignes.
 * Sert à corriger la remise saisie au POS afin que le chiffre d'affaires, la
 * marge et le gain issus des ventes en caisse soient justes.
 *
 * La facture liée n'est PAS touchée : les prix et la remise facturés restent
 * ceux de la première version. La modification est refusée sur une vente annulée.
 */
export interface UpdatePosSaleDiscountInput {
  /** Remise globale en DT appliquée au TTC affiché (0 = aucune remise). */
  discountTTC: number
}

export async function updatePosSaleDiscount(
  id: string,
  input: UpdatePosSaleDiscountInput,
  _userId: string,
): Promise<{ discountTTC: number; totalTTC: number }> {
  return db.$transaction(async (tx) => {
    const sale = await tx.deliveryNote.findUnique({
      where: { id },
      include: { items: { include: { taxRate: true } } },
    })
    if (!sale) throw new Error('Vente en caisse introuvable')
    if (sale.source !== DeliveryNoteSource.POS) {
      throw new Error('Ce bon de livraison ne provient pas d\'une vente en caisse')
    }
    if (sale.status === DeliveryNoteStatus.CANCELLED) {
      throw new Error('Impossible de modifier la remise d\'une vente annulée')
    }

    // Les lignes du BL portent le prix unitaire TTC brut (sans remise) : la
    // remise globale est reconstruite à partir de ces lignes, comme au POS.
    const lines: DocumentLineInput[] = sale.items.map((item) => ({
      productId: item.productId ?? undefined,
      sku: item.sku,
      designation: item.designation,
      quantity: Number(item.quantity),
      unitPriceTTC: Number(item.unitPriceTTC),
      discountValue: 0,
      discountType: null,
      taxRate: Number(item.taxRate.rate),
    }))

    const discountTTC = Math.max(0, Math.round(input.discountTTC * 1000) / 1000)
    const totals = calculateDocumentTotals({
      lines,
      globalDiscount: discountTTC > 0 ? { type: 'AMOUNT', value: discountTTC } : null,
      discountBasis: 'TTC',
      timbreFiscal: 0,
    })

    const updated = await tx.deliveryNote.update({
      where: { id },
      data: {
        totalHT: toDecimalString(totals.totalHT),
        totalTVA: toDecimalString(totals.totalTVA),
        totalTTC: toDecimalString(totals.totalTTC),
      },
    })

    return { discountTTC, totalTTC: Number(updated.totalTTC) }
  })
}

/** Liste des ventes POS (factures avec source = POS). */
export async function listPosSales(options?: { search?: string; limit?: number }) {
  const where: Prisma.InvoiceWhereInput = { source: InvoiceSource.POS }
  if (options?.search) {
    where.OR = [
      { number: { contains: options.search } },
      { customer: { OR: [{ firstName: { contains: options.search } }, { lastName: { contains: options.search } }] } },
    ]
  }
  return db.invoice.findMany({
    where,
    include: { customer: true, _count: { select: { items: true } } },
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 100,
  })
}

/** Détail d'une vente POS. */
export async function getPosSale(id: string) {
  return db.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { taxRate: true, product: true } },
      payments: true,
      createdBy: { select: { name: true } },
    },
  })
}
