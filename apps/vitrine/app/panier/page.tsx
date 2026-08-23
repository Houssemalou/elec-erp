import type { Metadata } from 'next'
import { CartPage } from '@/components/cart/cart-page'

export const metadata: Metadata = { title: 'Panier' }

export default function PanierPage() {
  return <CartPage />
}