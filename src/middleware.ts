/**
 * CHEF FINANCIERO — Middleware de autenticación
 *
 * Protege todas las rutas del dashboard.
 * Redirige al login si no hay sesión activa.
 */

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse }           from 'next/server'
import type { NextRequest }       from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Rutas públicas que no requieren autenticación
  const publicPaths = ['/login', '/register', '/auth']
  const isPublic = publicPaths.some((p) => req.nextUrl.pathname.startsWith(p))

  if (isPublic) return res

  // Verificar sesión
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirectTo', req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
  ],
}
