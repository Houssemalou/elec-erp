'use server'

import { revalidatePath } from 'next/cache'
import {
  db,
  type Role,
  QuoteStatus,
  PurchaseOrderStatus,
  OnlineOrderStatus,
} from '@elec/db'
import {
  StockMovementType,
  createInvoice,
  validateInvoice,
  cancelInvoice,
  registerPayment,
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
  confirmOrder,
  cancelOrder,
  updateOrderStatus,
  markOrderPaid,
  adjustStock,
  transferStock,
  runInventory,
  createPosSale,
} from '@elec/services'
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

/** Enregistre le nom de société (client commercial) saisi dans la section client. */
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

/** Lignes de document sérialisées en JSON dans le champ `lines`. */
function parseLines(fd: FormData): Array<{
  productId: string | null
  sku: string
  designation: string
  quantity: number
  unitPriceHT: number
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
        unitPriceHT: Number(l.unitPriceHT ?? 0),
        discountType: (l.discountType as 'PERCENT' | 'AMOUNT') ?? null,
        discountValue: Number(l.discountValue ?? 0),
        taxRate: Number(l.taxRate ?? 0),
      }))
      .filter((l) => l.quantity > 0 && (l.productId || l.designation))
  } catch {
    return []
  }
}

/** Retourne l'utilisateur courant si autorisé, sinon null. */
function clean(users: Role[] = STAFF_ROLES) {
  return requireRole(users).then((r) => (r.allowed && r.session?.user ? r.session.user : null))
}

// ============================================================================
// Catégories
// ============================================================================

