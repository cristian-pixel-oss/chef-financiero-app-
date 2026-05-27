-- ============================================================
-- CHEF FINANCIERO — Migration 003: corregir vistas consolidadas
-- ============================================================
-- Cambios:
--   1. daily_hotel_summary: INNER JOIN → LEFT JOIN en occupancy_daily
--      para que muestre datos aunque no exista registro de ocupación.
--   2. daily_hotel_summary: añadir varianza (total_rd - budget_total_rd).
-- ============================================================

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
  -- Totales CARN del hotel
  ROUND(SUM(COALESCE(pp.carn_total_rd, 0))::NUMERIC, 2)
                                              AS total_carn_rd,
  -- Totales VEG del hotel
  ROUND(SUM(COALESCE(pp.veg_total_rd, 0))::NUMERIC, 2)
                                              AS total_veg_rd,
  -- Total consolidado
  ROUND((
    SUM(COALESCE(fo.viveres_rd,0) + COALESCE(fo.nevera_rd,0) + COALESCE(fo.extras_rd,0))
    + SUM(COALESCE(pp.carn_total_rd, 0))
    + SUM(COALESCE(pp.veg_total_rd,  0))
  )::NUMERIC, 2)                              AS total_rd,
  -- Presupuesto total: suma (budget_rd_pax × PAX) de cada restaurante
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
  END                                         AS execution_pct,
  -- Varianza (+ = sobre presupuesto)
  ROUND((
    SUM(COALESCE(fo.viveres_rd,0) + COALESCE(fo.nevera_rd,0) + COALESCE(fo.extras_rd,0))
    + SUM(COALESCE(pp.carn_total_rd, 0))
    + SUM(COALESCE(pp.veg_total_rd,  0))
    - SUM(COALESCE(fo.budget_rd_pax,0) * COALESCE(od.pax,0))
  )::NUMERIC, 2)                              AS variance_rd

FROM restaurants r

-- Pedidos de alimentos (obligatorio: ancla la fecha)
JOIN daily_food_orders fo ON fo.restaurant_id = r.id

-- Ocupación del hotel (LEFT JOIN: no bloquear si aún no se registró)
LEFT JOIN occupancy_daily od
       ON od.hotel_id = r.hotel_id
      AND od.date     = fo.date

-- Proteínas y vegetales agrupados
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
