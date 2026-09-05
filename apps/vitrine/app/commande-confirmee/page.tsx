import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@elec/db'
import { money, formatDate } from '@/lib/format'
import { CheckCircle2, MapPin, Store, Truck, Zap } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OrderConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  if (!id) notFound()

  const order = await prisma.onlineOrder.findUnique({
    where: { id },
    include: { items: { include: { taxRate: true } }, customer: true },
  })
  if (!order) notFound()

  const itemCount = order.items.reduce((s, i) => s + Number(i.quantity), 0)
  const isPickup = order.deliveryMethod === 'PICKUP'

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold text-[var(--text-primary)]">Merci pour votre commande !</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Votre commande <span className="font-mono font-semibold text-accent-400">{order.number}</span> a bien été enregistrée.
          Notre équipe vous contactera au téléphone pour le suivi de votre livraison.
        </p>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-card">
        <div className="grid grid-cols-2 gap-4 border-b border-[var(--border)] bg-[var(--bg-secondary)] px-6 py-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-[var(--text-muted)]">Numéro</p>
            <p className="font-mono text-xs font-semibold text-accent-400">{order.number}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Date</p>
            <p className="font-medium text-[var(--text-secondary)]">{formatDate(order.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Articles</p>
            <p className="font-medium text-[var(--text-secondary)]">{itemCount}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Paiement</p>
            <p className="font-medium text-[var(--text-secondary)]">Espèces à la réception</p>
          </div>
        </div>

        <ul className="divide-y divide-[var(--border)]">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 px-6 py-3 text-sm">
              <span className="text-[var(--text-secondary)]">
                <span className="font-medium text-[var(--text-primary)]">{i.designation}</span>
                <span className="text-xs text-[var(--text-muted)]"> · Réf. {i.sku}</span>
              </span>
              <span className="text-[var(--text-muted)]">
                {Number(i.quantity)} × {money(Number(i.unitPriceHT) * (1 + Number(i.taxRate.rate) / 100))}
              </span>
            </li>
          ))}
        </ul>

        <div className="space-y-1.5 border-t border-[var(--border)] bg-[var(--bg-secondary)] px-6 py-4 text-sm">
          {Number(order.shippingCost) > 0 ? (
            <div className="flex justify-between text-[var(--text-secondary)]"><span>Livraison</span><span>{money(order.shippingCost)}</span></div>
          ) : null}
          <div className="flex justify-between border-t border-[var(--border)] pt-2 text-base font-bold text-[var(--text-primary)]">
            <span>Total</span>
            <span>{money(order.totalTTC)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-card">
        {isPickup ? (
          <>
            <Store className="h-5 w-5 shrink-0 text-accent-400" />
            <div className="text-sm text-[var(--text-secondary)]">
              Retrait en magasin
              {order.pickupTime ? (
                <span className="block font-medium text-[var(--text-primary)]">
                  Récupération prévue le {formatDate(order.pickupTime)} à{' '}
                  {new Date(order.pickupTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : null}
              <span className="block text-xs text-[var(--text-muted)]">
                Nous vous appellerons dès que votre commande est prête. Merci de régler en espèces lors du retrait.
              </span>
            </div>
          </>
        ) : (
          <>
            <Truck className="h-5 w-5 shrink-0 text-accent-400" />
            <div className="text-sm text-[var(--text-secondary)]">
              Livraison à <span className="font-medium text-[var(--text-primary)]">{order.shippingAddress}</span>, {order.shippingCity}
              <span className="block text-xs text-[var(--text-muted)]">
                Notre équipe vous contactera pour confirmer la livraison. Merci de régler en espèces à la réception.
              </span>
            </div>
          </>
        )}
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <MapPin className="h-3.5 w-3.5" />
        La facture officielle est établie par le magasin et vous est remise avec votre commande.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Link href="/produits" className="inline-flex items-center gap-2 text-sm font-semibold text-accent-400 hover:text-accent-300">
          <Zap className="h-4 w-4" /> Continuer mes achats
        </Link>
      </div>
    </div>
  )
}
