/**
 * CHEF FINANCIERO — Servicio de Costos
 *
 * Toda la lógica de negocio para costos diarios de alimentos y operación.
 * Este servicio es puro (sin hooks de React) para que funcione igual en:
 *   - Next.js (web)
 *   - Expo / React Native (móvil — futuro)
 */

import { supabase } from '@/lib/supabase/client'
import type {
  DailyFoodOrder,
  DailyFoodOrderInsert,
  DailyFoodOrderView,
  DailyOperationOrder,
  DailyCostConsolidatedRow,
  DailyHotelSummaryRow,
  MonthlyProjectionRow,
  OccupancyDaily,
  OccupancyDailyInsert,
} from '@/types/database.types'

// Re-export so consumers don't need to import from two places
export type { DailyCostConsolidatedRow, DailyHotelSummaryRow, MonthlyProjectionRow }

/** Resultado de una consulta de rango de fechas */
export interface DateRangeStats {
  days_with_data:  number
  total_rd:        number
  budget_total_rd: number
  total_pax:       number
  total_alm_rd:    number
  total_carn_rd:   number
  total_veg_rd:    number
  cost_per_pax_rd: number
  execution_pct:   number
  variance_rd:     number
}

// ─── Pedidos de alimentos ────────────────────────────────────────────────────

/**
 * Obtiene todos los pedidos de alimentos de un hotel para una fecha,
 * incluyendo las columnas calculadas (total, varianza, costo/PAX).
 */
export async function getFoodOrdersByDate(hotelId: string, date: string) {
  const { data: restaurants, error: restError } = await supabase
    .from('restaurants')
    .select('id')
    .eq('hotel_id', hotelId)

  if (restError) throw restError
  const restaurantIds = (restaurants ?? []).map((r) => r.id)
  if (restaurantIds.length === 0) return []

  const { data, error } = await supabase
    .from('daily_food_orders_view')
    .select('*')
    .eq('date', date)
    .in('restaurant_id', restaurantIds)
    .order('restaurant_name')

  if (error) throw error
  return data as DailyFoodOrderView[]
}

/**
 * Obtiene pedidos de alimentos de un rango de fechas para un hotel.
 */
export async function getFoodOrdersByRange(
  hotelId: string,
  startDate: string,
  endDate: string
) {
  const { data: restaurants, error: restError } = await supabase
    .from('restaurants')
    .select('id')
    .eq('hotel_id', hotelId)

  if (restError) throw restError
  const restaurantIds = (restaurants ?? []).map((r) => r.id)
  if (restaurantIds.length === 0) return []

  const { data, error } = await supabase
    .from('daily_food_orders_view')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .in('restaurant_id', restaurantIds)
    .order('date', { ascending: false })

  if (error) throw error
  return data as DailyFoodOrderView[]
}

/**
 * Crea o actualiza el pedido de alimentos de un restaurante en una fecha.
 * Usa upsert para manejar la restricción UNIQUE(restaurant_id, date).
 */
export async function upsertFoodOrder(order: DailyFoodOrderInsert) {
  const { data, error } = await supabase
    .from('daily_food_orders')
    .upsert(order, { onConflict: 'restaurant_id,date' })
    .select()
    .single()

  if (error) throw error
  return data as DailyFoodOrder
}

/**
 * Elimina el pedido de alimentos de un restaurante en una fecha.
 */
export async function deleteFoodOrder(restaurantId: string, date: string) {
  const { error } = await supabase
    .from('daily_food_orders')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('date', date)

  if (error) throw error
}

// ─── Resumen diario y proyecciones ──────────────────────────────────────────

/**
 * Resumen ejecutivo del día (función RPC en Supabase).
 * Equivale al indicador principal del dashboard JARVIS.
 * Nota: solo suma costos ALM. Para el total consolidado usa getDailyHotelSummary().
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getDailySummary(hotelId: string, date: string): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('get_daily_summary', {
    p_hotel_id: hotelId,
    p_date: date,
  })
  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[])?.[0] ?? null
}

/**
 * Proyección al cierre del mes.
 * Equivale a la pestaña ACUMULADO DEL MES del Excel.
 */
export async function getMonthlyProjection(
  hotelId: string,
  year: number,
  month: number
): Promise<MonthlyProjectionRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('get_monthly_projection', {
    p_hotel_id: hotelId,
    p_year: year,
    p_month: month,
  })
  if (error) throw error
  return ((data as unknown[])?.[0] as MonthlyProjectionRow) ?? null
}

