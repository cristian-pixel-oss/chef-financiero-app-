'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useAuth }  from '@/hooks/useAuth'

export default function RegisterPage() {
  const { signUp } = useAuth()

  const [fullName, setFullName] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await signUp(email, password, fullName)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-green-900/30 border border-green-700 rounded-2xl p-8">
            <div className="text-5xl mb-4 text-green-400">✓</div>
            <h2 className="text-white text-xl font-semibold mb-2">¡Registro exitoso!</h2>
            <p className="text-gray-400 text-sm mb-6">
              Revisa tu correo <strong className="text-white">{email}</strong> y confirma
              tu cuenta. Después podrás iniciar sesión.
            </p>
            <a
              href="/login"
              className="inline-block bg-amber-400 hover:bg-amber-300 text-gray-900
                         font-semibold rounded-lg px-8 py-3 transition"
            >
              Ir al login
            </a>
          </div>
        </div>
      </div>
    )
  }

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

        {/* Formulario */}
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 shadow-2xl">
          <h2 className="text-white text-xl font-semibold mb-6">Crear cuenta</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Nombre completo
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Cristian Lamela"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3
                           text-white placeholder-gray-500 focus:outline-none focus:ring-2
                           focus:ring-amber-400 focus:border-transparent transition"
              />
            </div>

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
                placeholder="Mínimo 6 caracteres"
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
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-sm text-gray-500">¿Ya tienes cuenta? </span>
            <a
              href="/login"
              className="text-sm text-amber-400 hover:text-amber-300 transition font-medium"
            >
              Iniciar sesión
            </a>
          </div>
        </div>

      </div>
    </div>
  )
}