export async function createCategory(fd: FormData): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'Accès non autorisé' }
  const name = str(fd, 'name')
  if (!name) return { success: false, error: 'Le nom est obligatoire' }
  const slug = str(fd, 'slug') || slugify(name)

  const existing = await db.category.findUnique({ where: { slug } })
  if (existing) return { success: false, error: `Une catégorie existe déjà avec le slug « ${slug} »` }

  const cat = await db.category.create({
    data: {
      name,
      slug,
      description: str(fd, 'description') || null,
      parentId: str(fd, 'parentId') || null,
      taxRateId: str(fd, 'taxRateId') || null,
      markupPercent: num(fd, 'markupPercent') || null,
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
  if (!user) return { success: false, error: 'Accès non autorisé' }
  const name = str(fd, 'name')
  if (!name) return { success: false, error: 'Le nom est obligatoire' }
  const slug = str(fd, 'slug') || slugify(name)
  const clash = await db.category.findFirst({ where: { slug, NOT: { id } } })
  if (clash) return { success: false, error: 'Une autre catégorie utilise déjà ce slug' }

  await db.category.update({
    where: { id },
    data: {
      name,
      slug,
      description: str(fd, 'description') || null,
      parentId: str(fd, 'parentId') || null,
      taxRateId: str(fd, 'taxRateId') || null,
      markupPercent: num(fd, 'markupPercent') || null,
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
  if (!user) return { success: false, error: 'Accès non autorisé' }
  const products = await db.product.count({ where: { categoryId: id } })
  if (products > 0) {
    return {
      success: false,
      error: `Impossible de supprimer : ${products} produit(s) sont rattachés à cette catégorie.`,
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
    // ignore — on essaie une saisie ligne par ligne / virgule
  }
  return raw
    .split(/[\n,]/)
    .map((u) => u.trim())
    .filter((u) => u.length > 0)
}

export async function createProduct(fd: FormData): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'Accès non autorisé' }

  const sku = str(fd, 'sku')
  const name = str(fd, 'name')
  if (!sku || !name) return { success: false, error: 'Référence et nom sont obligatoires' }
  if (num(fd, 'priceHT') <= 0) return { success: false, error: 'Le prix HT doit être positif' }
  const taxRateId = str(fd, 'taxRateId')
  if (!taxRateId) return { success: false, error: 'Un taux de TVA est obligatoire' }

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
        priceHT: num(fd, 'priceHT'),
        costPrice: numOrNull(fd, 'costPrice'),
        unit: str(fd, 'unit') || 'unité',
        weightKg: numOrNull(fd, 'weightKg'),
        categoryId: str(fd, 'categoryId') || null,
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
  if (!user) return { success: false, error: 'Accès non autorisé' }

  const sku = str(fd, 'sku')
  const name = str(fd, 'name')
  if (!sku || !name) return { success: false, error: 'Référence et nom sont obligatoires' }
  const taxRateId = str(fd, 'taxRateId')
  if (!taxRateId) return { success: false, error: 'Un taux de TVA est obligatoire' }

  const slug = str(fd, 'slug') || slugify(`${name}-${sku}`)
  const images = parseImageList(fd)

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
          priceHT: num(fd, 'priceHT'),
          costPrice: numOrNull(fd, 'costPrice'),
          unit: str(fd, 'unit') || 'unité',
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
  if (!user) return { success: false, error: 'Accès non autorisé' }
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
  if (!user) return { success: false, error: 'Accès non autorisé' }
  const p = await db.product.findUnique({ where: { id } })
  if (!p) return { success: false, error: 'Produit introuvable' }
  await db.product.update({ where: { id }, data: { isActive: !p.isActive } })
  revalidatePath('/produits')
  return { success: true }
}

// ============================================================================
// Stock — gestion manuelle (ajustement, transfert, inventaire)
// ============================================================================

export async function adjustStockAction(fd: FormData): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'Accès non autorisé' }
  const productId = str(fd, 'productId')
  const warehouseId = str(fd, 'warehouseId')
  const quantity = num(fd, 'quantity')
  const reason = str(fd, 'reason')
  if (!productId || !warehouseId) return { success: false, error: 'Produit et dépôt obligatoires' }
  if (quantity === 0) return { success: false, error: 'La quantité ne peut pas être nulle' }
  if (reason.length < 3) return { success: false, error: 'Le motif est obligatoire (perte, casse, inventaire…)' }

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
  if (!user) return { success: false, error: 'Accès non autorisé' }
  const productId = str(fd, 'productId')
  const fromWarehouseId = str(fd, 'fromWarehouseId')
  const toWarehouseId = str(fd, 'toWarehouseId')
  const quantity = num(fd, 'quantity')
  if (!productId || !fromWarehouseId || !toWarehouseId) {
    return { success: false, error: 'Produit, dépôt source et dépôt destination obligatoires' }
  }
  if (quantity <= 0) return { success: false, error: 'La quantité doit être positive' }

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
  if (!user) return { success: false, error: 'Accès non autorisé' }
  const warehouseId = str(fd, 'warehouseId')
  if (!warehouseId) return { success: false, error: 'Dépôt obligatoire' }

  let entries: Array<{ productId: string; actualQuantity: number }> = []
  const raw = str(fd, 'lines')
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Array<{ productId?: string; actualQuantity?: number }>
      entries = parsed
        .filter((l) => l.productId && Number.isFinite(Number(l.actualQuantity)))
        .map((l) => ({ productId: l.productId as string, actualQuantity: Number(l.actualQuantity) }))
    } catch {
      return { success: false, error: 'Lignes d’inventaire invalides' }
    }
  }
  if (entries.length === 0) return { success: false, error: 'Aucune ligne d’inventaire' }

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
  if (!user) return { success: false, error: 'Accès non autorisé' }
  const type = str(fd, 'type') === 'PROFESSIONNEL' ? 'PROFESSIONNEL' : 'PARTICULIER'
  if (type === 'PROFESSIONNEL' && !str(fd, 'companyName')) {
    return { success: false, error: 'Le nom de société est obligatoire pour un professionnel' }
  }
  const c = await db.customer.create({
    data: {
      type,
      firstName: str(fd, 'firstName') || null,
      lastName: str(fd, 'lastName') || null,
      companyName: str(fd, 'companyName') || null,
      matriculeFiscal: str(fd, 'matriculeFiscal') || null,
      cin: str(fd, 'cin') || null,
      email: str(fd, 'email') || null,
      phone: str(fd, 'phone') || null,
      address: str(fd, 'address') || null,
      city: str(fd, 'city') || null,
      notes: str(fd, 'notes') || null,
      active: check(fd, 'active'),
    },
  })
  revalidatePath('/clients')
  return { success: true, id: c.id }
}

