import Link from 'next/link'
import { db } from '@elec/db'
import { ProductCard } from '@/components/product-card'
import { ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export default async function HomePage() {
  const [featured, categories] = await Promise.all([
    db.product.findMany({
      where: { isActive: true, isFeatured: true },
      include: { images: true, taxRate: true },
      take: 4,
    }),
    db.category.findMany({
      where: { active: true },
      include: { _count: { select: { products: true } } },
      orderBy: { sortOrder: 'asc' },
      take: 6,
    }),
  ])

  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[60vh] overflow-hidden bg-[var(--bg-primary)] md:min-h-[70vh]">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/electronova-logo.png)' }}
        />
        <div className="absolute inset-0 bg-[#0B0B0B]/50" />
        <div className="relative mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center md:min-h-[70vh] md:py-20">
          <h1 className="sr-only">
            ElectroNova <span className="text-accent-400">HA</span>
          </h1>
        </div>
      </section>

      {/* Catégories */}
      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">Nos catégories</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Parcourez notre sélection par univers</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/produits?categorie=${c.slug}`}
              className="group rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 text-center shadow-card transition-all hover:-translate-y-0.5 hover:border-accent-400/30 hover:shadow-glow"
            >
              <p className="font-display text-sm font-semibold text-[var(--text-primary)] group-hover:text-accent-400">{c.name}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{c._count.products} produits</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Produits à la une */}
      <section className="bg-[var(--bg-secondary)] py-14">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">Coup de cœur</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Les produits préférés de nos clients</p>
            </div>
            <Link href="/produits" className="flex items-center gap-1 text-sm font-semibold text-accent-400 hover:text-accent-300">
              Tout voir <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
