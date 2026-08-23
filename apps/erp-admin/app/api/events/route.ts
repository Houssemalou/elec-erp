import { auth } from '@/auth'
import { prisma } from '@elec/db'
import { subscribe, type BusinessEvent } from '@elec/services'
import { STAFF_ROLES } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Flux Server-Sent Events pour le centre de notifications du back-office.
 * 1) Diffusion immédiate des événements du process courant (hub in-memory).
 * 2) Polling PostgreSQL : capture les événements créés par d'autres
 *    applications (ex : nouvelle commande passée côté boutique).
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user || !STAFF_ROLES.includes(session.user.role)) {
    return new Response('Non autorisé', { status: 401 })
  }

  const encoder = new TextEncoder()
  let lastSeenAt = new Date()
  const sentIds = new Set<string>()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (id: string, type: string, payload: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`id: ${id}\nevent: ${type}\ndata: ${JSON.stringify(payload)}\n\n`),
          )
        } catch {
          /* flux fermé */
        }
      }

      push('0', 'hello', { role: session.user.role })

      const onEvent = (event: BusinessEvent) => {
        if (sentIds.has(event.id)) return
        sentIds.add(event.id)
        push(event.id, event.type, event.payload)
      }
      const unsubscribe = subscribe(onEvent)

      const poll = async () => {
        try {
          const notifications = await prisma.notification.findMany({
            where: { createdAt: { gt: lastSeenAt } },
            orderBy: { createdAt: 'asc' },
            take: 50,
          })
          for (const n of notifications) {
            if (sentIds.has(n.id)) continue
            sentIds.add(n.id)
            push(n.id, 'notification', {
              id: n.id,
              type: n.type,
              title: n.title,
              message: n.message,
              link: n.link,
              createdAt: n.createdAt.toISOString(),
              isRead: n.isRead,
            })
            if (n.createdAt.getTime() > lastSeenAt.getTime()) lastSeenAt = n.createdAt
          }
        } catch {
          /* base indisponible momentanément */
        }
      }
      const timer = setInterval(poll, 3000)
      void poll()

      req.signal.addEventListener('abort', () => {
        clearInterval(timer)
        unsubscribe()
        try {
          controller.close()
        } catch {
          /* déjà fermé */
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}