/**
 * Resumen mensual: costos agrupados por restaurante.
 * Para el informe ejecutivo mensual.
 */
export async function getMonthlySummaryByRestaurant(
  hotelId: string,
  year: number,
  month: number
) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate   = new Date(year, month, 0).toISOString().split('T')[0]

  const { data: restaurants, error: restError } = await supabase
    .from('restaurants')
    .select('id')
    .eq('hotel_id', hotelId)

  if (restError) throw restError
  const restaurantIds = (restaurants ?? []).map((r) => r.id)
  if (restaurantIds.length === 0) return []

  const { data, error } = await supabase
    .from('daily_food_orders_view')
    .select(`
      restaurant_id,
      restaurant_name,
      restaurant_type,
      budget_rd_pax,
      viveres_rd,
      nevera_rd,
      extras_rd,
      total_rd,
      variance_rd,
      cost_per_pax_rd,
      pax
    `)
    .gte('date', startDate)
    .lte('date', endDate)
    .in('restaurant_id', restaurantIds)

  if (error) throw error

  // Agrupa por restaurante
  const grouped = (data ?? []).reduce(
    (acc, row) => {
      const key = row.restaurant_id
      if (!acc[key]) {
        acc[key] = {
          restaurant_id:   row.restaurant_id,
          restaurant_name: row.restaurant_name,
          restaurant_type: row.restaurant_type,
          total_viveres_rd: 0,
          total_nevera_rd:  0,
          total_extras_rd:  0,
          total_rd:         0,
          total_budget_rd:  0,
          total_pax:        0,
          days_count:       0,
        }
      }
      acc[key].total_viveres_rd += row.viveres_rd ?? 0
      acc[key].total_nevera_rd  += row.nevera_rd  ?? 0
      acc[key].total_extras_rd  += row.extras_rd  ?? 0
      acc[key].total_rd         += row.total_rd   ?? 0
      acc[key].total_budget_rd  += (row.budget_rd_pax ?? 0) * (row.pax ?? 0)
      acc[key].total_pax        += row.pax         ?? 0
      acc[key].days_count       += 1
      return acc
    },
    {} as Record<string, {
      restaurant_id: string
      restaurant_name: string
      restaurant_type: string | null
      total_viveres_rd: number
      total_nevera_rd:  number
      total_extras_rd:  number
      total_rd:         number
      total_budget_rd:  number
      total_pax:        number
      days_count:       number
    }>
  )

  return Object.values(grouped).map((r) => ({
    ...r,
    variance_rd:      r.total_rd - r.total_budget_rd,
    cost_per_pax_rd:  r.total_pax > 0 ? r.total_rd / r.total_pax : 0,
    execution_pct:    r.total_budget_rd > 0 ? (r.total_rd / r.total_budget_rd) * 100 : 0,
  }))
}

// ─── Vistas consolidadas (ALM + CARN + VEG) ─────────────────────────────────

/**
 * Obtiene los costos consolidados (ALM + CARN + VEG) de todos los restaurantes
 * de un hotel para una fecha específica.
 * Equivale al cruce de columnas del DASH-DÍA del Excel.
 *
 * REQUIERE: Migration 002_consolidated_view.sql ejecutada en Supabase.
 */
export async function getConsolidatedOrdersByDate(
  hotelId: string,
  date: string
): Promise<DailyCostConsolidatedRow[]> {
  const { data, error } = await supabase
    .from('daily_cost_consolidated')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('date', date)
    .order('restaurant_name')

  if (error) throw error
  return (data ?? []) as DailyCostConsolidatedRow[]
}

/**
 * Obtiene el resumen consolidado del hotel para una fecha.
 * Suma ALM + CARN + VEG de todos los restaurantes.
 * Para el bloque de KPIs del Dashboard.
 *
 * REQUIERE: Migration 002_consolidated_view.sql ejecutada en Supabase.
 */
export async function getDailyHotelSummary(
  hotelId: string,
  date: string
): Promise<DailyHotelSummaryRow | null> {
  const { data, error } = await supabase
    .from('daily_hotel_summary')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('date', date)
    .maybeSingle()

  if (error) throw error
  return data as DailyHotelSummaryRow | null
}

// ─── Pedidos de operación ────────────────────────────────────────────────────

/**
 * Obtiene los pedidos de operación de un hotel para una fecha.
 */
