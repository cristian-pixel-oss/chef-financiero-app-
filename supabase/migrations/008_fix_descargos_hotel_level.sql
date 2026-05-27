-- ============================================================
-- CHEF FINANCIERO — Migration 008
-- Corrige daily_hotel_summary para incluir descargos a nivel
-- hotel (restaurant_id IS NULL), que son los datos históricos
-- importados con la migración 007.
--
-- ROOT CAUSE: la vista anterior hacía JOIN en restaurant_id,
-- pero los registros históricos tienen restaurant_id = NULL
-- → descargos_rd siempre era 0.
--
-- FIX: cambiar el subquery de descargos para agrupar por
-- hotel_id + date en lugar de restaurant_id + date.
-- Esto captura TODOS los descargos del hotel (per-restaurante
-- Y nivel-hotel) sin doble conteo.
-- ============================================================

DROP VIEW IF EXISTS daily_hotel_summary;

CREATE OR REPLACE VIEW daily_hotel_summary
WITH (security_invoker = true)
AS
SELECT
  r.hotel_id,
  r.user_id,
  fo.date,
  od.pax,

  -- ALM bruto
  ROUND(SUM(
    COALESCE(fo.viveres_rd,0) + COALESCE(fo.nevera_rd,0) + COALESCE(fo.extras_rd,0)
  )::NUMERIC, 2)                                              AS total_alm_rd,

  -- Descargos totales del hotel (per-restaurante + nivel-hotel)
  ROUND(COALESCE(dd.descargos_rd, 0)::NUMERIC, 2)            AS total_descargos_rd,

  -- Costo neto = ALM − Descargos
  ROUND((
    SUM(COALESCE(fo.viveres_rd,0) + COALESCE(fo.nevera_rd,0) + COALESCE(fo.extras_rd,0))
    - COALESCE(dd.descargos_rd, 0)
  )::NUMERIC, 2)                                              AS net_total_rd,

  -- Carn/veg informativos
  ROUND(SUM(COALESCE(pp.carn_total_rd, 0))::NUMERIC, 2)      AS total_carn_rd,
  ROUND(SUM(COALESCE(pp.veg_total_rd,  0))::NUMERIC, 2)      AS total_veg_rd,

  -- total_rd = ALM (compatible con código existente)
  ROUND(SUM(
    COALESCE(fo.viveres_rd,0) + COALESCE(fo.nevera_rd,0) + COALESCE(fo.extras_rd,0)
  )::NUMERIC, 2)                                              AS total_rd,

  -- Presupuesto (con fallback a budget_restaurants)
  ROUND(SUM(
    COALESCE(NULLIF(fo.budget_rd_pax, 0), br_budget.budget_rd_pax, 0) * COALESCE(od.pax, 0)
  )::NUMERIC, 2)                                              AS budget_total_rd,

  -- RD$/PAX sobre costo neto
  CASE WHEN COALESCE(od.pax, 0) > 0 THEN
    ROUND((
      SUM(COALESCE(fo.viveres_rd,0) + COALESCE(fo.nevera_rd,0) + COALESCE(fo.extras_rd,0))
      - COALESCE(dd.descargos_rd, 0)
    ) / od.pax, 2)
    ELSE 0
  END                                                         AS cost_per_pax_rd,

  -- % ejecución sobre costo neto
  CASE WHEN SUM(
    COALESCE(NULLIF(fo.budget_rd_pax, 0), br_budget.budget_rd_pax, 0) * COALESCE(od.pax, 0)
  ) > 0 THEN
    ROUND((
      (SUM(COALESCE(fo.viveres_rd,0) + COALESCE(fo.nevera_rd,0) + COALESCE(fo.extras_rd,0))
       - COALESCE(dd.descargos_rd, 0))
      / SUM(COALESCE(NULLIF(fo.budget_rd_pax, 0), br_budget.budget_rd_pax, 0) * COALESCE(od.pax, 0))
    ) * 100, 2)
    ELSE 0
  END                                                         AS execution_pct,

  -- Varianza sobre costo neto
  ROUND((
    SUM(COALESCE(fo.viveres_rd,0) + COALESCE(fo.nevera_rd,0) + COALESCE(fo.extras_rd,0))
    - COALESCE(dd.descargos_rd, 0)
    - SUM(COALESCE(NULLIF(fo.budget_rd_pax, 0), br_budget.budget_rd_pax, 0) * COALESCE(od.pax, 0))
  )::NUMERIC, 2)                                              AS variance_rd

FROM restaurants r

JOIN  daily_food_orders fo ON fo.restaurant_id = r.id

LEFT JOIN occupancy_daily od
       ON od.hotel_id = r.hotel_id
      AND od.date     = fo.date

LEFT JOIN LATERAL (
  SELECT budget_rd_pax
  FROM   budget_restaurants br
  WHERE  br.restaurant_id = r.id
    AND  br.year  = EXTRACT(YEAR  FROM fo.date)::INTEGER
    AND  (br.month = EXTRACT(MONTH FROM fo.date)::INTEGER OR br.month IS NULL)
  ORDER BY br.month NULLS LAST
  LIMIT 1
) br_budget ON TRUE

-- FIX: JOIN por hotel_id + date captura TODOS los descargos:
--   • restaurant_id IS NOT NULL  → descargos manuales por restaurante
--   • restaurant_id IS NULL      → descargos históricos a nivel hotel
LEFT JOIN (
  SELECT hotel_id, date, SUM(amount_rd) AS descargos_rd
  FROM   daily_descargos
  GROUP  BY hotel_id, date
) dd ON dd.hotel_id = r.hotel_id AND dd.date = fo.date

LEFT JOIN (
  SELECT
    dpo.restaurant_id, dpo.date,
    SUM(CASE WHEN p.category = 'proteina'
          THEN COALESCE(dpo.price_rd_kg, p.price_rd) * dpo.quantity_kg ELSE 0 END) AS carn_total_rd,
    SUM(CASE WHEN p.category = 'vegetal'
          THEN COALESCE(dpo.price_rd_kg, p.price_rd) * dpo.quantity_kg ELSE 0 END) AS veg_total_rd
  FROM   daily_protein_orders dpo
  JOIN   products p ON p.id = dpo.product_id
  GROUP  BY dpo.restaurant_id, dpo.date
) pp ON pp.restaurant_id = r.id AND pp.date = fo.date

GROUP BY r.hotel_id, r.user_id, fo.date, od.pax, dd.descargos_rd;
