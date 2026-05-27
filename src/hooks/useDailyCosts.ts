/**
 * CHEF FINANCIERO — Hook: useDailyCosts
 *
 * Gestiona el estado y las operaciones de costos diarios.
 * Diseñado para funcionar en React (Next.js) y en React Native (Expo).
 * La única diferencia en RN será el import del cliente de Supabase.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getFoodOrdersByDate,
  getDailySummary,
  getMonthlyProjection,
  upsertFoodOrder,
  getMonthlySummaryByRestaurant,
} from '@/services/costs.service'
import type { DailyFoodOrderView, DailyFoodOrderInsert } from '@/types/database.types'

interface DailySummary {
  date:                  string
  pax:                   number
  total_food_rd:         number
  total_operation_rd:    number
  budget_food_rd:        number
  budget_operation_rd:   number
  variance_food_rd:      number
  variance_operation_rd: number
  cost_per_pax_rd:       number
  execution_pct:         number
}

interface MonthlyProjection {
  days_with_data:    number
  days_in_month:     number
  actual_cost_rd:    number
  avg_daily_cost_rd: number
  projected_cost_rd: number
  budget_total_rd:   number
  projected_variance: number
}

interface UseDailyCostsOptions {
  hotelId: string
  date: string
  year?: number
  month?: number
}

export function useDailyCosts({ hotelId, date, year, month }: UseDailyCostsOptions) {
  const [orders, setOrders]             = useState<DailyFoodOrderView[]>([])
  const [summary, setSummary]           = useState<DailySummary | null>(null)
  const [projection, setProjection]     = useState<MonthlyProjection | null>(null)
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState<string | null>(null)

  const currentYear  = year  ?? new Date(date).getFullYear()
  const currentMonth = month ?? new Date(date).getMonth() + 1

  const loadData = useCallback(async () => {
    if (!hotelId || !date) return
    setLoading(true)
    setError(null)
    try {
      const [ordersData, summaryData, projectionData] = await Promise.all([
        getFoodOrdersByDate(hotelId, date),
        getDailySummary(hotelId, date),
        getMonthlyProjection(hotelId, currentYear, currentMonth),
      ])
      setOrders(ordersData)
      setSummary(summaryData)
      setProjection(projectionData)
    } catch (err: unknown) {
      // PostgrestError no extiende Error — extraemos message manualmente
      const msg =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message ?? 'Error cargando costos'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [hotelId, date, currentYear, currentMonth])

  useEffect(() => {
    loadData()
  }, [loadData])

  /**
   * Guarda o actualiza el pedido de alimentos de un restaurante.
   * Recarga automáticamente los datos después de guardar.
   */
  const saveOrder = useCallback(
    async (order: DailyFoodOrderInsert) => {
      setSaving(true)
      setError(null)
      try {
        await upsertFoodOrder(order)
        await loadData()
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : (err as { message?: string })?.message ?? 'Error guardando pedido'
        setError(msg)
        throw err
      } finally {
        setSaving(false)
      }
    },
    [loadData]
  )

  /**
   * Calcula el estado del semáforo basado en el porcentaje de ejecución.
   * Lógica equivalente a los colores del Excel.
   */
  const getStatusColor = (executionPct: number): 'green' | 'yellow' | 'red' => {
    if (executionPct <= 95)  return 'green'
    if (executionPct <= 105) return 'yellow'
    return 'red'
  }

  /**
   * Calcula el estado del semáforo para la proyección del mes.
   */
  const getProjectionStatus = (): 'green' | 'yellow' | 'red' | null => {
    if (!projection) return null
    const pct =
      projection.budget_total_rd > 0
        ? (projection.projected_cost_rd / projection.budget_total_rd) * 100
        : 0
    return getStatusColor(pct)
  }

  return {
    orders,
    summary,
    projection,
    loading,
    saving,
    error,
    saveOrder,
    refresh: loadData,
    getStatusColor,
    getProjectionStatus,
  }
}

// ─── Hook para el resumen mensual ────────────────────────────────────────────

export function useMonthlyCosts(hotelId: string, year: number, month: number) {
  const [data, setData]     = useState<Awaited<ReturnType<typeof getMonthlySummaryByRestaurant>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!hotelId) return
    setLoading(true)
    getMonthlySummaryByRestaurant(hotelId, year, month)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [hotelId, year, month])

  // Totales del mes
  const totals = data.reduce(
    (acc, r) => ({
      total_rd:     acc.total_rd     + r.total_rd,
      budget_rd:    acc.budget_rd    + r.total_budget_rd,
      variance_rd:  acc.variance_rd  + r.variance_rd,
      total_pax:    acc.total_pax    + r.total_pax,
    }),
    { total_rd: 0, budget_rd: 0, variance_rd: 0, total_pax: 0 }
  )

  return { data, totals, loading, error }
}
