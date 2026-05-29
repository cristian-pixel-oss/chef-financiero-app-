/**
 * CHEF FINANCIERO — Página de Reset Password
 *
 * Maneja DOS flujos que Supabase usa según la configuración del proyecto:
 *
 * FLUJO A — PKCE (proyectos nuevos, por defecto):
 *   El email redirige a: /auth/reset-password?code=XXXX
 *   → Detectamos ?code= en la URL, llamamos exchangeCodeForSession(code),
 *     limpiamos la URL y mostramos el formulario.
 *
 * FLUJO B — Legacy / Implicit (proyectos anteriores):
 *   El email redirige a: /auth/reset-password#access_token=XXX&type=recovery
 *   → Supabase JS detecta el hash automáticamente y dispara el evento
 *     PASSWORD_RECOVERY en onAuthStateChange.
 *
 * Al guardar la nueva contraseña:
 *   supabase.auth.updateUser({ password }) → signOut() → redirect /login?reset=1
 */

'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter }                   from 'next/navigation'
import { supabase }                    from '@/lib/supabase/client'

type PageState = 'checking' | 'form' | 'invalid' | 'success'

export default function ResetPasswordPage() {
  const router = useRouter()

  const [pageState,    setPageState]    = useState<PageState>('checking')
  const [password,     setPassword]     = useState('')
  const [confirm,      setConfirm]      = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const recoveryHandled = useRef(false)

  // ── Detectar token / code al montar ───────────────────────────────────────
  useEffect(() => {
    let active = true

    async function init() {
      // ── FLUJO A: PKCE — ?code= en la query string ─────────────────────────
      const params = new URLSearchParams(window.location.search)
      const code   = params.get('code')

      if (code) {
        try {
          const { error: exchangeError } = await (supabase.auth as any)
            .exchangeCodeForSession(code)

          if (exchangeError) throw exchangeError

          if (!active) return
          recoveryHandled.current = true
          setPageState('form')
          // Limpiar ?code de la URL para que una recarga no intente reusar el código
          window.history.replaceState({}, '', window.location.pathname)
        } catch (err) {
          console.error('[ResetPassword] Error intercambiando code:', err)
          if (active) setPageState('invalid')
        }
        return
      }

      // ── FLUJO B: Legacy — #access_token en el hash ────────────────────────
      // onAuthStateChange dispara PASSWORD_RECOVERY cuando el cliente Supabase
      // detecta el hash con type=recovery.
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (!active) return

          if (event === 'PASSWORD_RECOVERY' && session) {
            recoveryHandled.current = true
            setPageState('form')
          } else if (event === 'SIGNED_IN' && session && !recoveryHandled.current) {
            // Usuario ya autenticado que llegó aquí sin token → redirigir
            router.replace('/home')
          }
        }
      )

      // Fallback: si en 5 s no llegó ningún evento válido → token expirado/inválido
      const timer = setTimeout(() => {
        if (!active || recoveryHandled.current) return
        setPageState('invalid')
      }, 5000)

      return () => {
        subscription.unsubscribe()
        clearTimeout(timer)
      }
    }

    const cleanup = init()

    return () => {
      active = false
      cleanup.then((fn) => fn?.())
    }
  }, [router])

  // ── Guardar nueva contraseña ───────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      await supabase.auth.signOut()
      setPageState('success')
      setTimeout(() => router.replace('/login?reset=1'), 2000)
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Error al actualizar la contraseña. Intenta de nuevo.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // ─── Render: verificando token ─────────────────────────────────────────────
  if (pageState === 'checking') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 gap-4">
        <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-amber-400" />
        <p className="text-gray-500 text-sm">Verificando enlace…</p>
      </div>
    )
  }

  // ─── Render: token inválido / expirado ─────────────────────────────────────
  if (pageState === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-red-900/20 border border-red-700/50 rounded-2xl p-8">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-white text-xl font-semibold mb-2">
              Enlace inválido o expirado
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Este enlace de recuperación ya no es válido. Los enlaces expiran
              después de 1 hora o al ser usados. Solicita uno nuevo.
            </p>
            <a
              href="/auth/forgot-password"
              className="inline-block bg-amber-400 hover:bg-amber-300 text-gray-900
                         font-semibold rounded-lg px-8 py-3 transition"
            >
              Solicitar nuevo enlace
            </a>
            <div className="mt-4">
              <a
                href="/login"
                className="text-sm text-gray-500 hover:text-amber-400 transition"
              >
                ← Volver al login
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render: éxito ─────────────────────────────────────────────────────────
  if (pageState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-green-900/30 border border-green-700 rounded-2xl p-8">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-white text-xl font-semibold mb-2">
              ¡Contraseña actualizada!
            </h2>
            <p className="text-gray-400 text-sm">
              Tu contraseña fue cambiada correctamente. Redirigiendo al login…
            </p>
            <div className="mt-6">
              <div className="animate-spin h-5 w-5 rounded-full border-b-2 border-amber-400 mx-auto" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render: formulario ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">

        {/* Marca */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Chef <span className="text-amber-400">Financiero</span>
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            Control de costos profesional para cocinas de hotel
          </p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 shadow-2xl">
          <h2 className="text-white text-xl font-semibold mb-2">Nueva contraseña</h2>
          <p className="text-gray-400 text-sm mb-6">
            Elige una contraseña segura de al menos 6 caracteres.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Nueva contraseña */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 pr-11
                             text-white placeholder-gray-500 focus:outline-none focus:ring-2
                             focus:ring-amber-400 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3
                             text-gray-400 hover:text-amber-400 transition"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Confirmar contraseña */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Confirmar contraseña
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="Repite la contraseña"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 pr-11
                             text-white placeholder-gray-500 focus:outline-none focus:ring-2
                             focus:ring-amber-400 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3
                             text-gray-400 hover:text-amber-400 transition"
                  tabIndex={-1}
                  aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showConfirm ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Indicador de coincidencia */}
            {confirm.length > 0 && (
              <p className={`text-xs ${password === confirm ? 'text-green-400' : 'text-red-400'}`}>
                {password === confirm ? '✓ Las contraseñas coinciden' : '✗ Las contraseñas no coinciden'}
              </p>
            )}

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
              {loading ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a
              href="/login"
              className="text-sm text-gray-400 hover:text-amber-400 transition"
            >
              ← Volver al login
            </a>
          </div>
        </div>

      </div>
    </div>
  )
}
