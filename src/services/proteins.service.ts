/**
 * CHEF FINANCIERO — Servicio de Proteínas y Vegetales
 *
 * Lógica de negocio para el control de pedidos y mise en place.
 * Reemplaza la lógica de las pestañas PED-CARN, PED-VEG y PROT del Excel.
 */

import { supabase } from '@/lib/supabase/client'
import type {
  Product,
  ProductInsert,
  DailyProteinOrder,
  DailyProteinOrderInsert,
  ProteinControl,
  ProteinControlInsert,
  ProteinControlView,
  ProductCategory,
} from '@/types/database.types'

// ─── Catálogo de productos ───────────────────────────────────────────────────

/**
 * Obtiene el catálogo de proteínas o vegetales de un hotel.
 */
export async function getProducts(
  hotelId: string,
  category?: ProductCategory
) {
  let query = supabase
    .from('products')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('active', true)
    .order('subcategory')
    .order('name')

  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) throw error
  return data as Product[]
}

/**
 * Crea o actualiza un producto en el catálogo.
 */
export async function upsertProduct(product: ProductInsert) {
  const { data, error } = await supabase
    .from('products')
    .upsert(product)
    .select()
    .single()

  if (error) throw error
  return data as Product
}

/**
 * Actualiza el precio de un producto.
 * Cuando cambia el precio en el catálogo, los pedidos futuros
 * tomarán el nuevo precio. Los pedidos históricos conservan su snapshot.
 */
