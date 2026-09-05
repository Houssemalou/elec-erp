'use server'

import { prisma, CustomerType } from '@elec/db'
import { onlineOrderCreateSchema } from '@elec/contracts'
import { createOnlineOrder, createQuote, createNotification } from '@elec/services'

// ============================================================================
// Boutique 100 % guest : pas de compte. Le client fournit ses coordonnées à
// la commande ; un dossier Client est créé / réutilisé automatiquement.
// ============================================================================

export type GuestCheckoutInput = {
  email?: string
  shippingFullName: string
  shippingAddress?: string
  shippingCity?: string
  shippingPhone: string
  cin?: string
  shippingNote?: string | null
  shippingCost?: number
  paymentMethod: 'COD'
  deliveryMethod?: 'DELIVERY' | 'PICKUP'
  pickupTime?: string | null
  withInvoice?: boolean
  lines: Array<{ productId: string; quantity: number }>
}

export async function createOrderAction(
  input: GuestCheckoutInput,
): Promise<{ ok: boolean; orderId?: string; error?: string }> {
  const email = (input.email ?? '').trim().toLowerCase()
  const cin = (input.cin ?? '').trim()
  if (!cin) return { ok: false, error: 'Le numéro de carte d\'identité (CIN) est obligatoire.' }

  const parsed = onlineOrderCreateSchema.safeParse({
    customerId: 'guest',
    shippingFullName: input.shippingFullName,
    shippingAddress: input.shippingAddress ?? '',
    shippingCity: input.shippingCity ?? '',
    shippingPhone: input.shippingPhone,
    shippingNote: input.shippingNote ?? null,
    shippingCost: input.shippingCost,
    paymentMethod: input.paymentMethod ?? 'COD',
    deliveryMethod: input.deliveryMethod ?? 'DELIVERY',
    pickupTime: input.pickupTime ?? null,
    withInvoice: input.withInvoice ?? false,
    lines: input.lines,
  })
  if (!parsed.success) {
    return { ok: false, error: 'Veuillez vérifier les informations de commande.' }
  }

  try {
    const customer = await findOrCreateGuestCustomer(input, email || undefined)

    const order = await createOnlineOrder({
      customerId: customer.id,
      shippingFullName: parsed.data.shippingFullName,
      shippingAddress: parsed.data.shippingAddress,
      shippingCity: parsed.data.shippingCity,
      shippingPhone: parsed.data.shippingPhone,
      shippingNote: parsed.data.shippingNote,
      shippingCost: parsed.data.shippingCost,
      paymentMethod: parsed.data.paymentMethod,
      deliveryMethod: parsed.data.deliveryMethod,
      pickupTime: parsed.data.pickupTime,
      withInvoice: parsed.data.withInvoice,
      lines: parsed.data.lines,
    })

    return { ok: true, orderId: order.id }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

async function findOrCreateGuestCustomer(input: GuestCheckoutInput, email?: string) {
  const parts = (input.shippingFullName ?? '').trim().split(/\s+/)
  const firstName = parts[0] ?? 'Client'
  const lastName = parts.slice(1).join(' ') || null

  const filters: Array<Record<string, string>> = []
  if (email) filters.push({ email })
  if (input.shippingPhone) filters.push({ phone: input.shippingPhone })
  if (input.cin) filters.push({ cin: input.cin })

  const existing = filters.length
    ? await prisma.customer.findFirst({ where: { OR: filters } })
    : null
  if (existing) {
    return prisma.customer.update({
      where: { id: existing.id },
      data: {
        email: email || existing.email,
        phone: input.shippingPhone || existing.phone,
        cin: input.cin || existing.cin,
        address: input.shippingAddress || existing.address,
        city: input.shippingCity || existing.city,
      },
    })
  }

  return prisma.customer.create({
    data: {
      type: CustomerType.PARTICULIER,
      firstName,
      lastName,
      email: email || null,
      cin: input.cin || null,
      phone: input.shippingPhone || null,
      address: input.shippingAddress || null,
      city: input.shippingCity || null,
    },
  })
}

export async function getShippingCost(): Promise<number> {
  return Number(process.env.SHIPPING_COST ?? '5')
}

// ============================================================================
// Demande de devis (guest) : crée un devis brouillon dans le back-office,
// attribué au premier gestionnaire. L'équipe magasin ajuste puis finalise.
// ============================================================================

export type QuoteRequestInput = {
  name: string
  phone: string
  email: string
  message?: string
  lines: Array<{ productId: string; quantity: number }>
}

export async function createQuoteRequestAction(
  input: QuoteRequestInput,
): Promise<{ ok: boolean; quoteNumber?: string; error?: string }> {
  const name = (input.name ?? '').trim()
  const email = (input.email ?? '').trim().toLowerCase()
  const phone = (input.phone ?? '').trim()
  if (!name || !phone || !email) return { ok: false, error: 'Veuillez renseigner vos coordonnées.' }
  if (!input.lines?.length) return { ok: false, error: 'Sélectionnez au moins un produit.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Adresse e-mail invalide.' }

  try {
    const parts = name.split(/\s+/)
    const firstName = parts[0] ?? 'Client'
    const lastName = parts.slice(1).join(' ') || null

    const existing = await prisma.customer.findFirst({ where: { email } })
    const customer = existing
      ? await prisma.customer.update({
          where: { id: existing.id },
          data: { phone: phone || existing.phone, firstName, lastName: lastName ?? existing.lastName },
        })
      : await prisma.customer.create({
          data: { type: CustomerType.PARTICULIER, firstName, lastName, email, phone: phone || null },
        })

    const manager = await prisma.user.findFirst({
      where: { role: { in: ['ADMIN', 'MANAGER'] } },
      orderBy: { createdAt: 'asc' },
    })
    if (!manager) return { ok: false, error: 'Aucun gestionnaire disponible. Réessayez plus tard.' }

    const products = await prisma.product.findMany({
      where: { id: { in: input.lines.map((l) => l.productId) }, isActive: true },
      include: { taxRate: true },
    })
    const byId = new Map(products.map((p) => [p.id, p]))
    const lines = input.lines.flatMap((l) => {
      const p = byId.get(l.productId)
      if (!p) return []
      return [{
        productId: p.id,
        sku: p.sku,
        designation: p.name,
        quantity: l.quantity,
        unitPriceHT: Number(p.priceHT),
        discountType: null,
        discountValue: 0,
        taxRate: Number(p.taxRate.rate),
      }]
    })
    if (!lines.length) return { ok: false, error: 'Aucun produit valide sélectionné.' }

    const quote = await createQuote({
      customerId: customer.id,
      createdById: manager.id,
      notes: input.message?.trim() ? `Demande via le site : ${input.message.trim()}` : 'Demande de devis via le site.',
      conditions: 'Devis à valider par le magasin.',
      lines,
    })

    await createNotification({
      type: 'NEW_QUOTE_REQUEST',
      title: 'Nouvelle demande de devis',
      message: `Devis ${quote.number} — ${name}${phone ? ` (${phone})` : ''} — ${lines.length} article(s) demandé(s) via le site`,
      link: `/devis/${quote.id}`,
    })

    return { ok: true, quoteNumber: quote.number }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}