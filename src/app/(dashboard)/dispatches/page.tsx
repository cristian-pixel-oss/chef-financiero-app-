'use client'

export const dynamic = 'force-dynamic'

/**
 * CHEF FINANCIERO — Despachos Carnes & Vegetales
 *
 * Matriz interactiva: Producto × Restaurante con input de Kg.
 * Equivale a las pestañas PED-CARN y PED-VEG del Excel.
 *
 * Estructura de datos:
 *   matrix[productId][restaurantId] = "quantity_kg" (string para el input)
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase }              from '@/lib/supabase/client'
import { useHotelId }            from '@/hooks/useHotelId'
import { upsertProteinOrder, deleteProteinOrder } from '@/services/proteins.service'
import type { Product, Restaurant } from '@/types/database.types'

// ─── Etiquetas de subcategoría ────────────────────────────────────────────────

const SUBCAT_LABELS: Record<string, string> = {
  res:       '🥩 Res',
  aves:      '🐔 Aves',
  cerdo:     '🐷 Cerdo',
  cordero:   '🐑 Cordero',
  mariscos:  '🦐 Mariscos',
  pescado:   '🐟 Pescado',
  embutido:  '🌭 Embutidos',
  verdura:   '🥬 Verduras',
  fruta:     '🍊 Frutas',
  tuberculo: '🥔 Tubérculos',
}

const PROT_ORDER: string[] = ['res', 'aves', 'cerdo', 'cordero', 'mariscos', 'pescado', 'embutido']
const VEG_ORDER:  string[] = ['verdura', 'fruta', 'tuberculo']

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Matriz: productId → restaurantId → string (valor del input) */
type Matrix = Record<string, Record<string, string>>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtKg(n: number) {
  return new Intl.NumberFormat('es-DO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 3,
  }).format(n)
}

