'use client'

export const dynamic = 'force-dynamic'

/**
 * CHEF FINANCIERO — Proyección de Cierre Mensual
 *
 * Herramienta interactiva: dado el gasto acumulado y la ocupación esperada
 * para los días restantes, calcula el tope máximo de RD$/PAX que el chef
 * debe respetar para cerrar el mes dentro del presupuesto aprobado.
 *
 * Fórmula:
 *   1. avgDailyDescargos  = descargos_acumulados / días_con_datos
 *   2. descargosEstimados = avgDailyDescargos × días_restantes
 *   3. presupuestoRestante = presupuesto_mes_completo − gasto_neto_acumulado
 *   4. margenBruto         = presupuestoRestante + descargosEstimados
 *   5. topeRD_PAX          = margenBruto / totalPAX_restante
 */

import { useState, useEffect, useMemo } from 'react'
import { supabase }            from '@/lib/supabase/client'
import { useHotelId }          from '@/hooks/useHotelId'
import {
  getPeriodStats,
  getConsolidatedMonthlyProjection,
  type PeriodSummary,
  type MonthlyProjectionRow,
} from '@/services/costs.service'
import { DG_BUDGET_RD_PAX, DG_EXCHANGE_RATE } from '@/lib/constants'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRD(n: number) {
  return new Intl.NumberFormat('es-DO', { maximumFractionDigits: 0 }).format(n)
}

function fmtRD2(n: number) {
  return new Intl.NumberFormat('es-DO', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)
}

function fmtM(n: number) {
  return (n / 1_000_000).toFixed(1) + 'M'
}

