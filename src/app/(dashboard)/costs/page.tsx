'use client'

export const dynamic = 'force-dynamic'

/**
 * CHEF FINANCIERO — Pedidos Diarios
 *
 * Flujo:
 *   1. El usuario ingresa el PAX del día UNA SOLA VEZ (arriba).
 *      Se guarda en occupancy_daily y alimenta el presupuesto de todos los restaurantes.
 *   2. Por cada restaurante ingresa Víveres / Nevera / Extras y guarda.
 *   3. Al final se muestra un resumen de carnicos y vegetales ya despachados
 *      (datos de /dispatches — sólo lectura).
 *
 * KPIs superiores: ALM | CARNICOS | VEGETALES | TOTAL COCINA (RD$ + USD + RD$/PAX)
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase }          from '@/lib/supabase/client'
import { useAuth }           from '@/hooks/useAuth'
import { upsertFoodOrder, getOccupancy, upsertOccupancy } from '@/services/costs.service'
import { DG_EXCHANGE_RATE }  from '@/lib/constants'
import { getExchangeRate } from '@/services/hotelConfig.service'
import { useHotelId } from '@/hooks/useHotelId'
import type { Restaurant, DailyFoodOrderInsert } from '@/types/database.types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}
function fmtDec(n: number, dec = 2) {
  return new Intl.NumberFormat('es-DO', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n)
}
function fmtUSD(rd: number, rate: number) {
  if (rate <= 0) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(rd / rate)
}
function todayStr() { return new Date().toISOString().split('T')[0] }

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface RowState {
  budgetPax: string
  viveres:   string
  nevera:    string
  extras:    string
  notes:     string
  dirty:     boolean
  saving:    boolean
  saved:     boolean
  error:     string | null
}

function emptyRow(budgetPax: number | null): RowState {
  return {
    budgetPax: budgetPax != null ? String(budgetPax) : '',
    viveres: '', nevera: '', extras: '', notes: '',
    dirty: false, saving: false, saved: false, error: null,
  }
}

function rowFromOrder(
  order: { budget_rd_pax: number | null; viveres_rd: number; nevera_rd: number; extras_rd: number; notes: string | null },
  fallbackBudget: number | null
): RowState {
  return {
    budgetPax: order.budget_rd_pax != null
      ? String(order.budget_rd_pax)
      : fallbackBudget != null ? String(fallbackBudget) : '',
    viveres: String(order.viveres_rd),
    nevera:  String(order.nevera_rd),
    extras:  String(order.extras_rd),
    notes:   order.notes ?? '',
    dirty: false, saving: false, saved: true, error: null,
  }
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CostsPage() {
  const { user, profile, loading: authLoading } = useAuth()

  const [date,        setDate]        = useState(todayStr())
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])

  // PAX global
  const [globalPax,  setGlobalPax]  = useState('')
  const [paxSaving,  setPaxSaving]  = useState(false)
  const [paxSaved,   setPaxSaved]   = useState(false)

  // Tasa de cambio (editable, default = tasa DG)
  const [exchangeRate, setExchangeRate] = useState(DG_EXCHANGE_RATE)
  const { hotelId } = useHotelId()
  useEffect(() => {
    if (!hotelId) return
    const now = new Date()
    getExchangeRate(hotelId, now.getFullYear(), now.getMonth() + 1).then(rate => { if (rate) setExchangeRate(rate) })
  }, [hotelId])

  // ALM rows
  const [rows, setRows] = useState<Record<string, RowState>>({})

  const userId  = user?.id ?? ''

  // Estado de carga
  const [loading,    setLoading]    = useState(true)
  const [dayLoading, setDayLoading] = useState(false)
  const [pageError,  setPageError]  = useState<string | null>(null)

  // ── Restaurantes ────────────────────────────────────────────────────────────
  useEffect(() => {
    // Esperar a que termine la carga de auth
    if (authLoading) return

    // Si el perfil no tiene hotel_id, no hay datos que cargar
    if (!hotelId) {
      setLoading(false)
      return
    }

    supabase
      .from('restaurants')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => {
        setRestaurants((data ?? []) as Restaurant[])
        setLoading(false)
      })
  }, [hotelId, authLoading])

  // ── 3. Cargar datos del día ──────────────────────────────────────────────────
  const loadDay = useCallback(async () => {
    if (!hotelId || restaurants.length === 0) return
    setDayLoading(true)
    setPageError(null)
    setPaxSaved(false)

    const restIds       = restaurants.map((r) => r.id)
    const [year, month] = date.split('-').map(Number)

    try {
      const [occRes, ordersRes, budgetsRes] = await Promise.all([
        getOccupancy(hotelId, date),
        supabase
          .from('daily_food_orders_view')
          .select('restaurant_id, budget_rd_pax, viveres_rd, nevera_rd, extras_rd, notes, pax')
          .eq('date', date)
          .in('restaurant_id', restIds),
        supabase
          .from('budget_restaurants')
          .select('restaurant_id, budget_rd_pax')
          .in('restaurant_id', restIds)
          .eq('year', year)
          .eq('month', month),
      ])

      if (ordersRes.error)  throw ordersRes.error
      if (budgetsRes.error) throw budgetsRes.error

      setGlobalPax(occRes?.pax != null ? String(occRes.pax) : '')

      // Mapa presupuestos
      const budgetMap: Record<string, number | null> = {}
      ;(budgetsRes.data ?? []).forEach((b: { restaurant_id: string; budget_rd_pax: number | null }) => {
        budgetMap[b.restaurant_id] = b.budget_rd_pax
      })

      // Mapa pedidos ALM
      const orderMap: Record<string, {
        budget_rd_pax: number | null; viveres_rd: number; nevera_rd: number; extras_rd: number; notes: string | null
      }> = {}
      ;(ordersRes.data ?? []).forEach((o: typeof orderMap[string] & { restaurant_id: string }) => {
        orderMap[o.restaurant_id] = o
      })

      const newRows: Record<string, RowState> = {}
      restaurants.forEach((r) => {
        const order = orderMap[r.id]
        const bud   = budgetMap[r.id] ?? null
        newRows[r.id] = order ? rowFromOrder(order, bud) : emptyRow(bud)
      })
      setRows(newRows)

    } catch (err: unknown) {
      setPageError(err instanceof Error ? err.message : 'Error cargando datos')
    } finally {
      setDayLoading(false)
    }
  }, [hotelId, date, restaurants])

  useEffect(() => { loadDay() }, [loadDay])

  // ── Guardar PAX ─────────────────────────────────────────────────────────────
  async function savePax() {
    if (!hotelId || !userId) return
    const paxNum = parseInt(globalPax, 10)
    if (isNaN(paxNum) || paxNum <= 0) return
    setPaxSaving(true)
    try {
      await upsertOccupancy({
        user_id: userId, hotel_id: hotelId, date,
        pax: paxNum, status: null, a_la_carte_usd: 0, notes: null,
      })
      setPaxSaved(true)
    } catch (err: unknown) {
      setPageError(err instanceof Error ? err.message : 'Error guardando PAX')
    } finally {
      setPaxSaving(false)
    }
  }

  // ── Actualizar fila ─────────────────────────────────────────────────────────
  function updateRow(
    id: string,
    field: keyof Pick<RowState, 'budgetPax' | 'viveres' | 'nevera' | 'extras' | 'notes'>,
    value: string
  ) {
    setRows((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value, dirty: true, saved: false },
    }))
  }

  // ── Guardar fila ────────────────────────────────────────────────────────────
  async function saveRow(restId: string) {
    const row = rows[restId]
    if (!row || !userId) return
    setRows((prev) => ({ ...prev, [restId]: { ...prev[restId], saving: true, error: null } }))
    try {
      const paxNum = parseInt(globalPax, 10) || null
      const order: DailyFoodOrderInsert = {
        user_id: userId, restaurant_id: restId, date,
        pax:           paxNum,
        budget_rd_pax: row.budgetPax ? Number(row.budgetPax) : null,
        viveres_rd:    Number(row.viveres) || 0,
        nevera_rd:     Number(row.nevera)  || 0,
        extras_rd:     Number(row.extras)  || 0,
        notes:         row.notes || null,
      }
      await upsertFoodOrder(order)
      setRows((prev) => ({
        ...prev,
        [restId]: { ...prev[restId], saving: false, saved: true, dirty: false },
      }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar'
      setRows((prev) => ({ ...prev, [restId]: { ...prev[restId], saving: false, error: msg } }))
    }
  }

  // ── Cálculos ────────────────────────────────────────────────────────────────
  const paxNum      = parseInt(globalPax, 10) || 0
  const totalALM    = Object.values(rows).reduce(
    (s, r) => s + (Number(r.viveres) || 0) + (Number(r.nevera) || 0) + (Number(r.extras) || 0), 0,
  )
  const totalPpto   = Object.values(rows).reduce((s, r) => s + paxNum * (Number(r.budgetPax) || 0), 0)
  const rdPax       = paxNum > 0 ? totalALM / paxNum : 0
  const varianzaALM = totalALM - totalPpto
  const execPct     = totalPpto > 0 ? (totalALM / totalPpto) * 100 : 0

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
      </div>
    )
  }

  if (!hotelId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 px-4">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">🏨</p>
          <h2 className="text-white font-semibold text-lg mb-2">Sin hotel asignado</h2>
          <p className="text-gray-400 text-sm">
            Tu cuenta no está vinculada a ningún hotel. Contacta al administrador
            para que configure tu acceso.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* ── Encabezado ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Pedidos <span className="text-amber-400">Diarios</span>
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">Pedidos de almacén por área de cocina</p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => { setDate(e.target.value); setPaxSaved(false) }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm
                     focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      {/* ── PAX global + Tasa ───────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-amber-500/30 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          {/* PAX */}
          <div className="flex-1">
            <label className="block text-sm font-semibold text-amber-400 mb-1">
              👥 Ocupación del día (PAX)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Total de huéspedes. Alimenta el presupuesto de todos los restaurantes.
            </p>
            <input
              type="number"
              min="0"
              step="1"
              value={globalPax}
              onChange={(e) => { setGlobalPax(e.target.value); setPaxSaved(false) }}
              onKeyDown={(e) => e.key === 'Enter' && savePax()}
              placeholder="Ej: 1250"
              className="w-full max-w-xs bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5
                         text-white text-lg font-bold focus:outline-none focus:ring-2
                         focus:ring-amber-400 tabular-nums"
            />
          </div>

          {/* Tasa de cambio */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Tasa RD$/USD</label>
            <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
              <span className="text-gray-500 text-xs">RD$</span>
              <input
                type="number"
                min="1"
                step="0.01"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(parseFloat(e.target.value) || DG_EXCHANGE_RATE)}
                className="w-20 bg-transparent text-white text-sm tabular-nums text-right
                           focus:outline-none"
              />
              <span className="text-gray-500 text-xs">/ USD</span>
            </div>
          </div>

          {/* Botón guardar PAX */}
          <div className="flex items-center gap-3">
            {paxSaved && <span className="text-green-400 text-sm">✓ PAX guardado</span>}
            <button
              onClick={savePax}
              disabled={paxSaving || !globalPax}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition ${
                paxSaving || !globalPax
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-amber-400 text-gray-900 hover:bg-amber-300'
              }`}
            >
              {paxSaving ? 'Guardando…' : 'Guardar PAX'}
            </button>
          </div>
        </div>

        {paxNum > 0 && totalPpto > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-800 flex flex-wrap gap-4 text-xs text-gray-500">
            <span>PAX: <strong className="text-white">{fmt(paxNum)}</strong></span>
            <span>Presupuesto ALM: <strong className="text-amber-400">RD$ {fmt(totalPpto)}</strong></span>
          </div>
        )}
      </div>

      {pageError && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3">
          <p className="text-red-400 text-sm">⚠ {pageError}</p>
        </div>
      )}

      {/* ── KPIs: ALM ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">

        {/* ALM Total */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">🏪 Total Almacén</p>
          <p className="text-white font-bold text-xl tabular-nums">RD$ {fmt(totalALM)}</p>
          <p className="text-xs text-gray-600 tabular-nums mt-0.5">{fmtUSD(totalALM, exchangeRate)}</p>
          {totalPpto > 0 && (
            <p className={`text-xs mt-1 tabular-nums font-medium ${
              execPct <= 95 ? 'text-green-400' : execPct <= 105 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {execPct.toFixed(1)}% ppto · {varianzaALM > 0 ? '+' : ''}{fmt(varianzaALM)} var
            </p>
          )}
        </div>

        {/* Presupuesto ALM */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">📋 Presupuesto ALM</p>
          <p className="text-blue-300 font-bold text-xl tabular-nums">
            {totalPpto > 0 ? `RD$ ${fmt(totalPpto)}` : <span className="text-gray-600">Sin configurar</span>}
          </p>
          {paxNum > 0 && totalPpto > 0 && (
            <p className="text-xs text-gray-600 tabular-nums mt-0.5">
              {fmt(paxNum)} PAX
            </p>
          )}
        </div>

        {/* RD$/PAX */}
        <div className={`rounded-xl px-4 py-3 border ${
          execPct <= 95  ? 'bg-green-900/20 border-green-600/40'
          : execPct <= 105 ? 'bg-amber-900/20 border-amber-600/40'
          : execPct > 0    ? 'bg-red-900/20 border-red-600/40'
          : 'bg-gray-900 border-gray-800'
        }`}>
          <p className="text-xs text-gray-500 mb-1">💰 RD$/PAX hoy</p>
          <p className={`font-bold text-xl tabular-nums ${
            execPct <= 95  ? 'text-green-400'
            : execPct <= 105 ? 'text-amber-400'
            : execPct > 0    ? 'text-red-400'
            : 'text-gray-400'
          }`}>
            {paxNum > 0 ? fmtDec(rdPax) : '—'}
          </p>
          {paxNum > 0 && (
            <p className="text-xs text-gray-600 tabular-nums mt-0.5">
              {fmtUSD(totalALM, exchangeRate)} USD
            </p>
          )}
        </div>
      </div>

      {/* ══ SECCIÓN: Pedidos de Almacén ═════════════════════════════════════ */}
      <div>
        <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
          <span className="text-amber-400">🏪</span> Almacén
          <span className="text-xs text-gray-500 font-normal">(Víveres · Nevera · Extras)</span>
        </h2>

        {dayLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-400" />
          </div>
        ) : restaurants.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No hay restaurantes configurados.</div>
        ) : (
          <div className="space-y-3">
            {restaurants.map((rest) => {
              const row = rows[rest.id]
              if (!row) return null

              const rowTotal  = (Number(row.viveres) || 0) + (Number(row.nevera) || 0) + (Number(row.extras) || 0)
              const rowBudget = paxNum * (Number(row.budgetPax) || 0)
              const rowVar    = rowTotal - rowBudget
              const rowPct    = rowBudget > 0 ? (rowTotal / rowBudget) * 100 : 0
              const statusColor =
                rowPct === 0    ? 'text-gray-500'
                : rowPct <= 95  ? 'text-green-400'
                : rowPct <= 105 ? 'text-yellow-400'
                : 'text-red-400'

              return (
                <div key={rest.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800/60">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-white font-medium text-sm truncate">{rest.name}</span>
                      {row.saved && !row.dirty && (
                        <span className="shrink-0 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                          ✓ guardado
                        </span>
                      )}
                      {row.dirty && (
                        <span className="shrink-0 text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                          pendiente
                        </span>
                      )}
                    </div>
                    {rowTotal > 0 && (
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-white text-xs font-semibold tabular-nums">
                          RD$ {fmt(rowTotal)}
                        </span>
                        {rowBudget > 0 && (
                          <span className={`text-xs font-bold ${statusColor}`}>
                            {rowPct.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="px-5 py-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Ppto RD$/PAX</label>
                        <input
                          type="number"
                          value={row.budgetPax}
                          onChange={(e) => updateRow(rest.id, 'budgetPax', e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                                     text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 tabular-nums"
                        />
                        {paxNum > 0 && row.budgetPax && (
                          <p className="text-xs text-gray-600 mt-0.5 tabular-nums">
                            = RD$ {fmt(paxNum * (Number(row.budgetPax) || 0))}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Víveres RD$</label>
                        <input
                          type="number"
                          value={row.viveres}
                          onChange={(e) => updateRow(rest.id, 'viveres', e.target.value)}
                          placeholder="0"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                                     text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 tabular-nums"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Nevera RD$</label>
                        <input
                          type="number"
                          value={row.nevera}
                          onChange={(e) => updateRow(rest.id, 'nevera', e.target.value)}
                          placeholder="0"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                                     text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 tabular-nums"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Extras RD$</label>
                        <input
                          type="number"
                          value={row.extras}
                          onChange={(e) => updateRow(rest.id, 'extras', e.target.value)}
                          placeholder="0"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                                     text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 tabular-nums"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-transparent mb-1">·</label>
                        <button
                          onClick={() => saveRow(rest.id)}
                          disabled={row.saving}
                          className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition ${
                            row.saving
                              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                              : row.saved && !row.dirty
                              ? 'bg-green-900/30 border border-green-800 text-green-400 hover:bg-green-900/50'
                              : 'bg-amber-400 hover:bg-amber-300 text-gray-900'
                          }`}
                        >
                          {row.saving ? '…' : row.saved && !row.dirty ? '✓ OK' : 'Guardar'}
                        </button>
                      </div>
                    </div>

                    {row.error && <p className="mt-2 text-red-400 text-xs">{row.error}</p>}

                    {rowBudget > 0 && rowTotal > 0 && (
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              rowPct <= 95  ? 'bg-green-400'
                              : rowPct <= 105 ? 'bg-yellow-400'
                              : 'bg-red-400'
                            }`}
                            style={{ width: `${Math.min(rowPct, 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs tabular-nums shrink-0 ${rowVar <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {rowVar > 0 ? '+' : ''}{fmt(rowVar)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
