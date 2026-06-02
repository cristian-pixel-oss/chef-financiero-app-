'use client'

export const dynamic = 'force-dynamic'

import { useEffect }                    from 'react'
import { useRouter, usePathname }       from 'next/navigation'
import { useAuth }                      from '@/hooks/useAuth'
import { getRoleLevel, canAccessRoute } from '@/lib/roles'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()

  // Redirigir si no autenticado
  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  // Control de acceso por rol
  useEffect(() => {
    if (!loading && user && profile && pathname) {
      if (!canAccessRoute(profile.role, pathname)) {
        router.push('/home?open=1')
      }
    }
  }, [loading, user, profile, pathname, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-400" />
      </div>
    )
  }

  if (!user) return null

  const roleLevel = getRoleLevel(profile?.role)
  const isAdmin   = roleLevel === 'admin'

  return (
    <div className="min-h-screen flex bg-gray-950">

      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-gray-900 border-r border-gray-800 shrink-0">

        {/* Logo → /home */}
        <a
          href="/home"
          className="flex items-center justify-center px-4 py-5 border-b border-gray-800 hover:opacity-80 transition"
        >
          <img
            src="/images/logo.png.png"
            alt="Chef Financiero"
            style={{ maxWidth: '140px', width: '100%', height: 'auto' }}
            draggable={false}
          />
        </a>

        {/* Navegación */}
        <div className="p-4 flex-1 flex flex-col gap-2">
          {/* Menú Principal */}
          <a
            href="/home?open=1"
            className="flex items-center gap-2.5 w-full px-4 py-3 rounded-xl
                       border border-amber-500/30 bg-amber-500/5
                       text-amber-400 text-sm font-semibold
                       hover:bg-amber-500/10 hover:border-amber-400/50
                       transition-all duration-200"
          >
            <span className="text-base">←</span>
            Menú Principal
          </a>

          {/* Tasa de Cambio — solo admin */}
          {isAdmin && (
            <a
              href="/admin/configuracion"
              className={`flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl
                         text-sm font-medium transition-all duration-200
                         ${pathname === '/admin/configuracion'
                           ? 'bg-amber-400/15 text-amber-400 border border-amber-400/20'
                           : 'text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent'
                         }`}
            >
              <span className="text-base">💱</span>
              Tasa de Cambio
            </a>
          )}

          {/* Usuarios — solo admin */}
          {isAdmin && (
            <a
              href="/admin/usuarios"
              className={`flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl
                         text-sm font-medium transition-all duration-200
                         ${pathname === '/admin/usuarios'
                           ? 'bg-amber-400/15 text-amber-400 border border-amber-400/20'
                           : 'text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent'
                         }`}
            >
              <span className="text-base">👥</span>
              Usuarios
            </a>
          )}
        </div>

        {/* Usuario + cerrar sesión */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-amber-400/20 flex items-center justify-center shrink-0">
              <span className="text-amber-400 text-sm font-bold">
                {profile?.full_name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {profile?.full_name ?? 'Usuario'}
              </p>
              <p className="text-gray-500 text-xs truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut().then(() => router.push('/login'))}
            className="w-full text-left text-xs text-gray-600 hover:text-red-400 transition px-1 py-1"
          >
            Cerrar sesión →
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header móvil */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900">
          <a
            href="/home?open=1"
            className="flex items-center gap-1.5 text-amber-400 text-sm font-semibold
                       px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5
                       hover:bg-amber-500/10 transition"
          >
            ← Menú
          </a>
          <span className="text-white font-bold text-sm flex-1">
            Chef <span className="text-amber-400">Financiero</span>
          </span>
          {isAdmin && (
            <a href="/admin/usuarios" className="text-gray-400 hover:text-white transition text-sm">
              👥
            </a>
          )}
        </header>

        {/* Página */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