function fmtRD(n: number) {
  return new Intl.NumberFormat('es-DO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ProteinsPage() {
  const today = new Date().toISOString().split('T')[0]

  // ── Estado principal
  const [date,        setDate]        = useState(today)
  const [activeTab,   setActiveTab]   = useState<'proteina' | 'vegetal'>('proteina')
  const { hotelId, hotelLoading: loadingHotel } = useHotelId()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [products,    setProducts]    = useState<Product[]>([])

  // ── Estado de la matriz
  const [matrix,         setMatrix]         = useState<Matrix>({})
  const [originalOrders, setOriginalOrders] = useState<Set<string>>(new Set())

  // ── Estado de UI
  const [loadingData,  setLoadingData]  = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [savedAt,      setSavedAt]      = useState<Date | null>(null)
  const [error,        setError]        = useState<string | null>(null)

  // ── 1. Cargar restaurantes cuando hotelId esté listo
  useEffect(() => {
    if (!hotelId) return
    let cancelled = false
    async function init() {
      try {
        const { data: rests, error: rErr } = await supabase
          .from('restaurants')
          .select('*')
          .eq('hotel_id', hotelId)
          .eq('active', true)
          .order('sort_order', { ascending: true })
        if (rErr) throw rErr
        if (!cancelled) setRestaurants((rests ?? []) as Restaurant[])
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error cargando restaurantes')
      }
    }
    init()
    return () => { cancelled = true }
  }, [hotelId])

  // ── 2. Cargar productos cuando cambia la pestaña o el hotel
  useEffect(() => {
    if (!hotelId) return
    supabase
      .from('products')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('category', activeTab)
      .eq('active', true)
      .order('subcategory', { ascending: true })
      .order('name', { ascending: true })
      .then(({ data, error: pErr }) => {
        if (pErr) { setError(pErr.message); return }
        setProducts((data ?? []) as Product[])
      })
  }, [hotelId, activeTab])

  // ── 3. Cargar despachos existentes al cambiar fecha, restaurantes o pestaña
  const loadOrders = useCallback(async () => {
    if (!hotelId || restaurants.length === 0) return
    setLoadingData(true)
    setError(null)
    try {
      const restaurantIds = restaurants.map((r) => r.id)
      const { data, error: oErr } = await supabase
        .from('daily_protein_orders_view')
        .select('product_id, restaurant_id, quantity_kg, product_category')
        .eq('date', date)
        .in('restaurant_id', restaurantIds)

      if (oErr) throw oErr

      type OrderRow = {
        product_id:       string | null
        restaurant_id:    string
        quantity_kg:      number
        product_category: string
      }

      const newMatrix: Matrix = {}
      const keys = new Set<string>()

      ;((data ?? []) as OrderRow[])
        .filter((o) => o.product_category === activeTab)
        .forEach((o) => {
          if (!o.product_id) return
          if (!newMatrix[o.product_id]) newMatrix[o.product_id] = {}
          newMatrix[o.product_id][o.restaurant_id] = String(o.quantity_kg ?? '')
          keys.add(`${o.product_id}|${o.restaurant_id}`)
        })

      setMatrix(newMatrix)
      setOriginalOrders(keys)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error cargando despachos')
    } finally {
      setLoadingData(false)
    }
  }, [hotelId, date, restaurants, activeTab])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  // ── Actualizar una celda de la matriz
  const updateCell = useCallback(
    (productId: string, restaurantId: string, value: string) => {
      setSavedAt(null)
      setMatrix((prev) => ({
        ...prev,
        [productId]: {
          ...(prev[productId] ?? {}),
          [restaurantId]: value,
        },
      }))
    },
    []
  )

  // ── Guardar despacho completo
  const handleSave = useCallback(async () => {
    if (!hotelId || products.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const toUpsert: Array<{
        product: Product
        restaurantId: string
        qty: number
      }> = []
      const toDelete: Array<{ productId: string; restaurantId: string }> = []

      for (const product of products) {
        for (const restaurant of restaurants) {
          const key     = `${product.id}|${restaurant.id}`
          const rawVal  = matrix[product.id]?.[restaurant.id] ?? ''
          const qty     = parseFloat(rawVal) || 0
          const wasOrig = originalOrders.has(key)

          if (qty > 0) {
            toUpsert.push({ product, restaurantId: restaurant.id, qty })
          } else if (wasOrig) {
            toDelete.push({ productId: product.id, restaurantId: restaurant.id })
          }
        }
      }

      await Promise.all([
        ...toUpsert.map(({ product, restaurantId, qty }) =>
          upsertProteinOrder({
            user_id:       user.id,
            restaurant_id: restaurantId,
            product_id:    product.id,
            date,
            price_rd_kg:   product.price_rd,
            quantity_kg:   qty,
            order_type:    'normal',
            notes:         null,
          })
        ),
        ...toDelete.map(({ productId, restaurantId }) =>
          deleteProteinOrder(restaurantId, productId, date)
        ),
      ])

      setSavedAt(new Date())
      await loadOrders()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error guardando despacho')
    } finally {
      setSaving(false)
    }
  }, [hotelId, products, restaurants, matrix, originalOrders, date, loadOrders])

  // ── Productos agrupados por subcategoría
  const grouped = useMemo<[string, Product[]][]>(() => {
    const order = activeTab === 'proteina' ? PROT_ORDER : VEG_ORDER
    const map: Record<string, Product[]> = {}
    products.forEach((p) => {
      const sub = p.subcategory ?? 'otro'
      if (!map[sub]) map[sub] = []
      map[sub].push(p)
    })
    const result: [string, Product[]][] = []
    order.forEach((k) => { if (map[k]) result.push([k, map[k]]) })
    Object.keys(map).forEach((k) => { if (!order.includes(k)) result.push([k, map[k]]) })
    return result
  }, [products, activeTab])

  // ── Totales por restaurante
  const restaurantTotals = useMemo(() => {
    const totals: Record<string, { kg: number; rd: number }> = {}
    restaurants.forEach((r) => { totals[r.id] = { kg: 0, rd: 0 } })
    products.forEach((product) => {
      restaurants.forEach((r) => {
        const qty = parseFloat(matrix[product.id]?.[r.id] ?? '') || 0
        if (qty > 0) {
          totals[r.id].kg += qty
          totals[r.id].rd += qty * product.price_rd
        }
      })
    })
    return totals
  }, [matrix, products, restaurants])

  // ── Totales generales
  const grandTotal = useMemo(
    () =>
      Object.values(restaurantTotals).reduce(
        (acc, t) => ({ kg: acc.kg + t.kg, rd: acc.rd + t.rd }),
        { kg: 0, rd: 0 }
      ),
    [restaurantTotals]
  )

  const restsWithOrders  = Object.values(restaurantTotals).filter((t) => t.kg > 0).length
  const prodsWithOrders  = products.filter((p) =>
    restaurants.some((r) => (parseFloat(matrix[p.id]?.[r.id] ?? '') || 0) > 0)
  ).length

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loadingHotel) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
      </div>
    )
  }

  if (!hotelId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">No hay hoteles configurados. Ejecuta el seed.sql en Supabase.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 max-w-full">

      {/* ── Encabezado ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Despachos{' '}
            <span className="text-amber-400">Carnes &amp; Vegetales</span>
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Matriz de despacho por restaurante — cantidades en Kg
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de fecha */}
          <input
            type="date"
            value={date}
            onChange={(e) => { setDate(e.target.value); setSavedAt(null) }}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                       text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />

          {/* Toggle categoría */}
          <div className="flex bg-gray-800 rounded-lg p-1 gap-1">
            {(['proteina', 'vegetal'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSavedAt(null) }}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                  activeTab === tab
                    ? 'bg-amber-400 text-gray-900'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab === 'proteina' ? '🥩 Carnes' : '🥬 Vegetales'}
              </button>
            ))}
          </div>

          {/* Botón guardar */}
          <button
            onClick={handleSave}
            disabled={saving || loadingData}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
              saving || loadingData
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-amber-400 text-gray-900 hover:bg-amber-300 active:scale-95'
            }`}
          >
            {saving ? 'Guardando…' : '💾 Guardar despacho'}
          </button>
        </div>
      </div>

      {/* ── Mensajes de estado ───────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3">
          <p className="text-red-400 text-sm">⚠ {error}</p>
        </div>
      )}
      {savedAt && !error && (
        <div className="bg-green-900/30 border border-green-700 rounded-xl px-4 py-3">
          <p className="text-green-400 text-sm">
            ✓ Despacho guardado a las {savedAt.toLocaleTimeString('es-DO')}
          </p>
        </div>
      )}

      {/* ── KPIs de resumen ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Total Kg despachados</p>
          <p className="text-white text-xl font-bold tabular-nums">
            {fmtKg(grandTotal.kg)} Kg
          </p>
        </div>
        <div className="bg-gray-900 border border-amber-500/30 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Costo total RD$</p>
          <p className="text-amber-400 text-xl font-bold tabular-nums">
            RD$ {fmtRD(grandTotal.rd)}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Restaurantes con pedido</p>
          <p className="text-white text-xl font-bold">
            {restsWithOrders}
            <span className="text-gray-500 text-sm font-normal"> / {restaurants.length}</span>
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Productos despachados</p>
          <p className="text-white text-xl font-bold">
            {prodsWithOrders}
            <span className="text-gray-500 text-sm font-normal"> / {products.length}</span>
          </p>
        </div>
      </div>

      {/* ── Tabla matriz ─────────────────────────────────────────────────────── */}
      {loadingData ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
        </div>
      ) : (
        <div
          style={{
            overflowX: 'scroll',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 320px)',
            minHeight: '400px',
            borderRadius: '0.75rem',
            border: '1px solid #1f2937',
            background: '#111827',
          }}
        >
          <table
            className="text-sm border-collapse"
            style={{ minWidth: '2800px' }}
          >
              {/* ── Cabecera ── */}
              <thead>
                <tr style={{ borderBottom: '1px solid #374151', backgroundColor: '#111827' }}>
                  {/* Columna producto — sticky left + sticky top (celda intersección) */}
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      left: 0,
                      zIndex: 50,          /* máximo: sticky en ambas direcciones */
                      backgroundColor: '#111827',
                      width: 200,
                      minWidth: 200,
                      textAlign: 'left',
                      padding: '12px 16px',
                      color: '#9ca3af',
                      fontWeight: 500,
                      borderRight: '1px solid #1f2937',
                      borderBottom: '1px solid #374151',
                    }}
                  >
                    Producto
                  </th>
                  {/* RD$/Kg — sticky left + sticky top (celda intersección) */}
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      left: 200,
                      zIndex: 50,          /* máximo: sticky en ambas direcciones */
                      backgroundColor: '#111827',
                      width: 90,
                      minWidth: 90,
                      textAlign: 'right',
                      padding: '12px 12px',
                      color: '#9ca3af',
                      fontWeight: 500,
                      borderRight: '1px solid #1f2937',
                      borderBottom: '1px solid #374151',
                    }}
                  >
                    RD$/Kg
                  </th>
                  {/* Una columna por restaurante — sticky top */}
                  {restaurants.map((r) => (
                    <th
                      key={r.id}
                      style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 40,
                        backgroundColor: '#111827',
                        minWidth: '88px',
                        textAlign: 'center',
                        padding: '8px 6px',
                        color: '#9ca3af',
                        fontWeight: 500,
                        borderLeft: '1px solid #1f2937',
                        borderBottom: '1px solid #374151',
                        fontSize: '0.7rem',
                        lineHeight: '1.2',
                      }}
                    >
                      {r.name}
                    </th>
                  ))}
                  {/* Totales de fila — sticky top */}
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 40,
                      backgroundColor: '#0d1320',
                      minWidth: '100px',
                      textAlign: 'right',
                      padding: '12px',
                      color: '#fbbf24',
                      fontWeight: 500,
                      borderLeft: '1px solid #374151',
                      borderBottom: '1px solid #374151',
                    }}
                  >
                    Kg total
                  </th>
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 40,
                      backgroundColor: '#0d1320',
                      minWidth: '110px',
                      textAlign: 'right',
                      padding: '12px',
                      color: '#fbbf24',
                      fontWeight: 500,
                      borderBottom: '1px solid #374151',
                    }}
                  >
                    RD$ total
                  </th>
                </tr>
              </thead>

              {/* ── Cuerpo ── */}
              <tbody>
                {grouped.length === 0 ? (
                  <tr>
                    <td
                      colSpan={restaurants.length + 4}
                      className="text-center py-16 text-gray-500"
                    >
                      No hay productos en esta categoría
                    </td>
                  </tr>
                ) : (
                  grouped.map(([sub, prods]) => (
                    <>
                      {/* Encabezado de subcategoría */}
                      <tr key={`hdr-${sub}`}>
                        <td
                          colSpan={restaurants.length + 4}
                          className="px-4 py-1.5 text-xs font-semibold text-amber-400/80
                                     uppercase tracking-widest bg-gray-800/50 border-t border-gray-800"
                        >
                          {SUBCAT_LABELS[sub] ?? sub}
                        </td>
                      </tr>

                      {/* Filas de producto */}
                      {prods.map((product) => {
                        const rowKg = restaurants.reduce(
                          (acc, r) => acc + (parseFloat(matrix[product.id]?.[r.id] ?? '') || 0),
                          0
                        )
                        const rowRd = rowKg > 0
                          ? restaurants.reduce((acc, r) => {
                              const qty = parseFloat(matrix[product.id]?.[r.id] ?? '') || 0
                              return acc + qty * product.price_rd
                            }, 0)
                          : 0

                        return (
                          <tr
                            key={product.id}
                            className={`border-b border-gray-800/40 transition-colors ${
                              rowKg > 0
                                ? 'bg-amber-400/5 hover:bg-amber-400/10'
                                : 'hover:bg-gray-800/30'
                            }`}
                          >
                            {/* Nombre producto (sticky) */}
                            <td
                              style={{
                                position: 'sticky',
                                left: 0,
                                zIndex: 20,
                                backgroundColor: rowKg > 0 ? '#16202e' : '#111827',
                                padding: '8px 16px',
                                color: '#e5e7eb',
                                fontWeight: 500,
                                borderRight: '1px solid #1f2937',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {product.name}
                            </td>

                            {/* Precio referencia (sticky junto al nombre) */}
                            <td
                              style={{
                                position: 'sticky',
                                left: 200,
                                zIndex: 20,
                                backgroundColor: rowKg > 0 ? '#16202e' : '#111827',
                                padding: '8px 12px',
                                textAlign: 'right',
                                color: '#9ca3af',
                                fontFamily: 'tabular-nums',
                                borderRight: '1px solid #1f2937',
                              }}
                            >
                              {fmtRD(product.price_rd)}
                            </td>

                            {/* Input Kg por restaurante */}
                            {restaurants.map((r) => {
                              const val = matrix[product.id]?.[r.id] ?? ''
                              const qty = parseFloat(val) || 0
                              return (
                                <td
                                  key={r.id}
                                  className="px-1 py-1.5 border-l border-gray-800 align-top"
                                >
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={val}
                                    onChange={(e) =>
                                      updateCell(product.id, r.id, e.target.value)
                                    }
                                    placeholder="—"
                                    className={`w-full rounded px-2 py-1 text-right text-sm
                                               tabular-nums focus:outline-none focus:ring-1
                                               focus:ring-amber-400 placeholder-gray-600
                                               transition-colors ${
                                                 qty > 0
                                                   ? 'bg-amber-400/10 border border-amber-500/50 text-white'
                                                   : 'bg-gray-800 border border-gray-700 text-gray-400'
                                               }`}
                                    style={{ width: '76px' }}
                                  />
                                  {qty > 0 && (
                                    <div className="text-center text-xs text-amber-400/60 mt-0.5 tabular-nums">
                                      {fmtRD(qty * product.price_rd)}
                                    </div>
                                  )}
                                </td>
                              )
                            })}

                            {/* Total fila */}
                            <td className="px-3 py-2 text-right font-semibold tabular-nums border-l border-gray-700 bg-gray-950/30">
                              <span className={rowKg > 0 ? 'text-white' : 'text-gray-600'}>
                                {rowKg > 0 ? `${fmtKg(rowKg)} Kg` : '—'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums bg-gray-950/30">
                              <span className={rowRd > 0 ? 'text-amber-400' : 'text-gray-600'}>
                                {rowRd > 0 ? `RD$ ${fmtRD(rowRd)}` : '—'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </>
                  ))
                )}
              </tbody>

              {/* ── Pie: totales por restaurante ── */}
              <tfoot>
                {/* Fila Kg totales */}
                <tr style={{ borderTop: '2px solid #374151', backgroundColor: '#1a2436' }}>
                  <td
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 20,
                      backgroundColor: '#1a2436',
                      padding: '12px 16px',
                      color: '#ffffff',
                      fontWeight: 700,
                      borderRight: '1px solid #374151',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Total Kg
                  </td>
                  <td
                    style={{
                      position: 'sticky',
                      left: 200,
                      zIndex: 20,
                      backgroundColor: '#1a2436',
                      padding: '12px',
                      borderRight: '1px solid #374151',
                    }}
                  />
                  {restaurants.map((r) => {
                    const kg = restaurantTotals[r.id]?.kg ?? 0
                    return (
                      <td
                        key={r.id}
                        className="px-2 py-3 text-center border-l border-gray-700"
                      >
                        <span
                          className={`text-sm font-semibold tabular-nums ${
                            kg > 0 ? 'text-white' : 'text-gray-600'
                          }`}
                        >
                          {kg > 0 ? `${fmtKg(kg)}` : '—'}
                        </span>
                      </td>
                    )
                  })}
                  <td className="px-3 py-3 text-right font-bold text-white tabular-nums border-l border-gray-700">
                    {fmtKg(grandTotal.kg)} Kg
                  </td>
                  <td />
                </tr>

                {/* Fila RD$ totales */}
                <tr style={{ backgroundColor: '#172030' }}>
                  <td
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 20,
                      backgroundColor: '#172030',
                      padding: '12px 16px',
                      color: '#fbbf24',
                      fontWeight: 700,
                      borderRight: '1px solid #374151',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Total RD$
                  </td>
                  <td
                    style={{
                      position: 'sticky',
                      left: 200,
                      zIndex: 20,
                      backgroundColor: '#172030',
                      padding: '12px',
                      borderRight: '1px solid #374151',
                    }}
                  />
                  {restaurants.map((r) => {
                    const rd = restaurantTotals[r.id]?.rd ?? 0
                    return (
                      <td
                        key={r.id}
                        className="px-2 py-3 text-center border-l border-gray-700"
                      >
                        <span
                          className={`text-sm font-semibold tabular-nums ${
                            rd > 0 ? 'text-amber-400' : 'text-gray-600'
                          }`}
                        >
                          {rd > 0 ? fmtRD(rd) : '—'}
                        </span>
                      </td>
                    )
                  })}
                  <td className="px-3 py-3 border-l border-gray-700" />
                  <td className="px-3 py-3 text-right font-bold text-amber-400 tabular-nums text-base">
                    RD$ {fmtRD(grandTotal.rd)}
                  </td>
                </tr>
              </tfoot>
            </table>
        </div>
      )}

      {/* ── Nota de ayuda ───────────────────────────────────────────────────── */}
      <p className="text-xs text-gray-600 text-right">
        Tip: ingresa 0 o vacía la celda para eliminar un despacho guardado · Los precios son snapshot del catálogo actual
      </p>
    </div>
  )
}
