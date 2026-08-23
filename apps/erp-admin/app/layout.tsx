import type { Metadata } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { ProgressBar } from '@/components/ui/progress-bar'
import { GlobalLoader } from '@/components/ui/global-loader'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const space = Space_Grotesk({ subsets: ['latin'], variable: '--font-space' })

export const metadata: Metadata = {
  title: {
    default: 'ElectroNova HA ERP — Gestion magasin électrique',
    template: '%s | ElectroNova HA ERP',
  },
  description:
    'ERP de gestion : produits, stock, devis, factures, commandes, clients et fournisseurs.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} ${space.variable} font-sans`}>
        <ProgressBar />
        <GlobalLoader />
        {children}
      </body>
    </html>
  )
}