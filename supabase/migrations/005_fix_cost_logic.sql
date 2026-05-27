-- ============================================================
-- CHEF FINANCIERO — Migration 005: corregir lógica de costos
-- ============================================================
-- Problema: daily_cost_consolidated y daily_hotel_summary
-- sumaban carn_total_rd + veg_total_rd al total_rd, causando
-- doble conteo porque esos costos ya están capturados en
-- daily_food_orders de Carnicería Central y Vegetales Central.
--
-- Corrección:
--   total_rd = ALM únicamente (viveres + nevera + extras)
--   carn_total_rd / veg_total_rd permanecen como columnas
--   informativas del desglose por punto de servicio.
--   cost_per_pax_rd, execution_pct y variance_rd usan solo ALM.
-- ============================================================

-- ── 1. Vista por restaurante/fecha ──────────────────────────
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
  -- ── Costos de Carnes (informativo — ya incluido en ALM de Carnicería Central) ──
  COALESCE(pp.carn_total_rd, 0)                AS carn_total_rd,
  -- ── Costos de Vegetales (informativo — ya incluido en ALM de Vegetales Central) ──
  COALESCE(pp.veg_total_rd, 0)                 AS veg_total_rd,
  -- ── Total real = solo ALM (sin doble conteo de proteínas) ──
  COALESCE(fo.viveres_rd, 0)
    + COALESCE(fo.nevera_rd, 0)
    + COALESCE(fo.extras_rd, 0)                AS total_rd,
  -- ── Presupuesto ──────────────────────────────────────────────
  COALESCE(fo.budget_rd_pax, 0)                AS budget_rd_pax,
  COALESCE(fo.budget_rd_pax, 0)
    * COALESCE(od.pax, 0)                      AS budget_total_rd,
  -- ── KPIs calculados sobre ALM únicamente ────────────────────
  CASE WHEN COALESCE(od.pax, 0) > 0 THEN
    ROUND((
      COALESCE(fo.viveres_rd, 0)
      + COALESCE(fo.nevera_rd, 0)
      + COALESCE(fo.extras_rd, 0)
    ) / od.pax, 2)
    ELSE 0
  END                                           AS cost_per_pax_rd,
  CASE WHEN COALESCE(fo.budget_rd_pax, 0) * COALESCE(od.pax, 0) > 0 THEN
    ROUND((
      (COALESCE(fo.viveres_rd, 0)
       + COALESCE(fo.nevera_rd, 0)
       + COALESCE(fo.extras_rd, 0))
      / (fo.budget_rd_pax * od.pax)
    ) * 100, 2)
    ELSE 0
  END                                           AS execution_pct,
  -- ── Varianza sobre ALM únicamente ────────────────────────────
  (COALESCE(fo.viveres_rd, 0)
   + COALESCE(fo.nevera_rd, 0)
   + COALESCE(fo.extras_rd, 0))
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

-- Proteínas y vegetales agrupados por restaurante y fecha (solo informativo)
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


-- ── 2. Vista resumen diario del hotel ───────────────────────
DROP VIEW IF EXISTS daily_hotel_summary;

CREATE OR REPLACE VIEW daily_hotel_summary
WITH (security_invoker = true)
AS
SELECT
  r.hotel_id,
  r.user_id,
  fo.date,
  -- PAX de la ocupación del hotel (puede ser NULL si aún no se registró)
  od.pax,
  -- Totales ALM del hotel
  ROUND(SUM(COALESCE(fo.viveres_rd,0) + COALESCE(fo.nevera_rd,0) + COALESCE(fo.extras_rd,0))::NUMERIC, 2)
                                              AS total_alm_rd,
  -- Totales CARN del hotel (informativo — ya incluido en ALM de Carnicería Central)
  ROUND(SUM(COALESCE(pp.carn_total_rd, 0))::NUMERIC, 2)
                                              AS total_carn_rd,
  -- Totales VEG del hotel (informativo — ya incluido en ALM de Vegetales Central)
  ROUND(SUM(COALESCE(pp.veg_total_rd, 0))::NUMERIC, 2)
                                              AS total_veg_rd,
  -- Total real = solo ALM (sin doble conteo de proteínas)
  ROUND(SUM(COALESCE(fo.viveres_rd,0) + COALESCE(fo.nevera_rd,0) + COALESCE(fo.extras_rd,0))::NUMERIC, 2)
                                              AS total_rd,
  -- Presupuesto total: suma (budget_rd_pax × PAX) de cada restaurante
  ROUND(SUM(COALESCE(fo.budget_rd_pax,0) * COALESCE(od.pax,0))::NUMERIC, 2)
                                              AS budget_total_rd,
  -- RD$/PAX consolidado sobre ALM únicamente
  CASE WHEN COALESCE(od.pax, 0) > 0 THEN
    ROUND(
      SUM(COALESCE(fo.viveres_rd,0) + COALESCE(fo.nevera_rd,0) + COALESCE(fo.extras_rd,0))
      / od.pax, 2)
    ELSE 0
  END                                         AS cost_per_pax_rd,
  -- % ejecución global sobre ALM únicamente
  CASE WHEN SUM(COALESCE(fo.budget_rd_pax,0) * COALESCE(od.pax,0)) > 0 THEN
    ROUND((
      SUM(COALESCE(fo.viveres_rd,0) + COALESCE(fo.nevera_rd,0) + COALESCE(fo.extras_rd,0))
      / SUM(COALESCE(fo.budget_rd_pax,0) * COALESCE(od.pax,0))
    ) * 100, 2)
    ELSE 0
  END                                         AS execution_pct,
  -- Varianza sobre ALM únicamente (+ = sobre presupuesto)
  ROUND((
    SUM(COALESCE(fo.viveres_rd,0) + COALESCE(fo.nevera_rd,0) + COALESCE(fo.extras_rd,0))
    - SUM(COALESCE(fo.budget_rd_pax,0) * COALESCE(od.pax,0))
  )::NUMERIC, 2)                              AS variance_rd

FROM restaurants r

-- Pedidos de alimentos (obligatorio: ancla la fecha)
JOIN daily_food_orders fo ON fo.restaurant_id = r.id

-- Ocupación del hotel (LEFT JOIN: no bloquear si aún no se registró)
LEFT JOIN occupancy_daily od
       ON od.hotel_id = r.hotel_id
      AND od.date     = fo.date

-- Proteínas y vegetales agrupados (solo informativo)
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
