import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { listNotifications, markNotificationRead, markAllNotificationsRead, unreadNotificationCount } from '@elec/services'
import { STAFF_ROLES } from '@/lib/session'

export const runtime = 'nodejs'

export async function GET() {
  const session = await auth()
  if (!session?.user || !STAFF_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const [data, unread] = await Promise.all([
    listNotifications(session.user.id, { limit: 30 }),
    unreadNotificationCount(session.user.id),
  ])
  return NextResponse.json({ notifications: data.notifications, unreadCount: unread })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user || !STAFF_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const body = (await req.json().catch(() => ({}))) as { id?: string; all?: boolean }
  if (body.all) {
    await markAllNotificationsRead(session.user.id)
  } else if (body.id) {
    await markNotificationRead(body.id, session.user.id)
  } else {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}