export async function getOperationOrdersByDate(
  hotelId: string,
  date: string
) {
  const { data, error } = await supabase
    .from('daily_operation_orders')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('date', date)
    .order('category')

  if (error) throw error
  return (data ?? []).map((o: DailyOperationOrder) => ({
    ...o,
    budget_total_rd:  (o.budget_rd_pax ?? 0) * (o.pax ?? 0),
    total_rd:         (o.order_amount_rd ?? 0) + (o.extra_amount_rd ?? 0),
    variance_rd:
      (o.order_amount_rd ?? 0) + (o.extra_amount_rd ?? 0) -
      (o.budget_rd_pax ?? 0) * (o.pax ?? 0),
    cost_per_pax_rd:
      (o.pax ?? 0) > 0
        ? ((o.order_amount_rd ?? 0) + (o.extra_amount_rd ?? 0)) / o.pax!
        : 0,
  }))
}

/**
 * Crea o actualiza un pedido de operación.
 */
export async function upsertOperationOrder(
  order: Omit<DailyOperationOrder, 'id' | 'created_at' | 'updated_at'>
) {
  const { data, error } = await supabase
    .from('daily_operation_orders')
    .upsert(order, { onConflict: 'hotel_id,date,category' })
    .select()
    .single()

  if (error) throw error
  return data as DailyOperationOrder
}

// ─── Ocupación diaria ────────────────────────────────────────────────────────

/**
 * Obtiene el registro de ocupación (PAX) de un hotel para una fecha.
 */
export async function getOccupancy(
  hotelId: string,
  date: string
): Promise<OccupancyDaily | null> {
  const { data, error } = await supabase
    .from('occupancy_daily')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('date', date)
    .maybeSingle()

  if (error) throw error
  return data as OccupancyDaily | null
}

/**
 * Crea o actualiza el PAX del hotel para una fecha.
 * Punto de entrada único: la ocupación se ingresa una vez y alimenta
 * el presupuesto de todos los restaurantes.
 */
export async function upsertOccupancy(
  occupancy: OccupancyDailyInsert
): Promise<OccupancyDaily> {
  const { data, error } = await supabase
    .from('occupancy_daily')
    .upsert(occupancy, { onConflict: 'hotel_id,date' })
    .select()
    .single()

  if (error) throw error
  return data as OccupancyDaily
}

// ─── Proyección mensual consolidada (ALM + CARN + VEG) ─────────────────────

/**
 * Calcula la proyección al cierre del mes usando la vista daily_cost_consolidated.
 * Reemplaza la RPC get_monthly_projection con datos 100% consolidados.
 *
 * REQUIERE: Migrations 002 y 003 ejecutadas.
 *
 * @param from  Inicio del período real (opcional, default = primer día del mes).
 *              Debe coincidir exactamente con el startDate de getPeriodStats
 *              para que "Acumulado neto" en la proyección sea idéntico al
 *              "Costo Neto Final" de los KPIs.
 * @param to    Fin del período real (opcional, default = último día del mes).
 *              En producción se pasa `today` para excluir pedidos con fecha futura.
 *
 * El presupuesto siempre se consulta para el MES COMPLETO (1..último día),
 * de modo que la varianza se compara contra el presupuesto mensual aprobado.
 */
