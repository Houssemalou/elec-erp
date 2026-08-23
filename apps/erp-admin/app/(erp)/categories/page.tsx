import Link from 'next/link'
import { Plus, Pencil, Search } from 'lucide-react'
import { db } from '@elec/db'
import { PageHeader, Card, Badge, Table, THead, TR, TH, TD, Input, Button } from '@/components/ui'
import { Pagination, PAGE_SIZE, pageNumber } from '@/components/ui/pagination'
import { DeleteButton } from '@/components/ui/delete-button'
import { deleteCategory } from '@/lib/actions/erp'

export const dynamic = 'force-dynamic'

export default async function CategoriesPage({
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
          { slug: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : undefined

  const [total, categories] = await Promise.all([
    db.category.count({ where }),
    db.category.findMany({
      where,
      include: {
        parent: true,
        taxRate: true,
        _count: { select: { products: true, children: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <PageHeader
        title="Catégories"
        description={`${total} catégorie${total > 1 ? 's' : ''} dans le catalogue`}
        actions={
          <Link href="/categories/nouveau">
            <Button>
              <Plus className="h-4 w-4" /> Nouvelle catégorie
            </Button>
          </Link>
        }
      />

      <Card>
        <form className="border-b border-slate-100 p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={q} placeholder="Nom, slug…" className="pl-9" />
          </div>
        </form>
        <Table>
          <THead>
            <TR>
              <TH>Nom</TH>
              <TH>Slug</TH>
              <TH>Parent</TH>
              <TH>TVA par défaut</TH>
              <TH className="text-right">Produits</TH>
              <TH className="text-right">Sous-catégories</TH>
              <TH>Statut</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <tbody>
            {categories.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium text-slate-900">{c.name}</TD>
                <TD className="font-mono text-xs text-slate-500">{c.slug}</TD>
                <TD>{c.parent?.name ?? '—'}</TD>
                <TD>{c.taxRate ? <Badge tone="blue">{Number(c.taxRate.rate)}%</Badge> : '—'}</TD>
                <TD className="text-right">{c._count.products}</TD>
                <TD className="text-right">{c._count.children}</TD>
                <TD>
                  <Badge tone={c.active ? 'green' : 'slate'}>{c.active ? 'Active' : 'Inactive'}</Badge>
                </TD>
                <TD className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/categories/${c.id}/edit`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
                      <Pencil className="h-3.5 w-3.5" /> Modifier
                    </Link>
                    <DeleteButton id={c.id} action={deleteCategory} label="Supprimer" />
                  </div>
                </TD>
              </TR>
            ))}
            {categories.length === 0 ? (
              <TR>
                <TD colSpan={8} className="py-12 text-center text-slate-400">Aucune catégorie</TD>
              </TR>
            ) : null}
          </tbody>
        </Table>
        <Pagination page={page} totalPages={totalPages} total={total} params={{ q }} />
      </Card>
    </div>
  )
}