'use server'

import { revalidatePath } from 'next/cache'
import {
  db,
  type Role,
  QuoteStatus,
  PurchaseOrderStatus,
  OnlineOrderStatus,
  type ExpenseCategory,
  type PaymentMethod,
  type ReceivableStatus,
} from '@elec/db'
import {
  StockMovementType,
  createInvoice,
  validateInvoice,
  cancelInvoice,
  registerPayment,
  updateInvoicePaymentStatus,
  convertQuoteToInvoice,
  createInvoiceFromOnlineOrder,
  createQuote,
  updateQuote,
  deleteQuote,
  setQuoteStatus,
  createCreditNote,
  validateCreditNote,
  createPurchaseOrder,
  receivePurchaseOrder,
  setPurchaseOrderStatus,
  createPurchaseInvoice,
  validatePurchaseInvoice,
  cancelPurchaseInvoice,
  confirmOrder,
  cancelOrder,
  updateOrderStatus,
  markOrderPaid,
  adjustStock,
  transferStock,
  runInventory,
  createPosSale,
  cancelPosSale,
  restorePosSale,
  updatePosSaleDiscount,
  createExpense,
  updateExpense as updateExpenseService,
  deleteExpense as deleteExpenseService,
  type ExpenseInput,
  createReceivable,
  updateReceivable,
  deleteReceivable,
  registerReceivablePayment,
  saveWeeklyClosing,
  closeWeeklyClosing,
  reopenWeeklyClosing,
  deleteWeeklyClosing,
  weekStartOf,
  getSalesGainBetween,
  getExpensesTotalBetween,
  getWeeklyOpeningCash,
  type ReceivableInput,
  type WeeklyClosingInput,
} from '@elec/services'
import { roundMoney, unitPriceHTFrom } from '@elec/contracts'
import { requireRole, ADMIN_ROLE, MANAGER_ROLES, STAFF_ROLES } from '@/lib/session'
import { hash } from 'bcryptjs'

export interface ActionResult {
  success: boolean
  error?: string
  id?: string
  deliveryNoteId?: string
  deliveryNoteNumber?: string
  invoiceId?: string
  invoiceNumber?: string
}

function str(fd: FormData, key: string): string {
  const v = fd.get(key)
  return v === null ? '' : String(v).trim()
}

function num(fd: FormData, key: string, fallback = 0): number {
  const v = parseFloat(str(fd, key))
  return Number.isFinite(v) ? v : fallback
}

function numOrNull(fd: FormData, key: string): number | null {
  const s = str(fd, key)
  if (!s) return null
  const v = parseFloat(s)
  return Number.isFinite(v) ? v : null
}

/**
 * Date issue d'un `<input type="date">` (format `YYYY-MM-DD`).
 *
 * `new Date('2026-02-02')` est interprÃ©tÃ© en UTC : Ã  Tunis le lundi deviendrait
 * dimanche. On force donc une lecture en heure locale.
 */
function dateOrNull(fd: FormData, key: string): Date | null {
  const s = str(fd, key)
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/** Enregistre le nom de sociÃ©tÃ© (client commercial) saisi dans la section client. */
async function applyCompanyName(customerId: string, fd: FormData) {
  const companyName = str(fd, 'companyName')
  if (!customerId || !companyName) return
  await db.customer.update({
    where: { id: customerId },
    data: { companyName, type: 'PROFESSIONNEL' },
  })
}

function check(fd: FormData, key: string): boolean {
  return str(fd, key) !== '' && str(fd, key) !== 'false' && str(fd, key) !== 'off'
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Lignes de document sÃ©rialisÃ©es en JSON dans le champ `lines`.
 *
 * Le prix transmis est TOUJOURS le PU TTC : c'est la valeur saisie dans le
 * formulaire (`DocumentForm` n'expose qu'un champ TTC) et la seule rÃ©fÃ©rence.
 * `unitPriceTTC` est donc lu ici, et non `unitPriceHT` â€” lire ce dernier
 * renvoyait systÃ©matiquement 0, toutes les lignes tombaient Ã  zÃ©ro.
 */
function parseLines(fd: FormData): Array<{
  productId: string | null
  sku: string
  designation: string
  quantity: number
  unitPriceTTC: number
  discountType: 'PERCENT' | 'AMOUNT' | null
  discountValue: number
  taxRate: number
}> {
  const raw = str(fd, 'lines')
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>
    return parsed
      .map((l) => ({
        productId: (l.productId as string) || null,
        sku: String(l.sku ?? ''),
        designation: String(l.designation ?? ''),
        quantity: Number(l.quantity ?? 0),
        unitPriceTTC: Number(l.unitPriceTTC ?? l.unitPriceHT ?? 0),
        discountType: (l.discountType as 'PERCENT' | 'AMOUNT') ?? null,
        discountValue: Number(l.discountValue ?? 0),
        taxRate: Number(l.taxRate ?? 0),
      }))
      .filter((l) => l.quantity > 0 && (l.productId || l.designation))
  } catch {
    return []
  }
}

async function nextProductSku(preRef: string) {
  const products = await db.product.findMany({
    where: { sku: { startsWith: preRef } },
    select: { sku: true },
  })
  let max = 0
  for (const p of products) {
    const suffix = p.sku.slice(preRef.length)
    if (/^\d+$/.test(suffix)) max = Math.max(max, parseInt(suffix, 10))
  }
  const next = max + 1
  if (next > 999) throw new Error('Limite de 999 rÃ©fÃ©rences atteinte pour cette prÃ©-rÃ©fÃ©rence')
  return preRef + String(next).padStart(3, '0')
}

/** Retourne l'utilisateur courant si autorisÃ©, sinon null. */
function clean(users: Role[] = STAFF_ROLES) {
  return requireRole(users).then((r) => (r.allowed && r.session?.user ? r.session.user : null))
}

/**
 * RafraÃ®chit toutes les vues concernÃ©es par une vente : aprÃ¨s une annulation
 * (ou une crÃ©ation) le stock, le chiffre d'affaires, l'historique des ventes en
 * caisse, les factures et les commandes doivent tous afficher l'Ã©tat Ã  jour.
 */
function revalidateAfterSaleChange(extraPath?: string) {
  revalidatePath('/pos')
  revalidatePath('/ventes-caisse')
  revalidatePath('/factures')
  revalidatePath('/commandes')
  revalidatePath('/stock')
  revalidatePath('/dashboard')
  revalidatePath('/finance')
  if (extraPath) revalidatePath(extraPath)
}

// ============================================================================
// CatÃ©gories
// ============================================================================

export async function createCategory(fd: FormData): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const name = str(fd, 'name')
  if (!name) return { success: false, error: 'Le nom est obligatoire' }
  const slug = str(fd, 'slug') || slugify(name)
  const preRef = (str(fd, 'preRef') || '').trim() || null
  if (preRef && preRef.length > 5) return { success: false, error: 'La prÃ©-rÃ©fÃ©rence ne peut pas dÃ©passer 5 caractÃ¨res' }

  const existing = await db.category.findUnique({ where: { slug } })
  if (existing) return { success: false, error: `Une catÃ©gorie existe dÃ©jÃ  avec le slug Â« ${slug} Â»` }

  const cat = await db.category.create({
    data: {
      name,
      slug,
      description: str(fd, 'description') || null,
      parentId: str(fd, 'parentId') || null,
      taxRateId: str(fd, 'taxRateId') || null,
      markupPercent: num(fd, 'markupPercent') || null,
      preRef: preRef ?? undefined,
      active: check(fd, 'active'),
      sortOrder: Math.round(num(fd, 'sortOrder')),
    },
  })
  revalidatePath('/categories')
  revalidatePath('/produits')
  return { success: true, id: cat.id }
}

