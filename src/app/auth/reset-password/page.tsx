/**
 * CHEF FINANCIERO — Página de Reset Password
 *
 * Flujo:
 *  1. Supabase redirige aquí desde el email de recuperación con #access_token= en el hash.
 *  2. onAuthStateChange detecta el evento PASSWORD_RECOVERY y habilita el formulario.
 *  3. El usuario ingresa y confirma la nueva contraseña.
 *  4. Se llama supabase.auth.updateUser({ password }) para guardar el cambio.
 *  5. Se hace sign-out y se redirige a /login con ?reset=1 para mostrar confirmación.
 *
 *  Si el token es inválido / expirado (no llega PASSWORD_RECOVERY en ~2s),
 *  se muestra un estado de error con enlace de reintento.
 */

'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter }                   from 'next/navigation'
import { supabase }                    from '@/lib/supabase/client'

type PageState = 'checking' | 'form' | 'invalid' | 'success'

export default function ResetPasswordPage() {
  const router = useRouter()

  const [pageState,     setPageState]     = useState<PageState>('checking')
  const [password,      setPassword]      = useState('')
  const [confirm,       setConfirm]       = useState('')
  const [showPassword,  setShowPassword]  = useState(false)
  const [showConfirm,   setShowConfirm]   = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  // Evita race conditions: true en cuanto PASSWORD_RECOVERY haya sido procesado
  const recoveryHandled = useRef(false)

  // ── Detectar evento PASSWORD_RECOVERY ─────────────────────────────────────
  useEffect(() => {
    let active = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return

      if (event === 'PASSWORD_RECOVERY' && session) {
        // Token válido: mostrar formulario
        recoveryHandled.current = true
        setPageState('form')
      } else if (event === 'SIGNED_IN' && session && !recoveryHandled.current) {
        // Usuario ya autenticado que entró a esta URL manualmente
        router.replace('/home')
      }
    })

    // Fallback: si después de 2 s no llegó PASSWORD_RECOVERY → token inválido/expirado
    const timer = setTimeout(() => {
      if (!active || recoveryHandled.current) return
      setPageState('invalid')
    }, 2000)

    return () => {
      active = false
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [router])

  // ── Validación y envío ─────────────────────────────────────────────────────
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

      // Cerrar sesión temporal de recuperación y redirigir al login
      await supabase.auth.signOut()
      setPageState('success')
      setTimeout(() => router.replace('/login?reset=1'), 2000)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al actualizar la contraseña. Intenta de nuevo.'
      )
    } finally {
      setLoading(false)
    }
  }

  // ─── Render: checking ──────────────────────────────────────────────────────
  if (pageState === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-amber-400" />
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
              después de 1 hora. Solicita uno nuevo.
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
