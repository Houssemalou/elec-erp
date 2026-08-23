import Link from 'next/link'
import { Plus, Pencil, Search } from 'lucide-react'
import { db } from '@elec/db'
import { PageHeader, Card, Badge, Table, THead, TR, TH, TD, Input, Button } from '@/components/ui'
import { Pagination, PAGE_SIZE, pageNumber } from '@/components/ui/pagination'
import { DeleteButton } from '@/components/ui/delete-button'
import { deleteUser } from '@/lib/actions/erp'
import { ROLE_LABELS } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function UsersPage({
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
          { email: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : undefined

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        description={`${total} comptes du personnel`}
        actions={
          <Link href="/utilisateurs/nouveau">
            <Button>
              <Plus className="h-4 w-4" /> Nouvel utilisateur
            </Button>
          </Link>
        }
      />
      <Card>
        <form className="border-b border-slate-100 p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={q} placeholder="Nom, email…" className="pl-9" />
          </div>
        </form>
        <Table>
          <THead>
            <TR>
              <TH>Utilisateur</TH>
              <TH>Email</TH>
              <TH>Rôle</TH>
              <TH>Téléphone</TH>
              <TH>Créé le</TH>
              <TH>Statut</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <tbody>
            {users.map((u) => (
              <TR key={u.id}>
                <TD className="font-medium text-slate-900">{u.name}</TD>
                <TD className="text-slate-500">{u.email}</TD>
                <TD>
                  <Badge tone={u.role === 'ADMIN' ? 'blue' : u.role === 'MANAGER' ? 'accent' : 'slate'}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </Badge>
                </TD>
                <TD>{u.phone ?? '—'}</TD>
                <TD>{new Date(u.createdAt).toLocaleDateString('fr-FR')}</TD>
                <TD>
                  <Badge tone={u.isActive ? 'green' : 'red'}>{u.isActive ? 'Actif' : 'Inactif'}</Badge>
                </TD>
                <TD className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/utilisateurs/${u.id}/edit`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
                      <Pencil className="h-3.5 w-3.5" /> Modifier
                    </Link>
                    <DeleteButton id={u.id} action={deleteUser} label="Supprimer" />
                  </div>
                </TD>
              </TR>
            ))}
            {users.length === 0 ? (
              <TR>
                <TD colSpan={7} className="py-12 text-center text-slate-400">Aucun utilisateur</TD>
              </TR>
            ) : null}
          </tbody>
        </Table>
        <Pagination page={page} totalPages={totalPages} total={total} params={{ q }} />
      </Card>
    </div>
  )
}