export async function updateCategory(id: string, fd: FormData): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const name = str(fd, 'name')
  if (!name) return { success: false, error: 'Le nom est obligatoire' }
  const slug = str(fd, 'slug') || slugify(name)
  const preRef = (str(fd, 'preRef') || '').trim() || null
  if (preRef && preRef.length > 5) return { success: false, error: 'La prÃ©-rÃ©fÃ©rence ne peut pas dÃ©passer 5 caractÃ¨res' }
  const clash = await db.category.findFirst({ where: { slug, NOT: { id } } })
  if (clash) return { success: false, error: 'Une autre catÃ©gorie utilise dÃ©jÃ  ce slug' }

  await db.category.update({
    where: { id },
    data: {
      name,
      slug,
      description: str(fd, 'description') || null,
      parentId: str(fd, 'parentId') || null,
      taxRateId: str(fd, 'taxRateId') || null,
      markupPercent: num(fd, 'markupPercent') || null,
      preRef: preRef ?? undefined,
      active: check(fd, 'active'),
      sortOrder: Math.round(num(fd, 'sortOrder')),
    },
  })
  revalidatePath('/categories')
  revalidatePath('/produits')
  return { success: true, id }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const user = await clean(ADMIN_ROLE)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const products = await db.product.count({ where: { categoryId: id } })
  if (products > 0) {
    return {
      success: false,
      error: `Impossible de supprimer : ${products} produit(s) sont rattachÃ©s Ã  cette catÃ©gorie.`,
    }
  }
  await db.category.delete({ where: { id } })
  revalidatePath('/categories')
  revalidatePath('/produits')
  return { success: true }
}

// ============================================================================
// Produits
// ============================================================================

function parseImageList(fd: FormData): string[] {
  const raw = str(fd, 'images')
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    }
  } catch {
    // ignore â€” on essaie une saisie ligne par ligne / virgule
  }
  return raw
    .split(/[\n,]/)
    .map((u) => u.trim())
    .filter((u) => u.length > 0)
}

export async function createProduct(fd: FormData): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }

  const name = str(fd, 'name')
  if (!name) return { success: false, error: 'Le nom est obligatoire' }
  const priceTTC = num(fd, 'priceTTC')
  if (priceTTC <= 0) return { success: false, error: 'Le prix de vente TTC doit Ãªtre positif' }
  const taxRateId = str(fd, 'taxRateId')
  if (!taxRateId) return { success: false, error: 'Un taux de TVA est obligatoire' }
  const categoryId = str(fd, 'categoryId') || null
  const taxRate = await db.taxRate.findUnique({ where: { id: taxRateId }, select: { rate: true } })
  const priceHT = roundMoney(priceTTC / (1 + Number(taxRate?.rate ?? 0) / 100))

  let sku = str(fd, 'sku')
  if (categoryId) {
    const category = await db.category.findUnique({ where: { id: categoryId }, select: { preRef: true } })
    if (category?.preRef) sku = await nextProductSku(category.preRef)
  }
  if (!sku) return { success: false, error: 'La rÃ©fÃ©rence est obligatoire' }

  const slug = str(fd, 'slug') || slugify(`${name}-${sku}`)
  const images = parseImageList(fd)

  try {
    const product = await db.product.create({
      data: {
        sku,
        name,
        slug,
        description: str(fd, 'description') || null,
        brand: str(fd, 'brand') || null,
        barcode: str(fd, 'barcode') || null,
        priceHT,
        priceTTC,
        costPrice: numOrNull(fd, 'costPrice'),
        unit: str(fd, 'unit') || 'unitÃ©',
        weightKg: numOrNull(fd, 'weightKg'),
        categoryId,
        taxRateId,
        isActive: check(fd, 'isActive'),
        isFeatured: check(fd, 'isFeatured'),
        minStockAlert: num(fd, 'minStockAlert'),
        images: {
          create: images.map((url, i) => ({
            url,
            isPrimary: i === 0,
            sortOrder: i,
          })),
        },
      },
    })
    revalidatePath('/produits')
    revalidatePath('/categories')
    return { success: true, id: product.id }
  } catch (e) {
    const msg = (e as { meta?: { target?: string[] } }).meta?.target?.join(', ')
    return { success: false, error: msg ? `Contrainte unique : ${msg}` : (e as Error).message }
  }
}

