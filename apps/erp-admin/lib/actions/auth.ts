'use server'

import { signIn, signOut } from '@/auth'
import { AuthError } from 'next-auth'

export type LoginState = { error: string | null; success: boolean }

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')

  try {
    await signIn('credentials', { email, password, redirect: false })
    return { error: null, success: true }
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Email ou mot de passe incorrect', success: false }
    }
    throw error
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: '/login' })
}