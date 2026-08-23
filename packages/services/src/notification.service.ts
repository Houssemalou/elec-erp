import { db, Prisma } from '@elec/db'
import { publishEvent, type BusinessEvent } from './events'

export type NotificationType = 'NEW_ORDER' | 'NEW_QUOTE_REQUEST' | 'STOCK_ALERT' | 'PAYMENT_RECEIVED' | 'QUOTE_ACCEPTED' | 'STOCK_RECEIVED' | 'SYSTEM'

export interface CreateNotificationInput {
  /** null = diffusion à tout le personnel. */
  userId?: string | null
  type: NotificationType
  title: string
  message: string
  link?: string | null
}

/**
 * Crée une notification persistée (centre de notifications) et la diffuse
 * immédiatement aux clients SSE connectés du process courant.
 */
export async function createNotification(input: CreateNotificationInput): Promise<{ id: string; type: string; title: string; message: string; link: string | null; isRead: boolean; createdAt: Date }> {
  const notification = await db.notification.create({
    data: {
      userId: input.userId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
    },
  })

  const event: BusinessEvent = {
    id: notification.id,
    type: 'notification',
    payload: {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      createdAt: notification.createdAt.toISOString(),
    },
    createdAt: new Date().toISOString(),
  }
  publishEvent(event)

  return notification
}

export async function listNotifications(userId: string, options?: { limit?: number; unreadOnly?: boolean }) {
  const where = { OR: [{ userId }, { userId: null }] } as Prisma.NotificationWhereInput
  if (options?.unreadOnly) {
    where.isRead = false
  }
  const [notifications, unreadCount] = await db.$transaction([
    db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
    }),
    db.notification.count({ where: { ...where, isRead: false } }),
  ])
  return { notifications, unreadCount }
}

export async function markNotificationRead(notificationId: string, userId: string) {
  await db.notification.updateMany({
    where: { id: notificationId, OR: [{ userId }, { userId: null }] },
    data: { isRead: true },
  })
}

export async function markAllNotificationsRead(userId: string) {
  await db.notification.updateMany({
    where: { OR: [{ userId }, { userId: null }], isRead: false },
    data: { isRead: true },
  })
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  return db.notification.count({
    where: { OR: [{ userId }, { userId: null }], isRead: false },
  })
}

/**
 * Alerte stock : crée une notification STOCK_ALERT pour les produits passés
 * sous le seuil (dédupliquée si une alerte non lue identique existe déjà).
 */
export async function checkAndNotifyStockAlerts(): Promise<number> {
  const levels = await db.stockLevel.findMany({
    include: {
      product: { select: { id: true, name: true, sku: true, minStockAlert: true } },
      warehouse: { select: { id: true, name: true } },
    },
  })

  let created = 0
  for (const level of levels) {
    const available = Number(level.quantity) - Number(level.reservedQuantity)
    const threshold = Number(level.product.minStockAlert)
    if (threshold > 0 && available < threshold) {
      const title = 'Stock sous le seuil d\'alerte'
      const message = `${level.product.sku} — ${level.product.name} (${level.warehouse.name}) : ${available.toFixed(3)} restant(s), seuil ${threshold.toFixed(3)}`
      const existing = await db.notification.findFirst({
        where: { type: 'STOCK_ALERT', isRead: false, title, message },
      })
      if (!existing) {
        await db.notification.create({
          data: {
            type: 'STOCK_ALERT',
            title,
            message,
            link: `/produits/${level.product.id}`,
          },
        })
        created++
      }
    }
  }
  return created
}

export async function getStaffNotificationsLink(): Promise<string | null> {
  return null
}