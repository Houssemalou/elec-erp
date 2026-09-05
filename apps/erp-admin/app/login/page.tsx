import type { Metadata } from 'next'
import { Zap } from 'lucide-react'
import { LoginForm } from '@/components/auth/login-form'
import { getStoreSettings } from '@elec/services'

export const metadata: Metadata = { title: 'Connexion' }

export default async function LoginPage() {
  const settings = await getStoreSettings().catch(() => null)
  const logoUrl = settings?.logoUrl ?? null

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B0B0B] p-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(255,196,0,0.2) 0, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,196,0,0.05) 0, transparent 45%)',
        }}
      />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          {logoUrl ? (
            <img src={logoUrl} alt="ElectroNova HA" className="mx-auto mb-4 h-14 w-14 rounded-2xl object-contain shadow-lifted" />
          ) : (
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-400 shadow-lifted">
              <Zap className="h-7 w-7 text-accent-400" />
            </div>
          )}
          <h1 className="font-display text-2xl font-bold text-white">ElectroNova HA ERP</h1>
          <p className="mt-1 text-sm text-white/50">Gestion du magasin électrique</p>
        </div>

        <div className="rounded-2xl border border-[#2A2A2A] bg-[#151515] p-6 shadow-lifted">
          <h2 className="mb-1 font-display text-lg font-semibold text-white">Bienvenue</h2>
          <p className="mb-6 text-sm text-white/50">Connectez-vous pour accéder à votre espace.</p>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
