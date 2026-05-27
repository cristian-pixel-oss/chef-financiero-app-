'use client'

/**
 * CHEF FINANCIERO — Página de Bienvenida (/home)
 *
 * Pantalla completa con logo, botón de acceso y menú flotante con cards.
 */

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams }  from 'next/navigation'
import { useAuth }                     from '@/hooks/useAuth'
import { supabase }                    from '@/lib/supabase/client'
import { getRoleLevel }                from '@/lib/roles'

// ─── Items del menú ───────────────────────────────────────────────────────────

type MenuTier = 'standard' | 'premium' | 'admin'

interface MenuItem {
  href:    string
  icon:    string
  label:   string
  desc:    string
  accent:  string
  minRole: MenuTier   // nivel mínimo requerido para ver este item
  active:  boolean
}

const MENU_ITEMS: MenuItem[] = [
  { href: '/dashboard',      icon: '📊', label: 'Dashboard',         desc: 'Resumen ejecutivo del período', accent: 'amber',   minRole: 'premium',  active: true  },
  { href: '/costs',          icon: '📋', label: 'Pedidos',           desc: 'Control de costos diario ALM', accent: 'blue',    minRole: 'standard', active: true  },
  { href: '/dispatches',     icon: '🥩', label: 'Despachos',         desc: 'Carnes y vegetales',            accent: 'orange',  minRole: 'standard', active: true  },
  { href: '/descargos',      icon: '💵', label: 'Descargos',         desc: 'Ingresos de otros hoteles',     accent: 'cyan',    minRole: 'standard', active: true  },
  { href: '/budget',         icon: '💰', label: 'Presupuesto',       desc: 'Configuración por área',        accent: 'emerald', minRole: 'premium',  active: true  },
  { href: '/proyeccion',     icon: '📈', label: 'Proyección Cierre', desc: 'Planificación cierre mensual', accent: 'violet',  minRole: 'premium',  active: true  },
  { href: '/admin/usuarios', icon: '👥', label: 'Usuarios',          desc: 'Gestión de accesos',            accent: 'amber',   minRole: 'admin',    active: true  },
  { href: '#',               icon: '📑', label: 'Informes',          desc: 'Próximamente',                  accent: 'gray',    minRole: 'premium',  active: false },
]

