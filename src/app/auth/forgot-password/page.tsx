'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useAuth }  from '@/hooks/useAuth'

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()

  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await resetPassword(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar el correo')
    } finally {
      setLoading(false)
    }
  }

  // ── Estado: correo enviado ────────────────────────────────────────────────
  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-green-900/30 border border-green-700 rounded-2xl p-8">
            <div className="text-5xl mb-4">📧</div>
            <h2 className="text-white text-xl font-semibold mb-2">
              Revisa tu correo
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Te enviamos un enlace a{' '}
              <strong className="text-white">{email}</strong>. Haz clic en
              él para restablecer tu contraseña.
            </p>
            <a
              href="/login"
              className="inline-block bg-amber-400 hover:bg-amber-300 text-gray-900
                         font-semibold rounded-lg px-8 py-3 transition"
            >
              Volver al login
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── Formulario ────────────────────────────────────────────────────────────
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
          <h2 className="text-white text-xl font-semibold mb-2">
            Recuperar contraseña
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            Ingresa tu correo y te enviaremos un enlace para restablecer tu
            contraseña.
          </p>

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
              {loading ? 'Enviando...' : 'Enviar enlace'}
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
