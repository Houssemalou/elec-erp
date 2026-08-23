import { auth } from '@/auth'
import type { Role } from '@elec/db'

/** Session courante (retourne null si non authentifié). */
export async function getSession() {
  return auth()
}

/** Vérifie que l'utilisateur connecté possède l'un des rôles requis. */
export async function requireRole(roles: Role[], redirectTo = '/dashboard') {
  const session = await auth()
  if (!session?.user) {
    return { session: null as null, allowed: false }
  }
  if (!roles.includes(session.user.role)) {
    return { session, allowed: false }
  }
  return { session, allowed: true }
}

export const STAFF_ROLES: Role[] = ['ADMIN', 'MANAGER', 'VENDEUR']
export const MANAGER_ROLES: Role[] = ['ADMIN', 'MANAGER']
export const ADMIN_ROLE: Role[] = ['ADMIN']