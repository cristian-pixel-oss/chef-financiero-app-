'use client'

export const dynamic = 'force-dynamic'

/**
 * CHEF FINANCIERO â€” Dashboard Principal (JARVIS)
 *
 * Layout inspirado en Excel DASH-MAY:
 *   Fila 1 â€” OcupaciÃ³n | Ppto $/PAX | Real $/PAX
 *   Fila 2 â€” Ppto Total | Gasto Real | Saldo Disponible (semÃ¡foro)
 *   Tabla  â€” Ãrea/Cocina | Ppto $/PAX | Ppto Total | Real Total | Real $/PAX | Excedente | % Ejec. | Estado
 *   Abajo  â€” ProyecciÃ³n al cierre del mes
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase }                          from '@/lib/supabase/client'
import { useHotelId }                        from '@/hooks/useHotelId'
import {
  getPeriodStats,
  type PeriodSummary,
  type RestaurantPeriodStat,
} from '@/services/costs.service'
import { DG_BUDGET_RD_PAX, DG_BUDGET_USD_PAX, DG_EXCHANGE_RATE } from '@/lib/constants'
import { getExchangeRate } from '@/services/hotelConfig.service'

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function fmtRD(n: number) {
  return new Intl.NumberFormat('es-DO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtRD2(n: number) {
  return new Intl.NumberFormat('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function fmtUSD(n: number, rate: number) {
  if (rate <= 0) return 'â€”'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n / rate)
}

function fmtPct(n: number) { return `${n.toFixed(1)}%` }

function todayStr() { return new Date().toISOString().split('T')[0] }

function firstOfMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function semaphore(pct: number): 'green' | 'yellow' | 'red' {
  if (pct <= 95)  return 'green'
  if (pct <= 105) return 'yellow'
  return 'red'
}

// â”€â”€â”€ Micro-componentes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SemDot({ status }: { status: 'green' | 'yellow' | 'red' }) {
  const c: Record<string, string> = {
    green:  'bg-green-400',
    yellow: 'bg-amber-400',
    red:    'bg-red-500 animate-pulse',
  }
  return <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${c[status]}`} />
}

function SemBadge({ status }: { status: 'green' | 'yellow' | 'red' }) {
  const cfg: Record<string, { cls: string; label: string }> = {
    green:  { cls: 'text-green-400 bg-green-400/10',  label: 'âœ“ OK'      },
    yellow: { cls: 'text-amber-400 bg-amber-400/10',  label: '~ AtenciÃ³n' },
    red:    { cls: 'text-red-400   bg-red-400/10',    label: '! Alerta'   },
  }
  const { cls, label } = cfg[status]
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>
      {label}
    </span>
  )
}

// â”€â”€â”€ Bloque KPI grande (fila 1) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function KPITop({
  label, value, sub, note, colorClass = 'text-white', borderClass = 'border-gray-800 bg-gray-900',
}: {
  label:       string
  value:       string
  sub?:        string
  note?:       string
  colorClass?: string
  borderClass?: string
}) {
  return (
    <div className={`border rounded-xl p-5 flex flex-col gap-1 ${borderClass}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-3xl font-bold tabular-nums leading-tight ${colorClass}`}>{value}</p>
      {sub  && <p className="text-sm text-gray-400 tabular-nums">{sub}</p>}
      {note && <p className="text-xs text-gray-600 mt-0.5">{note}</p>}
    </div>
  )
}

// â”€â”€â”€ Bloque KPI medio (fila 2) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function KPIMid({
  label, value, sub, note, colorClass = 'text-white', borderClass = 'border-gray-800 bg-gray-900',
}: {
  label:        string
  value:        string
  sub?:         string
  note?:        string
  colorClass?:  string
  borderClass?: string
}) {
  return (
    <div className={`border rounded-xl p-5 flex flex-col gap-1 ${borderClass}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-2xl font-bold tabular-nums leading-tight ${colorClass}`}>{value}</p>
      {sub  && <p className="text-sm text-gray-400 tabular-nums">{sub}</p>}
      {note && <p className={`text-xs mt-0.5 ${colorClass === 'text-white' ? 'text-gray-600' : colorClass.replace('400', '700').replace('300', '600')}`}>{note}</p>}
    </div>
  )
}

// â”€â”€â”€ PÃ¡gina principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function DashboardPage() {
  const today = todayStr()

  // â”€â”€ Estado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [viewMode,     setViewMode]     = useState<'day' | 'range'>('range')
  const [selectedDate, setSelectedDate] = useState(today)
  const [startDate,    setStartDate]    = useState(firstOfMonthStr())
  const [endDate,      setEndDate]      = useState(today)
  const [exchangeRate, setExchangeRate] = useState(DG_EXCHANGE_RATE)

  // Cargar tasa de cambio desde Supabase
  useEffect(() => {
    if (!hotelId) return
    const now = new Date()
    getExchangeRate(hotelId, now.getFullYear(), now.getMonth() + 1)
      .then(rate => { if (rate) setExchangeRate(rate) })
  }, [hotelId])

  const { hotelId, hotelName, hotelLoading } = useHotelId()

  const [periodStats,  setPeriodStats]  = useState<PeriodSummary | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)


  // â”€â”€ Cargar datos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadData = useCallback(async () => {
    if (!hotelId) return
    setLoading(true)
    setError(null)
    try {
      const [from, to] = viewMode === 'day'
        ? [selectedDate, selectedDate]
        : [startDate, endDate]

      const stats = await getPeriodStats(hotelId, from, to)
      setPeriodStats(stats)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }, [hotelId, viewMode, selectedDate, startDate, endDate])

  useEffect(() => { loadData() }, [loadData])

  // â”€â”€ Guards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (hotelLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
    </div>
  )

  if (!hotelId) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400">No hay hoteles configurados.</p>
    </div>
  )

  // â”€â”€ Derivados â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const ps       = periodStats
  const totalSt  = ps ? semaphore(ps.execution_pct) : 'green'
  const saldoPos = (ps?.saldo_rd ?? 0) >= 0

  const periodLabel = viewMode === 'day'
    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-DO', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : `${startDate} â†’ ${endDate}`

  // Colores semÃ¡foro para bloques
  const semBorder: Record<string, string> = {
    green:  'border-green-600/40 bg-green-900/20',
    yellow: 'border-amber-600/40 bg-amber-900/20',
    red:    'border-red-600/40   bg-red-900/20',
  }
  const semText: Record<string, string> = {
    green:  'text-green-400',
    yellow: 'text-amber-400',
    red:    'text-red-400',
  }

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-5">

      {/* â”€â”€ HEADER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Dashboard <span className="text-amber-400">JARVIS</span>
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {hotelName || 'Control de costos'} â€” Control Financiero Cocina
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="shrink-0 text-gray-400 hover:text-white text-sm px-3 py-2
                       bg-gray-800 border border-gray-700 rounded-lg disabled:opacity-50 transition"
          >
            â†» Actualizar
          </button>
        </div>

        {/* Controles */}
        <div className="flex flex-wrap items-center gap-3">

          {/* Modo */}
          <div className="flex bg-gray-800 rounded-lg p-1 gap-1">
            {(['day', 'range'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  viewMode === m ? 'bg-amber-400 text-gray-900' : 'text-gray-400 hover:text-white'
                }`}
              >
                {m === 'day' ? 'ðŸ“… DÃ­a' : 'ðŸ“…â”€ðŸ“… PerÃ­odo'}
              </button>
            ))}
          </div>

          {/* Fechas */}
          {viewMode === 'day' ? (
            <input
              type="date" value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                         text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="date" value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                           text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <span className="text-gray-500 text-sm">â†’</span>
              <input
                type="date" value={endDate} min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                           text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          )}

          {/* Tasa cambio */}
          <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
            <span className="text-gray-400 text-xs whitespace-nowrap">RD$/USD</span>
            <input
              type="number" min="1" step="0.01" value={exchangeRate}
              onChange={(e) => setExchangeRate(parseFloat(e.target.value) || DG_EXCHANGE_RATE)}
              className="w-20 bg-transparent text-white text-sm text-right tabular-nums focus:outline-none"
            />
          </div>

          {/* Referencia DG */}
          <div className="hidden sm:flex items-center gap-1.5 bg-green-900/30 border border-green-700/40
                          rounded-lg px-3 py-2">
            <span className="text-green-400 text-xs">âœ…</span>
            <span className="text-green-300 text-xs font-medium whitespace-nowrap">
              Ppto DG: RD$ {DG_BUDGET_RD_PAX}/PAX Â· USD {DG_BUDGET_USD_PAX.toFixed(2)}/PAX
            </span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3">
          <p className="text-red-400 text-sm">âš  {error}</p>
        </div>
      )}


      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-400" />
        </div>

      ) : !ps || ps.days_with_data === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-400 text-base">No hay datos para el perÃ­odo seleccionado.</p>
          <p className="text-gray-600 text-sm mt-2">
            Ingresa pedidos en <strong className="text-gray-400">Pedidos</strong> para ver el resumen.
          </p>
        </div>

      ) : (
        <div className="space-y-4">

          {/* Etiqueta perÃ­odo + semÃ¡foro */}
          <div className="flex items-center gap-3 flex-wrap">
            <SemDot status={totalSt} />
            <span className="text-white font-semibold capitalize">{periodLabel}</span>
            {ps.days_with_data > 1 && (
              <span className="text-gray-500 text-xs bg-gray-800 px-2 py-0.5 rounded-full">
                {ps.days_with_data} dÃ­as con datos
              </span>
            )}
            <SemBadge status={totalSt} />
          </div>

          {/* â•â• FILA 1: OcupaciÃ³n | Ppto $/PAX | Real $/PAX â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
          <div className="grid grid-cols-3 gap-4">

            {/* OcupaciÃ³n */}
            <KPITop
              label="OcupaciÃ³n"
              value={`${fmtRD(ps.total_pax)} PAX`}
              sub={ps.days_with_data > 1 ? `${ps.days_with_data} dÃ­as` : undefined}
            />

            {/* Presupuesto $/PAX â€” valor fijo DG */}
            <KPITop
              label="Presupuesto $/PAX"
              value={`RD$ ${fmtRD2(DG_BUDGET_RD_PAX)}`}
              note="Aprobado DirecciÃ³n General"
              colorClass="text-blue-300"
            />

            {/* Costo Real $/PAX */}
            <KPITop
              label="Costo Real $/PAX"
              value={`RD$ ${fmtRD2(ps.cost_per_pax_rd)}`}
              note={`${fmtPct(ps.execution_pct)} del presupuesto`}
              colorClass={semText[totalSt]}
              borderClass={semBorder[totalSt]}
            />
          </div>

          {/* â•â• FILA 2: Ppto Total | Gasto Real | Saldo â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
          <div className="grid grid-cols-3 gap-4">

            {/* Presupuesto Total */}
            <KPIMid
              label="Presupuesto Total"
              value={`RD$ ${fmtRD(ps.budget_total_rd)}`}
            />

            {/* Gasto Real Acumulado (bruto) */}
            <KPIMid
              label="Gasto Real Acumulado"
              value={`RD$ ${fmtRD(ps.total_rd)}`}
              colorClass="text-amber-400"
            />

            {/* Saldo Disponible (sobre costo neto) */}
            <KPIMid
              label="Saldo Disponible"
              value={`${saldoPos ? '+' : ''}RD$ ${fmtRD(ps.saldo_rd)}`}
              note={saldoPos ? 'âœ“ Dentro del presupuesto' : 'âš  Excede el presupuesto'}
              colorClass={saldoPos ? 'text-green-400' : 'text-red-400'}
              borderClass={saldoPos
                ? 'border-green-600/50 bg-green-900/20'
                : 'border-red-600/50   bg-red-900/20'}
            />
          </div>

          {/* â•â• FILA 3: Descargos | Costo Neto | RD$/PAX Neto â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
          {(ps.descargos_rd > 0 || true) && (
            <div className="grid grid-cols-3 gap-4">

              {/* Descargos */}
              <KPIMid
                label="Descargos"
                value={ps.descargos_rd > 0 ? `âˆ’RD$ ${fmtRD(ps.descargos_rd)}` : 'RD$ 0'}
                colorClass={ps.descargos_rd > 0 ? 'text-cyan-400' : 'text-gray-500'}
                borderClass={ps.descargos_rd > 0 ? 'border-cyan-700/40 bg-cyan-900/10' : 'border-gray-800 bg-gray-900'}
              />

              {/* Costo Neto Final */}
              <KPIMid
                label="Costo Neto Final"
                value={`RD$ ${fmtRD(ps.net_total_rd)}`}
                colorClass={semText[totalSt]}
                borderClass={semBorder[totalSt]}
              />

              {/* RD$/PAX Neto */}
              <KPIMid
                label="RD$/PAX Neto"
                value={`RD$ ${fmtRD2(ps.cost_per_pax_rd)}`}
                note={`${fmtPct(ps.execution_pct)} del presupuesto`}
                colorClass={semText[totalSt]}
                borderClass={semBorder[totalSt]}
              />
            </div>
          )}

          {/* â•â• TABLA POR RESTAURANTE â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
          {ps.restaurants.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">

              <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">Desglose por Ãrea / Cocina</h3>
                <span className="text-xs text-gray-500">{ps.restaurants.length} Ã¡reas</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: '#1a2436', borderBottom: '1px solid #374151' }}>
                      <th className="text-left text-gray-400 font-medium px-2 py-2 whitespace-nowrap"
                          style={{ width: 140, minWidth: 140, maxWidth: 140 }}>
                        Ãrea / Cocina
                      </th>
                      <th className="text-right text-gray-400 font-medium px-2 py-2 whitespace-nowrap">
                        $/PAX
                      </th>
                      <th className="text-right text-gray-400 font-medium px-2 py-2 whitespace-nowrap">
                        Ppto RD$
                      </th>
                      <th className="text-right text-gray-400 font-medium px-2 py-2 whitespace-nowrap">
                        Real RD$
                      </th>
                      <th className="text-right text-cyan-500/70 font-medium px-2 py-2 whitespace-nowrap">
                        Descargos
                      </th>
                      <th className="text-right text-gray-400 font-medium px-2 py-2 whitespace-nowrap">
                        Neto
                      </th>
                      <th className="text-right text-gray-400 font-medium px-2 py-2 whitespace-nowrap">
                        $/PAX Real
                      </th>
                      <th className="text-right text-gray-400 font-medium px-2 py-2 whitespace-nowrap">
                        Excedente
                      </th>
                      <th className="text-center text-gray-400 font-medium px-2 py-2 whitespace-nowrap">
                        %
                      </th>
                      <th className="text-center text-gray-400 font-medium px-2 py-2 whitespace-nowrap">
                        Estado
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-800/60">
                    {ps.restaurants.map((r: RestaurantPeriodStat) => {
                      const st      = semaphore(r.execution_pct)
                      const excPos  = r.excedente_rd >= 0
                      const hasBudg = r.budget_total_rd > 0
                      return (
                        <tr key={r.restaurant_id} className="hover:bg-gray-800/30 transition">
                          <td className="px-2 py-1 text-white font-medium"
                              style={{ width: 140, minWidth: 140, maxWidth: 140,
                                       overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.restaurant_name}
                          </td>
                          <td className="px-2 py-1 text-right text-gray-400 tabular-nums">
                            {r.budget_rd_pax > 0 ? fmtRD2(r.budget_rd_pax) : <span className="text-gray-600">â€”</span>}
                          </td>
                          <td className="px-2 py-1 text-right text-gray-300 tabular-nums">
                            {hasBudg ? fmtRD(r.budget_total_rd) : <span className="text-gray-600">â€”</span>}
                          </td>
                          <td className="px-2 py-1 text-right text-white font-semibold tabular-nums">
                            {fmtRD(r.total_rd)}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums">
                            {r.descargos_rd > 0 ? (
                              <span className="text-cyan-400 font-semibold">âˆ’{fmtRD(r.descargos_rd)}</span>
                            ) : (
                              <span className="text-gray-700">â€”</span>
                            )}
                          </td>
                          <td className="px-2 py-1 text-right font-bold tabular-nums text-amber-300">
                            {fmtRD(r.net_total_rd)}
                          </td>
                          <td className="px-2 py-1 text-right text-gray-400 tabular-nums">
                            {r.cost_per_pax_rd > 0 ? fmtRD2(r.cost_per_pax_rd) : 'â€”'}
                          </td>
                          <td className={`px-2 py-1 text-right font-semibold tabular-nums ${
                            !hasBudg ? 'text-gray-600'
                            : excPos  ? 'text-green-400'
                            : 'text-red-400'
                          }`}>
                            {hasBudg ? `${excPos ? '+' : ''}${fmtRD(r.excedente_rd)}` : 'â€”'}
                          </td>
                          <td className="px-2 py-1 text-center">
                            {hasBudg ? (
                              <span className={`font-bold tabular-nums ${semText[st]}`}>
                                {fmtPct(r.execution_pct)}
                              </span>
                            ) : (
                              <span className="text-gray-600">â€”</span>
                            )}
                          </td>
                          <td className="px-2 py-1 text-center">
                            {hasBudg ? <SemBadge status={st} /> : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>

                  {/* Fila total */}
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #374151', backgroundColor: '#172030' }}>
                      <td className="px-2 py-1.5 text-amber-400 font-bold uppercase tracking-wide"
                          style={{ width: 140, minWidth: 140, maxWidth: 140 }}>
                        TOTAL
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-300 tabular-nums font-semibold">
                        {ps.total_pax > 0 ? fmtRD2(ps.budget_rd_pax) : 'â€”'}
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-200 tabular-nums font-bold">
                        {fmtRD(ps.budget_total_rd)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-amber-400 tabular-nums font-bold">
                        {fmtRD(ps.total_rd)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-bold">
                        {ps.descargos_rd > 0 ? (
                          <span className="text-cyan-400">âˆ’{fmtRD(ps.descargos_rd)}</span>
                        ) : (
                          <span className="text-gray-600">â€”</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right text-amber-300 tabular-nums font-bold">
                        {fmtRD(ps.net_total_rd)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-300 tabular-nums font-bold">
                        {fmtRD2(ps.cost_per_pax_rd)}
                      </td>
                      <td className={`px-2 py-1.5 text-right font-bold tabular-nums ${
                        saldoPos ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {saldoPos ? '+' : ''}{fmtRD(ps.saldo_rd)}
                      </td>
                      <td className={`px-2 py-1.5 text-center font-bold ${semText[totalSt]}`}>
                        {fmtPct(ps.execution_pct)}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <SemBadge status={totalSt} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}


