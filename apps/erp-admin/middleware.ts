import { auth } from '@/auth'

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = Boolean(req.auth)

  if (nextUrl.pathname === '/') {
    return Response.redirect(new URL(isLoggedIn ? '/dashboard' : '/login', nextUrl))
  }

  if (nextUrl.pathname.startsWith('/login')) {
    return isLoggedIn ? Response.redirect(new URL('/dashboard', nextUrl)) : undefined
  }

  if (!isLoggedIn) {
    return Response.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(nextUrl.pathname)}`, nextUrl))
  }

  return undefined
})

export const config = {
  matcher: [
    '/((?!api/auth|api/events|api/notifications|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}