// Colores por acento (clases Tailwind explícitas para que no se purguen)
const ACCENT: Record<string, { border: string; label: string; bg: string }> = {
  amber:   { border: 'border-amber-500/50   hover:border-amber-400',   label: 'text-amber-400',   bg: 'hover:bg-amber-500/5'   },
  blue:    { border: 'border-blue-500/50    hover:border-blue-400',    label: 'text-blue-400',    bg: 'hover:bg-blue-500/5'    },
  orange:  { border: 'border-orange-500/50  hover:border-orange-400',  label: 'text-orange-400',  bg: 'hover:bg-orange-500/5'  },
  cyan:    { border: 'border-cyan-500/50    hover:border-cyan-400',    label: 'text-cyan-400',    bg: 'hover:bg-cyan-500/5'    },
  emerald: { border: 'border-emerald-500/50 hover:border-emerald-400', label: 'text-emerald-400', bg: 'hover:bg-emerald-500/5' },
  violet:  { border: 'border-violet-500/50  hover:border-violet-400',  label: 'text-violet-400',  bg: 'hover:bg-violet-500/5'  },
  gray:    { border: 'border-gray-700/40',                             label: 'text-gray-600',    bg: ''                       },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user, profile, loading } = useAuth()
  const router                     = useRouter()
  const searchParams               = useSearchParams()

  const [hotelName, setHotelName] = useState('Bahía Príncipe')
  const [menuOpen,  setMenuOpen]  = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Abrir menú automáticamente si viene con ?open=1 (desde "← Menú Principal")
  useEffect(() => {
    if (searchParams.get('open') === '1') setMenuOpen(true)
  }, [searchParams])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    supabase
      .from('hotels')
      .select('name')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()
      .then(({ data }) => { if (data?.name) setHotelName(data.name) })
  }, [user])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  if (loading || !user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#080e1a' }}>
        <div className="animate-spin h-10 w-10 rounded-full border-b-2 border-amber-400" />
      </div>
    )
  }

  const roleLevel = getRoleLevel(profile?.role)
  const firstName = profile?.full_name?.split(' ')[0] ?? user.email?.split('@')[0] ?? 'Chef'

  function canSee(item: MenuItem): boolean {
    if (item.minRole === 'standard') return true
    if (item.minRole === 'premium')  return roleLevel === 'premium' || roleLevel === 'admin'
    if (item.minRole === 'admin')    return roleLevel === 'admin'
    return false
  }

  const visibleItems = MENU_ITEMS.filter(canSee)

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: '#080e1a' }}>

      {/* ── Logo pantalla completa ───────────────────────────────────────── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:    'url(/images/logo.png.png)',
          backgroundSize:     'cover',
          backgroundPosition: 'center',
          backgroundRepeat:   'no-repeat',
        }}
      />

      {/* ── Gradiente inferior ──────────────────────────────────────────── */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height:     '22%',
          background: 'linear-gradient(to bottom, transparent 0%, rgba(8,14,26,0.88) 60%, rgba(8,14,26,1) 100%)',
        }}
      />

      {/* ── Botón ACCEDER AL SISTEMA ─────────────────────────────────────── */}
      <div className="absolute inset-x-0 bottom-0 flex justify-center pb-10">
        <button
          onClick={() => setMenuOpen(true)}
          className="group relative px-10 py-4 rounded-xl transition-all duration-300
                     hover:scale-105 active:scale-95 select-none"
          style={{
            border:         '1px solid rgba(212,160,23,0.55)',
            background:     'rgba(8,14,26,0.65)',
            backdropFilter: 'blur(14px)',
            boxShadow:      '0 0 32px rgba(212,160,23,0.12)',
          }}
        >
          <span className="text-sm font-bold tracking-[0.28em] uppercase" style={{ color: '#d4a017' }}>
            ACCEDER AL SISTEMA
          </span>
          <div
            className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{ boxShadow: '0 0 36px rgba(212,160,23,0.22) inset' }}
          />
        </button>
      </div>

      {/* ── Menú flotante ────────────────────────────────────────────────── */}
      {menuOpen && (
        <div className="absolute inset-0 flex items-end justify-center" style={{ zIndex: 50 }}>

          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)' }}
            onClick={() => setMenuOpen(false)}
          />

          {/* Panel */}
          <div
            ref={menuRef}
            className="relative w-full max-w-2xl mx-4 mb-5 rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(10,16,36,0.97)',
              border:     '1px solid rgba(212,160,23,0.20)',
              boxShadow:  '0 -8px 60px rgba(212,160,23,0.10)',
            }}
          >
            {/* Cabecera */}
            <div
              className="px-4 py-4 flex items-center gap-3 border-b"
              style={{ borderColor: 'rgba(212,160,23,0.14)' }}
            >
              {/* Botón inicio — cierra el menú y muestra el logo */}
              <button
                onClick={() => setMenuOpen(false)}
                title="Ir al inicio"
                className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg
                           border transition-all duration-200
                           hover:scale-105 active:scale-95"
                style={{
                  border:     '1px solid rgba(212,160,23,0.35)',
                  background: 'rgba(212,160,23,0.08)',
                  color:      '#d4a017',
                  fontSize:   '1.1rem',
                }}
              >
                🏠
              </button>

              {/* Saludo */}
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-widest font-semibold mb-0.5 truncate" style={{ color: '#d4a017' }}>
                  {getGreeting()}, {firstName}
                </p>
                <p className="text-sm font-medium text-gray-300 truncate">{hotelName}</p>
              </div>

              {/* Cerrar */}
              <button
                onClick={() => setMenuOpen(false)}
                className="shrink-0 text-gray-600 hover:text-gray-400 transition text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Grid de cards */}
            <div className="p-4 grid grid-cols-3 gap-3">
              {visibleItems.map((item) => {
                const ac = ACCENT[item.accent] ?? ACCENT.gray
                return item.active ? (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`
                      group flex flex-col items-center justify-center gap-1.5
                      rounded-xl border py-4 px-2 text-center
                      transition-all duration-200 cursor-pointer
                      hover:scale-[1.03] hover:shadow-lg bg-gray-900/70
                      ${ac.border} ${ac.bg}
                    `}
                  >
                    <span className="text-2xl">{item.icon}</span>
                    <span className={`text-sm font-bold ${ac.label} flex items-center gap-1.5 flex-wrap justify-center`}>
                      {item.label}
                      {item.minRole === 'premium' && roleLevel !== 'admin' && (
                        <span
                          className="text-[8px] font-bold uppercase tracking-wide px-1 py-0.5 rounded-full"
                          style={{ background: 'rgba(212,160,23,0.15)', color: '#d4a017' }}
                        >
                          Pro
                        </span>
                      )}
                      {item.minRole === 'admin' && (
                        <span
                          className="text-[8px] font-bold uppercase tracking-wide px-1 py-0.5 rounded-full"
                          style={{ background: 'rgba(212,160,23,0.15)', color: '#d4a017' }}
                        >
                          Admin
                        </span>
                      )}
                    </span>
                    <span className="text-gray-500 text-xs leading-tight">{item.desc}</span>
                  </a>
                ) : (
                  <div
                    key={item.label}
                    className={`
                      relative flex flex-col items-center justify-center gap-1.5
                      rounded-xl border py-4 px-2 text-center
                      opacity-40 cursor-not-allowed bg-gray-900/40
                      ${ac.border}
                    `}
                  >
                    <span className="absolute top-1.5 right-1.5 text-[8px] font-bold uppercase
                      bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-full">
                      Pronto
                    </span>
                    <span className="text-2xl grayscale">{item.icon}</span>
                    <span className="text-sm font-bold text-gray-600">{item.label}</span>
                    <span className="text-gray-600 text-xs leading-tight">{item.desc}</span>
                  </div>
                )
              })}
            </div>

            {/* Pie */}
            <div
              className="px-6 py-3 flex justify-between items-center border-t"
              style={{ borderColor: 'rgba(255,255,255,0.04)' }}
            >
              <span className="text-xs text-gray-700 font-mono">Chef Financiero v1.0</span>
              <button
                onClick={async () => {
                  const { createClientComponentClient } = await import('@supabase/auth-helpers-nextjs')
                  await createClientComponentClient().auth.signOut()
                  router.push('/login')
                }}
                className="text-xs text-gray-600 hover:text-red-400 transition"
              >
                Cerrar sesión →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
