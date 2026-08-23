import Link from 'next/link'
import { db } from '@elec/db'
import { ProductCard } from '@/components/product-card'
import { ArrowRight, ShieldCheck, Truck, BadgePercent, Wrench } from 'lucide-react'

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
      <section className="relative overflow-hidden bg-brand-950">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 20%, rgba(255,183,3,0.3) 0, transparent 40%), radial-gradient(circle at 85% 80%, rgba(52,104,171,0.5) 0, transparent 50%)',
          }}
        />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-20 md:grid-cols-2 md:py-28">
          <div className="animate-fade-up">
            <h1 className="font-display text-4xl font-bold leading-tight text-white md:text-5xl">
              Tout le matériel électrique,{' '}
              <span className="text-accent-400">au juste prix.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-brand-200">
              Câbles, disjoncteurs, éclairage, tableaux électriques et appareillage pour
              particuliers et professionnels, livrés en Chamal El Gharbi et Grande Tunis.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/produits"
                className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-6 py-3 text-sm font-bold text-brand-950 transition-colors hover:bg-accent-400"
              >
                Voir le catalogue <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/panier"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Voir mon panier
              </Link>
            </div>
          </div>

          <div className="hidden md:block">
            <div className="grid grid-cols-2 gap-4">
              {['Disjoncteurs', 'Câbles', 'Éclairage LED', 'Tableaux'].map((label, i) => (
                <div
                  key={label}
                  className={`rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur ${i % 2 === 1 ? 'mt-8' : ''}`}
                >
                  <span className="text-3xl">{['🔌', '🧵', '💡', '🗄️'][i]}</span>
                  <p className="mt-3 font-display text-lg font-semibold text-white">{label}</p>
                  <p className="text-sm text-brand-300">Qualité certifiée</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* USP */}
      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: <ShieldCheck className="h-6 w-6" />, title: 'Produits certifiés', sub: 'Marques reconnues, conformité CE' },
            { icon: <Truck className="h-6 w-6" />, title: 'Livraison rapide', sub: 'Chamal El Gharbi & Grande Tunis' },
            { icon: <BadgePercent className="h-6 w-6" />, title: 'Prix justes', sub: 'HT + TVA transparente' },
            { icon: <Wrench className="h-6 w-6" />, title: 'Conseil d\'expert', sub: 'Un accompagnement sur mesure' },
          ].map((u) => (
            <div key={u.title} className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                {u.icon}
              </div>
              <div>
                <p className="font-display text-sm font-semibold text-brand-950">{u.title}</p>
                <p className="mt-0.5 text-sm text-slate-500">{u.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Catégories */}
      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-brand-950">Nos catégories</h2>
            <p className="mt-1 text-sm text-slate-500">Parcourez notre sélection par univers</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/produits?categorie=${c.slug}`}
              className="group rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lifted"
            >
              <p className="font-display text-sm font-semibold text-brand-950 group-hover:text-brand-700">{c.name}</p>
              <p className="mt-1 text-xs text-slate-400">{c._count.products} produits</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Produits à la une */}
      <section className="bg-brand-50/60 py-14">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-brand-950">Coup de cœur</h2>
              <p className="mt-1 text-sm text-slate-500">Les produits préférés de nos clients</p>
            </div>
            <Link href="/produits" className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-600">
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