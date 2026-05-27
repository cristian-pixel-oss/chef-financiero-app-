'use client'

/**
 * CHEF FINANCIERO — /admin/usuarios
 * Gestión de usuarios del hotel. Solo accesible para role = 'admin'.
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter }  from 'next/navigation'
import { useAuth }    from '@/hooks/useAuth'
import { supabase }   from '@/lib/supabase/client'
import {
  createInvitation,
  getHotelMembers,
  getPendingInvitations,
  deactivateHotelMember,
  type HotelMember,
  type Invitation,
  type InviteRole,
} from '@/services/invitations.service'
import { getRoleLabel, getRoleBadgeClass, getRoleLevel } from '@/lib/roles'

const MAX_USERS = 4

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  return `Hace ${days} días`
}

function expiresIn(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const days = Math.ceil(diff / 86_400_000)
  if (days <= 0)  return 'Expirada'
  if (days === 1) return 'Expira mañana'
  return `Expira en ${days} días`
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AdminUsuariosPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const router = useRouter()

  const [hotelId,   setHotelId]   = useState('')
  const [hotelName, setHotelName] = useState('')
  const [members,   setMembers]   = useState<HotelMember[]>([])
  const [pending,   setPending]   = useState<Invitation[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  // Modal invitación
  const [showModal,  setShowModal]  = useState(false)
  const [invEmail,   setInvEmail]   = useState('')
  const [invRole,    setInvRole]    = useState<InviteRole>('standard')
  const [inviting,   setInviting]   = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [invError,   setInvError]   = useState<string | null>(null)

  // Confirmación desactivar
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null)

  // ── Redirigir si no es admin ───────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && profile && getRoleLevel(profile.role) !== 'admin') {
      router.push('/home?open=1')
    }
  }, [authLoading, profile, router])

  // ── Cargar hotel ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    supabase
      .from('hotels')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at')
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) { setHotelId(data.id); setHotelName(data.name) }
      })
  }, [user])

  // ── Cargar miembros e invitaciones ────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!hotelId) return
    setLoading(true)
    setError(null)
    try {
      const [m, p] = await Promise.all([
        getHotelMembers(hotelId),
        getPendingInvitations(hotelId),
      ])
      setMembers(m)
      setPending(p)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }, [hotelId])

  useEffect(() => { loadData() }, [loadData])

  // ── Enviar invitación ─────────────────────────────────────────────────────
  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !hotelId) return
    const total = members.filter(m => m.active).length + pending.length
    if (total >= MAX_USERS) {
      setInvError(`Límite de ${MAX_USERS} usuarios alcanzado`)
      return
    }
    setInviting(true)
    setInvError(null)
    try {
      const inv = await createInvitation(hotelId, invEmail, invRole, user.id)
      const link = `${window.location.origin}/invite/${inv.token}`
      setInviteLink(link)
    } catch (err) {
      setInvError(err instanceof Error ? err.message : 'Error al crear invitación')
    } finally {
      setInviting(false)
    }
  }

  // ── Desactivar miembro ────────────────────────────────────────────────────
  async function handleDeactivate(memberId: string) {
    if (!hotelId) return
    try {
      await deactivateHotelMember(memberId, hotelId)
      setConfirmDeactivate(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al desactivar')
    }
  }

  // ── Guards ────────────────────────────────────────────────────────────────
  if (authLoading || !profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
      </div>
    )
  }
  if (getRoleLevel(profile.role) !== 'admin') return null

  const activeCount = members.filter(m => m.active).length
  const remaining   = MAX_USERS - activeCount - pending.length
  const canInvite   = remaining > 0

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Usuarios <span className="text-amber-400">del Hotel</span>
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">{hotelName}</p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3">
          <p className="text-red-400 text-sm">⚠ {error}</p>
        </div>
      )}

      {/* Contador + botón invitar */}
      <div className="flex items-center justify-between gap-4 bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
        <div>
          <p className="text-white font-semibold text-lg">
            {activeCount} <span className="text-gray-500 font-normal">de</span> {MAX_USERS} usuarios activos
          </p>
          {pending.length > 0 && (
            <p className="text-amber-400/70 text-xs mt-0.5">
              + {pending.length} invitación{pending.length > 1 ? 'es' : ''} pendiente{pending.length > 1 ? 's' : ''}
            </p>
          )}
          {!canInvite && (
            <p className="text-red-400 text-xs mt-0.5">Límite de {MAX_USERS} usuarios alcanzado</p>
          )}
        </div>
        <button
          onClick={() => { setShowModal(true); setInviteLink(''); setInvEmail(''); setInvError(null) }}
          disabled={!canInvite}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
            canInvite
              ? 'bg-amber-400 text-gray-900 hover:bg-amber-300'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          + Invitar usuario
        </button>
      </div>

      {/* Lista de miembros */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-400" />
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h2 className="text-white font-semibold text-sm">Miembros activos</h2>
          </div>

          {members.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No hay miembros aún.</p>
          ) : (
            <div className="divide-y divide-gray-800/60">
              {members.map((m) => {
                const isMe    = m.user_id === user?.id
                const isAdmin = getRoleLevel(m.role) === 'admin'
                return (
                  <div key={m.user_id} className="flex items-center gap-4 px-5 py-3.5">
                    {/* Avatar inicial */}
                    <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                      <span className="text-gray-300 text-sm font-bold">
                        {(m.full_name ?? '?')[0].toUpperCase()}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-sm font-medium truncate">
                          {m.full_name ?? '—'}
                        </span>
                        {isMe && (
                          <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded-full">
                            Tú
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadgeClass(m.role)}`}>
                          {getRoleLabel(m.role)}
                        </span>
                        {!m.active && (
                          <span className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full">
                            Inactivo
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 text-xs mt-0.5">{timeAgo(m.created_at)}</p>
                    </div>

                    {/* Acciones */}
                    {!isMe && !isAdmin && m.active && (
                      confirmDeactivate === m.user_id ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-gray-400">¿Confirmar?</span>
                          <button
                            onClick={() => handleDeactivate(m.user_id)}
                            className="text-xs text-red-400 hover:text-red-300 font-semibold transition"
                          >
                            Sí, desactivar
                          </button>
                          <button
                            onClick={() => setConfirmDeactivate(null)}
                            className="text-xs text-gray-500 hover:text-gray-300 transition"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeactivate(m.user_id)}
                          className="shrink-0 text-xs text-gray-600 hover:text-red-400 transition"
                        >
                          Desactivar
                        </button>
                      )
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Invitaciones pendientes */}
      {pending.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h2 className="text-white font-semibold text-sm">Invitaciones pendientes</h2>
          </div>
          <div className="divide-y divide-gray-800/60">
            {pending.map((inv) => (
              <div key={inv.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-9 h-9 rounded-full bg-amber-400/10 flex items-center justify-center shrink-0">
                  <span className="text-amber-400 text-sm">✉</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-gray-300 text-sm truncate">{inv.email}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadgeClass(inv.role)}`}>
                      {getRoleLabel(inv.role)}
                    </span>
                  </div>
                  <p className="text-gray-600 text-xs mt-0.5">{expiresIn(inv.expires_at)}</p>
                </div>
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/invite/${inv.token}`
                    navigator.clipboard.writeText(link).catch(() => {})
                    alert('¡Link copiado!')
                  }}
                  className="shrink-0 text-xs text-amber-400 hover:text-amber-300 transition"
                >
                  Copiar link
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leyenda de roles */}
      <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl px-5 py-4 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Permisos por rol</p>
        {[
          { role: 'admin',    items: 'Acceso total + gestión de usuarios' },
          { role: 'premium',  items: 'Dashboard · Pedidos · Despachos · Descargos · Presupuesto · Proyección' },
          { role: 'standard', items: 'Pedidos · Despachos · Descargos' },
        ].map(({ role, items }) => (
          <div key={role} className="flex items-start gap-3">
            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${getRoleBadgeClass(role)}`}>
              {getRoleLabel(role)}
            </span>
            <span className="text-xs text-gray-500">{items}</span>
          </div>
        ))}
      </div>

      {/* ── Modal Invitación ─────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => { setShowModal(false); setInviteLink('') }}
          />
          <div
            className="relative w-full max-w-md rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(10,16,36,0.98)',
              border:     '1px solid rgba(212,160,23,0.25)',
              boxShadow:  '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header modal */}
            <div className="px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold">Invitar usuario</h3>
                <button
                  onClick={() => { setShowModal(false); setInviteLink('') }}
                  className="text-gray-600 hover:text-gray-400 transition"
                >
                  ✕
                </button>
              </div>
              <p className="text-gray-500 text-xs mt-1">
                Quedan {remaining} lugar{remaining !== 1 ? 'es' : ''} disponible{remaining !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="px-6 py-5 space-y-4">

              {/* Si ya se generó el link */}
              {inviteLink ? (
                <div className="space-y-4">
                  <div className="bg-green-900/30 border border-green-700/50 rounded-xl px-4 py-3">
                    <p className="text-green-400 text-sm font-semibold mb-1">✓ Invitación creada</p>
                    <p className="text-gray-400 text-xs">
                      Comparte este link con <strong className="text-white">{invEmail}</strong>:
                    </p>
                  </div>

                  <div className="bg-gray-800 rounded-xl px-3 py-2.5 flex items-center gap-2">
                    <p className="text-gray-300 text-xs truncate flex-1 font-mono">{inviteLink}</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(inviteLink).catch(() => {})
                        alert('¡Link copiado al portapapeles!')
                      }}
                      className="shrink-0 text-xs text-amber-400 hover:text-amber-300 font-semibold transition px-2 py-1 rounded-lg bg-amber-400/10"
                    >
                      Copiar
                    </button>
                  </div>

                  <p className="text-gray-600 text-xs text-center">
                    El link expira en 7 días. El usuario debe registrarse para activar su acceso.
                  </p>

                  <button
                    onClick={() => {
                      setShowModal(false)
                      setInviteLink('')
                      loadData()
                    }}
                    className="w-full py-2.5 rounded-xl bg-amber-400 text-gray-900 text-sm font-semibold hover:bg-amber-300 transition"
                  >
                    Listo
                  </button>
                </div>
              ) : (
                /* Formulario */
                <form onSubmit={handleInvite} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Correo electrónico
                    </label>
                    <input
                      type="email"
                      required
                      value={invEmail}
                      onChange={(e) => setInvEmail(e.target.value)}
                      placeholder="chef@hotel.com"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5
                                 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Rol</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['standard', 'premium'] as InviteRole[]).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setInvRole(r)}
                          className={`px-4 py-3 rounded-xl border text-sm font-semibold transition text-left ${
                            invRole === r
                              ? r === 'premium'
                                ? 'border-violet-500/60 bg-violet-500/10 text-violet-300'
                                : 'border-blue-500/60 bg-blue-500/10 text-blue-300'
                              : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500'
                          }`}
                        >
                          <span className="block font-bold">{getRoleLabel(r)}</span>
                          <span className="text-xs font-normal opacity-70">
                            {r === 'premium' ? 'Acceso completo' : 'Pedidos y despachos'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {invError && (
                    <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-2">
                      <p className="text-red-400 text-xs">{invError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={inviting || !invEmail}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition ${
                      inviting || !invEmail
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-amber-400 text-gray-900 hover:bg-amber-300'
                    }`}
                  >
                    {inviting ? 'Generando link…' : 'Generar link de invitación'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
