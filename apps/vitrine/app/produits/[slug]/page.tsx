import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@elec/db'
import { AddToCart } from '@/components/cart/add-to-cart'
import { ProductCard } from '@/components/product-card'
import { money } from '@/lib/format'
import { ShieldCheck, Truck, RotateCcw, FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await db.product.findUnique({
    where: { slug },
    include: { images: true, taxRate: true, category: true, stockLevels: true },
  })
  if (!product || !product.isActive) notFound()

  const totalStock = product.stockLevels.reduce((s, l) => s + (Number(l.quantity) - Number(l.reservedQuantity)), 0)
  const image = product.images.find((i) => i.isPrimary) ?? product.images[0]

  const related = await db.product.findMany({
    where: { isActive: true, categoryId: product.categoryId, id: { not: product.id } },
    include: { images: true, taxRate: true },
    take: 4,
  })

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <div className="flex h-96 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-brand-50/50">
          {image ? (
            <img src={image.url} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-7xl">⚡</span>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">
            {product.brand ?? 'ElecShop'}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-brand-950">{product.name}</h1>
          <p className="mt-1 font-mono text-sm text-slate-400">Réf. {product.sku}</p>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-slate-500">Prix unitaire</p>
                <p className="font-display text-3xl font-bold text-brand-950">{money(product.priceHT)}</p>
                <p className="mt-1 text-xs text-slate-400">
                  HT · TVA {Number(product.taxRate.rate)}% incluse : {money(Number(product.priceHT) * (1 + Number(product.taxRate.rate) / 100))} TTC
                </p>
              </div>
            </div>
            <AddToCart
              className="mt-5 w-full py-3.5"
              product={{
                productId: product.id,
                sku: product.sku,
                name: product.name,
                slug: product.slug,
                priceHT: Number(product.priceHT),
                taxRate: Number(product.taxRate.rate),
                unit: product.unit,
                image: image?.url,
              }}
            />
            <Link
              href={`/demande-devis?produit=${product.slug}`}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white py-3.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
            >
              <FileText className="h-4 w-4" /> Demander un devis pour ce produit
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {[
              { icon: <Truck className="h-5 w-5" />, label: 'Livraison rapide' },
              { icon: <ShieldCheck className="h-5 w-5" />, label: 'Produit certifié' },
              { icon: <RotateCcw className="h-5 w-5" />, label: 'Retours possibles' },
            ].map((b) => (
              <div key={b.label} className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-600">
                <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  {b.icon}
                </div>
                <p className="text-xs font-medium">{b.label}</p>
              </div>
            ))}
          </div>

          {product.description ? (
            <div className="mt-6">
              <h2 className="mb-2 font-display text-sm font-semibold text-brand-950">Description</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{product.description}</p>
            </div>
          ) : null}
        </div>
      </div>

      {related.length > 0 ? (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-2xl font-bold text-brand-950">Dans la même catégorie</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}