import Link from 'next/link'
import type { Product } from '@elec/db'
import { AddToCart } from './cart/add-to-cart'
import { money } from '@/lib/format'

type Decimal = number | string | { toString(): string }

type ProductCardData = Product & {
  images: { url: string; isPrimary: boolean }[]
  taxRate: { rate: Decimal }
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const image = product.images.find((i) => i.isPrimary) ?? product.images[0]
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-card transition-all hover:shadow-lifted hover:border-accent-400/30">
      <Link href={`/produits/${product.slug}`} className="relative flex h-48 items-center justify-center overflow-hidden bg-[var(--bg-primary)]">
        {image ? (
          <img src={image.url} alt={product.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <span className="text-4xl">⚡</span>
        )}
        {product.isFeatured ? (
          <span className="absolute left-3 top-3 rounded-full bg-accent-400 px-2.5 py-1 text-[11px] font-bold text-[#0B0B0B]">
            Coup de cœur
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{product.brand ?? 'ElectroNova HA'}</p>
        <Link href={`/produits/${product.slug}`} className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--text-primary)] hover:text-accent-400">
          {product.name}
        </Link>
        <div className="mt-auto flex items-end justify-between pt-4">
          <div>
            <p className="font-display text-lg font-bold text-accent-400">{money(Number(product.priceHT) * (1 + Number(product.taxRate.rate) / 100))}</p>
          </div>
          <AddToCart
            product={{
              productId: product.id,
              sku: product.sku,
              name: product.name,
              slug: product.slug,
              priceHT: Number(product.priceHT),
              taxRate: Number(product.taxRate.rate),
              unit: product.unit,
              image: image?.url,
            }}
          />
        </div>
      </div>
    </div>
  )
}
