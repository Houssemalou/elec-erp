import type { Metadata } from 'next'
import { Zap } from 'lucide-react'
import { LoginForm } from '@/components/auth/login-form'
import { getStoreSettings } from '@elec/services'

export const metadata: Metadata = { title: 'Connexion' }

export default async function LoginPage() {
  const settings = await getStoreSettings().catch(() => null)
  const logoUrl = settings?.logoUrl ?? null

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-950 p-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(255,183,3,0.25) 0, transparent 40%), radial-gradient(circle at 80% 70%, rgba(52,104,171,0.4) 0, transparent 45%)',
        }}
      />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          {logoUrl ? (
            <img src={logoUrl} alt="ElectroNova HA" className="mx-auto mb-4 h-14 w-14 rounded-2xl object-contain shadow-lifted" />
          ) : (
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-500 shadow-lifted">
              <Zap className="h-7 w-7 text-brand-950" />
            </div>
          )}
          <h1 className="font-display text-2xl font-bold text-white">ElectroNova HA ERP</h1>
          <p className="mt-1 text-sm text-brand-200">Gestion du magasin électrique</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white p-6 shadow-lifted">
          <h2 className="mb-1 font-display text-lg font-semibold text-brand-950">Bienvenue</h2>
          <p className="mb-6 text-sm text-slate-500">Connectez-vous pour accéder à votre espace.</p>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}