import { EventEmitter } from 'node:events'

// ---------------------------------------------------------------------------
// Hub d'événements in-process (Server-Sent Events)
//
// Chaque process Next.js possède son hub. Pour un événement créé dans un
// autre process (ex : commande créée côté boutique, consommée côté ERP),
// le flux SSE interroge aussi la base PostgreSQL (voir erp-admin/api/events).
// ---------------------------------------------------------------------------

export interface BusinessEvent {
  id: string
  type: string
  payload: Record<string, unknown>
  createdAt: string
}

type Listener = (event: BusinessEvent) => void

const hub = new EventEmitter()
hub.setMaxListeners(100)

export function publishEvent(event: BusinessEvent): void {
  hub.emit('event', event)
}

export function subscribe(callback: Listener): () => void {
  hub.on('event', callback)
  return () => hub.off('event', callback)
}