export async function getConsolidatedMonthlyProjection(
  hotelId: string,
  year:    number,
  month:   number,
  from?:   string,
  to?:     string,
): Promise<MonthlyProjectionRow> {
  const firstDay    = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay     = new Date(year, month, 0).toISOString().split('T')[0]
  const daysInMonth = new Date(year, month, 0).getDate()

  // Período real: usa from/to si se pasan (match exacto con getPeriodStats)
  const actualStart = from ?? firstDay
  const actualEnd   = to   ?? lastDay

  // Query 1a: gasto real del período (from..to) — misma fuente que getPeriodStats
  const { data: actualData, error: actualErr } = await supabase
    .from('daily_cost_consolidated')
    .select('date, total_rd')
    .eq('hotel_id', hotelId)
    .gte('date', actualStart)
    .lte('date', actualEnd)

  if (actualErr) throw actualErr

  // Query 1b: presupuesto del MES COMPLETO (siempre 1..último día del mes)
  // Se calcula separado para que la varianza refleje el presupuesto mensual completo
  // aunque el período real sea solo hasta hoy.
  const { data: budgetData, error: budgetErr } = await supabase
    .from('daily_cost_consolidated')
    .select('date, budget_total_rd')
    .eq('hotel_id', hotelId)
    .gte('date', firstDay)
    .lte('date', lastDay)

  if (budgetErr) throw budgetErr

  // Query 2: descargos del período real (función SECURITY DEFINER — bypasea RLS)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: descTotal } = await (supabase as any)
    .rpc('get_descargos_total', {
      p_hotel_id: hotelId,
      p_start:    actualStart,
      p_end:      actualEnd,
    })
  const totalDescargosRd = Number(descTotal) || 0

  // Agregar costos reales por fecha
  const actualByDate: Record<string, number> = {}
  for (const row of (actualData ?? []) as { date: string; total_rd: number }[]) {
    actualByDate[row.date] = (actualByDate[row.date] ?? 0) + (row.total_rd ?? 0)
  }
  const daysWithData = Object.keys(actualByDate).length
  const actualCostRd = Object.values(actualByDate).reduce((s, v) => s + v, 0)

  // Agregar presupuesto del mes completo
  const budgetByDate: Record<string, number> = {}
  for (const row of (budgetData ?? []) as { date: string; budget_total_rd: number }[]) {
    budgetByDate[row.date] = (budgetByDate[row.date] ?? 0) + (row.budget_total_rd ?? 0)
  }
  const budgetFromQuery  = Object.values(budgetByDate).reduce((s, v) => s + v, 0)
  const daysWithBudget   = Object.keys(budgetByDate).length

  // ──────────────────────────────────────────────────────────────────────────
  // IMPORTANTE: daily_cost_consolidated solo devuelve filas para días con
  // pedidos ingresados. Si faltan días (p.ej. los últimos 9 días del mes
  // aún no tienen pedidos), su budget_total_rd = 0 en la query.
  //
  // Para que la varianza compare "manzanas con manzanas", extrapolamos el
  // presupuesto diario promedio a los 31 días del mes:
  //
  //   fullMonthBudget = (budgetFromQuery / daysWithBudget) × daysInMonth
  //
  // Así ambos lados de la comparación (proyección Y presupuesto) cubren 31 días.
  // ──────────────────────────────────────────────────────────────────────────
  const avgDailyBudget  = daysWithBudget > 0 ? budgetFromQuery / daysWithBudget : 0
  const fullMonthBudget = avgDailyBudget * daysInMonth

  // Promedios diarios: bruto (lo que se pide antes de descargos) y neto
  const avgDailyGross = daysWithData > 0 ? actualCostRd / daysWithData : 0

  // Costo neto acumulado = gasto bruto − descargos del período
  const netActualCostRd = actualCostRd - totalDescargosRd

  // Promedio diario neto y proyección al cierre
  const avgDailyCost  = daysWithData > 0 ? netActualCostRd / daysWithData : 0
  const projectedCost = avgDailyCost * daysInMonth

  // Varianza vs presupuesto MES COMPLETO (extrapolado): positivo = bajo presupuesto
  const projVariance  = fullMonthBudget - projectedCost

  return {
    days_with_data:     daysWithData,
    days_in_month:      daysInMonth,
    actual_cost_rd:     actualCostRd,
    descargos_rd:       totalDescargosRd,
    net_actual_cost_rd: netActualCostRd,
    avg_daily_gross_rd: avgDailyGross,   // bruto/día — para mostrar en UI
    avg_daily_cost_rd:  avgDailyCost,    // neto/día — base de la proyección
    projected_cost_rd:  projectedCost,
    budget_total_rd:    fullMonthBudget, // presupuesto mes completo (extrapolado)
    projected_variance: projVariance,
  }
}

// ─── Estadísticas de período para el Dashboard principal ────────────────────

export interface RestaurantPeriodStat {
  restaurant_id:   string
  restaurant_name: string
  budget_rd_pax:   number   // presupuesto individual configurado por PAX
  budget_total_rd: number   // suma de presupuestos diarios del período
  total_rd:        number   // gasto real bruto = ALM + CARN + VEG del período
  descargos_rd:    number   // descargos por restaurante (resta al total)
  net_total_rd:    number   // total_rd − descargos_rd (costo neto real)
  cost_per_pax_rd: number   // net_total_rd / total_pax_del_período
  excedente_rd:    number   // budget_total_rd − net_total_rd (+ = bajo presupuesto)
  execution_pct:   number   // net_total_rd / budget_total_rd * 100
}