export async function updateCustomer(id: string, fd: FormData): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'Accès non autorisé' }
  const type = str(fd, 'type') === 'PROFESSIONNEL' ? 'PROFESSIONNEL' : 'PARTICULIER'
  if (type === 'PROFESSIONNEL' && !str(fd, 'companyName')) {
    return { success: false, error: 'Le nom de société est obligatoire pour un professionnel' }
  }
  await db.customer.update({
    where: { id },
    data: {
      type,
      firstName: str(fd, 'firstName') || null,
      lastName: str(fd, 'lastName') || null,
      companyName: str(fd, 'companyName') || null,
      matriculeFiscal: str(fd, 'matriculeFiscal') || null,
      cin: str(fd, 'cin') || null,
      email: str(fd, 'email') || null,
      phone: str(fd, 'phone') || null,
      address: str(fd, 'address') || null,
      city: str(fd, 'city') || null,
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
  if (!user) return { success: false, error: 'Accès non autorisé' }
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
  if (!user) return { success: false, error: 'Accès non autorisé' }
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
  if (!user) return { success: false, error: 'Accès non autorisé' }
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
  if (!user) return { success: false, error: 'Accès non autorisé' }
  const used = await db.purchaseOrder.count({ where: { supplierId: id } })
  if (used > 0) return { success: false, error: 'Impossible de supprimer : des bons de commande existent.' }
  await db.supplier.delete({ where: { id } })
  revalidatePath('/fournisseurs')
  return { success: true }
}

// ============================================================================
// Devis
// ============================================================================

export async function createQuoteAction(fd: FormData): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'Accès non autorisé' }
  const customerId = str(fd, 'customerId')
  const lines = parseLines(fd)
  if (!customerId) return { success: false, error: 'Le client est obligatoire' }
  if (lines.length === 0) return { success: false, error: 'Ajoutez au moins une ligne' }

  try {
    await applyCompanyName(customerId, fd)
    const q = await createQuote({
      customerId,
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
  if (!user) return { success: false, error: 'Accès non autorisé' }
  const lines = parseLines(fd)
  if (lines.length === 0) return { success: false, error: 'Ajoutez au moins une ligne' }

  try {
    await applyCompanyName(str(fd, 'customerId'), fd)
    await updateQuote(id, {
      customerId: str(fd, 'customerId'),
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
  if (!user) return { success: false, error: 'Accès non autorisé' }
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
  if (!user) return { success: false, error: 'Accès non autorisé' }
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
  if (!user) return { success: false, error: 'Accès non autorisé' }
  const customerId = str(fd, 'customerId')
  const lines = parseLines(fd)
  if (!customerId) return { success: false, error: 'Le client est obligatoire' }
  if (lines.length === 0) return { success: false, error: 'Ajoutez au moins une ligne' }

  try {
    await applyCompanyName(customerId, fd)
    const inv = await createInvoice({
      customerId,
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
  if (!user) return { success: false, error: 'Accès non autorisé' }
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
  if (!user) return { success: false, error: 'Accès non autorisé' }
  try {
    await cancelInvoice(id, user.id)
    revalidatePath('/factures')
    revalidatePath(`/factures/${id}`)
    return { success: true, id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function registerPaymentAction(fd: FormData): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'Accès non autorisé' }
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
    return { success: true, id: invoiceId }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function convertQuoteToInvoiceAction(quoteId: string): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'Accès non autorisé' }
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
  if (!user) return { success: false, error: 'Accès non autorisé' }
  const invoiceId = str(fd, 'invoiceId')
  const reason = str(fd, 'reason')
  const lines = parseLines(fd)
  if (!invoiceId) return { success: false, error: 'La facture d’origine est obligatoire' }
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
  if (!user) return { success: false, error: 'Accès non autorisé' }
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
  if (!user) return { success: false, error: 'Accès non autorisé' }
  const supplierId = str(fd, 'supplierId')
  if (!supplierId) return { success: false, error: 'Le fournisseur est obligatoire' }
  const lines = parseLines(fd).map((l) => ({
    productId: l.productId as string,
    quantity: l.quantity,
    unitPriceHT: l.unitPriceHT,
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
  if (!user) return { success: false, error: 'Accès non autorisé' }
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
  if (!user) return { success: false, error: 'Accès non autorisé' }
  await setPurchaseOrderStatus(id, status as PurchaseOrderStatus)
  revalidatePath('/achats')
  revalidatePath(`/achats/${id}`)
  return { success: true }
}

// ============================================================================
// Commandes en ligne
// ============================================================================

export async function confirmOrderAction(id: string): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'Accès non autorisé' }
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
  if (!user) return { success: false, error: 'Accès non autorisé' }
  try {
    await cancelOrder(id, reason)
    revalidatePath('/commandes')
    revalidatePath(`/commandes/${id}`)
    revalidatePath('/stock')
    return { success: true, id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateOrderStatusAction(id: string, status: string): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'Accès non autorisé' }
  await updateOrderStatus(id, status as OnlineOrderStatus)
  revalidatePath('/commandes')
  revalidatePath(`/commandes/${id}`)
  return { success: true }
}

export async function markOrderPaidAction(id: string, method: string): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'Accès non autorisé' }
  await markOrderPaid(id, method as 'CARD' | 'EDAHABIA' | 'BANK_TRANSFER')
  revalidatePath('/commandes')
  revalidatePath(`/commandes/${id}`)
  return { success: true }
}

export async function createInvoiceFromOrderAction(id: string, fd?: FormData): Promise<ActionResult> {
  const user = await clean(MANAGER_ROLES)
  if (!user) return { success: false, error: 'Accès non autorisé' }

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
  if (!user) return { success: false, error: 'Accès non autorisé' }
  const email = str(fd, 'email')
  const name = str(fd, 'name')
  const password = str(fd, 'password')
  if (!email || !name) return { success: false, error: 'Email et nom obligatoires' }
  if (password.length < 8) return { success: false, error: 'Mot de passe : 8 caractères minimum' }
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return { success: false, error: 'Un utilisateur existe déjà avec cet email' }

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
  if (!user) return { success: false, error: 'Accès non autorisé' }
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
    if (password.length < 8) return { success: false, error: 'Mot de passe : 8 caractères minimum' }
    data.passwordHash = await hash(password, 10)
  }
  await db.user.update({ where: { id }, data })
  revalidatePath('/utilisateurs')
  return { success: true, id }
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const user = await clean(ADMIN_ROLE)
  if (!user) return { success: false, error: 'Accès non autorisé' }
  if (user.id === id) return { success: false, error: 'Vous ne pouvez pas supprimer votre propre compte' }
  await db.user.delete({ where: { id } })
  revalidatePath('/utilisateurs')
  return { success: true }
}

// ============================================================================
// Paramètres magasin
// ============================================================================

export async function updateStoreSettings(fd: FormData): Promise<ActionResult> {
  const user = await clean(ADMIN_ROLE)
  if (!user) return { success: false, error: 'Accès non autorisé' }
  await db.storeSettings.update({
    where: { id: 1 },
    data: {
      storeName: str(fd, 'storeName') || 'Magasin Électrique',
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
// Point de Vente (POS) — Vente en caisse
// ============================================================================

export async function createPosSaleAction(fd: FormData): Promise<ActionResult> {
  const user = await clean(STAFF_ROLES)
  if (!user) return { success: false, error: 'Accès non autorisé' }

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
  let manualClient: { firstName: string; lastName?: string; companyName?: string; address?: string; matriculeFiscal?: string; cin?: string } | null = null
  if (generateInvoice && !customerId) {
    const firstName = str(fd, 'manualFirstName')
    const lastName = str(fd, 'manualLastName')
    const companyName = str(fd, 'manualCompany')
    const address = str(fd, 'manualAddress')
    const matriculeFiscal = str(fd, 'manualMatricule')
    const cin = str(fd, 'manualCin')
    if (!firstName) {
      return { success: false, error: 'Le nom du client est requis pour générer une facture' }
    }
    manualClient = { firstName, lastName, companyName, address, matriculeFiscal, cin }
  }

  // Discount
  const discountType = str(fd, 'discountType') as 'PERCENT' | 'AMOUNT' | ''
  const discountValue = parseFloat(str(fd, 'discountValue') || '0')

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
    })
    revalidatePath('/pos')
    revalidatePath('/ventes-caisse')
    revalidatePath('/factures')
    revalidatePath('/stock')
    revalidatePath('/dashboard')
    revalidatePath('/finance')
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