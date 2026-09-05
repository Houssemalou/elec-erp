import type { Metadata } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { CartProvider } from '@/components/cart/cart-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { ProgressBar } from '@/components/progress-bar'
import { getStoreSettings } from '@elec/services'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const space = Space_Grotesk({ subsets: ['latin'], variable: '--font-space' })

export const metadata: Metadata = {
  title: {
    default: 'ElectroNova HA — Matériel électrique à Béja',
    template: '%s | ElectroNova HA',
  },
  description:
    'Vente de matériel électrique : câbles, disjoncteurs, éclairage, tableaux et appareillage. Livraison en Chamal El Gharbi et Grande Tunis.',
  icons: {
    icon: '/logo-url.jpg',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getStoreSettings().catch(() => null)
  const storeName = settings?.storeName || 'ElectroNova HA'

  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${space.variable} font-sans`}>
        <ThemeProvider>
          <ProgressBar />
          <CartProvider>
            <Navbar storeName={storeName} logoUrl={settings?.logoUrl ?? null} />
            {children}
            <Footer settings={settings} />
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}