export interface PeriodSummary {
  total_pax:        number
  budget_rd_pax:    number   // presupuesto efectivo por PAX (budget_total / total_pax)
  gross_per_pax_rd: number   // total_rd / total_pax (bruto ALM+CARN+VEG, antes de descargos)
  cost_per_pax_rd:  number   // net_total_rd / total_pax (neto)
  budget_total_rd:  number
  total_rd:         number   // gasto real bruto: ALM + CARN + VEG
  descargos_rd:     number   // total descargos del período
  net_total_rd:     number   // total_rd − descargos_rd
  saldo_rd:         number   // budget_total − net_total_rd (+ = bajo presupuesto)
  execution_pct:    number   // net / budget
  days_with_data:   number
  restaurants:      RestaurantPeriodStat[]
}

/**
 * Agrega costos del período por restaurante desde daily_cost_consolidated.
 * Usa total_rd = ALM + CARN + VEG (gasto real total del restaurante).
 * Incluye TODOS los restaurantes con pedidos: Carnicería Central, Vegetales Central, etc.
 */
export async function getPeriodStats(
  hotelId:   string,
  startDate: string,
  endDate:   string
): Promise<PeriodSummary> {
  const { data, error } = await supabase
    .from('daily_cost_consolidated')
    .select('restaurant_id, restaurant_name, date, pax, budget_rd_pax, budget_total_rd, total_rd, descargos_rd')
    .eq('hotel_id', hotelId)
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw error

  // Total de descargos del período (todos los tipos: per-restaurante + nivel hotel).
  // Función escalar SECURITY DEFINER — bypasea RLS, devuelve un solo número.
  // Más robusta con PostgREST que las funciones RETURNS TABLE.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: descTotal, error: descErr } = await (supabase as any)
    .rpc('get_descargos_total', {
      p_hotel_id: hotelId,
      p_start:    startDate,
      p_end:      endDate,
    })

  if (descErr) {
    console.error('[getPeriodStats] get_descargos_total error:', JSON.stringify(descErr))
  }

  // descTotal es un escalar NUMERIC — puede llegar como número o string
  const hotelLevelDescargos = Number(descTotal) || 0

  type Row = {
    restaurant_id:   string
    restaurant_name: string
    date:            string
    pax:             number | null
    budget_rd_pax:   number | null
    budget_total_rd: number | null
    total_rd:        number | null
    descargos_rd:    number | null
  }

  const rows = (data ?? []) as Row[]

  if (rows.length === 0) {
    return {
      total_pax: 0, budget_rd_pax: 0, gross_per_pax_rd: 0, cost_per_pax_rd: 0,
      budget_total_rd: 0, total_rd: 0, descargos_rd: 0, net_total_rd: 0,
      saldo_rd: 0, execution_pct: 0, days_with_data: 0, restaurants: [],
    }
  }

  // PAX total = suma del máximo PAX por día (evita multiplicar por N restaurantes)
  const paxByDate: Record<string, number> = {}
  for (const row of rows) {
    const p = row.pax ?? 0
    if (!(row.date in paxByDate) || p > paxByDate[row.date]) {
      paxByDate[row.date] = p
    }
  }
  const totalPax     = Object.values(paxByDate).reduce((s, p) => s + p, 0)
  const daysWithData = Object.keys(paxByDate).length

  // Agregar por restaurante
  const byRestaurant = new Map<string, {
    restaurant_id:   string
    restaurant_name: string
    budget_rd_pax:   number
    budget_total_rd: number
    total_rd:        number
    descargos_rd:    number
  }>()

  for (const row of rows) {
    const key  = row.restaurant_id
    let   rest = byRestaurant.get(key)
    if (!rest) {
      rest = {
        restaurant_id:   row.restaurant_id,
        restaurant_name: row.restaurant_name,
        budget_rd_pax:   row.budget_rd_pax ?? 0,
        budget_total_rd: 0,
        total_rd:        0,
        descargos_rd:    0,
      }
      byRestaurant.set(key, rest)
    }
    rest.budget_total_rd += row.budget_total_rd ?? 0
    rest.total_rd        += row.total_rd        ?? 0
    rest.descargos_rd    += row.descargos_rd    ?? 0
    if (row.budget_rd_pax != null) rest.budget_rd_pax = row.budget_rd_pax
  }

  const restaurants: RestaurantPeriodStat[] = Array.from(byRestaurant.values())
    .map((r) => {
      const net = r.total_rd - r.descargos_rd
      return {
        ...r,
        net_total_rd:    net,
        cost_per_pax_rd: totalPax > 0 ? net / totalPax : 0,
        excedente_rd:    r.budget_total_rd - net,
        execution_pct:   r.budget_total_rd > 0 ? (net / r.budget_total_rd) * 100 : 0,
      }
    })
    .sort((a, b) => a.restaurant_name.localeCompare(b.restaurant_name, 'es'))

  const totalRd = restaurants.reduce((s, r) => s + r.total_rd, 0)
  // daily_hotel_summary.total_descargos_rd ya incluye TODOS los tipos:
  // - entradas manuales por restaurante (restaurant_id IS NOT NULL)
  // - importaciones históricas a nivel hotel (restaurant_id IS NULL)
  // NO sumamos restaurants.reduce(r.descargos_rd) para evitar doble conteo.
  const totalDescargos = hotelLevelDescargos
  const netTotalRd     = totalRd - totalDescargos
  const totalBudget   = restaurants.reduce((s, r) => s + r.budget_total_rd, 0)

  return {
    total_pax:        totalPax,
    budget_rd_pax:    totalPax > 0 ? totalBudget / totalPax : 0,
    gross_per_pax_rd: totalPax > 0 ? totalRd / totalPax : 0,
    cost_per_pax_rd:  totalPax > 0 ? netTotalRd / totalPax : 0,
    budget_total_rd:  totalBudget,
    total_rd:         totalRd,
    descargos_rd:     totalDescargos,
    net_total_rd:     netTotalRd,
    saldo_rd:         totalBudget - netTotalRd,
    execution_pct:    totalBudget > 0 ? (netTotalRd / totalBudget) * 100 : 0,
    days_with_data:   daysWithData,
    restaurants,
  }
}