export async function updateProduct(id: string, fd: FormData): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }

  const sku = str(fd, 'sku')
  const name = str(fd, 'name')
  if (!sku || !name) return { success: false, error: 'RÃ©fÃ©rence et nom sont obligatoires' }
  const taxRateId = str(fd, 'taxRateId')
  if (!taxRateId) return { success: false, error: 'Un taux de TVA est obligatoire' }

  const slug = str(fd, 'slug') || slugify(`${name}-${sku}`)
  const images = parseImageList(fd)
  const priceTTC = num(fd, 'priceTTC')
  if (priceTTC <= 0) return { success: false, error: 'Le prix de vente TTC doit Ãªtre positif' }
  const taxRate = await db.taxRate.findUnique({ where: { id: taxRateId }, select: { rate: true } })
  const priceHT = roundMoney(priceTTC / (1 + Number(taxRate?.rate ?? 0) / 100))

  try {
    await db.$transaction(async (tx) => {
      await tx.productImage.deleteMany({ where: { productId: id } })
      await tx.product.update({
        where: { id },
        data: {
          sku,
          name,
          slug,
          description: str(fd, 'description') || null,
          brand: str(fd, 'brand') || null,
          barcode: str(fd, 'barcode') || null,
          priceHT,
          priceTTC,
          costPrice: numOrNull(fd, 'costPrice'),
          unit: str(fd, 'unit') || 'unitÃ©',
          weightKg: numOrNull(fd, 'weightKg'),
          categoryId: str(fd, 'categoryId') || null,
          taxRateId,
          isActive: check(fd, 'isActive'),
          isFeatured: check(fd, 'isFeatured'),
          minStockAlert: num(fd, 'minStockAlert'),
          images: {
            create: images.map((url, i) => ({ url, isPrimary: i === 0, sortOrder: i })),
          },
        },
      })
    })
    revalidatePath('/produits')
    revalidatePath(`/produits/${id}`)
    return { success: true, id }
  } catch (e) {
    const msg = (e as { meta?: { target?: string[] } }).meta?.target?.join(', ')
    return { success: false, error: msg ? `Contrainte unique : ${msg}` : (e as Error).message }
  }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const user = await clean(ADMIN_ROLE)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const used = await db.onlineOrderItem.count({ where: { productId: id } })
  if (used > 0) {
    return { success: false, error: `Impossible de supprimer : le produit figure dans ${used} commande(s).` }
  }
  await db.product.delete({ where: { id } })
  revalidatePath('/produits')
  return { success: true }
}

export async function toggleProductActive(id: string): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const p = await db.product.findUnique({ where: { id } })
  if (!p) return { success: false, error: 'Produit introuvable' }
  await db.product.update({ where: { id }, data: { isActive: !p.isActive } })
  revalidatePath('/produits')
  return { success: true }
}

// ============================================================================
// Stock â€” gestion manuelle (ajustement, transfert, inventaire)
// ============================================================================

export async function adjustStockAction(fd: FormData): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const productId = str(fd, 'productId')
  const warehouseId = str(fd, 'warehouseId')
  const quantity = num(fd, 'quantity')
  const reason = str(fd, 'reason')
  if (!productId || !warehouseId) return { success: false, error: 'Produit et dÃ©pÃ´t obligatoires' }
  if (quantity === 0) return { success: false, error: 'La quantitÃ© ne peut pas Ãªtre nulle' }
  if (reason.length < 3) return { success: false, error: 'Le motif est obligatoire (perte, casse, inventaireâ€¦)' }

  try {
    await adjustStock({
      productId,
      warehouseId,
      quantity,
      type: StockMovementType.ADJUSTMENT,
      reason,
      userId: user.id,
    })
    revalidatePath('/stock')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function transferStockAction(fd: FormData): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const productId = str(fd, 'productId')
  const fromWarehouseId = str(fd, 'fromWarehouseId')
  const toWarehouseId = str(fd, 'toWarehouseId')
  const quantity = num(fd, 'quantity')
  if (!productId || !fromWarehouseId || !toWarehouseId) {
    return { success: false, error: 'Produit, dÃ©pÃ´t source et dÃ©pÃ´t destination obligatoires' }
  }
  if (quantity <= 0) return { success: false, error: 'La quantitÃ© doit Ãªtre positive' }

  try {
    await transferStock({ productId, fromWarehouseId, toWarehouseId, quantity, userId: user.id })
    revalidatePath('/stock')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function runInventoryAction(fd: FormData): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const warehouseId = str(fd, 'warehouseId')
  if (!warehouseId) return { success: false, error: 'DÃ©pÃ´t obligatoire' }

  let entries: Array<{ productId: string; actualQuantity: number }> = []
  const raw = str(fd, 'lines')
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Array<{ productId?: string; actualQuantity?: number }>
      entries = parsed
        .filter((l) => l.productId && Number.isFinite(Number(l.actualQuantity)))
        .map((l) => ({ productId: l.productId as string, actualQuantity: Number(l.actualQuantity) }))
    } catch {
      return { success: false, error: 'Lignes dâ€™inventaire invalides' }
    }
  }
  if (entries.length === 0) return { success: false, error: 'Aucune ligne dâ€™inventaire' }

  try {
    await runInventory(warehouseId, entries, user.id)
    revalidatePath('/stock')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ============================================================================
// Clients
// ============================================================================

export async function createCustomer(fd: FormData): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const type = str(fd, 'type') === 'PROFESSIONNEL' ? 'PROFESSIONNEL' : 'PARTICULIER'
  if (type === 'PROFESSIONNEL' && !str(fd, 'companyName')) {
    return { success: false, error: 'Le nom de sociÃ©tÃ© est obligatoire pour un professionnel' }
  }
  const c = await db.customer.create({
    data: {
      type,
      firstName: str(fd, 'firstName') || null,
      lastName: str(fd, 'lastName') || null,
      companyName: str(fd, 'companyName') || null,
      matriculeFiscal: str(fd, 'matriculeFiscal') || null,
      email: str(fd, 'email') || null,
      phone: str(fd, 'phone') || null,
      address: str(fd, 'address') || null,
      notes: str(fd, 'notes') || null,
      active: check(fd, 'active'),
    },
  })
  revalidatePath('/clients')
  return { success: true, id: c.id }
}

export async function updateCustomer(id: string, fd: FormData): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const type = str(fd, 'type') === 'PROFESSIONNEL' ? 'PROFESSIONNEL' : 'PARTICULIER'
  if (type === 'PROFESSIONNEL' && !str(fd, 'companyName')) {
    return { success: false, error: 'Le nom de sociÃ©tÃ© est obligatoire pour un professionnel' }
  }
  await db.customer.update({
    where: { id },
    data: {
      type,
      firstName: str(fd, 'firstName') || null,
      lastName: str(fd, 'lastName') || null,
      companyName: str(fd, 'companyName') || null,
      matriculeFiscal: str(fd, 'matriculeFiscal') || null,
      email: str(fd, 'email') || null,
      phone: str(fd, 'phone') || null,
      address: str(fd, 'address') || null,
      // `city` n'est plus collectÃ© dans l'ERP (un seul champ Â« Adresse Â») :
      // on ne l'Ã©crase pas, la boutique en ligne le renseigne sur ses commandes.
      notes: str(fd, 'notes') || null,
      active: check(fd, 'active'),
    },
  })
  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
  return { success: true, id }
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  const user = await clean(ADMIN_ROLE)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const doc = await db.onlineOrder.count({ where: { customerId: id } })
  if (doc > 0) return { success: false, error: 'Impossible de supprimer : le client a des commandes.' }
  await db.customer.delete({ where: { id } })
  revalidatePath('/clients')
  return { success: true }
}

