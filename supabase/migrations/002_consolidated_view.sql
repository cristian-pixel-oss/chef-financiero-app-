-- ============================================================
-- CHEF FINANCIERO — Vista consolidada de costos
-- Migration 002 — Ejecutar en Supabase → SQL Editor
-- ============================================================

-- ── Vista: despacho de proteínas/vegetales con costo calculado ──
-- (reemplaza la anterior si existía)
DROP VIEW IF EXISTS daily_protein_orders_view;

CREATE OR REPLACE VIEW daily_protein_orders_view
WITH (security_invoker = true)
AS
SELECT
  dpo.id,
  dpo.restaurant_id,
  dpo.product_id,
  dpo.date,
  dpo.price_rd_kg,
  dpo.quantity_kg,
  dpo.order_type,
  dpo.notes,
  dpo.created_at,
  dpo.user_id,
  -- Campos del producto
  p.name            AS product_name,
  p.category        AS product_category,
  p.subcategory     AS product_subcategory,
  p.unit_of_measure AS product_uom,
  -- Campo del restaurante
  r.name            AS restaurant_name,
  r.hotel_id,
  -- Costo calculado
  ROUND((dpo.price_rd_kg * dpo.quantity_kg)::NUMERIC, 2) AS cost_rd
FROM daily_protein_orders dpo
JOIN products    p ON p.id = dpo.product_id
JOIN restaurants r ON r.id = dpo.restaurant_id;

-- ── Vista consolidada: ALM + CARN + VEG por restaurante y fecha ──
-- Esta vista es el corazón del dashboard JARVIS consolidado.
-- Equivale al cruce de archivos del Excel.

DROP VIEW IF EXISTS daily_cost_consolidated;

CREATE OR REPLACE VIEW daily_cost_consolidated
WITH (security_invoker = true)
AS
SELECT
  r.id                                         AS restaurant_id,
  r.name                                       AS restaurant_name,
  r.type                                       AS restaurant_type,
  r.hotel_id,
  r.user_id,
  fo.date,
  -- Ocupación del día
  od.pax,
  -- ── Costos de Almacén (víveres + nevera + extras) ──────────
  COALESCE(fo.viveres_rd, 0)                   AS viveres_rd,
  COALESCE(fo.nevera_rd,  0)                   AS nevera_rd,
  COALESCE(fo.extras_rd,  0)                   AS extras_rd,
  COALESCE(fo.viveres_rd, 0)
    + COALESCE(fo.nevera_rd, 0)
    + COALESCE(fo.extras_rd, 0)                AS alm_total_rd,
  -- ── Costos de Carnes (proteínas) ────────────────────────────
  COALESCE(pp.carn_total_rd, 0)                AS carn_total_rd,
  -- ── Costos de Vegetales ──────────────────────────────────────
  COALESCE(pp.veg_total_rd, 0)                 AS veg_total_rd,
  -- ── Total consolidado ────────────────────────────────────────
  COALESCE(fo.viveres_rd, 0)
    + COALESCE(fo.nevera_rd, 0)
    + COALESCE(fo.extras_rd, 0)
    + COALESCE(pp.carn_total_rd, 0)
    + COALESCE(pp.veg_total_rd, 0)             AS total_rd,
  -- ── Presupuesto ──────────────────────────────────────────────
  COALESCE(fo.budget_rd_pax, 0)                AS budget_rd_pax,
  COALESCE(fo.budget_rd_pax, 0)
    * COALESCE(od.pax, 0)                      AS budget_total_rd,
  -- ── KPIs calculados ──────────────────────────────────────────
  CASE WHEN COALESCE(od.pax, 0) > 0 THEN
    ROUND((
      COALESCE(fo.viveres_rd, 0)
      + COALESCE(fo.nevera_rd, 0)
      + COALESCE(fo.extras_rd, 0)
      + COALESCE(pp.carn_total_rd, 0)
      + COALESCE(pp.veg_total_rd, 0)
    ) / od.pax, 2)
    ELSE 0
  END                                           AS cost_per_pax_rd,
  CASE WHEN COALESCE(fo.budget_rd_pax, 0) * COALESCE(od.pax, 0) > 0 THEN
    ROUND((
      (COALESCE(fo.viveres_rd, 0)
       + COALESCE(fo.nevera_rd, 0)
       + COALESCE(fo.extras_rd, 0)
       + COALESCE(pp.carn_total_rd, 0)
       + COALESCE(pp.veg_total_rd, 0))
      / (fo.budget_rd_pax * od.pax)
    ) * 100, 2)
    ELSE 0
  END                                           AS execution_pct,
  -- ── Varianza ─────────────────────────────────────────────────
  (COALESCE(fo.viveres_rd, 0)
   + COALESCE(fo.nevera_rd, 0)
   + COALESCE(fo.extras_rd, 0)
   + COALESCE(pp.carn_total_rd, 0)
   + COALESCE(pp.veg_total_rd, 0))
  - (COALESCE(fo.budget_rd_pax, 0) * COALESCE(od.pax, 0))
                                                AS variance_rd