// ─── Estadísticas de rango de fechas ────────────────────────────────────────

/**
 * Agrega costos consolidados (ALM + CARN + VEG) de un rango de fechas.
 * Útil para el modo "rango" del dashboard.
 *
 * Agrupa por fecha para evitar duplicar el PAX (hay N restaurantes por día).
 */
export async function getDateRangeStats(
  hotelId:   string,
  startDate: string,
  endDate:   string
): Promise<DateRangeStats> {
  const { data, error } = await supabase
    .from('daily_cost_consolidated')
    .select('date, total_rd, budget_total_rd, alm_total_rd, carn_total_rd, veg_total_rd, pax')
    .eq('hotel_id', hotelId)
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw error

  type Row = {
    date:            string
    total_rd:        number
    budget_total_rd: number
    alm_total_rd:    number
    carn_total_rd:   number
    veg_total_rd:    number
    pax:             number | null
  }

  // Agrupar por fecha (varios restaurantes por día)
  const byDate: Record<string, {
    total_rd:  number
    budget_rd: number
    alm_rd:    number
    carn_rd:   number
    veg_rd:    number
    pax:       number
  }> = {}

  for (const row of (data ?? []) as Row[]) {
    if (!byDate[row.date]) {
      byDate[row.date] = { total_rd: 0, budget_rd: 0, alm_rd: 0, carn_rd: 0, veg_rd: 0, pax: 0 }
    }
    byDate[row.date].total_rd  += row.total_rd        ?? 0
    byDate[row.date].budget_rd += row.budget_total_rd ?? 0
    byDate[row.date].alm_rd   += row.alm_total_rd    ?? 0
    byDate[row.date].carn_rd  += row.carn_total_rd   ?? 0
    byDate[row.date].veg_rd   += row.veg_total_rd    ?? 0
    // PAX es el mismo para todos los restaurantes del mismo día
    byDate[row.date].pax = Math.max(byDate[row.date].pax, row.pax ?? 0)
  }

  const dates       = Object.values(byDate)
  const totalRd     = dates.reduce((s, d) => s + d.total_rd,  0)
  const totalBudget = dates.reduce((s, d) => s + d.budget_rd, 0)
  const totalPax    = dates.reduce((s, d) => s + d.pax,       0)

  return {
    days_with_data:  dates.length,
    total_rd:        totalRd,
    budget_total_rd: totalBudget,
    total_pax:       totalPax,
    total_alm_rd:    dates.reduce((s, d) => s + d.alm_rd,  0),
    total_carn_rd:   dates.reduce((s, d) => s + d.carn_rd, 0),
    total_veg_rd:    dates.reduce((s, d) => s + d.veg_rd,  0),
    cost_per_pax_rd: totalPax > 0 ? totalRd / totalPax : 0,
    execution_pct:   totalBudget > 0 ? (totalRd / totalBudget) * 100 : 0,
    variance_rd:     totalRd - totalBudget,
  }
}
