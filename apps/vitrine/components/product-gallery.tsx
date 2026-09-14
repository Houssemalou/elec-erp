'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface GalleryImage {
  id: string
  url: string
  alt: string | null
  isPrimary: boolean
}

export function ProductGallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const [index, setIndex] = useState(0)
  const count = images.length
  const current = Math.min(index, Math.max(0, count - 1))
  const hasMany = count > 1

  const prev = () => setIndex((i) => (count === 0 ? 0 : (i - 1 + count) % count))
  const next = () => setIndex((i) => (count === 0 ? 0 : (i + 1) % count))

  if (count === 0) {
    return <span className="text-7xl">⚡</span>
  }

  const active = images[current]!

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-card)]">
        <img
          key={active.id}
          src={active.url}
          alt={active.alt || name}
          className="max-h-full w-full object-contain"
        />

        {hasMany ? (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Image précédente"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-[var(--border)] bg-[var(--bg-card)]/90 p-2 text-[var(--text-secondary)] shadow-card transition-colors hover:text-accent-400"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Image suivante"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-[var(--border)] bg-[var(--bg-card)]/90 p-2 text-[var(--text-secondary)] shadow-card transition-colors hover:text-accent-400"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {images.map((img, i) => (
                <button
                  type="button"
                  key={img.id}
                  onClick={() => setIndex(i)}
                  aria-label={`Image ${i + 1}`}
                  className={`h-2 rounded-full transition-all ${i === current ? 'w-5 bg-accent-400' : 'w-2 bg-[var(--border)] hover:bg-accent-400/60'}`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {hasMany ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              type="button"
              key={img.id}
              onClick={() => setIndex(i)}
              aria-label={`Afficher l'image ${i + 1}`}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border transition-all ${i === current ? 'border-accent-400' : 'border-[var(--border)] opacity-70 hover:opacity-100'}`}
            >
              <img src={img.url} alt={img.alt || `${name} ${i + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}