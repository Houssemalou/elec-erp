'use client'

import { useState } from 'react'
import { ShoppingCart, Check } from 'lucide-react'
import { useCart } from './cart-provider'
import { cn } from '@/lib/utils'

export function AddToCart({
  product,
  className,
}: {
  product: {
    productId: string
    sku: string
    name: string
    slug: string
    priceHT: number
    taxRate: number
    unit: string
    image?: string
  }
  className?: string
}) {
  const { add } = useCart()
  const [added, setAdded] = useState(false)

  return (
    <button
      onClick={() => {
        add(product)
        setAdded(true)
        window.setTimeout(() => setAdded(false), 1500)
      }}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60',
        className,
      )}
    >
      {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
      {added ? 'Ajouté !' : 'Ajouter au panier'}
    </button>
  )
}