import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { ErpShell } from '@/components/layout/erp-shell'
import { STAFF_ROLES } from '@/lib/session'
import { getStoreSettings } from '@elec/services'

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user || !STAFF_ROLES.includes(session.user.role)) {
    redirect('/login')
  }

  const settings = await getStoreSettings().catch(() => null)

  return (
    <ErpShell userName={session.user.name ?? session.user.email ?? 'Utilisateur'} role={session.user.role} logoUrl={settings?.logoUrl ?? null}>
      {children}
    </ErpShell>
  )
}