// ============================================================================
// Fournisseurs
// ============================================================================

export async function createSupplier(fd: FormData): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const name = str(fd, 'name')
  if (!name) return { success: false, error: 'Le nom est obligatoire' }
  const s = await db.supplier.create({
    data: {
      name,
      company: str(fd, 'company') || null,
      email: str(fd, 'email') || null,
      phone: str(fd, 'phone') || null,
      address: str(fd, 'address') || null,
      city: str(fd, 'city') || null,
      matriculeFiscal: str(fd, 'matriculeFiscal') || null,
      notes: str(fd, 'notes') || null,
      active: check(fd, 'active'),
    },
  })
  revalidatePath('/fournisseurs')
  return { success: true, id: s.id }
}

export async function updateSupplier(id: string, fd: FormData): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  if (!str(fd, 'name')) return { success: false, error: 'Le nom est obligatoire' }
  await db.supplier.update({
    where: { id },
    data: {
      name: str(fd, 'name'),
      company: str(fd, 'company') || null,
      email: str(fd, 'email') || null,
      phone: str(fd, 'phone') || null,
      address: str(fd, 'address') || null,
      city: str(fd, 'city') || null,
      matriculeFiscal: str(fd, 'matriculeFiscal') || null,
      notes: str(fd, 'notes') || null,
      active: check(fd, 'active'),
    },
  })
  revalidatePath('/fournisseurs')
  revalidatePath(`/fournisseurs/${id}`)
  return { success: true, id }
}

export async function deleteSupplier(id: string): Promise<ActionResult> {
  const user = await clean(ADMIN_ROLE)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const used = await db.purchaseOrder.count({ where: { supplierId: id } })
  const usedInvoices = await db.purchaseInvoice.count({ where: { supplierId: id } })
  if (used > 0) return { success: false, error: 'Impossible de supprimer : des bons de commande existent.' }
  if (usedInvoices > 0) {
    return { success: false, error: 'Impossible de supprimer : des factures dâ€™achat existent.' }
  }
  await db.supplier.delete({ where: { id } })
  revalidatePath('/fournisseurs')
  return { success: true }
}

// ============================================================================
// Devis
// ============================================================================

