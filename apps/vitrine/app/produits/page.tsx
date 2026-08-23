import { db } from '@elec/db'
import { ProductCard } from '@/components/product-card'
import { Search } from 'lucide-react'

export const revalidate = 300

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ categorie?: string; q?: string }>
}) {
  const { categorie, q } = await searchParams

  const categories = await db.category.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
  })

  const category = categorie ? categories.find((c) => c.slug === categorie) : undefined

  const products = await db.product.findMany({
    where: {
      isActive: true,
      ...(category ? { categoryId: category.id } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { brand: { contains: q, mode: 'insensitive' } }] } : {}),
    },
    include: { images: true, taxRate: true },
    orderBy: { createdAt: 'desc' },
    take: 60,
  })

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-brand-950">
          {category?.name ?? 'Tous les produits'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {products.length} produit{products.length > 1 ? 's' : ''} disponible{products.length > 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Filtres */}
        <aside className="w-full shrink-0 lg:w-56">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
            <p className="mb-3 font-display text-sm font-semibold text-brand-950">Catégories</p>
            <ul className="space-y-1">
              <li>
                <a
                  href="/produits"
                  className={`block rounded-lg px-3 py-2 text-sm ${!category ? 'bg-brand-50 font-semibold text-brand-800' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Toutes
                </a>
              </li>
              {categories.map((c) => (
                <li key={c.id}>
                  <a
                    href={`/produits?categorie=${c.slug}`}
                    className={`block rounded-lg px-3 py-2 text-sm ${category?.id === c.id ? 'bg-brand-50 font-semibold text-brand-800' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {c.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="flex-1">
          <form className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Rechercher un produit…"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              {categorie ? <input type="hidden" name="categorie" value={categorie} /> : null}
            </div>
          </form>

          {products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 py-20 text-center text-slate-500">
              Aucun produit trouvé
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}