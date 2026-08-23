import { z } from 'zod'

// ---------------------------------------------------------------------------
// Schémas partagés entre Server Actions et formulaires (Zod)
// ---------------------------------------------------------------------------

export const discountSchema = z
  .object({
    type: z.enum(['PERCENT', 'AMOUNT']).nullable().optional(),
    value: z.coerce.number().min(0).max(999999).default(0),
  })
  .nullable()
  .optional()

export const documentLineSchema = z.object({
  productId: z.string().optional().nullable(),
  sku: z.string().min(1),
  designation: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPriceHT: z.coerce.number().nonnegative(),
  discountType: z.enum(['PERCENT', 'AMOUNT']).nullable().optional(),
  discountValue: z.coerce.number().min(0).default(0),
  taxRate: z.coerce.number().positive(),
})

export const authLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
})

export const categorySchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'slug invalide'),
  description: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  taxRateId: z.string().optional().nullable(),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
})

export const productSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  priceHT: z.coerce.number().nonnegative(),
  costPrice: z.coerce.number().nonnegative().optional().nullable(),
  unit: z.string().default('unité'),
  categoryId: z.string().optional().nullable(),
  taxRateId: z.string().min(1),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  minStockAlert: z.coerce.number().nonnegative().default(0),
  imageUrls: z.array(z.string().url()).optional().default([]),
})

export const customerSchema = z
  .object({
    type: z.enum(['PARTICULIER', 'PROFESSIONNEL']),
    firstName: z.string().optional().nullable(),
    lastName: z.string().optional().nullable(),
    companyName: z.string().optional().nullable(),
    matriculeFiscal: z.string().optional().nullable(),
    cin: z.string().optional().nullable(),
    email: z.string().email().optional().or(z.literal('')).nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'PROFESSIONNEL' && !data.matriculeFiscal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['matriculeFiscal'],
        message: 'Le matricule fiscal est obligatoire pour les clients professionnels',
      })
    }
  })

export const supplierSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  matriculeFiscal: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const stockAdjustmentSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.coerce.number().refine((n) => n !== 0, 'La quantité ne peut pas être nulle'),
  reason: z.string().min(3, 'Le motif est obligatoire (perte, casse, inventaire, erreur...)'),
  reference: z.string().optional().nullable(),
})

export const stockTransferSchema = z.object({
  productId: z.string().min(1),
  fromWarehouseId: z.string().min(1),
  toWarehouseId: z.string().min(1),
  quantity: z.coerce.number().positive(),
})

export const quoteSchema = z.object({
  customerId: z.string().min(1),
  validUntil: z.string().datetime().optional().nullable(),
  globalDiscountType: z.enum(['PERCENT', 'AMOUNT']).nullable().optional(),
  globalDiscountValue: z.coerce.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  conditions: z.string().optional().nullable(),
  lines: z.array(documentLineSchema).min(1, 'Au moins une ligne est requise'),
})

export const invoiceSchema = z.object({
  customerId: z.string().min(1),
  quoteId: z.string().optional().nullable(),
  issueDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  globalDiscountType: z.enum(['PERCENT', 'AMOUNT']).nullable().optional(),
  globalDiscountValue: z.coerce.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  lines: z.array(documentLineSchema).min(1, 'Au moins une ligne est requise'),
})

export const creditNoteSchema = z.object({
  invoiceId: z.string().min(1),
  reason: z.string().min(3),
  lines: z.array(documentLineSchema).min(1, 'Au moins une ligne est requise'),
})

export const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive(),
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'EDAHABIA', 'ONLINE']),
  reference: z.string().optional().nullable(),
  receivedAt: z.string().datetime().optional().nullable(),
  note: z.string().optional().nullable(),
})

export const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1),
  expectedDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  lines: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.coerce.number().positive(),
      unitPriceHT: z.coerce.number().nonnegative(),
      taxRate: z.coerce.number().positive(),
    }),
  ).min(1),
})

export const onlineOrderCreateSchema = z.object({
  customerId: z.string().min(1),
  shippingFullName: z.string().min(1),
  shippingAddress: z.string().optional().default(''),
  shippingCity: z.string().optional().default(''),
  shippingPhone: z.string().min(1),
  shippingNote: z.string().optional().nullable(),
  shippingCost: z.coerce.number().nonnegative().default(0),
  paymentMethod: z.enum(['COD']).default('COD'),
  deliveryMethod: z.enum(['DELIVERY', 'PICKUP']).default('DELIVERY'),
  pickupTime: z.string().optional().nullable(),
  withInvoice: z.boolean().default(false),
  lines: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.coerce.number().positive(),
    }),
  ).min(1),
})

export const storeSettingsSchema = z.object({
  storeName: z.string().min(1),
  slogan: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  matriculeFiscal: z.string().optional().nullable(),
  rib: z.string().optional().nullable(),
  legalNotes: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  invoiceFooterText: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  defaultWarehouseId: z.string().optional().nullable(),
})

export type AuthLoginInput = z.infer<typeof authLoginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ProductInput = z.infer<typeof productSchema>
export type CategoryInput = z.infer<typeof categorySchema>
export type CustomerInput = z.infer<typeof customerSchema>
export type SupplierInput = z.infer<typeof supplierSchema>
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>
export type StockTransferInput = z.infer<typeof stockTransferSchema>
export type QuoteInput = z.infer<typeof quoteSchema>
export type InvoiceInput = z.infer<typeof invoiceSchema>
export type CreditNoteInput = z.infer<typeof creditNoteSchema>
export type PaymentInput = z.infer<typeof paymentSchema>
export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>
export type OnlineOrderCreateInput = z.infer<typeof onlineOrderCreateSchema>
export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>
export type DocumentLineInput = z.infer<typeof documentLineSchema>