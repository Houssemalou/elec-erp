import Link from 'next/link'
import { Plus, Search, Pencil, Power } from 'lucide-react'
import { db } from '@elec/db'
import {
  PageHeader,
  Card,
  Button,
  Input,
  Badge,
  Table,
  THead,
  TR,
  TH,
  TD,
} from '@/components/ui'
import { Pagination, PAGE_SIZE, pageNumber } from '@/components/ui/pagination'
import { DeleteButton } from '@/components/ui/delete-button'
import { money } from '@/lib/utils'
import { deleteProduct, toggleProductActive } from '@/lib/actions/erp'
import { ToggleActiveButton } from '@/components/products/toggle-active-button'

export const dynamic = 'force-dynamic'

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const q = params.q
  const page = pageNumber(params.page)

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { sku: { contains: q, mode: 'insensitive' as const } },
          { brand: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : undefined

  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      include: { category: true, taxRate: true, images: { where: { isPrimary: true }, take: 1 }, stockLevels: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <PageHeader
        title="Produits"
        description={`${total} produits dans le catalogue`}
        actions={
          <Link href="/produits/nouveau">
            <Button>
              <Plus className="h-4 w-4" /> Nouveau produit
            </Button>
          </Link>
        }
      />

      <Card>
        <form className="border-b border-slate-100 p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={q} placeholder="Rechercher par référence, nom, marque…" className="pl-9" />
          </div>
        </form>
        <Table>
          <THead>
            <TR>
              <TH>Référence</TH>
              <TH>Produit</TH>
              <TH>Catégorie</TH>
              <TH>TVA</TH>
              <TH className="text-right">Prix HT</TH>
              <TH className="text-right">Stock total</TH>
              <TH>Statut</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <tbody>
            {products.map((p) => {
              const total = p.stockLevels.reduce((s, l) => s + Number(l.quantity), 0)
              return (
                <TR key={p.id}>
                  <TD className="font-mono text-xs text-slate-500">{p.sku}</TD>
                  <TD>
                    <div className="flex items-center gap-3">
                      {p.images[0] ? (
                        <img src={p.images[0].url} alt="" className="h-9 w-9 rounded-lg object-cover" />
                      ) : (
                        <div className="h-9 w-9 rounded-lg bg-brand-50" />
                      )}
                      <div>
                        <Link href={`/produits/${p.id}/edit`} className="font-medium text-slate-900 hover:text-brand-700">
                          {p.name}
                        </Link>
                        {p.brand ? <p className="text-xs text-slate-400">{p.brand}</p> : null}
                      </div>
                    </div>
                  </TD>
                  <TD>{p.category?.name ?? '—'}</TD>
                  <TD>
                    <Badge tone="blue">{Number(p.taxRate.rate)}%</Badge>
                  </TD>
                  <TD className="text-right font-medium">{money(p.priceHT)}</TD>
                  <TD className="text-right">
                    <span className={total <= Number(p.minStockAlert) ? 'font-semibold text-red-600' : 'text-slate-700'}>
                      {total.toLocaleString('fr-FR')}
                    </span>
                  </TD>
                  <TD>
                    <Badge tone={p.isActive ? 'green' : 'slate'}>{p.isActive ? 'Actif' : 'Inactif'}</Badge>
                  </TD>
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/produits/${p.id}/edit`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
                        <Pencil className="h-3.5 w-3.5" /> Modifier
                      </Link>
                      <ToggleActiveButton id={p.id} isActive={p.isActive} action={toggleProductActive} />
                      <DeleteButton id={p.id} action={deleteProduct} label="Supprimer" />
                    </div>
                  </TD>
                </TR>
              )
            })}
            {products.length === 0 ? (
              <TR>
                <TD colSpan={8} className="py-12 text-center text-slate-400">
                  Aucun produit trouvé
                </TD>
              </TR>
            ) : null}
          </tbody>
        </Table>
        <Pagination page={page} totalPages={totalPages} total={total} params={{ q }} />
      </Card>
    </div>
  )
}