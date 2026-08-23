import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@elec/db'
import { money, formatDate } from '@/lib/format'
import { CheckCircle2, MapPin, Store, Truck, Zap } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OrderConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; email?: string }>
}) {
  const { id, email } = await searchParams
  if (!id || !email) notFound()

  const order = await prisma.onlineOrder.findUnique({
    where: { id },
    include: { items: true, customer: true },
  })
  if (!order || (order.customer.email ?? '').toLowerCase() !== email.trim().toLowerCase()) {
    notFound()
  }

  const itemCount = order.items.reduce((s, i) => s + Number(i.quantity), 0)
  const isPickup = order.deliveryMethod === 'PICKUP'

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold text-brand-950">Merci pour votre commande !</h1>
        <p className="mt-2 text-sm text-slate-600">
          Votre commande <span className="font-mono font-semibold">{order.number}</span> a bien été enregistrée.
          Un e-mail de confirmation et de suivi vous sera envoyé à <span className="font-medium">{email}</span>.
        </p>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="grid grid-cols-2 gap-4 border-b border-slate-100 bg-slate-50 px-6 py-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-400">Numéro</p>
            <p className="font-mono text-xs font-semibold text-brand-800">{order.number}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Date</p>
            <p className="font-medium text-slate-700">{formatDate(order.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Articles</p>
            <p className="font-medium text-slate-700">{itemCount}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Paiement</p>
            <p className="font-medium text-slate-700">Espèces à la réception</p>
          </div>
        </div>

        <ul className="divide-y divide-slate-100">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 px-6 py-3 text-sm">
              <span className="text-slate-600">
                <span className="font-medium text-slate-900">{i.designation}</span>
                <span className="text-xs text-slate-400"> · Réf. {i.sku}</span>
              </span>
              <span className="text-slate-500">
                {Number(i.quantity)} × {money(i.unitPriceHT)}
              </span>
            </li>
          ))}
        </ul>

        <div className="space-y-1.5 border-t border-slate-100 bg-slate-50 px-6 py-4 text-sm">
          <div className="flex justify-between text-slate-600"><span>Sous-total HT</span><span>{money(order.subtotalHT)}</span></div>
          <div className="flex justify-between text-slate-600"><span>TVA</span><span>{money(order.totalTVA)}</span></div>
          {Number(order.shippingCost) > 0 ? (
            <div className="flex justify-between text-slate-600"><span>Livraison</span><span>{money(order.shippingCost)}</span></div>
          ) : null}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-brand-950">
            <span>Total TTC</span>
            <span>{money(order.totalTTC)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        {isPickup ? (
          <>
            <Store className="h-5 w-5 shrink-0 text-brand-500" />
            <div className="text-sm text-slate-600">
              Retrait en magasin
              {order.pickupTime ? (
                <span className="block font-medium text-slate-900">
                  Récupération prévue le {formatDate(order.pickupTime)} à{' '}
                  {new Date(order.pickupTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : null}
              <span className="block text-xs text-slate-400">
                Nous vous appellerons dès que votre commande est prête. Merci de régler en espèces lors du retrait.
              </span>
            </div>
          </>
        ) : (
          <>
            <Truck className="h-5 w-5 shrink-0 text-brand-500" />
            <div className="text-sm text-slate-600">
              Livraison à <span className="font-medium text-slate-900">{order.shippingAddress}</span>, {order.shippingCity}
              <span className="block text-xs text-slate-400">
                Notre équipe vous contactera pour confirmer la livraison. Merci de régler en espèces à la réception.
              </span>
            </div>
          </>
        )}
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
        <MapPin className="h-3.5 w-3.5" />
        La facture officielle est établie par le magasin et vous est remise avec votre commande.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Link href="/produits" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-600">
          <Zap className="h-4 w-4" /> Continuer mes achats
        </Link>
      </div>
    </div>
  )
}