import type { Metadata } from 'next'
import { CheckoutForm } from '@/components/checkout/checkout-form'
import { db } from '@elec/db'

export const metadata: Metadata = { title: 'Commande' }

export const dynamic = 'force-dynamic'

export default async function CheckoutPage() {
  const settings = await db.storeSettings.findFirst({ orderBy: { id: 'asc' } })

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="mb-8 font-display text-3xl font-bold text-brand-950">Finaliser ma commande</h1>
      <CheckoutForm
        storeName={settings?.storeName ?? ''}
        storeAddress={[settings?.address, settings?.city].filter(Boolean).join(', ')}
        storePhone={settings?.phone ?? ''}
      />
    </div>
  )
}