export async function createQuoteAction(fd: FormData): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const customerId = str(fd, 'customerId') || null
  const customerName = str(fd, 'customerName') || null
  const lines = parseLines(fd)
  if (lines.length === 0) return { success: false, error: 'Ajoutez au moins une ligne' }

  try {
    if (customerId) await applyCompanyName(customerId, fd)
    const q = await createQuote({
      customerId,
      customerName,
      nonAssujettiTva: str(fd, 'nonAssujettiTva') === '1',
      createdById: user.id,
      validUntil: str(fd, 'validUntil') || null,
      globalDiscountType: (str(fd, 'globalDiscountType') || null) as 'PERCENT' | 'AMOUNT' | null,
      globalDiscountValue: num(fd, 'globalDiscountValue'),
      notes: str(fd, 'notes') || null,
      conditions: str(fd, 'conditions') || null,
      lines,
    })
    revalidatePath('/devis')
    return { success: true, id: q.id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateQuoteAction(id: string, fd: FormData): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const customerId = str(fd, 'customerId') || null
  const customerName = str(fd, 'customerName') || null
  const lines = parseLines(fd)
  if (lines.length === 0) return { success: false, error: 'Ajoutez au moins une ligne' }

  try {
    if (customerId) await applyCompanyName(customerId, fd)
    await updateQuote(id, {
      customerId,
      customerName,
      nonAssujettiTva: str(fd, 'nonAssujettiTva') === '1',
      validUntil: str(fd, 'validUntil') || null,
      globalDiscountType: (str(fd, 'globalDiscountType') || null) as 'PERCENT' | 'AMOUNT' | null,
      globalDiscountValue: num(fd, 'globalDiscountValue'),
      notes: str(fd, 'notes') || null,
      conditions: str(fd, 'conditions') || null,
      lines,
    })
    revalidatePath('/devis')
    revalidatePath(`/devis/${id}`)
    return { success: true, id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteQuoteAction(id: string): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  try {
    await deleteQuote(id)
    revalidatePath('/devis')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function setQuoteStatusAction(id: string, status: string): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  await setQuoteStatus(id, status as QuoteStatus)
  revalidatePath('/devis')
  revalidatePath(`/devis/${id}`)
  return { success: true }
}

// ============================================================================
// Factures
// ============================================================================

export async function createInvoiceAction(fd: FormData): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const customerId = str(fd, 'customerId') || null
  const customerName = str(fd, 'customerName') || null
  const customerMatricule = str(fd, 'customerMatricule') || null
  const customerAddress = str(fd, 'customerAddress') || null
  const lines = parseLines(fd)
  if (lines.length === 0) return { success: false, error: 'Ajoutez au moins une ligne' }

  try {
    if (customerId) await applyCompanyName(customerId, fd)
    const inv = await createInvoice({
      customerId,
      customerName,
      customerMatricule,
      customerAddress,
      createdById: user.id,
      issueDate: str(fd, 'issueDate') || null,
      dueDate: str(fd, 'dueDate') || null,
      globalDiscountType: (str(fd, 'globalDiscountType') || null) as 'PERCENT' | 'AMOUNT' | null,
      globalDiscountValue: num(fd, 'globalDiscountValue'),
      notes: str(fd, 'notes') || null,
      lines,
    })
    revalidatePath('/factures')
    return { success: true, id: inv.id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function validateInvoiceAction(id: string): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  try {
    await validateInvoice(id, user.id)
    revalidatePath('/factures')
    revalidatePath(`/factures/${id}`)
    revalidatePath('/stock')
    return { success: true, id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function cancelInvoiceAction(id: string): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  try {
    await cancelInvoice(id, user.id)
    revalidateAfterSaleChange(`/factures/${id}`)
    return { success: true, id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function registerPaymentAction(fd: FormData): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: "AccÃ¨s non autorisÃ©" }
  const invoiceId = str(fd, 'invoiceId')
  const amount = num(fd, 'amount')
  if (!invoiceId || amount <= 0) return { success: false, error: 'Montant invalide' }
  try {
    await registerPayment({
      invoiceId,
      amount,
      method: (str(fd, 'method') || 'CASH') as 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE' | 'EDAHABIA' | 'ONLINE',
      receivedAt: str(fd, 'receivedAt') || null,
      reference: str(fd, 'reference') || null,
      note: str(fd, 'note') || null,
      createdById: user.id,
    })
    revalidatePath('/factures')
    revalidatePath(`/factures/${invoiceId}`)
    revalidatePath('/finance')
    revalidatePath('/tresorerie')
    revalidatePath('/creances')
    return { success: true, id: invoiceId }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateInvoicePaymentStatusAction(fd: FormData): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: "AccÃ¨s non autorisÃ©" }
  const invoiceId = str(fd, 'invoiceId')
  const paidAmount = num(fd, 'paidAmount')
  if (!invoiceId) return { success: false, error: 'Facture manquante' }
  try {
    await updateInvoicePaymentStatus({
      invoiceId,
      paidAmount,
      createdById: user.id,
    })
    revalidatePath('/factures')
    revalidatePath(`/factures/${invoiceId}`)
    revalidatePath('/finance')
    revalidatePath('/tresorerie')
    revalidatePath('/creances')
    return { success: true, id: invoiceId }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function convertQuoteToInvoiceAction(quoteId: string): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  try {
    const inv = await convertQuoteToInvoice(quoteId, user.id)
    revalidatePath('/devis')
    revalidatePath('/factures')
    revalidatePath(`/devis/${quoteId}`)
    return { success: true, id: inv.id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ============================================================================
// Avoirs
// ============================================================================

export async function createCreditNoteAction(fd: FormData): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const invoiceId = str(fd, 'invoiceId')
  const reason = str(fd, 'reason')
  const lines = parseLines(fd)
  if (!invoiceId) return { success: false, error: 'La facture dâ€™origine est obligatoire' }
  if (reason.length < 3) return { success: false, error: 'Le motif est obligatoire' }
  if (lines.length === 0) return { success: false, error: 'Ajoutez au moins une ligne' }

  try {
    const cn = await createCreditNote({ invoiceId, reason, createdById: user.id, lines })
    revalidatePath('/avoirs')
    revalidatePath('/factures')
    return { success: true, id: cn.id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function validateCreditNoteAction(id: string): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  try {
    await validateCreditNote(id)
    revalidatePath('/avoirs')
    revalidatePath(`/avoirs/${id}`)
    revalidatePath('/factures')
    revalidatePath('/stock')
    return { success: true, id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ============================================================================
// Bons de commande fournisseurs (achats)
// ============================================================================

export async function createPurchaseOrderAction(fd: FormData): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const supplierId = str(fd, 'supplierId')
  if (!supplierId) return { success: false, error: 'Le fournisseur est obligatoire' }
  // Le bon de commande attend un PU HT : on dÃ©duit le HT du PU TTC saisi.
  const lines = parseLines(fd).map((l) => ({
    productId: l.productId as string,
    quantity: l.quantity,
    unitPriceHT: unitPriceHTFrom({ quantity: 1, unitPriceTTC: l.unitPriceTTC, taxRate: l.taxRate }),
    taxRate: l.taxRate,
  }))
  if (lines.length === 0) return { success: false, error: 'Ajoutez au moins une ligne' }

  try {
    const po = await createPurchaseOrder({
      supplierId,
      createdById: user.id,
      expectedDate: str(fd, 'expectedDate') || null,
      notes: str(fd, 'notes') || null,
      lines,
    })
    revalidatePath('/achats')
    return { success: true, id: po.id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function receivePurchaseOrderAction(id: string): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  try {
    await receivePurchaseOrder(id)
    revalidatePath('/achats')
    revalidatePath(`/achats/${id}`)
    revalidatePath('/stock')
    return { success: true, id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function setPurchaseOrderStatusAction(id: string, status: string): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  await setPurchaseOrderStatus(id, status as PurchaseOrderStatus)
  revalidatePath('/achats')
  revalidatePath(`/achats/${id}`)
  return { success: true }
}

// ============================================================================
// Factures d'achat (achats) â€” factures reÃ§ues des fournisseurs
// ============================================================================

export async function createPurchaseInvoiceAction(fd: FormData): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const supplierId = str(fd, 'supplierId')
  if (!supplierId) return { success: false, error: 'Le fournisseur est obligatoire' }
  const lines = parseLines(fd)
  if (lines.length === 0) return { success: false, error: 'Ajoutez au moins une ligne' }

  try {
    const inv = await createPurchaseInvoice({
      supplierId,
      createdById: user.id,
      issueDate: str(fd, 'issueDate') || null,
      dueDate: str(fd, 'dueDate') || null,
      globalDiscountType: (str(fd, 'globalDiscountType') || null) as 'PERCENT' | 'AMOUNT' | null,
      globalDiscountValue: num(fd, 'globalDiscountValue'),
      notes: str(fd, 'notes') || null,
      lines,
    })
    revalidatePath('/achats')
    return { success: true, id: inv.id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function validatePurchaseInvoiceAction(id: string): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  try {
    await validatePurchaseInvoice(id, user.id)
    revalidatePath('/achats')
    revalidatePath(`/achats/${id}`)
    revalidatePath('/stock')
    revalidatePath('/finance')
    return { success: true, id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function cancelPurchaseInvoiceAction(id: string): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  try {
    await cancelPurchaseInvoice(id, user.id)
    revalidatePath('/achats')
    revalidatePath(`/achats/${id}`)
    revalidatePath('/finance')
    return { success: true, id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ============================================================================
// Commandes en ligne
// ============================================================================

export async function confirmOrderAction(id: string): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  try {
    await confirmOrder(id)
    revalidatePath('/commandes')
    revalidatePath(`/commandes/${id}`)
    revalidatePath('/stock')
    return { success: true, id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function cancelOrderAction(id: string, reason?: string): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  try {
    await cancelOrder(id, user.id, reason)
    revalidateAfterSaleChange(`/commandes/${id}`)
    return { success: true, id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateOrderStatusAction(id: string, status: string): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  try {
    await updateOrderStatus(id, status as OnlineOrderStatus)
    revalidateAfterSaleChange(`/commandes/${id}`)
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function markOrderPaidAction(id: string, method: string): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  try {
    await markOrderPaid(id, method as 'CARD' | 'EDAHABIA' | 'BANK_TRANSFER')
    revalidatePath('/commandes')
    revalidatePath(`/commandes/${id}`)
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function createInvoiceFromOrderAction(id: string, fd?: FormData): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }

  let discountType: 'PERCENT' | 'AMOUNT' | null = null
  let discountValue = 0
  if (fd) {
    const dt = str(fd, 'discountType')
    if (dt === 'PERCENT' || dt === 'AMOUNT') {
      discountType = dt
      discountValue = parseFloat(str(fd, 'discountValue') || '0')
    }
  }

  try {
    const inv = await createInvoiceFromOnlineOrder(id, user.id, discountType, discountValue)
    revalidatePath('/commandes')
    revalidatePath('/factures')
    revalidatePath(`/commandes/${id}`)
    return { success: true, id: inv.id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ============================================================================
// Utilisateurs
// ============================================================================

export async function createUser(fd: FormData): Promise<ActionResult> {
  const user = await clean(ADMIN_ROLE)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const email = str(fd, 'email')
  const name = str(fd, 'name')
  const password = str(fd, 'password')
  if (!email || !name) return { success: false, error: 'Email et nom obligatoires' }
  if (password.length < 8) return { success: false, error: 'Mot de passe : 8 caractÃ¨res minimum' }
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return { success: false, error: 'Un utilisateur existe dÃ©jÃ  avec cet email' }

  const u = await db.user.create({
    data: {
      email,
      name,
      role: (str(fd, 'role') || 'VENDEUR') as Role,
      phone: str(fd, 'phone') || null,
      isActive: check(fd, 'isActive'),
      passwordHash: await hash(password, 10),
    },
  })
  revalidatePath('/utilisateurs')
  return { success: true, id: u.id }
}

export async function updateUser(id: string, fd: FormData): Promise<ActionResult> {
  const user = await clean(ADMIN_ROLE)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const data: {
    name: string
    role: Role
    phone?: string | null
    isActive: boolean
    passwordHash?: string
  } = {
    name: str(fd, 'name'),
    role: (str(fd, 'role') || 'VENDEUR') as Role,
    phone: str(fd, 'phone') || null,
    isActive: check(fd, 'isActive'),
  }
  if (!data.name) return { success: false, error: 'Le nom est obligatoire' }
  const password = str(fd, 'password')
  if (password) {
    if (password.length < 8) return { success: false, error: 'Mot de passe : 8 caractÃ¨res minimum' }
    data.passwordHash = await hash(password, 10)
  }
  await db.user.update({ where: { id }, data })
  revalidatePath('/utilisateurs')
  return { success: true, id }
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const user = await clean(ADMIN_ROLE)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  if (user.id === id) return { success: false, error: 'Vous ne pouvez pas supprimer votre propre compte' }
  await db.user.delete({ where: { id } })
  revalidatePath('/utilisateurs')
  return { success: true }
}

// ============================================================================
// ParamÃ¨tres magasin
// ============================================================================

export async function updateStoreSettings(fd: FormData): Promise<ActionResult> {
  const user = await clean(ADMIN_ROLE)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  await db.storeSettings.update({
    where: { id: 1 },
    data: {
      storeName: str(fd, 'storeName') || 'Magasin Ã‰lectrique',
      slogan: str(fd, 'slogan') || null,
      activity: str(fd, 'activity') || null,
      address: str(fd, 'address') || null,
      city: str(fd, 'city') || null,
      phone: str(fd, 'phone') || null,
      email: str(fd, 'email') || null,
      matriculeFiscal: str(fd, 'matriculeFiscal') || null,
      rib: str(fd, 'rib') || null,
      legalNotes: str(fd, 'legalNotes') || null,
      paymentTerms: str(fd, 'paymentTerms') || null,
      logoUrl: str(fd, 'logoUrl') || null,
      invoiceFooterText: str(fd, 'invoiceFooterText') || null,
      defaultWarehouseId: str(fd, 'defaultWarehouseId') || null,
    },
  })
  revalidatePath('/parametres')
  return { success: true }
}

// ============================================================================
// DÃ©penses â€” charges hors achats (loyer, salaires, Ã©nergie, transportâ€¦)
// Montants saisis en TTC : l'entreprise n'est pas assujettie Ã  la TVA.
// ============================================================================

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'LOYER',
  'SALAIRES',
  'ELECTRICITE',
  'TRANSPORT',
  'FOURNITURES',
  'IMPOTS',
  'DETTE',
  'AUTRE',
]

const EXPENSE_PAYMENT_METHODS: PaymentMethod[] = [
  'CASH',
  'CARD',
  'BANK_TRANSFER',
  'CHEQUE',
  'EDAHABIA',
  'ONLINE',
]

/** Valide le payload d'une dÃ©pense. PartagÃ© par la crÃ©ation et la mise Ã  jour. */
function parseExpense(fd: FormData): { ok: true; data: ExpenseInput } | { ok: false; error: string } {
  const label = str(fd, 'label')
  if (!label) return { ok: false, error: 'Le libellÃ© est obligatoire' }

  const amountTTC = num(fd, 'amountTTC')
  if (!(amountTTC > 0)) return { ok: false, error: 'Le montant doit Ãªtre supÃ©rieur Ã  zÃ©ro' }

  const category = str(fd, 'category') as ExpenseCategory
  if (!EXPENSE_CATEGORIES.includes(category)) return { ok: false, error: 'CatÃ©gorie invalide' }

  const paymentMethod = str(fd, 'paymentMethod') as PaymentMethod
  if (!EXPENSE_PAYMENT_METHODS.includes(paymentMethod)) return { ok: false, error: 'Moyen de rÃ¨glement invalide' }

  return {
    ok: true,
    data: {
      label,
      category,
      amountTTC,
      expenseDate: str(fd, 'expenseDate') || null,
      paymentMethod,
      notes: str(fd, 'notes') || null,
    },
  }
}

/** La liste et l'onglet Finance doivent.refresh aprÃ¨s toute Ã©criture. */
function revalidateAfterExpenseChange(extraPath?: string) {
  revalidatePath('/depenses')
  revalidatePath('/finance')
  if (extraPath) revalidatePath(extraPath)
}

export async function createExpenseAction(fd: FormData): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const parsed = parseExpense(fd)
  if (!parsed.ok) return { success: false, error: parsed.error }

  try {
    const expense = await createExpense(parsed.data, user.id)
    revalidateAfterExpenseChange()
    return { success: true, id: expense.id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateExpenseAction(id: string, fd: FormData): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const parsed = parseExpense(fd)
  if (!parsed.ok) return { success: false, error: parsed.error }

  try {
    await updateExpenseService(id, parsed.data)
    revalidateAfterExpenseChange(`/depenses/${id}/edit`)
    return { success: true, id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const user = await clean(ADMIN_ROLE)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  try {
    await deleteExpenseService(id)
    revalidateAfterExpenseChange()
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ============================================================================
// CrÃ©ances clients â€” saisie libre, encaissement, suppression
// ============================================================================

const RECEIVABLE_STATUSES: ReceivableStatus[] = ['OPEN', 'PARTIALLY_PAID', 'PAID', 'CANCELLED']
const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'EDAHABIA', 'ONLINE']

/** Valide le payload d'une crÃ©ance libre. PartagÃ© par crÃ©ation et mise Ã  jour. */
function parseReceivable(fd: FormData): { ok: true; data: ReceivableInput } | { ok: false; error: string } {
  const customerName = str(fd, 'customerName')
  if (!customerName) return { ok: false, error: 'Le nom du client est obligatoire' }

  const amountTTC = num(fd, 'amountTTC')
  if (!(amountTTC > 0)) return { ok: false, error: 'Le montant doit Ãªtre supÃ©rieur Ã  zÃ©ro' }

  return {
    ok: true,
    data: {
      customerName,
      customerId: str(fd, 'customerId') || null,
      amountTTC,
      dueDate: dateOrNull(fd, 'dueDate'),
      notes: str(fd, 'notes') || null,
    },
  }
}

function revalidateAfterReceivableChange(extraPath?: string) {
  revalidatePath('/creances')
  revalidatePath('/finance')
  if (extraPath) revalidatePath(extraPath)
}

export async function createReceivableAction(fd: FormData): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const parsed = parseReceivable(fd)
  if (!parsed.ok) return { success: false, error: parsed.error }

  try {
    const receivable = await createReceivable(parsed.data, user.id)
    revalidateAfterReceivableChange()
    return { success: true, id: receivable.id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateReceivableAction(id: string, fd: FormData): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const parsed = parseReceivable(fd)
  if (!parsed.ok) return { success: false, error: parsed.error }

  try {
    await updateReceivable(id, parsed.data)
    revalidateAfterReceivableChange(`/creances/${id}/edit`)
    return { success: true, id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function registerReceivablePaymentAction(fd: FormData): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }

  const receivableId = str(fd, 'receivableId')
  if (!receivableId) return { success: false, error: 'CrÃ©ance introuvable' }

  const method = str(fd, 'method') as PaymentMethod
  if (!PAYMENT_METHODS.includes(method)) return { success: false, error: 'Mode de paiement invalide' }

  try {
    await registerReceivablePayment({
      receivableId,
      amount: num(fd, 'amount'),
      method,
      receivedAt: dateOrNull(fd, 'receivedAt'),
      reference: str(fd, 'reference') || null,
      note: str(fd, 'note') || null,
      createdById: user.id,
    })
    revalidateAfterReceivableChange(`/creances/${receivableId}`)
    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteReceivableAction(id: string): Promise<ActionResult> {
  const user = await clean(ADMIN_ROLE)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  try {
    await deleteReceivable(id)
    revalidateAfterReceivableChange()
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ============================================================================
// ClÃ´tures hebdomadaires â€” saisie manuelle, verrouillage, rÃ©ouverture
// ============================================================================

/** Valide le bilan saisi. Les montants sont en TTC et saisis Ã  la main. */
function parseWeeklyClosing(fd: FormData): { ok: true; data: WeeklyClosingInput } | { ok: false; error: string } {
  const weekStart = dateOrNull(fd, 'weekStart') ?? dateOrNull(fd, 'issueDate')
  if (!weekStart) return { ok: false, error: 'La semaine est obligatoire' }

  const revenueTTC = num(fd, 'revenueTTC')
  const purchasesTTC = num(fd, 'purchasesTTC')
  const otherExpensesTTC = num(fd, 'otherExpensesTTC')
  const costOfGoodsTTC = num(fd, 'costOfGoodsTTC')
  const cashOnHandTTC = num(fd, 'cashOnHandTTC')

  if (
    revenueTTC < 0 ||
    purchasesTTC < 0 ||
    otherExpensesTTC < 0 ||
    costOfGoodsTTC < 0 ||
    cashOnHandTTC < 0
  ) {
    return { ok: false, error: 'Les montants ne peuvent pas Ãªtre nÃ©gatifs' }
  }

  return {
    ok: true,
    data: {
      weekStart,
      revenueTTC,
      purchasesTTC,
      otherExpensesTTC,
      costOfGoodsTTC,
      cashOnHandTTC,
      notes: str(fd, 'notes') || null,
    },
  }
}

export interface WeeklyAutoValues {
  success: boolean
  error?: string
  revenueTTC?: number
  costOfGoodsTTC?: number
  expensesTTC?: number
  openingCashTTC?: number
  missingCostLines?: number
}

/** Valeurs calculÃ©es automatiquement pour le lundi de la semaine voulue. */
export async function getWeeklyAutoValuesAction(weekStart: string): Promise<WeeklyAutoValues> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }

  const date = new Date(weekStart)
  if (Number.isNaN(date.getTime())) return { success: false, error: 'Date invalide' }

  const start = weekStartOf(date)
  const end = new Date(start.getTime() + 7 * 86400000)
  const [sales, expensesTTC, openingCashTTC] = await Promise.all([
    getSalesGainBetween(start, end),
    getExpensesTotalBetween(start, end),
    getWeeklyOpeningCash(start),
  ])
  return {
    success: true,
    revenueTTC: sales.revenueTTC,
    costOfGoodsTTC: sales.costOfGoodsTTC,
    expensesTTC,
    openingCashTTC,
    missingCostLines: sales.missingCostLines,
  }
}

export async function saveWeeklyClosingAction(fd: FormData): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  const parsed = parseWeeklyClosing(fd)
  if (!parsed.ok) return { success: false, error: parsed.error }

  try {
    const closing = await saveWeeklyClosing(parsed.data, user.id)
    revalidatePath('/clotures')
    revalidatePath('/finance')
    return { success: true, id: closing.id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function closeWeeklyClosingAction(id: string): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  try {
    await closeWeeklyClosing(id)
    revalidatePath('/clotures')
    revalidatePath('/finance')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function reopenWeeklyClosingAction(id: string): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  try {
    await reopenWeeklyClosing(id)
    revalidatePath('/clotures')
    revalidatePath('/finance')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteWeeklyClosingAction(id: string): Promise<ActionResult> {
  const user = await clean(ADMIN_ROLE)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  try {
    await deleteWeeklyClosing(id)
    revalidatePath('/clotures')
    revalidatePath('/finance')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ============================================================================
// Point de Vente (POS) â€” Vente en caisse
// ============================================================================

export async function createPosSaleAction(fd: FormData): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }

  const customerId = str(fd, 'customerId') || null
  const paymentMethod = str(fd, 'paymentMethod') as 'CASH' | 'CARD'
  const generateInvoice = fd.get('generateInvoice') === 'true'
  if (!paymentMethod || !['CASH', 'CARD'].includes(paymentMethod)) {
    return { success: false, error: 'Mode de paiement invalide' }
  }

  const rawLines = str(fd, 'lines')
  let lines: Array<{ productId: string; quantity: number }>
  try {
    lines = JSON.parse(rawLines)
  } catch {
    return { success: false, error: 'Lignes invalides' }
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    return { success: false, error: 'Ajoutez au moins un produit' }
  }

  // Manual client info for invoice
  let manualClient: { firstName: string; lastName?: string; companyName?: string; address?: string; matriculeFiscal?: string } | null = null
  if (generateInvoice && !customerId) {
    const firstName = str(fd, 'manualFirstName')
    const lastName = str(fd, 'manualLastName')
    const companyName = str(fd, 'manualCompany')
    const address = str(fd, 'manualAddress')
    const matriculeFiscal = str(fd, 'manualMatricule')
    if (!firstName) {
      return { success: false, error: 'Le nom du client est requis pour gÃ©nÃ©rer une facture' }
    }
    manualClient = { firstName, lastName, companyName, address, matriculeFiscal }
  }

  // Discount
  const discountType = str(fd, 'discountType') as 'PERCENT' | 'AMOUNT' | ''
  const discountValue = parseFloat(str(fd, 'discountValue') || '0')

  // DÃ©caissements affectÃ©s Ã  la vente : oÃ¹ va l'argent encaissÃ©.
  let cashOutflows: Array<{ label: string; amountTTC: number; category: ExpenseCategory }> = []
  const rawOutflows = str(fd, 'cashOutflows')
  if (rawOutflows) {
    try {
      const parsed = JSON.parse(rawOutflows)
      if (Array.isArray(parsed)) {
        cashOutflows = parsed
          .map((o) => ({
            label: String(o?.label ?? '').trim(),
            amountTTC: Number(o?.amountTTC ?? 0),
            category: (EXPENSE_CATEGORIES.includes(o?.category) ? o.category : 'AUTRE') as ExpenseCategory,
          }))
          .filter((o) => o.amountTTC > 0)
      }
    } catch {
      return { success: false, error: 'DÃ©caissements invalides' }
    }
  }

  try {
    const sale = await createPosSale({
      customerId,
      createdById: user.id,
      lines,
      paymentMethod,
      generateInvoice,
      manualClient,
      globalDiscountType: discountType || null,
      globalDiscountValue: discountValue || null,
      notes: str(fd, 'notes') || null,
      cashOutflows,
    })
    revalidateAfterSaleChange()
    return {
      success: true,
      id: sale.deliveryNoteId,
      deliveryNoteId: sale.deliveryNoteId,
      deliveryNoteNumber: sale.deliveryNoteNumber,
      invoiceId: sale.invoiceId,
      invoiceNumber: sale.invoiceNumber,
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Modification de la remise globale (en DT) d'une vente en caisse : le bon de
 * livraison est recalculÃ© (HT/TVA/TTC) pour que le chiffre d'affaires, la marge
 * et le gain des ventes en caisse soient justes. La facture liÃ©e reste
 * inchangÃ©e (premiÃ¨re version). RÃ©servÃ©e aux encadrants.
 */
export async function updatePosSaleDiscountAction(id: string, discountTTC: number): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  if (!Number.isFinite(discountTTC) || discountTTC < 0) {
    return { success: false, error: 'Remise invalide' }
  }
  try {
    await updatePosSaleDiscount(id, { discountTTC }, user.id)
    revalidateAfterSaleChange(`/ventes-caisse/${id}`)
    return { success: true, id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Annulation d'une vente en caisse depuis l'historique : le bon de livraison,
 * la facture liÃ©e, le chiffre d'affaires et le stock reviennent Ã  l'Ã©tat
 * antÃ©rieur. RÃ©servÃ©e aux encadrants (le chiffre d'affaires est modifiÃ©).
 */
export async function cancelPosSaleAction(id: string, reason?: string): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  try {
    const result = await cancelPosSale(id, user.id, reason)
    revalidateAfterSaleChange(`/ventes-caisse/${id}`)
    return { success: true, id, invoiceId: result.sale.invoiceId ?? undefined }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * RÃ©activation d'une vente en caisse annulÃ©e (Â« annuler l'annulation Â») : le
 * bon de livraison et la facture liÃ©e repassent validÃ©s et le stock des
 * articles est Ã  nouveau dÃ©duit. RÃ©servÃ©e aux encadrants.
 */
export async function restorePosSaleAction(id: string): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'AccÃ¨s non autorisÃ©' }
  try {
    const result = await restorePosSale(id, user.id)
    revalidateAfterSaleChange(`/ventes-caisse/${id}`)
    return { success: true, id, invoiceId: result.sale.invoiceId ?? undefined }
  } catch (e) {
    return { success: false, error: (e as Error).message }
}

}
