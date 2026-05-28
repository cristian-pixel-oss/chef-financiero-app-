/**
 * CHEF FINANCIERO — Página de Login
 *
 * Flujo de autenticación:
 *  1. Al montar, suscribe a onAuthStateChange para detectar sesiones que
 *     lleguen del #access_token del magic link / verificación de email.
 *  2. También llama a getSession() para sesiones ya guardadas en cookies.
 *  3. Mientras se verifica muestra un spinner (checkingSession = true) para
 *     que el formulario nunca aparezca durante el procesamiento del token.
 *  4. Cuando detecta sesión → router.replace('/home') sin pasar por el form.
 *  5. Solo si no hay sesión → muestra el formulario de email + contraseña.
 */

'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter }                   from 'next/navigation'
import { useAuth }                     from '@/hooks/useAuth'
import { supabase }                    from '@/lib/supabase/client'

export default function LoginPage() {
  const router          = useRouter()
  const { signIn }      = useAuth()
  const redirectedRef   = useRef(false)   // evita doble redirect en StrictMode

  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  /**
   * checkingSession empieza en true para mostrar spinner mientras Supabase
   * procesa el #access_token= del hash. Pasa a false solo cuando se confirma
   * que no existe sesión activa.
   */
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let active = true

    function redirectToHome() {
      if (!redirectedRef.current && active) {
        redirectedRef.current = true
        router.replace('/home')
      }
    }

    // ── 1. onAuthStateChange ──────────────────────────────────────────────
    // Escucha cualquier evento de auth: sesión restaurada desde cookies,
    // SIGNED_IN después de procesar #access_token= (magic link / email conf.),
    // TOKEN_REFRESHED, etc.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          redirectToHome()
        }
      }
    )

    // ── 2. getSession() ───────────────────────────────────────────────────
    // Obtiene la sesión actual (cookies o #access_token= ya procesado).
    // Cuando resuelve sin sesión, oculta el spinner y muestra el form.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      if (session) {
        redirectToHome()
      } else {
        setCheckingSession(false)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [router])

  // ─── Submit del formulario manual ────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await signIn(email, password)
      router.replace('/home')
    } catch (err) {
      // Extrae el mensaje tanto de Error instances como de objetos planos
      const msg =
        err instanceof Error
          ? err.message
          : typeof (err as { message?: unknown })?.message === 'string'
            ? (err as { message: string }).message
            : 'Error al iniciar sesión'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  // Spinner mientras se verifica la sesión (cubre el procesamiento del hash)
  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-amber-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">

        {/* Logo / Marca */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Chef <span className="text-amber-400">Financiero</span>
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            Control de costos profesional para cocinas de hotel
          </p>
        </div>

        {/* Formulario */}
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 shadow-2xl">
          <h2 className="text-white text-xl font-semibold mb-6">Iniciar sesión</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="chef@hotel.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3
                           text-white placeholder-gray-500 focus:outline-none focus:ring-2
                           focus:ring-amber-400 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 pr-11
                             text-white placeholder-gray-500 focus:outline-none focus:ring-2
                             focus:ring-amber-400 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400
                             hover:text-amber-400 transition"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-400 hover:bg-amber-300 disabled:bg-amber-400/40
                         text-gray-900 font-semibold rounded-lg px-4 py-3 transition
                         focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2
                         focus:ring-offset-gray-900"
            >
              {loading ? 'Iniciando sesión...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a
              href="/auth/forgot-password"
              className="text-sm text-gray-400 hover:text-amber-400 transition"
            >
              ¿Olvidaste tu contraseña?
            </a>
          </div>

          <div className="mt-4 text-center">
            <span className="text-sm text-gray-500">¿No tienes cuenta? </span>
            <a
              href="/auth/register"
              className="text-sm text-amber-400 hover:text-amber-300 transition font-medium"
            >
              Regístrate
            </a>
          </div>
        </div>

      </div>
    </div>
  )
}