export async function updateProductPrice(productId: string, newPriceRd: number) {
  const { data, error } = await supabase
    .from('products')
    .update({ price_rd: newPriceRd, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .select()
    .single()

  if (error) throw error
  return data as Product
}

// ─── Pedidos diarios de proteínas ───────────────────────────────────────────

/**
 * Obtiene todos los pedidos de proteínas de un restaurante en una fecha.
 * Incluye nombre del producto, categoría y costo calculado.
 */
export async function getProteinOrdersByDate(
  restaurantId: string,
  date: string
) {
  const { data, error } = await supabase
    .from('daily_protein_orders_view')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('date', date)
    .order('product_category')
    .order('product_name')

  if (error) throw error
  return data
}

/**
 * Obtiene el resumen de pedidos de proteínas de TODOS los restaurantes
 * de un hotel en una fecha determinada.
 * Equivale a la vista horizontal del Excel (PED-CARN).
 */
export async function getAllRestaurantsProteinOrders(
  hotelId: string,
  date: string
) {
  // Two-step: fetch restaurant IDs first, then query orders
  const { data: rests, error: rErr } = await supabase
    .from('restaurants')
    .select('id')
    .eq('hotel_id', hotelId)
  if (rErr) throw rErr
  const restaurantIds = (rests ?? []).map((r: { id: string }) => r.id)
  if (restaurantIds.length === 0) return []

  const { data, error } = await supabase
    .from('daily_protein_orders_view')
    .select('*')
    .eq('date', date)
    .in('restaurant_id', restaurantIds)
    .order('restaurant_name')
    .order('product_category')
    .order('product_name')

  if (error) throw error
  return (data ?? []) as DailyProteinOrder[]
}

/**
 * Crea o actualiza un pedido de proteínas.
 * Automáticamente hace snapshot del precio actual del producto.
 */
export async function upsertProteinOrder(
  order: Omit<DailyProteinOrderInsert, 'price_rd_kg'> & { price_rd_kg?: number }
) {
  // Si no viene el precio, lo buscamos del catálogo
  let price = order.price_rd_kg
  if (!price && order.product_id) {
    const { data: product } = await supabase
      .from('products')
      .select('price_rd')
      .eq('id', order.product_id)
      .single()
    price = product?.price_rd ?? 0
  }

  const { data, error } = await supabase
    .from('daily_protein_orders')
    .upsert({ ...order, price_rd_kg: price }, { onConflict: 'restaurant_id,product_id,date' })
    .select()
    .single()

  if (error) throw error
  return data as DailyProteinOrder
}

/**
 * Elimina un pedido de proteínas.
 */
export async function deleteProteinOrder(
  restaurantId: string,
  productId: string,
  date: string
) {
  const { error } = await supabase
    .from('daily_protein_orders')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('product_id', productId)
    .eq('date', date)

  if (error) throw error
}

// ─── Control de mise en place (proteínas) ───────────────────────────────────

/**
 * Obtiene el control de proteínas de un restaurante en una fecha,
 * incluyendo todos los KPIs calculados (kg consumido, g/PAX, desviación).
 * Equivale a la hoja PROT del Excel.
 */
export async function getProteinControl(restaurantId: string, date: string) {
  const { data, error } = await supabase
    .from('protein_control_view')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('date', date)
    .maybeSingle()

  if (error) throw error
  return data as ProteinControlView | null
}

/**
 * Obtiene el control de proteínas de todos los restaurantes de un hotel
 * para una fecha, con sus KPIs.
 */
export async function getAllRestaurantsProteinControl(
  hotelId: string,
  date: string
) {
  const { data: rests, error: rErr } = await supabase
    .from('restaurants')
    .select('id')
    .eq('hotel_id', hotelId)
  if (rErr) throw rErr
  const restaurantIds = (rests ?? []).map((r: { id: string }) => r.id)
  if (restaurantIds.length === 0) return []

  const { data, error } = await supabase
    .from('protein_control_view')
    .select('*')
    .eq('date', date)
    .in('restaurant_id', restaurantIds)
    .order('restaurant_name')

  if (error) throw error
  return (data ?? []) as ProteinControlView[]
}

/**
 * Crea o actualiza el registro de control de mise en place.
 *
 * IMPORTANTE: kg_mise_en_place y total_cost_rd se calculan automáticamente
 * sumando los pedidos de daily_protein_orders para ese restaurante y fecha.
 * El frontend puede pasar los valores precalculados o dejar que la BD los calcule
 * via trigger (si se implementa en el futuro).
 */
export async function upsertProteinControl(control: ProteinControlInsert) {
  // Calcular kg_mise_en_place y total_cost desde los pedidos si no vienen
  if (!control.kg_mise_en_place || !control.total_cost_rd) {
    const { data: orders } = await supabase
      .from('daily_protein_orders_view')
      .select('quantity_kg, cost_rd')
      .eq('restaurant_id', control.restaurant_id)
      .eq('date', control.date)

    if (orders) {
      control.kg_mise_en_place = orders.reduce((s, o) => s + (o.quantity_kg ?? 0), 0)
      control.total_cost_rd    = orders.reduce((s, o) => s + ((o as any).cost_rd ?? 0), 0)
    }
  }

  const { data, error } = await supabase
    .from('protein_control')
    .upsert(control, { onConflict: 'restaurant_id,date' })
    .select()
    .single()

  if (error) throw error
  return data as ProteinControl
}

/**
 * Resumen mensual de proteínas por restaurante.
 * Equivale al DASH-MES del Excel.
 */
export async function getMonthlyProteinSummary(
  hotelId: string,
  year: number,
  month: number
) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate   = new Date(year, month, 0).toISOString().split('T')[0]

  const { data: rests, error: rErr } = await supabase
    .from('restaurants')
    .select('id')
    .eq('hotel_id', hotelId)
  if (rErr) throw rErr
  const restaurantIds = (rests ?? []).map((r: { id: string }) => r.id)
  if (restaurantIds.length === 0) return []

  const { data, error } = await supabase
    .from('protein_control_view')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .in('restaurant_id', restaurantIds)

  if (error) throw error

  const grouped = ((data ?? []) as ProteinControlView[]).reduce(
    (acc, row: ProteinControlView) => {
      const key = row.restaurant_id
      if (!acc[key]) {
        acc[key] = {
          restaurant_id:    row.restaurant_id,
          restaurant_name:  row.restaurant_name,
          total_kg_consumed: 0,
          total_cost_rd:    0,
          total_pax:        0,
          days_count:       0,
          over_400g_days:   0,
        }
      }
      acc[key].total_kg_consumed += row.kg_consumed         ?? 0
      acc[key].total_cost_rd     += row.total_cost_rd       ?? 0
      acc[key].total_pax         += row.n_pax               ?? 0
      acc[key].days_count        += 1
      if ((row.deviation_vs_400g ?? 0) > 0) acc[key].over_400g_days += 1
      return acc
    },
    {} as Record<string, {
      restaurant_id:    string
      restaurant_name:  string
      total_kg_consumed: number
      total_cost_rd:    number
      total_pax:        number
      days_count:       number
      over_400g_days:   number
    }>
  )

  type GroupedRow = {
    restaurant_id:     string
    restaurant_name:   string
    total_kg_consumed: number
    total_cost_rd:     number
    total_pax:         number
    days_count:        number
    over_400g_days:    number
  }
  return (Object.values(grouped) as GroupedRow[]).map((r) => ({
    ...r,
    avg_g_per_pax:    r.total_pax > 0 ? (r.total_kg_consumed * 1000) / r.total_pax : 0,
    avg_cost_per_pax: r.total_pax > 0 ? r.total_cost_rd / r.total_pax : 0,
    over_400g_pct:    r.days_count > 0 ? (r.over_400g_days / r.days_count) * 100 : 0,
  }))
}
