'use client'

export const dynamic = 'force-dynamic'

/**
 * CHEF FINANCIERO — Presupuesto por Restaurante
 *
 * Permite editar el RD$/PAX presupuestado directamente en la tabla,
 * guardar cambios y copiar valores del mes anterior.
 */

import { useState, useEffect } from 'react'
import { supabase }    from '@/lib/supabase/client'
import { useHotelId }  from '@/hooks/useHotelId'
import { DG_BUDGET_RD_PAX, DG_BUDGET_USD_PAX, DG_EXCHANGE_RATE } from '@/lib/constants'
import { getExchangeRate } from '@/services/hotelConfig.service'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface RestaurantBudget {
  id:            string
  name:          string
  sort_order:    number
  budget_rd_pax: number | null
  ref_pax:       number | null
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function BudgetPage() {
  const now = new Date()

  const [year,         setYear]         = useState(now.getFullYear())
  const [month,        setMonth]        = useState(now.getMonth() + 1)
  const { hotelId, hotelLoading } = useHotelId()
  const [userId,       setUserId]       = useState('')
  const [data,         setData]         = useState<RestaurantBudget[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [exchangeRate, setExchangeRate] = useState(DG_EXCHANGE_RATE)

  // ── Cargar tasa de cambio desde Supabase ──────────────────────────────────────
  useEffect(() => {
    if (!hotelId) return
    getExchangeRate(hotelId, year, month).then(rate => { if (rate) setExchangeRate(rate) })
  }, [hotelId, year, month])

  // Edición inline
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [dirtyIds,   setDirtyIds]   = useState<Set<string>>(new Set())
  const [saving,     setSaving]     = useState(false)
  const [saveMsg,    setSaveMsg]    = useState<string | null>(null)
  const [loadingPrev, setLoadingPrev] = useState(false)

  // ── Obtener usuario actual ────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: authData }) => {
      if (authData?.user) setUserId(authData.user.id)
      else                setLoading(false)
    })
  }, [])

  // ── Cargar presupuestos cuando cambia hotel / mes / año ───────────────────────
  useEffect(() => {
    if (!hotelId) return
    setLoading(true)
    setError(null)
    setSaveMsg(null)

    async function load() {
      try {
        type RestRow   = { id: string; name: string; sort_order: number }
        type BudgetRow = { restaurant_id: string; budget_rd_pax: number | null; reference_pax: number | null }

        const { data: restsRaw, error: restErr } = await supabase
          .from('restaurants')
          .select('id, name, sort_order')
          .eq('hotel_id', hotelId)
          .eq('active', true)
          .order('sort_order')

        if (restErr) throw restErr
        const restList = (restsRaw ?? []) as RestRow[]
        const restIds  = restList.map((r) => r.id)

        if (restIds.length === 0) { setData([]); setLoading(false); return }

        const { data: budgetsRaw, error: budErr } = await supabase
          .from('budget_restaurants')
          .select('restaurant_id, budget_rd_pax, reference_pax')
          .in('restaurant_id', restIds)
          .eq('year', year)
          .eq('month', month)

        if (budErr) throw budErr
        const budgets = (budgetsRaw ?? []) as BudgetRow[]
        const budMap: Record<string, BudgetRow> = {}
        budgets.forEach((b) => { budMap[b.restaurant_id] = b })

        const merged: RestaurantBudget[] = restList.map((r) => ({
          id:            r.id,
          name:          r.name,
          sort_order:    r.sort_order,
          budget_rd_pax: budMap[r.id]?.budget_rd_pax ?? null,
          ref_pax:       budMap[r.id]?.reference_pax  ?? null,
        }))

        setData(merged)

        // Inicializar campos editables
        const vals: Record<string, string> = {}
        merged.forEach((r) => {
          vals[r.id] = r.budget_rd_pax != null ? String(r.budget_rd_pax) : ''
        })
        setEditValues(vals)
        setDirtyIds(new Set())
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error cargando presupuestos'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [hotelId, year, month])

  // ── Actualizar campo individual ───────────────────────────────────────────────
  function updateBudget(id: string, val: string) {
    setEditValues((prev) => ({ ...prev, [id]: val }))
    setDirtyIds((prev) => new Set([...prev, id]))
    setSaveMsg(null)
  }

  // ── Guardar cambios ───────────────────────────────────────────────────────────
  async function saveChanges() {
    if (!userId || dirtyIds.size === 0) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const upserts = [...dirtyIds].map((id) => ({
        user_id:       userId,
        restaurant_id: id,
        year,
        month,
        budget_rd_pax: editValues[id] ? parseFloat(editValues[id]) : null,
      }))

      const { error: upErr } = await supabase
        .from('budget_restaurants')
        .upsert(upserts, { onConflict: 'restaurant_id,year,month' })

      if (upErr) throw upErr

      // Refrescar data display
      setData((prev) =>
        prev.map((r) => {
          if (!dirtyIds.has(r.id)) return r
          const val = editValues[r.id]
          return { ...r, budget_rd_pax: val ? parseFloat(val) : null }
        })
      )
      setDirtyIds(new Set())
      setSaveMsg(`✓ ${upserts.length} presupuesto(s) guardado(s) correctamente`)
    } catch (err: unknown) {
      setSaveMsg(`Error: ${err instanceof Error ? err.message : 'Error guardando'}`)
    } finally {
      setSaving(false)
    }
  }

  // ── Copiar mes anterior ───────────────────────────────────────────────────────
  async function copyPrevMonth() {
    const prevYear  = month === 1 ? year - 1 : year
    const prevMonth = month === 1 ? 12 : month - 1
    setLoadingPrev(true)
    setSaveMsg(null)
    try {
      const restIds = data.map((r) => r.id)
      const { data: prevBudgets, error } = await supabase
        .from('budget_restaurants')
        .select('restaurant_id, budget_rd_pax')
        .in('restaurant_id', restIds)
        .eq('year', prevYear)
        .eq('month', prevMonth)

      if (error) throw error

      const copied = (prevBudgets ?? []) as { restaurant_id: string; budget_rd_pax: number | null }[]
      if (copied.length === 0) {
        setSaveMsg(`No hay presupuesto configurado para ${MONTHS[prevMonth - 1]} ${prevYear}`)
        return
      }

      const newVals  = { ...editValues }
      const newDirty = new Set(dirtyIds)
      copied.forEach((b) => {
        if (b.budget_rd_pax != null) {
          newVals[b.restaurant_id]  = String(b.budget_rd_pax)
          newDirty.add(b.restaurant_id)
        }
      })
      setEditValues(newVals)
      setDirtyIds(newDirty)
      setSaveMsg(
        `${copied.length} valores de ${MONTHS[prevMonth - 1]} ${prevYear} cargados. Revisa y guarda.`
      )
    } catch (err: unknown) {
      setSaveMsg(`Error copiando: ${err instanceof Error ? err.message : 'Error'}`)
    } finally {
      setLoadingPrev(false)
    }
  }

  // ── Estadísticas ──────────────────────────────────────────────────────────────
  const withBudget   = data.filter((r) => editValues[r.id] && parseFloat(editValues[r.id]) > 0)
  const sumBudgetPax = withBudget.reduce((s, r) => s + (parseFloat(editValues[r.id]) || 0), 0)
  const avgBudgetPax = withBudget.length > 0 ? sumBudgetPax / withBudget.length : 0
  const maxBudgetPax = withBudget.length > 0
    ? Math.max(...withBudget.map((r) => parseFloat(editValues[r.id]) || 0))
    : 0

  // Semáforo: suma total distribuida vs presupuesto DG aprobado
  const dgBudget    = DG_BUDGET_RD_PAX
  const sumDiff     = sumBudgetPax - dgBudget          // positivo = excede DG
  const sumDiffPct  = dgBudget > 0 ? Math.abs(sumDiff / dgBudget) * 100 : 0
  const budgetSt    = sumBudgetPax === 0 ? 'none'
    : sumDiffPct <= 2  ? 'ok'
    : sumDiff > 0      ? 'over'
    : 'under'

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Presupuesto <span className="text-amber-400">por Restaurante</span>
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            RD$/PAX — {MONTHS[month - 1]} {year}
          </p>
        </div>

        {/* Selectores de período */}
        <div className="flex gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* ── Presupuesto DG Aprobado ─────────────────────────────────────────── */}
      <div className="bg-green-900/20 border border-green-600/40 rounded-xl px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-lg">✅</span>
            <span className="text-green-300 text-sm font-semibold uppercase tracking-wide">
              Presupuesto DG Aprobado
            </span>
          </div>
          <div className="flex flex-wrap gap-4 sm:ml-auto">
            <div className="text-center">
              <p className="text-xs text-gray-500">RD$/PAX</p>
              <p className="text-white font-bold text-xl tabular-nums">
                RD$ {DG_BUDGET_RD_PAX.toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">USD/PAX</p>
              <p className="text-green-300 font-bold text-xl tabular-nums">
                USD {DG_BUDGET_USD_PAX.toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Tasa ref.</p>
              <p className="text-gray-400 font-semibold text-sm tabular-nums">
                {exchangeRate.toFixed(2)} RD$/USD
              </p>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          Este es el presupuesto total de cocina (ALM + Carnicos + Vegetales) aprobado por Dirección General.
          Configura los presupuestos por restaurante para distribuir este total.
        </p>
      </div>

      {/* Barra de acciones */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={copyPrevMonth}
          disabled={loadingPrev || loading}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${
            loadingPrev || loading
              ? 'border-gray-700 text-gray-500 cursor-not-allowed bg-gray-800'
              : 'border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 bg-gray-800'
          }`}
        >
          {loadingPrev ? '…' : `⬆ Copiar ${MONTHS[month === 1 ? 11 : month - 2]} ${month === 1 ? year - 1 : year}`}
        </button>

        <button
          onClick={saveChanges}
          disabled={saving || dirtyIds.size === 0}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
            saving || dirtyIds.size === 0
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-amber-400 text-gray-900 hover:bg-amber-300'
          }`}
        >
          {saving ? 'Guardando…' : `💾 Guardar cambios${dirtyIds.size > 0 ? ` (${dirtyIds.size})` : ''}`}
        </button>

        {saveMsg && (
          <span className={`text-sm ${saveMsg.startsWith('Error') || saveMsg.startsWith('No hay') ? 'text-red-400' : 'text-green-400'}`}>
            {saveMsg}
          </span>
        )}
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500">Restaurantes</p>
          <p className="text-white font-bold text-xl">{data.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500">Con presupuesto</p>
          <p className="text-amber-400 font-bold text-xl">{withBudget.length}</p>
        </div>
        <div className={`rounded-xl px-4 py-3 border ${
          budgetSt === 'ok'    ? 'bg-green-900/20  border-green-600/40'
          : budgetSt === 'over'  ? 'bg-red-900/20    border-red-600/40'
          : budgetSt === 'under' ? 'bg-amber-900/20  border-amber-600/40'
          : 'bg-gray-900 border-gray-800'
        }`}>
          <p className="text-xs text-gray-500">Total distribuido</p>
          <p className={`font-bold text-xl tabular-nums ${
            budgetSt === 'ok'    ? 'text-green-400'
            : budgetSt === 'over'  ? 'text-red-400'
            : budgetSt === 'under' ? 'text-amber-400'
            : 'text-gray-500'
          }`}>
            {sumBudgetPax > 0 ? `RD$ ${fmt(sumBudgetPax)}` : '—'}
          </p>
          {sumBudgetPax > 0 && (
            <p className={`text-xs mt-0.5 tabular-nums ${
              budgetSt === 'ok'    ? 'text-green-600'
              : budgetSt === 'over'  ? 'text-red-500'
              : 'text-amber-600'
            }`}>
              {budgetSt === 'ok'
                ? `✓ Igual al DG (RD$ ${fmt(dgBudget)})`
                : budgetSt === 'over'
                ? `⚠ +RD$ ${fmt(sumDiff)} sobre DG`
                : `↓ −RD$ ${fmt(Math.abs(sumDiff))} bajo DG`}
            </p>
          )}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500">Cambios pendientes</p>
          <p className={`font-bold text-xl ${dirtyIds.size > 0 ? 'text-amber-400' : 'text-gray-600'}`}>
            {dirtyIds.size > 0 ? `${dirtyIds.size} sin guardar` : '—'}
          </p>
        </div>
      </div>

      {/* Tabla editable de presupuestos */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-400" />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          No hay restaurantes configurados.
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {/* Cabecera */}
          <div className="px-5 py-3 border-b border-gray-800 grid grid-cols-12 gap-2">
            <span className="col-span-5 text-xs text-gray-500 uppercase tracking-wider">Restaurante</span>
            <span className="col-span-4 text-xs text-gray-500 uppercase tracking-wider text-right">
              Ppto RD$/PAX
            </span>
            <span className="col-span-3 text-xs text-gray-500 uppercase tracking-wider text-right">
              PAX Ref.
            </span>
          </div>

          {/* Filas */}
          <div className="divide-y divide-gray-800/50">
            {data.map((r) => {
              const isDirty   = dirtyIds.has(r.id)
              const numVal    = parseFloat(editValues[r.id] ?? '') || 0
              const barPct    = maxBudgetPax > 0 && numVal > 0 ? (numVal / maxBudgetPax) * 100 : 0

              return (
                <div
                  key={r.id}
                  className={`px-5 py-3 grid grid-cols-12 gap-2 items-center transition ${
                    isDirty ? 'bg-amber-400/5' : 'hover:bg-gray-800/30'
                  }`}
                >
                  <div className="col-span-5 flex items-center gap-2 min-w-0">
                    <span className="text-gray-200 text-sm truncate">{r.name}</span>
                    {isDirty && (
                      <span className="shrink-0 text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">
                        editado
                      </span>
                    )}
                  </div>

                  <div className="col-span-4 flex flex-col items-end gap-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editValues[r.id] ?? ''}
                      onChange={(e) => updateBudget(r.id, e.target.value)}
                      placeholder="0.00"
                      className={`w-full text-right bg-gray-800 rounded-lg px-3 py-1.5 text-sm
                                  text-amber-400 font-semibold tabular-nums focus:outline-none
                                  focus:ring-1 focus:ring-amber-400 border transition ${
                                    isDirty ? 'border-amber-500/60' : 'border-gray-700'
                                  }`}
                    />
                    {barPct > 0 && (
                      <div className="w-full bg-gray-800 rounded-full h-1">
                        <div
                          className="bg-amber-400/50 h-1 rounded-full transition-all"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="col-span-3 text-right">
                    {r.ref_pax != null ? (
                      <span className="text-gray-400 text-sm tabular-nums">
                        {r.ref_pax.toLocaleString('es-DO')}
                      </span>
                    ) : (
                      <span className="text-gray-700 text-sm">—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pie */}
          <div className="px-5 py-3 border-t border-gray-800 grid grid-cols-12 gap-2 bg-gray-800/30">
            <span className="col-span-5 text-xs text-gray-500">
              {withBudget.length} de {data.length} con presupuesto
              {dirtyIds.size > 0 && (
                <span className="text-amber-400 ml-2">· {dirtyIds.size} cambio(s) pendiente(s)</span>
              )}
            </span>
            <span className={`col-span-4 text-right text-xs tabular-nums font-semibold ${
              budgetSt === 'ok'    ? 'text-green-500'
              : budgetSt === 'over'  ? 'text-red-500'
              : budgetSt === 'under' ? 'text-amber-500'
              : 'text-gray-500'
            }`}>
              {sumBudgetPax > 0 ? `Total: RD$ ${fmt(sumBudgetPax)}` : ''}
            </span>
            <span className="col-span-3" />
          </div>
        </div>
      )}

      <p className="text-center text-xs text-gray-600">
        Los cambios se aplican al mes seleccionado. Para otros meses, cambia el selector de período.
      </p>
    </div>
  )
}
