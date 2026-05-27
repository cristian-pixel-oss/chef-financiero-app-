'use client'

export const dynamic = 'force-dynamic'

/**
 * CHEF FINANCIERO — /invite/[token]
 * Página pública de aceptación de invitación.
 * El invitado ve el hotel, su rol asignado y se registra con contraseña.
 */

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase }              from '@/lib/supabase/client'
import { getInvitationByToken, completeInvitation } from '@/services/invitations.service'
import { getRoleLabel }          from '@/lib/roles'

type PageState = 'loading' | 'valid' | 'invalid' | 'expired' | 'used' | 'success'

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const router    = useRouter()

  const [pageState,  setPageState]  = useState<PageState>('loading')
  const [invitation, setInvitation] = useState<{
    email: string; role: string; hotel_name: string; hotel_id: string
  } | null>(null)

  const [fullName,  setFullName]  = useState('')
  const [password,  setPassword]  = useState('')
  const [password2, setPassword2] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError,  setFormError]  = useState<string | null>(null)

  // ── Validar token ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setPageState('invalid'); return }

    getInvitationByToken(token).then((inv) => {
      if (!inv) { setPageState('invalid'); return }
      if (inv.used_at) { setPageState('used'); return }
      if (new Date(inv.expires_at) < new Date()) { setPageState('expired'); return }

      setInvitation({
        email:      inv.email,
        role:       inv.role,
        hotel_name: inv.hotel_name,
        hotel_id:   inv.hotel_id,
      })
      setPageState('valid')
    })
  }, [token])

  // ── Registro ───────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!invitation) return

    if (password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== password2) {
      setFormError('Las contraseñas no coinciden')
      return
    }

    setSubmitting(true)
    setFormError(null)

    try {
      // 1. Crear cuenta en Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email:    invitation.email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (signUpError) throw signUpError

      const userId = data.user?.id
      if (!userId) throw new Error('No se pudo crear el usuario')

      // 2. Completar perfil + marcar invitación como usada (SECURITY DEFINER)
      await completeInvitation(token, userId)

      setPageState('success')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al registrarse')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Estados de la página ───────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-400" />
      </div>
    )
  }

  if (pageState === 'invalid' || pageState === 'expired' || pageState === 'used') {
    const msgs: Record<string, { icon: string; title: string; desc: string }> = {
      invalid: { icon: '🔗', title: 'Link inválido', desc: 'Este link de invitación no existe.' },
      expired: { icon: '⏰', title: 'Invitación expirada', desc: 'Este link expiró. Solicita una nueva invitación al administrador.' },
      used:    { icon: '✓',  title: 'Invitación ya utilizada', desc: 'Esta invitación ya fue aceptada anteriormente.' },
    }
    const { icon, title, desc } = msgs[pageState]
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10">
            <div className="text-5xl mb-4">{icon}</div>
            <h2 className="text-white text-xl font-semibold mb-2">{title}</h2>
            <p className="text-gray-400 text-sm">{desc}</p>
            <a href="/login" className="mt-6 inline-block text-amber-400 text-sm hover:underline">
              Ir al login →
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (pageState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-green-900/30 border border-green-700 rounded-2xl p-10">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-white text-xl font-semibold mb-2">¡Bienvenido a Chef Financiero!</h2>
            <p className="text-gray-400 text-sm mb-2">
              Tu cuenta ha sido creada y tienes acceso a{' '}
              <strong className="text-white">{invitation?.hotel_name}</strong>.
            </p>
            {/* Si confirmación de email está activada en Supabase, mostrar aviso */}
            <p className="text-gray-500 text-xs mb-6">
              Si no puedes iniciar sesión, revisa tu correo y confirma tu cuenta primero.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="px-8 py-3 rounded-xl bg-amber-400 text-gray-900 font-semibold text-sm hover:bg-amber-300 transition"
            >
              Iniciar sesión →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Formulario de registro ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4 py-10">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Chef <span className="text-amber-400">Financiero</span>
          </h1>
          <p className="text-gray-400 mt-2 text-sm">Estás siendo invitado a unirte</p>
        </div>

        {/* Card info invitación */}
        <div
          className="rounded-xl px-5 py-4 mb-6 flex items-start gap-4"
          style={{
            background: 'rgba(212,160,23,0.06)',
            border:     '1px solid rgba(212,160,23,0.25)',
          }}
        >
          <span className="text-2xl mt-0.5">🏨</span>
          <div>
            <p className="text-amber-400 font-semibold text-sm">{invitation?.hotel_name}</p>
            <p className="text-gray-400 text-xs mt-0.5">
              Acceso como{' '}
              <span className="text-white font-semibold">{getRoleLabel(invitation?.role)}</span>
              {' '}· {invitation?.email}
            </p>
          </div>
        </div>

        {/* Formulario */}
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
          <h2 className="text-white text-xl font-semibold mb-5">Crea tu cuenta</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre completo</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5
                           text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Correo electrónico</label>
              <input
                type="email"
                value={invitation?.email ?? ''}
                disabled
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5
                           text-gray-400 text-sm cursor-not-allowed"
              />
              <p className="text-gray-600 text-xs mt-1">El email está asignado a esta invitación.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5
                           text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirmar contraseña</label>
              <input
                type="password"
                required
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="Repite la contraseña"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5
                           text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            {formError && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-2">
                <p className="text-red-400 text-sm">{formError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-3 rounded-xl text-sm font-bold transition ${
                submitting
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-amber-400 text-gray-900 hover:bg-amber-300'
              }`}
            >
              {submitting ? 'Creando cuenta…' : 'Aceptar invitación y entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
