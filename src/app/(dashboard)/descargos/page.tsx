'use client'

export const dynamic = 'force-dynamic'

/**
 * CHEF FINANCIERO — Descargos Diarios
 *
 * Descargos = ingresos por clientes de otros hoteles que cenan en
 * nuestros restaurantes. Se restan del gasto ALM → Costo Neto.
 *
 * COSTO NETO = GASTO REAL ALM − DESCARGOS
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase }                          from '@/lib/supabase/client'
import { useHotelId }                        from '@/hooks/useHotelId'
import {
  getDescargosByDate,
  upsertDescargo,
  deleteDescargo,
} from '@/services/descargos.service'
import { DG_EXCHANGE_RATE } from '@/lib/constants'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().split('T')[0] }

function fmtRD(n: number) {
  return new Intl.NumberFormat('es-DO', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)
}

function fmtUSD(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)
}

function round2(n: number) { return Math.round(n * 100) / 100 }

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface RestaurantRow {
  restaurant_id:   string
  restaurant_name: string
  sort_order:      number
  alm_total_rd:    number    // gasto real del día (para distribución proporcional)
  amount_usd:      string    // input controlado como string
  notes:           string
  dirty:           boolean
  hasRecord:       boolean
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function DescargosPage() {
  const today = todayStr()

  // ── Estado base ───────────────────────────────────────────────────────────
  const [date,         setDate]         = useState(today)
  const [exchangeRate, setExchangeRate] = useState(DG_EXCHANGE_RATE)
  const { hotelId, hotelLoading } = useHotelId()
  const [userId,       setUserId]       = useState('')

  // ── Datos ─────────────────────────────────────────────────────────────────
  const [rows,         setRows]         = useState<RestaurantRow[]>([])
  const [loading,      setLoading]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [saveMsg,      setSaveMsg]      = useState<string | null>(null)

  // ── Panel distribución global ─────────────────────────────────────────────
  const [globalUSD,        setGlobalUSD]        = useState('')
  const [assignToRestId,   setAssignToRestId]   = useState('')
  const [distMode,         setDistMode]         = useState<'prop' | 'one' | null>(null)
  const [distributing,     setDistributing]     = useState(false)

  // ── Init usuario ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: authData }) => {
      if (authData?.user) setUserId(authData.user.id)
    })
  }, [])

  // ── Cargar restaurantes + descargos + gasto real del día ──────────────────
  const loadData = useCallback(async () => {
    if (!hotelId) return
    setLoading(true)
    setError(null)
    setSaveMsg(null)

    try {
      // Restaurantes activos
      const { data: rests, error: rErr } = await supabase
        .from('restaurants')
        .select('id, name, sort_order')
        .eq('hotel_id', hotelId)
        .eq('active', true)
        .order('sort_order')
      if (rErr) throw rErr

      // Descargos ya guardados para la fecha
      const existing = await getDescargosByDate(hotelId, date)
      const byRest = Object.fromEntries(existing.map((d) => [d.restaurant_id, d]))

      // Gasto real ALM del día (para distribución proporcional)
      const { data: almData } = await supabase
        .from('daily_cost_consolidated')
        .select('restaurant_id, alm_total_rd')
        .eq('hotel_id', hotelId)
        .eq('date', date)
      const almByRest = Object.fromEntries(
        (almData ?? []).map((r: { restaurant_id: string; alm_total_rd: number }) =>
          [r.restaurant_id, r.alm_total_rd ?? 0]
        )
      )

      setRows(
        (rests ?? []).map((r: { id: string; name: string; sort_order: number }) => {
          const ex = byRest[r.id]
          return {
            restaurant_id:   r.id,
            restaurant_name: r.name,
            sort_order:      r.sort_order,
            alm_total_rd:    almByRest[r.id] ?? 0,
            amount_usd:      ex ? String(ex.amount_usd) : '',
            notes:           ex?.notes ?? '',
            dirty:           false,
            hasRecord:       !!ex,
          }
        })
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }, [hotelId, date])

  useEffect(() => { loadData() }, [loadData])

  // ── Editar fila individual ────────────────────────────────────────────────
  function handleUSD(restaurantId: string, value: string) {
    setRows((prev) => prev.map((r) =>
      r.restaurant_id === restaurantId ? { ...r, amount_usd: value, dirty: true } : r
    ))
  }

  function handleNotes(restaurantId: string, value: string) {
    setRows((prev) => prev.map((r) =>
      r.restaurant_id === restaurantId ? { ...r, notes: value, dirty: true } : r
    ))
  }

  // ── Distribuir proporcionalmente ──────────────────────────────────────────
  function distribuirProporcional() {
    const total = parseFloat(globalUSD) || 0
    if (total <= 0) return
    setDistributing(true)

    const totalAlm = rows.reduce((s, r) => s + r.alm_total_rd, 0)

    // Si no hay datos de gasto real, distribuir en partes iguales
    const useEqual = totalAlm <= 0

    let remainder = total
    const newRows = rows.map((r, i) => {
      const isLast = i === rows.length - 1
      let amount: number

      if (useEqual) {
        amount = isLast ? round2(remainder) : round2(total / rows.length)
      } else {
        const pct = r.alm_total_rd / totalAlm
        amount = isLast ? round2(remainder) : round2(total * pct)
      }

      remainder = round2(remainder - (isLast ? 0 : amount))

      return {
        ...r,
        amount_usd: amount > 0 ? amount.toFixed(2) : '',
        dirty:      true,
      }
    })

    setRows(newRows)
    setDistMode('prop')
    setDistributing(false)
  }

  // ── Asignar todo a un restaurante ─────────────────────────────────────────
  function asignarATodo() {
    const total = parseFloat(globalUSD) || 0
    if (!assignToRestId || total <= 0) return

    setRows((prev) => prev.map((r) => ({
      ...r,
      amount_usd: r.restaurant_id === assignToRestId ? total.toFixed(2) : '',
      dirty:      true,
    })))
    setDistMode('one')
  }

  // ── Guardar todo ──────────────────────────────────────────────────────────
  async function handleSave() {
    if (!hotelId || !userId) return
    setSaving(true)
    setError(null)
    setSaveMsg(null)

    try {
      const dirtyRows = rows.filter((r) => r.dirty)
      let saved = 0, deleted = 0

      for (const row of dirtyRows) {
        const usd = parseFloat(row.amount_usd) || 0
        if (usd <= 0) {
          if (row.hasRecord) { await deleteDescargo(row.restaurant_id, date); deleted++ }
        } else {
          await upsertDescargo({
            user_id:       userId,
            hotel_id:      hotelId,
            restaurant_id: row.restaurant_id,
            date,
            amount_usd:    usd,
            amount_rd:     round2(usd * exchangeRate),
            exchange_rate: exchangeRate,
            notes:         row.notes || null,
          })
          saved++
        }
      }

      setSaveMsg(
        saved > 0 || deleted > 0
          ? `✅ ${saved} descargo${saved !== 1 ? 's' : ''} guardado${saved !== 1 ? 's' : ''}${deleted > 0 ? `, ${deleted} eliminado${deleted !== 1 ? 's' : ''}` : ''}`
          : '✅ Sin cambios que guardar'
      )
      setGlobalUSD('')
      setDistMode(null)
      await loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const totalUSD  = rows.reduce((s, r) => s + (parseFloat(r.amount_usd) || 0), 0)
  const totalRD   = round2(totalUSD * exchangeRate)
  const hasDirty  = rows.some((r) => r.dirty)
  const globalRD  = round2((parseFloat(globalUSD) || 0) * exchangeRate)
  const totalAlm  = rows.reduce((s, r) => s + r.alm_total_rd, 0)
  const hasAlmData = totalAlm > 0

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (hotelLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">

      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Descargos <span className="text-amber-400">Diarios</span>
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Ingresos por clientes de otros hoteles — se restan del gasto real para obtener el costo neto
        </p>
      </div>

      {/* Fórmula */}
      <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl px-5 py-3 flex items-center gap-3">
        <span className="text-blue-400">ℹ</span>
        <p className="text-blue-200 text-sm">
          <strong>Costo Neto = Gasto Real ALM − Descargos</strong>
          <span className="text-blue-500 ml-2">· Los descargos se reflejan automáticamente en el Dashboard</span>
        </p>
      </div>

      {/* ── Controles de fecha y tasa ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="date" value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                     text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
          <span className="text-gray-400 text-xs whitespace-nowrap">RD$/USD</span>
          <input
            type="number" min="1" step="0.01" value={exchangeRate}
            onChange={(e) => setExchangeRate(parseFloat(e.target.value) || DG_EXCHANGE_RATE)}
            className="w-20 bg-transparent text-white text-sm text-right tabular-nums focus:outline-none"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={loadData} disabled={loading}
            className="text-gray-400 hover:text-white text-sm px-3 py-2
                       bg-gray-800 border border-gray-700 rounded-lg disabled:opacity-50 transition">
            ↻
          </button>
          <button onClick={handleSave} disabled={saving || !hasDirty}
            className="text-sm px-4 py-2 rounded-lg font-semibold transition
                       bg-amber-400 text-gray-900 hover:bg-amber-300
                       disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? 'Guardando…' : 'Guardar todo'}
          </button>
        </div>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3">
          <p className="text-red-400 text-sm">⚠ {error}</p>
        </div>
      )}
      {saveMsg && (
        <div className="bg-green-900/30 border border-green-700/40 rounded-xl px-4 py-3">
          <p className="text-green-400 text-sm">{saveMsg}</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PANEL: Descargo Total del Día
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">

        {/* Header del panel */}
        <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2"
             style={{ background: '#1a2436' }}>
          <span className="text-cyan-400">💵</span>
          <h3 className="text-white font-semibold text-sm">Descargo Total del Día</h3>
          <span className="text-gray-500 text-xs ml-1">— ingresa el total y distribúyelo automáticamente</span>
        </div>

        <div className="p-5 space-y-4">

          {/* Input total global */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Total:</span>
              <div className="flex items-center gap-1 bg-gray-800 border border-gray-600
                              rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-cyan-500">
                <span className="text-gray-400 text-sm font-bold">$</span>
                <input
                  type="number" min="0" step="0.01"
                  value={globalUSD}
                  onChange={(e) => { setGlobalUSD(e.target.value); setDistMode(null) }}
                  placeholder="0.00"
                  className="w-32 bg-transparent text-white text-lg font-bold text-right
                             tabular-nums focus:outline-none placeholder-gray-600"
                />
                <span className="text-gray-500 text-xs">USD</span>
              </div>
              {(parseFloat(globalUSD) || 0) > 0 && (
                <span className="text-cyan-300 text-sm font-semibold tabular-nums">
                  = RD$ {fmtRD(globalRD)}
                </span>
              )}
            </div>
          </div>

          {/* Botones de distribución */}
          <div className="flex flex-wrap items-start gap-3">

            {/* Distribuir proporcionalmente */}
            <div className="flex flex-col gap-1">
              <button
                onClick={distribuirProporcional}
                disabled={!globalUSD || (parseFloat(globalUSD) || 0) <= 0 || distributing || loading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition
                           bg-cyan-600 hover:bg-cyan-500 text-white
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>⚖</span>
                Distribuir automáticamente
              </button>
              <p className="text-xs text-gray-500 pl-1">
                {hasAlmData
                  ? 'Proporcional al gasto real ALM de cada área'
                  : 'Sin datos de gasto — distribuirá en partes iguales'}
              </p>
            </div>

            {/* Separador */}
            <div className="flex items-center self-stretch">
              <span className="text-gray-600 text-sm px-1">ó</span>
            </div>

            {/* Asignar todo a uno */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <select
                  value={assignToRestId}
                  onChange={(e) => setAssignToRestId(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5
                             text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400
                             min-w-44"
                >
                  <option value="">Seleccionar restaurante…</option>
                  {rows.map((r) => (
                    <option key={r.restaurant_id} value={r.restaurant_id}>
                      {r.restaurant_name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={asignarATodo}
                  disabled={!assignToRestId || !globalUSD || (parseFloat(globalUSD) || 0) <= 0}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition
                             bg-amber-600 hover:bg-amber-500 text-white
                             disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>→</span>
                  Asignar todo
                </button>
              </div>
              <p className="text-xs text-gray-500 pl-1">Asignar el 100% al restaurante seleccionado</p>
            </div>
          </div>

          {/* Indicador de distribución aplicada */}
          {distMode && (
            <div className="flex items-center gap-2 bg-cyan-900/20 border border-cyan-700/40
                            rounded-lg px-3 py-2">
              <span className="text-cyan-400 text-sm">✓</span>
              <p className="text-cyan-300 text-xs">
                {distMode === 'prop'
                  ? `Distribución proporcional aplicada${hasAlmData ? ' al gasto real del día' : ' en partes iguales'}. Revisa los valores y presiona "Guardar todo".`
                  : `Total asignado a ${rows.find(r => r.restaurant_id === assignToRestId)?.restaurant_name ?? ''}. Presiona "Guardar todo" para confirmar.`
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TABLA: Desglose por restaurante
      ══════════════════════════════════════════════════════════════════════ */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">

          <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-white font-medium text-sm">
              Desglose por restaurante — {date}
            </h3>
            <span className="text-xs text-gray-500">
              {rows.filter((r) => (parseFloat(r.amount_usd) || 0) > 0).length} de {rows.length} restaurantes con descargo
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: '#1a2436', borderBottom: '1px solid #374151' }}>
                  <th className="text-left   text-gray-400 font-medium px-5 py-3">Restaurante</th>
                  <th className="text-right  text-gray-500 font-medium px-4 py-3 whitespace-nowrap">
                    Gasto Real RD$
                  </th>
                  <th className="text-right  text-gray-400 font-medium px-4 py-3 w-36 whitespace-nowrap">
                    Descargo USD
                  </th>
                  <th className="text-right  text-gray-400 font-medium px-4 py-3 w-40 whitespace-nowrap">
                    Descargo RD$
                  </th>
                  <th className="text-left   text-gray-400 font-medium px-4 py-3">Notas</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-800/60">
                {rows.map((row) => {
                  const usd = parseFloat(row.amount_usd) || 0
                  const rd  = round2(usd * exchangeRate)
                  const pct = row.alm_total_rd > 0 ? (usd * exchangeRate / row.alm_total_rd) * 100 : 0
                  return (
                    <tr key={row.restaurant_id}
                        className={`transition ${row.dirty ? 'bg-amber-900/10' : 'hover:bg-gray-800/30'}`}>

                      {/* Nombre */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{row.restaurant_name}</span>
                          {row.hasRecord && !row.dirty && (
                            <span className="text-xs text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded-full">guardado</span>
                          )}
                          {row.dirty && (
                            <span className="text-xs text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">modificado</span>
                          )}
                        </div>
                      </td>

                      {/* Gasto real ALM (referencia) */}
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.alm_total_rd > 0 ? (
                          <span className="text-gray-400 text-xs">
                            {fmtRD(row.alm_total_rd)}
                            {usd > 0 && pct > 0 && (
                              <span className="text-cyan-600 ml-1">({pct.toFixed(1)}%)</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-700 text-xs">sin datos</span>
                        )}
                      </td>

                      {/* USD input */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-gray-500 text-xs">$</span>
                          <input
                            type="number" min="0" step="0.01"
                            value={row.amount_usd}
                            onChange={(e) => handleUSD(row.restaurant_id, e.target.value)}
                            placeholder="0.00"
                            className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5
                                       text-white text-sm text-right tabular-nums
                                       focus:outline-none focus:ring-2 focus:ring-amber-400
                                       placeholder-gray-600"
                          />
                        </div>
                      </td>

                      {/* RD$ calculado */}
                      <td className="px-4 py-3 text-right">
                        {usd > 0 ? (
                          <span className="text-cyan-300 font-semibold tabular-nums">
                            {fmtRD(rd)}
                          </span>
                        ) : (
                          <span className="text-gray-700">—</span>
                        )}
                      </td>

                      {/* Notas */}
                      <td className="px-4 py-3">
                        <input
                          type="text" value={row.notes}
                          onChange={(e) => handleNotes(row.restaurant_id, e.target.value)}
                          placeholder="Opcional…"
                          className="w-full bg-transparent border-b border-gray-700 px-0 py-1
                                     text-gray-400 text-sm focus:outline-none focus:border-amber-400
                                     placeholder-gray-700"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* ── Fila TOTAL (siempre visible) ───────────────────────────── */}
              <tfoot>
                <tr style={{ borderTop: '2px solid #374151', backgroundColor: '#172030' }}>
                  <td className="px-5 py-3 text-amber-400 font-bold text-xs uppercase tracking-wide">
                    TOTAL
                  </td>
                  {/* Total gasto real */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    {totalAlm > 0 ? (
                      <span className="text-gray-400 text-xs font-semibold">
                        RD$ {fmtRD(totalAlm)}
                      </span>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>
                  {/* Total USD */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    {totalUSD > 0 ? (
                      <span className="text-white font-bold">{fmtUSD(totalUSD)}</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  {/* Total RD$ */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    {totalUSD > 0 ? (
                      <span className="text-cyan-400 font-bold">RD$ {fmtRD(totalRD)}</span>
                    ) : (
                      <span className="text-gray-600">RD$ 0.00</span>
                    )}
                  </td>
                  <td>
                    {totalUSD > 0 && totalAlm > 0 && (
                      <span className="text-gray-500 text-xs px-4">
                        {((totalUSD * exchangeRate / totalAlm) * 100).toFixed(1)}% del gasto real
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>

            {rows.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No hay restaurantes configurados.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