function fmtUSDVal(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n / DG_EXCHANGE_RATE)
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function firstOfMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const DAYS_ES   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS_ES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProyeccionPage() {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  const lastDay = new Date(year, month, 0).getDate()

  // ── Estado ────────────────────────────────────────────────────────────────
  const { hotelId } = useHotelId()
  const [ps,      setPs]      = useState<PeriodSummary | null>(null)
  const [monthly, setMonthly] = useState<MonthlyProjectionRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  // PAX por día (valor como string para el <input>)
  const [paxByDate, setPaxByDate] = useState<Record<string, string>>({})

  // Cargar datos del mes en curso
  useEffect(() => {
    if (!hotelId) return
    setLoading(true)
    setError(null)
    const from = firstOfMonthStr()
    const to   = todayStr()
    Promise.all([
      getPeriodStats(hotelId, from, to),
      getConsolidatedMonthlyProjection(hotelId, year, month, from, to),
    ])
      .then(([stats, mon]) => { setPs(stats); setMonthly(mon) })
      .catch(e => setError(e instanceof Error ? e.message : 'Error cargando datos'))
      .finally(() => setLoading(false))
  }, [hotelId, year, month])

  // Días pendientes = desde el día después del ÚLTIMO REGISTRO hasta fin de mes.
  // Puede incluir días entre el último registro y hoy si no se ingresaron aún.
  // Ejemplo: last_data=22, today=27, lastDay=31 → días 23-31 (9 días, no 4).
  const remainingDates = useMemo(() => {
    if (!monthly) return []
    const startDay = monthly.days_with_data + 1
    const dates: string[] = []
    for (let d = startDay; d <= lastDay; d++) {
      dates.push(
        `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      )
    }
    return dates
  }, [monthly, year, month, lastDay])

  // ── Cálculo ───────────────────────────────────────────────────────────────

  const totalRemainingPax = remainingDates.reduce(
    (s, d) => s + (parseInt(paxByDate[d] ?? '0') || 0),
    0
  )

  type CalcResult = {
    avgDailyDescargos:           number
    projectedRemainingDescargos: number
    remainingNetBudget:          number
    grossBudgetForRemaining:     number
    targetRdPerPax:              number
    gap:                         number  // actual - target (+= hay que recortar)
  }

  let calc: CalcResult | null = null

  if (ps && monthly && totalRemainingPax > 0 && monthly.days_with_data > 0) {
    const avgDailyDescargos           = monthly.descargos_rd / monthly.days_with_data
    const projectedRemainingDescargos = avgDailyDescargos * remainingDates.length
    const remainingNetBudget          = monthly.budget_total_rd - ps.net_total_rd
    const grossBudgetForRemaining     = remainingNetBudget + projectedRemainingDescargos
    const targetRdPerPax              = grossBudgetForRemaining > 0
      ? grossBudgetForRemaining / totalRemainingPax
      : 0
    const gap = ps.cost_per_pax_rd - targetRdPerPax

    calc = {
      avgDailyDescargos,
      projectedRemainingDescargos,
      remainingNetBudget,
      grossBudgetForRemaining,
      targetRdPerPax,
      gap,
    }
  }

  // Semáforo del tope calculado
  const semClass = !calc
    ? 'text-white'
    : calc.targetRdPerPax >= DG_BUDGET_RD_PAX * 0.85
    ? 'text-green-400'
    : calc.targetRdPerPax >= DG_BUDGET_RD_PAX * 0.6
    ? 'text-amber-400'
    : 'text-red-400'

  const semBorder = !calc
    ? 'border-gray-800 bg-gray-900'
    : calc.targetRdPerPax >= DG_BUDGET_RD_PAX * 0.85
    ? 'border-green-700/40 bg-green-900/10'
    : calc.targetRdPerPax >= DG_BUDGET_RD_PAX * 0.6
    ? 'border-amber-700/40 bg-amber-900/10'
    : 'border-red-700/40 bg-red-900/10'

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin h-10 w-10 border-b-2 border-amber-400 rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-bold text-white">
          📈 Proyección de Cierre Mensual
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {MONTHS_ES[month]} {year} — Calcula el tope diario RD$/PAX para cerrar dentro del presupuesto
        </p>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {ps && monthly && (
        <>
          {/* ── Situación actual ── */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
              Situación al {now.toLocaleDateString('es-DO', {
                weekday: 'long', day: 'numeric', month: 'long'
              })}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Días */}
              <div>
                <p className="text-xs text-gray-500 mb-1">Días con datos</p>
                <p className="text-xl font-bold text-white">
                  {monthly.days_with_data}
                  <span className="text-gray-600 text-sm font-normal"> / {monthly.days_in_month}</span>
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {remainingDates.length} día{remainingDates.length !== 1 ? 's' : ''} sin datos
                </p>
              </div>

              {/* Gasto neto */}
              <div>
                <p className="text-xs text-gray-500 mb-1">Gasto neto acumulado</p>
                <p className="text-xl font-bold text-white tabular-nums">
                  RD$ {fmtM(ps.net_total_rd)}
                </p>
                <p className="text-xs text-gray-500 tabular-nums">
                  {fmtUSDVal(ps.net_total_rd)}
                </p>
              </div>

              {/* RD$/PAX actual */}
              <div>
                <p className="text-xs text-gray-500 mb-1">RD$/PAX actual</p>
                <p className={`text-xl font-bold tabular-nums ${
                  ps.execution_pct <= 95  ? 'text-green-400' :
                  ps.execution_pct <= 105 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  RD$ {fmtRD2(ps.cost_per_pax_rd)}
                </p>
                <p className="text-xs text-gray-500">
                  ppto: RD$ {fmtRD2(DG_BUDGET_RD_PAX)}
                </p>
              </div>

              {/* Ejecución */}
              <div>
                <p className="text-xs text-gray-500 mb-1">Ejecución</p>
                <p className={`text-xl font-bold ${
                  ps.execution_pct <= 95  ? 'text-green-400' :
                  ps.execution_pct <= 105 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {ps.execution_pct.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500">del presupuesto</p>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Días transcurridos</span>
                <span>{monthly.days_with_data} / {monthly.days_in_month} días</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400/60 rounded-full transition-all"
                  style={{ width: `${(monthly.days_with_data / monthly.days_in_month) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* ── Input de PAX restante ── */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
              Ocupación esperada — días restantes
            </p>
            <p className="text-xs text-gray-600 mb-4">
              Ingresa el PAX previsto para cada día pendiente del mes
            </p>

            {remainingDates.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                No quedan días pendientes en el mes. ✓
              </p>
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {remainingDates.map((dateStr) => {
                    const d   = new Date(dateStr + 'T00:00:00')
                    const day = d.getDate()
                    const dow = DAYS_ES[d.getDay()]
                    return (
                      <div key={dateStr} className="flex flex-col items-center">
                        <label className="text-xs text-gray-500 mb-1">
                          {dow} {day}
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="PAX"
                          value={paxByDate[dateStr] ?? ''}
                          onChange={(e) =>
                            setPaxByDate(prev => ({ ...prev, [dateStr]: e.target.value }))
                          }
                          className="bg-gray-800 border border-gray-700 rounded-lg px-1 py-2
                                     text-white text-sm text-center w-full tabular-nums
                                     focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      </div>
                    )
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-gray-400">
                    Total PAX restante:{' '}
                    <span className="text-white font-bold tabular-nums">
                      {totalRemainingPax > 0 ? fmtRD(totalRemainingPax) : '—'}
                    </span>
                  </p>
                  {totalRemainingPax === 0 && (
                    <p className="text-xs text-gray-600">
                      Ingresa al menos un día para calcular el tope
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Resultado ── */}
          {calc && (
            <div className={`rounded-xl p-5 border ${semBorder}`}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-5">
                Tope para cerrar {MONTHS_ES[month]} en presupuesto
              </p>

              {/* Número grande */}
              <div className="text-center mb-6">
                <p className="text-xs text-gray-500 mb-1">
                  Máximo diario por PAX · días {(monthly?.days_with_data ?? 0) + 1}–{lastDay} ({remainingDates.length} días)
                </p>
                <p className={`text-6xl font-bold tabular-nums tracking-tight ${semClass}`}>
                  RD$ {fmtRD2(calc.targetRdPerPax)}
                </p>
                <p className="text-lg text-gray-400 mt-1 tabular-nums">
                  ≈ ${(calc.targetRdPerPax / DG_EXCHANGE_RATE).toFixed(2)} USD / PAX / día
                </p>

                {/* Mensaje */}
                <div className="mt-3">
                  {calc.gap > 5 ? (
                    <p className="text-sm text-red-400">
                      ⚠ Debes reducir <span className="font-bold">RD$ {fmtRD2(calc.gap)}/PAX</span> respecto a tu promedio actual
                    </p>
                  ) : calc.gap < -5 ? (
                    <p className="text-sm text-green-400">
                      ✓ Tienes margen de <span className="font-bold">RD$ {fmtRD2(Math.abs(calc.gap))}/PAX</span> sobre tu promedio actual
                    </p>
                  ) : (
                    <p className="text-sm text-amber-400">
                      ~ Estás prácticamente en el límite — mantén el ritmo actual
                    </p>
                  )}
                </div>

                {/* Consejo del Chef */}
                <div className="mt-5 rounded-xl border border-amber-400/30 overflow-hidden"
                     style={{ boxShadow: '0 0 24px rgba(251,191,36,0.08)' }}>
                  {/* Banner imagen — ancho completo, sin recorte */}
                  <img
                    src="/images/consejo-chef.png"
                    alt="Consejo del Chef"
                    className="w-full block"
                  />
                  {/* Texto del consejo */}
                  <div className="px-5 py-4 bg-amber-950/20">
                    <p className="text-sm text-gray-300 leading-relaxed">
                      Este cálculo es una estimación basada en el promedio de descargos del mes.
                      Para mayor precisión, verifica diariamente que los descargos reales estén
                      registrados —{' '}
                      <span className="text-green-400 font-medium">un descargo mayor al promedio mejora tu margen</span>,{' '}
                      <span className="text-red-400 font-medium">uno menor lo reduce</span>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Desglose */}
              <div className="bg-gray-900/70 rounded-xl p-4 space-y-2.5 text-sm">
                <p className="text-xs text-gray-600 uppercase tracking-wider mb-3">
                  Cómo se calculó
                </p>

                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Presupuesto mes completo</span>
                  <span className="text-white tabular-nums font-medium">
                    RD$ {fmtM(monthly.budget_total_rd)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-400">
                    Gasto neto acumulado ({monthly.days_with_data} días)
                  </span>
                  <span className="text-red-400 tabular-nums">
                    −RD$ {fmtM(ps.net_total_rd)}
                  </span>
                </div>

                <div className="flex justify-between items-center border-t border-gray-700/60 pt-2.5">
                  <span className="text-gray-300 font-medium">Presupuesto neto restante</span>
                  <span className="text-white tabular-nums font-bold">
                    RD$ {fmtM(calc.remainingNetBudget)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-400">
                    Descargos estimados ({remainingDates.length} días ×{' '}
                    RD$ {fmtRD(Math.round(calc.avgDailyDescargos))}/día)
                  </span>
                  <span className="text-cyan-400 tabular-nums">
                    +RD$ {fmtM(calc.projectedRemainingDescargos)}
                  </span>
                </div>

                <div className="flex justify-between items-center border-t border-gray-700/60 pt-2.5">
                  <span className="text-gray-300 font-medium">Margen bruto disponible</span>
                  <span className="text-white tabular-nums font-bold">
                    RD$ {fmtM(calc.grossBudgetForRemaining)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-400">PAX restante total</span>
                  <span className="text-white tabular-nums">{fmtRD(totalRemainingPax)}</span>
                </div>

                <div className="flex justify-between items-center border-t border-gray-700/60 pt-2.5">
                  <span className="text-gray-300 font-semibold">
                    Tope = margen ÷ PAX
                  </span>
                  <span className={`${semClass} tabular-nums font-bold text-base`}>
                    RD$ {fmtRD2(calc.targetRdPerPax)}
                  </span>
                </div>

                {/* Referencia vs DG */}
                <div className="mt-1 pt-2.5 border-t border-amber-400/20 flex justify-between items-center">
                  <span className="text-xs font-semibold text-amber-300/70 uppercase tracking-wider">
                    Presupuesto DG aprobado
                  </span>
                  <span className="text-sm font-bold text-amber-300 tabular-nums">
                    RD$ {fmtRD2(DG_BUDGET_RD_PAX)} / PAX
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
