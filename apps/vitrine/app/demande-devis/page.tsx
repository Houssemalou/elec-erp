import type { Metadata } from 'next'
import { db } from '@elec/db'
import { QuoteRequestForm } from '@/components/quote/quote-request-form'

export const metadata: Metadata = { title: 'Demander un devis' }

export const dynamic = 'force-dynamic'

export default async function QuoteRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ produit?: string }>
}) {
  const { produit } = await searchParams
  const [products, settings] = await Promise.all([
    db.product.findMany({
      where: { isActive: true },
      include: { taxRate: true, category: true },
      orderBy: { name: 'asc' },
      take: 500,
    }),
    db.storeSettings.findFirst({ orderBy: { id: 'asc' } }),
  ])

  const preselected = produit
    ? products.find((p) => p.slug === produit)?.id
    : undefined

  const productOptions = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    priceHT: Number(p.priceHT),
    taxRate: Number(p.taxRate.rate),
  }))

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-[var(--text-primary)]">Demander un devis</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Sélectionnez les produits souhaités : notre équipe vous prépare un devis gratuit et vous recontacte
        rapidement au {settings?.phone ?? 'téléphone'} ou par e-mail.
      </p>
      <div className="mt-8">
        <QuoteRequestForm products={productOptions} preselectedProductId={preselected} />
      </div>
    </div>
  )
}
