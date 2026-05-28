/**
 * CHEF FINANCIERO — Middleware de autenticación
 *
 * Protege todas las rutas del dashboard.
 * Redirige al login si no hay sesión activa.
 *
 * Usa @supabase/ssr (compatible con Next.js 16+).
 * @supabase/auth-helpers-nextjs no es compatible con Next.js 16.
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Rutas públicas que no requieren autenticación
  const publicPaths = ['/login', '/register', '/auth', '/invite']
  const isPublic = publicPaths.some((p) => req.nextUrl.pathname.startsWith(p))

  if (isPublic) return res

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Si las variables no están disponibles, dejar pasar (evita crash en build)
  if (!supabaseUrl || !supabaseKey) return res

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options)
        })
      },
    },
  })

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
