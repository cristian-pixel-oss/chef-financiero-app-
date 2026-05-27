-- ============================================================
-- CHEF FINANCIERO — Migration 006: Módulo de Descargos
-- ============================================================
-- Descargos = ingresos por clientes de otros hoteles que cenan
-- en nuestros restaurantes. Se restan del gasto ALM para obtener
-- el costo neto final.
--
-- COSTO NETO = GASTO REAL ALM − DESCARGOS
--
-- También corrige el presupuesto en las vistas:
-- Antes: solo usaba daily_food_orders.budget_rd_pax (puede ser 0)
-- Ahora: usa ese valor; si es 0, hace fallback a budget_restaurants
-- ============================================================

-- ── 1. Tabla daily_descargos ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_descargos (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  hotel_id      UUID REFERENCES hotels(id)      ON DELETE CASCADE NOT NULL,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  date          DATE NOT NULL,
  amount_usd    DECIMAL(12, 2) NOT NULL DEFAULT 0,
  amount_rd     DECIMAL(12, 2) NOT NULL DEFAULT 0,
  exchange_rate DECIMAL(10, 4) NOT NULL DEFAULT 60,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, date)
);

ALTER TABLE daily_descargos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own descargos" ON daily_descargos;
CREATE POLICY "Users manage own descargos"
  ON daily_descargos FOR ALL
  USING    (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── 2. Vista daily_cost_consolidated (actualizada) ───────────────────────────
-- Cambios vs. 005:
--   a) budget_rd_pax: fallback a budget_restaurants cuando food_order = 0
--   b) Añade columnas descargos_rd y net_total_rd
DROP VIEW IF EXISTS daily_cost_consolidated;

CREATE OR REPLACE VIEW daily_cost_consolidated
WITH (security_invoker = true)
AS
SELECT
  r.id                                                        AS restaurant_id,
  r.name                                                      AS restaurant_name,
  r.type                                                      AS restaurant_type,
  r.hotel_id,
  r.user_id,
  fo.date,
  od.pax,

  -- ── Costos ALM ─────────────────────────────────────────────────────────────
  COALESCE(fo.viveres_rd, 0)                                  AS viveres_rd,
  COALESCE(fo.nevera_rd,  0)                                  AS nevera_rd,
  COALESCE(fo.extras_rd,  0)                                  AS extras_rd,
  COALESCE(fo.viveres_rd, 0)
    + COALESCE(fo.nevera_rd, 0)
    + COALESCE(fo.extras_rd, 0)                               AS alm_total_rd,

  -- ── Descargos (clientes de otros hoteles) ──────────────────────────────────
  COALESCE(dd.descargos_rd, 0)                                AS descargos_rd,

  -- ── Costo neto = ALM − Descargos ───────────────────────────────────────────
  COALESCE(fo.viveres_rd, 0)
    + COALESCE(fo.nevera_rd, 0)
    + COALESCE(fo.extras_rd, 0)
    - COALESCE(dd.descargos_rd, 0)                            AS net_total_rd,

  -- ── Carnes y Vegetales (informativos, ya incluidos en ALM de sus centrales) ─
  COALESCE(pp.carn_total_rd, 0)                               AS carn_total_rd,
  COALESCE(pp.veg_total_rd,  0)                               AS veg_total_rd,

  -- ── total_rd = ALM bruto (sin doble conteo de proteínas) ───────────────────
  COALESCE(fo.viveres_rd, 0)
    + COALESCE(fo.nevera_rd, 0)
    + COALESCE(fo.extras_rd, 0)                               AS total_rd,

  -- ── Presupuesto: food_order si tiene valor; fallback a budget_restaurants ──
  COALESCE(
    NULLIF(fo.budget_rd_pax, 0),
    br_budget.budget_rd_pax,
    0
  )                                                           AS budget_rd_pax,
  COALESCE(
    NULLIF(fo.budget_rd_pax, 0),
    br_budget.budget_rd_pax,
    0
  ) * COALESCE(od.pax, 0)                                    AS budget_total_rd,

  -- ── KPIs (sobre costo neto) ─────────────────────────────────────────────────
  CASE WHEN COALESCE(od.pax, 0) > 0 THEN
    ROUND((
      COALESCE(fo.viveres_rd, 0)
      + COALESCE(fo.nevera_rd, 0)
      + COALESCE(fo.extras_rd, 0)
      - COALESCE(dd.descargos_rd, 0)
    ) / od.pax, 2)
    ELSE 0
  END                                                         AS cost_per_pax_rd,

  CASE WHEN COALESCE(NULLIF(fo.budget_rd_pax, 0), br_budget.budget_rd_pax, 0)
              * COALESCE(od.pax, 0) > 0 THEN
    ROUND((
      COALESCE(fo.viveres_rd, 0)
      + COALESCE(fo.nevera_rd, 0)
      + COALESCE(fo.extras_rd, 0)
      - COALESCE(dd.descargos_rd, 0)
    ) / (
      COALESCE(NULLIF(fo.budget_rd_pax, 0), br_budget.budget_rd_pax, 0) * od.pax
    ) * 100, 2)
    ELSE 0
  END                                                         AS execution_pct,

  (
    COALESCE(fo.viveres_rd, 0)
    + COALESCE(fo.nevera_rd, 0)
    + COALESCE(fo.extras_rd, 0)
    - COALESCE(dd.descargos_rd, 0)
  ) - (
    COALESCE(NULLIF(fo.budget_rd_pax, 0), br_budget.budget_rd_pax, 0)
    * COALESCE(od.pax, 0)
  )                                                           AS variance_rd