FROM restaurants r

-- Food orders (almacén)
LEFT JOIN daily_food_orders fo
       ON fo.restaurant_id = r.id

-- Ocupación del hotel
LEFT JOIN occupancy_daily od
       ON od.hotel_id = r.hotel_id
      AND od.date     = fo.date

-- Proteínas y vegetales agrupados por restaurante y fecha
LEFT JOIN (
  SELECT
    dpo.restaurant_id,
    dpo.date,
    ROUND(SUM(
      CASE WHEN p.category = 'proteina'
        THEN COALESCE(dpo.price_rd_kg, p.price_rd) * dpo.quantity_kg
        ELSE 0
      END
    )::NUMERIC, 2)                             AS carn_total_rd,
    ROUND(SUM(
      CASE WHEN p.category = 'vegetal'
        THEN COALESCE(dpo.price_rd_kg, p.price_rd) * dpo.quantity_kg
        ELSE 0
      END
    )::NUMERIC, 2)                             AS veg_total_rd
  FROM daily_protein_orders dpo
  JOIN products p ON p.id = dpo.product_id
  GROUP BY dpo.restaurant_id, dpo.date
) pp ON pp.restaurant_id = r.id
     AND pp.date          = fo.date

WHERE fo.date IS NOT NULL;

-- ── Vista: resumen diario del hotel (para el top del dashboard) ──
DROP VIEW IF EXISTS daily_hotel_summary;

CREATE OR REPLACE VIEW daily_hotel_summary
WITH (security_invoker = true)
AS
SELECT
  r.hotel_id,
  r.user_id,
  fo.date,
  od.pax,
  -- Totales del hotel
  ROUND(SUM(COALESCE(fo.viveres_rd,0) + COALESCE(fo.nevera_rd,0) + COALESCE(fo.extras_rd,0))::NUMERIC, 2)
                                              AS total_alm_rd,
  ROUND(SUM(COALESCE(pp.carn_total_rd, 0))::NUMERIC, 2)
                                              AS total_carn_rd,
  ROUND(SUM(COALESCE(pp.veg_total_rd,  0))::NUMERIC, 2)
                                              AS total_veg_rd,
  ROUND((
    SUM(COALESCE(fo.viveres_rd,0) + COALESCE(fo.nevera_rd,0) + COALESCE(fo.extras_rd,0))
    + SUM(COALESCE(pp.carn_total_rd, 0))
    + SUM(COALESCE(pp.veg_total_rd,  0))
  )::NUMERIC, 2)                              AS total_rd,
  ROUND(SUM(COALESCE(fo.budget_rd_pax,0) * COALESCE(od.pax,0))::NUMERIC, 2)
                                              AS budget_total_rd,
  -- RD$/PAX consolidado
  CASE WHEN COALESCE(od.pax, 0) > 0 THEN
    ROUND((
      SUM(COALESCE(fo.viveres_rd,0) + COALESCE(fo.nevera_rd,0) + COALESCE(fo.extras_rd,0))
      + SUM(COALESCE(pp.carn_total_rd, 0))
      + SUM(COALESCE(pp.veg_total_rd,  0))
    ) / od.pax, 2)
    ELSE 0
  END                                         AS cost_per_pax_rd,
  -- % ejecución global
  CASE WHEN SUM(COALESCE(fo.budget_rd_pax,0) * COALESCE(od.pax,0)) > 0 THEN
    ROUND((
      (SUM(COALESCE(fo.viveres_rd,0) + COALESCE(fo.nevera_rd,0) + COALESCE(fo.extras_rd,0))
       + SUM(COALESCE(pp.carn_total_rd, 0))
       + SUM(COALESCE(pp.veg_total_rd,  0)))
      / SUM(COALESCE(fo.budget_rd_pax,0) * COALESCE(od.pax,0))
    ) * 100, 2)
    ELSE 0
  END                                         AS execution_pct

FROM restaurants r
JOIN daily_food_orders fo ON fo.restaurant_id = r.id
JOIN occupancy_daily od ON od.hotel_id = r.hotel_id AND od.date = fo.date
LEFT JOIN (
  SELECT
    dpo.restaurant_id,
    dpo.date,
    SUM(CASE WHEN p.category = 'proteina'
          THEN COALESCE(dpo.price_rd_kg, p.price_rd) * dpo.quantity_kg ELSE 0 END) AS carn_total_rd,
    SUM(CASE WHEN p.category = 'vegetal'
          THEN COALESCE(dpo.price_rd_kg, p.price_rd) * dpo.quantity_kg ELSE 0 END) AS veg_total_rd
  FROM daily_protein_orders dpo
  JOIN products p ON p.id = dpo.product_id
  GROUP BY dpo.restaurant_id, dpo.date
) pp ON pp.restaurant_id = r.id AND pp.date = fo.date

GROUP BY r.hotel_id, r.user_id, fo.date, od.pax;
