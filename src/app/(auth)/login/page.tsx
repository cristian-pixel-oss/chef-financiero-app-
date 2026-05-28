/**
 * CHEF FINANCIERO — Página de Login
 */

'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import { useAuth }             from '@/hooks/useAuth'

export default function LoginPage() {
  const router               = useRouter()
  const { user, loading: authLoading, signIn } = useAuth()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  /**
   * Si el usuario ya tiene sesión activa (por ejemplo, llegó desde un link de
   * verificación de email que pone #access_token= en la URL, o tenía sesión
   * guardada en cookies), redirigir directamente a /home sin mostrar el form.
   */
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/home')
    }
  }, [user, authLoading, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await signIn(email, password)
      // replace() en vez de push() para que el botón "atrás" no regrese al login
      router.replace('/home')
    } catch (err) {
      // Extrae el mensaje tanto de Error instances como de objetos planos (ej. stub)
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

  // Mientras se verifica si hay sesión activa, mostrar spinner
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-amber-400" />
      </div>
    )
  }

  // Si ya hay usuario, el useEffect lo redirige — no renderizar el form
  if (user) return null

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
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3
                           text-white placeholder-gray-500 focus:outline-none focus:ring-2
                           focus:ring-amber-400 focus:border-transparent transition"
              />
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