FROM restaurants r

LEFT JOIN daily_food_orders fo
       ON fo.restaurant_id = r.id

LEFT JOIN occupancy_daily od
       ON od.hotel_id = r.hotel_id
      AND od.date     = fo.date

-- Presupuesto desde budget_restaurants (el más específico: mensual > anual)
LEFT JOIN LATERAL (
  SELECT budget_rd_pax
  FROM   budget_restaurants br
  WHERE  br.restaurant_id = r.id
    AND  br.year  = EXTRACT(YEAR  FROM fo.date)::INTEGER
    AND  (br.month = EXTRACT(MONTH FROM fo.date)::INTEGER OR br.month IS NULL)
  ORDER BY br.month NULLS LAST
  LIMIT 1
) br_budget ON TRUE

-- Descargos del restaurante para esa fecha
LEFT JOIN (
  SELECT restaurant_id,
         date,
         SUM(amount_rd) AS descargos_rd
  FROM   daily_descargos
  GROUP  BY restaurant_id, date
) dd ON dd.restaurant_id = r.id
     AND dd.date          = fo.date

-- Carnes/veg informativos
LEFT JOIN (
  SELECT
    dpo.restaurant_id,
    dpo.date,
    ROUND(SUM(CASE WHEN p.category = 'proteina'
      THEN COALESCE(dpo.price_rd_kg, p.price_rd) * dpo.quantity_kg
      ELSE 0 END)::NUMERIC, 2) AS carn_total_rd,
    ROUND(SUM(CASE WHEN p.category = 'vegetal'
      THEN COALESCE(dpo.price_rd_kg, p.price_rd) * dpo.quantity_kg
      ELSE 0 END)::NUMERIC, 2) AS veg_total_rd
  FROM   daily_protein_orders dpo
  JOIN   products p ON p.id = dpo.product_id
  GROUP  BY dpo.restaurant_id, dpo.date
) pp ON pp.restaurant_id = r.id
     AND pp.date          = fo.date

WHERE fo.date IS NOT NULL;


-- ── 3. Vista daily_hotel_summary (actualizada) ───────────────────────────────
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

  -- Descargos totales
  ROUND(SUM(COALESCE(dd.descargos_rd, 0))::NUMERIC, 2)       AS total_descargos_rd,

  -- Costo neto = ALM − Descargos
  ROUND((
    SUM(COALESCE(fo.viveres_rd,0) + COALESCE(fo.nevera_rd,0) + COALESCE(fo.extras_rd,0))
    - SUM(COALESCE(dd.descargos_rd, 0))
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
      - SUM(COALESCE(dd.descargos_rd, 0))
    ) / od.pax, 2)
    ELSE 0
  END                                                         AS cost_per_pax_rd,

  -- % ejecución sobre costo neto
  CASE WHEN SUM(
    COALESCE(NULLIF(fo.budget_rd_pax, 0), br_budget.budget_rd_pax, 0) * COALESCE(od.pax, 0)
  ) > 0 THEN
    ROUND((
      (SUM(COALESCE(fo.viveres_rd,0) + COALESCE(fo.nevera_rd,0) + COALESCE(fo.extras_rd,0))
       - SUM(COALESCE(dd.descargos_rd, 0)))
      / SUM(COALESCE(NULLIF(fo.budget_rd_pax, 0), br_budget.budget_rd_pax, 0) * COALESCE(od.pax, 0))
    ) * 100, 2)
    ELSE 0
  END                                                         AS execution_pct,

  -- Varianza sobre costo neto
  ROUND((
    SUM(COALESCE(fo.viveres_rd,0) + COALESCE(fo.nevera_rd,0) + COALESCE(fo.extras_rd,0))
    - SUM(COALESCE(dd.descargos_rd, 0))
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

LEFT JOIN (
  SELECT restaurant_id, date, SUM(amount_rd) AS descargos_rd
  FROM   daily_descargos
  GROUP  BY restaurant_id, date
) dd ON dd.restaurant_id = r.id AND dd.date = fo.date

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

GROUP BY r.hotel_id, r.user_id, fo.date, od.pax;
