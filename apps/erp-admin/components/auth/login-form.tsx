'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Zap } from 'lucide-react'
import { loginAction } from '@/lib/actions/auth'
import { Button, Input, Label } from '@/components/ui'
import { startActionLoader, stopActionLoader } from '@/lib/action-events'

export function LoginForm() {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(loginAction, { error: null, success: false })
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!pending) stopActionLoader()
  }, [pending])

  useEffect(() => {
    if (state.success) {
      router.push('/dashboard')
      router.refresh()
    }
  }, [state.success, router])

  return (
    <form ref={formRef} action={formAction} onSubmit={startActionLoader} className="space-y-4">
      <div>
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="admin@magasin.tn" />
      </div>
      <div>
        <Label htmlFor="password">Mot de passe</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
      </div>

      {state.error ? (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full" size="lg">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
        {pending ? 'Connexion…' : 'Se connecter'}
      </Button>
    </form>
  )
}
