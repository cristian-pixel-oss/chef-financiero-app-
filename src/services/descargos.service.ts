/**
 * CHEF FINANCIERO — Servicio de Descargos
 *
 * Descargos = ingresos por clientes de otros hoteles que cenan en
 * nuestros restaurantes. Se restan del gasto ALM para obtener el
 * costo neto: COSTO NETO = GASTO ALM − DESCARGOS
 */

import { supabase } from '@/lib/supabase/client'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface Descargo {
  id:            string
  user_id:       string
  hotel_id:      string
  restaurant_id: string
  date:          string
  amount_usd:    number
  amount_rd:     number
  exchange_rate: number
  notes:         string | null
  created_at:    string
  updated_at:    string
}

export interface DescargoUpsert {
  user_id:       string
  hotel_id:      string
  restaurant_id: string
  date:          string
  amount_usd:    number
  amount_rd:     number
  exchange_rate: number
  notes?:        string | null
}

/** Fila en el formulario de descargos: un restaurante + sus valores del día */
export interface DescargoRow {
  restaurant_id:   string
  restaurant_name: string
  sort_order:      number
  amount_usd:      number
  amount_rd:       number
  notes:           string
  saved:           boolean   // tiene registro en BD
}

// ─── Funciones ────────────────────────────────────────────────────────────────

/**
 * Obtiene todos los descargos de un hotel para una fecha.
 */
export async function getDescargosByDate(
  hotelId: string,
  date:    string
): Promise<Descargo[]> {
  const { data, error } = await supabase
    .from('daily_descargos')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('date', date)
    .order('restaurant_id')

  if (error) throw error
  return (data ?? []) as Descargo[]
}

/**
 * Crea o actualiza el descargo de un restaurante en una fecha.
 * Usa UNIQUE(restaurant_id, date).
 */
export async function upsertDescargo(row: DescargoUpsert): Promise<Descargo> {
  const { data, error } = await supabase
    .from('daily_descargos')
    .upsert(row, { onConflict: 'restaurant_id,date' })
    .select()
    .single()

  if (error) throw error
  return data as Descargo
}

/**
 * Elimina el descargo de un restaurante en una fecha.
 * Se llama cuando el usuario pone amount_usd = 0.
 */
export async function deleteDescargo(
  restaurantId: string,
  date:         string
): Promise<void> {
  const { error } = await supabase
    .from('daily_descargos')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('date', date)

  if (error) throw error
}

/**
 * Obtiene los descargos de un hotel en un rango de fechas,
 * agrupados por restaurante (para el dashboard).
 */
export async function getDescargosByRange(
  hotelId:   string,
  startDate: string,
  endDate:   string
): Promise<{ restaurant_id: string; total_usd: number; total_rd: number }[]> {
  const { data, error } = await supabase
    .from('daily_descargos')
    .select('restaurant_id, amount_usd, amount_rd')
    .eq('hotel_id', hotelId)
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw error

  const byRest: Record<string, { total_usd: number; total_rd: number }> = {}
  for (const row of (data ?? []) as { restaurant_id: string; amount_usd: number; amount_rd: number }[]) {
    if (!byRest[row.restaurant_id]) byRest[row.restaurant_id] = { total_usd: 0, total_rd: 0 }
    byRest[row.restaurant_id].total_usd += row.amount_usd ?? 0
    byRest[row.restaurant_id].total_rd  += row.amount_rd  ?? 0
  }

  return Object.entries(byRest).map(([restaurant_id, v]) => ({ restaurant_id, ...v }))
}
