import Link from 'next/link'
import { Zap, Phone, Mail, MapPin, Briefcase } from 'lucide-react'
import type { getStoreSettings } from '@elec/services'

type StoreSettings = Awaited<ReturnType<typeof getStoreSettings>>

export function Footer({ settings }: { settings: StoreSettings | null }) {
  const name = settings?.storeName || 'ElectroNova HA'
  const activity = settings?.activity || 'Vente de matériel électrique'
  const address = settings?.address
  const city = settings?.city
  const phone = settings?.phone
  const email = settings?.email
  const logoUrl = settings?.logoUrl ?? null

  return (
    <footer className="border-t border-slate-100 bg-brand-950 text-brand-200">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-14 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt={name} className="h-9 w-9 rounded-xl object-contain" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-500">
                <Zap className="h-5 w-5 text-brand-950" />
              </div>
            )}
            <span className="font-display text-lg font-bold text-white">{name}</span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-brand-300">{activity}.</p>
          {settings?.matriculeFiscal ? (
            <p className="mt-2 text-xs text-brand-400">Matricule fiscal : {settings.matriculeFiscal}</p>
          ) : null}
        </div>

        <div>
          <h3 className="mb-4 font-display text-sm font-semibold text-white">Catégories</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/produits?categorie=cables-et-fils" className="hover:text-accent-400">Câbles et fils</Link></li>
            <li><Link href="/produits?categorie=disjoncteurs-protection" className="hover:text-accent-400">Disjoncteurs et protection</Link></li>
            <li><Link href="/produits?categorie=eclairage" className="hover:text-accent-400">Éclairage</Link></li>
            <li><Link href="/produits?categorie=tableaux-electriques" className="hover:text-accent-400">Tableaux électriques</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 font-display text-sm font-semibold text-white">Informations</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/panier" className="hover:text-accent-400">Mon panier</Link></li>
            <li><Link href="/produits" className="hover:text-accent-400">Catalogue complet</Link></li>
            <li><Link href="/demande-devis" className="hover:text-accent-400">Demander un devis</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 font-display text-sm font-semibold text-white">Contact</h3>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-accent-400" /> {activity}</li>
            {phone ? <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-accent-400" /> {phone}</li> : null}
            {email ? <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-accent-400" /> {email}</li> : null}
            {address || city ? (
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" /> {[address, city].filter(Boolean).join(', ')}
              </li>
            ) : null}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-brand-400">
        © {new Date().getFullYear()} {name} — Tous droits réservés
      </div>
    </footer>
  )
}