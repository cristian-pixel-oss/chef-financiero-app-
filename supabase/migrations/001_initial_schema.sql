-- ============================================================
-- CHEF FINANCIERO — Schema inicial de base de datos
-- Supabase / PostgreSQL
-- Versión 1.0 — Mayo 2026
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLA: profiles
-- Extiende auth.users con datos del usuario de la app
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name   TEXT,
  role        TEXT DEFAULT 'chef' CHECK (role IN ('chef', 'director', 'admin')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: hotels
-- Maestro de hoteles / propiedades del usuario
-- ============================================================
CREATE TABLE IF NOT EXISTS hotels (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code         VARCHAR(10) NOT NULL,
  name         TEXT NOT NULL,
  complex_name TEXT,
  country      TEXT DEFAULT 'República Dominicana',
  city         TEXT,
  currency     VARCHAR(3) DEFAULT 'RD',
  active       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, code)
);

-- ============================================================
-- TABLA: exchange_rates
-- Tasas de cambio RD$/USD por mes y hotel
-- ============================================================
CREATE TABLE IF NOT EXISTS exchange_rates (
  id        UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  hotel_id  UUID REFERENCES hotels(id) ON DELETE CASCADE NOT NULL,
  year      INTEGER NOT NULL,
  month     INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  rate      DECIMAL(10, 4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hotel_id, year, month)
);

-- ============================================================
-- TABLA: restaurants
-- Areas / puntos de servicio del hotel
-- ============================================================
CREATE TABLE IF NOT EXISTS restaurants (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  hotel_id   UUID REFERENCES hotels(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  type       TEXT CHECK (type IN (
               'main_kitchen', 'specialty', 'snack', 'production',
               'bakery_pastry', 'bar', 'breakfast', 'pantry'
             )),
  active     BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: occupancy_daily
-- Ocupación diaria (PAX) por hotel
-- ============================================================
CREATE TABLE IF NOT EXISTS occupancy_daily (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  hotel_id       UUID REFERENCES hotels(id) ON DELETE CASCADE NOT NULL,
  date           DATE NOT NULL,
  pax            INTEGER,
  status         TEXT CHECK (status IN ('normal', 'media', 'alta', 'sin_datos')),
  a_la_carte_usd DECIMAL(12, 2) DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hotel_id, date)
);

-- ============================================================
-- TABLA: products
-- Catálogo de productos: proteínas, vegetales, operación
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  hotel_id        UUID REFERENCES hotels(id) ON DELETE CASCADE NOT NULL,
  sap_code        VARCHAR(20),
  name            TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN (
                    'proteina', 'vegetal', 'lacteo', 'panaderia',
                    'limpieza', 'quimico', 'desechable', 'menaje',
                    'uniforme', 'bebida', 'otro'
                  )),
  subcategory     TEXT,  -- aves, res, cerdo, mariscos, pescado, fruta, tuberculo...
  unit_of_measure VARCHAR(10) DEFAULT 'KG',
  price_rd        DECIMAL(12, 4) NOT NULL DEFAULT 0,
  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: budget_operations
-- Presupuesto de artículos de operación (limpieza, quím., etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS budget_operations (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  hotel_id        UUID REFERENCES hotels(id) ON DELETE CASCADE NOT NULL,
  year            INTEGER NOT NULL,
  category        TEXT NOT NULL,  -- LIMPIEZA, QUIMICOS, DESECHABLES, UNIFORMES, MENAJE
  budget_usd_pax  DECIMAL(10, 4),
  budget_rd_pax   DECIMAL(10, 4),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hotel_id, year, category)
);

-- ============================================================
-- TABLA: budget_restaurants
-- Presupuesto de A&B por restaurante y período
-- ============================================================
CREATE TABLE IF NOT EXISTS budget_restaurants (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  restaurant_id    UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  year             INTEGER NOT NULL,
  month            INTEGER CHECK (month BETWEEN 1 AND 12),  -- NULL = presupuesto anual
  budget_rd_pax    DECIMAL(10, 4),
  distribution_pct DECIMAL(6, 4),   -- % del food cost total
  reference_pax    INTEGER,          -- ocupación de referencia para el presupuesto
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, year, month)
);

-- ============================================================
-- TABLA: daily_operation_orders
-- Pedidos diarios de artículos de operación
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_operation_orders (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  hotel_id         UUID REFERENCES hotels(id) ON DELETE CASCADE NOT NULL,
  date             DATE NOT NULL,
  category         TEXT NOT NULL,
  pax              INTEGER,
  budget_rd_pax    DECIMAL(10, 4),
  order_amount_rd  DECIMAL(12, 2) DEFAULT 0,
  extra_amount_rd  DECIMAL(12, 2) DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hotel_id, date, category)
);

-- ============================================================
-- TABLA: daily_food_orders
-- Pedidos diarios de alimentos por restaurante (Víveres + Nevera + Extras)
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_food_orders (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  restaurant_id  UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  date           DATE NOT NULL,
  pax            INTEGER,
  budget_rd_pax  DECIMAL(10, 4),
  viveres_rd     DECIMAL(12, 2) DEFAULT 0,
  nevera_rd      DECIMAL(12, 2) DEFAULT 0,
  extras_rd      DECIMAL(12, 2) DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, date)
);

-- ============================================================
-- TABLA: daily_protein_orders
-- Pedidos diarios de proteínas / vegetales (nivel producto)
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_protein_orders (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  restaurant_id  UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  product_id     UUID REFERENCES products(id),
  date           DATE NOT NULL,
  price_rd_kg    DECIMAL(12, 4),  -- snapshot del precio en el momento del pedido
  quantity_kg    DECIMAL(10, 3) DEFAULT 0,
  order_type     TEXT DEFAULT 'normal' CHECK (order_type IN ('normal', 'urgente', 'extra')),
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, product_id, date)
);

-- ============================================================
-- TABLA: protein_control
-- Control diario de mise en place y consumo por restaurante
-- ============================================================
CREATE TABLE IF NOT EXISTS protein_control (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  restaurant_id    UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  date             DATE NOT NULL,
  n_pax            INTEGER,
  kg_mise_en_place DECIMAL(10, 3) DEFAULT 0,  -- suma automática de daily_protein_orders
  kg_added         DECIMAL(10, 3) DEFAULT 0,
  kg_leftover      DECIMAL(10, 3) DEFAULT 0,
  total_cost_rd    DECIMAL(12, 2) DEFAULT 0,  -- suma automática de daily_protein_orders
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, date)
);

-- ============================================================
-- TABLA: chart_of_accounts
-- Catálogo de cuentas contables (6000.xxx)
-- ============================================================
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code        VARCHAR(10) NOT NULL,  -- 6000.005
  description TEXT NOT NULL,
  department  TEXT,                   -- COC, BYR, MTO
  label_n1    TEXT,
  label_n3    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: erp_transactions
-- Transacciones brutas del ERP (INF 37 — nivel artículo)
-- ============================================================
CREATE TABLE IF NOT EXISTS erp_transactions (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  hotel_id            UUID REFERENCES hotels(id),
  account_id          UUID REFERENCES chart_of_accounts(id),
  date                DATE NOT NULL,
  year                INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR  FROM date)::INTEGER) STORED,
  month               INTEGER GENERATED ALWAYS AS (EXTRACT(MONTH FROM date)::INTEGER) STORED,
  section             TEXT,
  product_sap_code    VARCHAR(20),
  product_description TEXT,
  transaction_type    TEXT,
  unit_of_measure     VARCHAR(10),
  quantity            DECIMAL(12, 4),
  amount_rd           DECIMAL(14, 2),
  amount_usd          DECIMAL(14, 2),
  exchange_rate       DECIMAL(10, 4),
  company             VARCHAR(20),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: thematic_discharges
-- Descargos de restaurantes temáticos
-- ============================================================
CREATE TABLE IF NOT EXISTS thematic_discharges (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  hotel_id        UUID REFERENCES hotels(id),
  restaurant_name TEXT NOT NULL,
  date            DATE NOT NULL,
  covers          INTEGER,       -- cubiertos servidos
  amount_rd       DECIMAL(12, 2),
  amount_usd      DECIMAL(12, 2),
  exchange_rate   DECIMAL(10, 4),
  account_code    VARCHAR(10),
  company         VARCHAR(20),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: action_plans
-- Planes de acción A&B (basado en ReviewPro u otras fuentes)
-- ============================================================
CREATE TABLE IF NOT EXISTS action_plans (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  hotel_id         UUID REFERENCES hotels(id),
  opportunity_area TEXT NOT NULL,
  department       TEXT,
  actions          TEXT,
  responsible      TEXT,
  start_date       DATE,
  due_date         DATE,
  monthly_score    TEXT,
  status           TEXT DEFAULT 'pending' CHECK (
                     status IN ('pending', 'in_progress', 'completed', 'overdue')
                   ),
  reference_month  INTEGER,
  reference_year   INTEGER,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: reviewpro_comments
-- Comentarios de huéspedes vinculados a planes de acción
-- ============================================================
CREATE TABLE IF NOT EXISTS reviewpro_comments (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  action_plan_id UUID REFERENCES action_plans(id) ON DELETE CASCADE NOT NULL,
  guest_name     TEXT,
  room_number    TEXT,
  classification TEXT CHECK (classification IN ('Promoter', 'Passive', 'Detractor')),
  comment        TEXT,
  comment_date   DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VISTAS CALCULADAS
-- Reemplazan las fórmulas de Excel con cálculos en la BD
-- ============================================================

-- Vista: pedidos de operación con cálculos
CREATE OR REPLACE VIEW daily_operation_orders_view AS
SELECT
  o.*,
  (o.budget_rd_pax * o.pax)                                     AS budget_total_rd,
  (COALESCE(o.order_amount_rd, 0) + COALESCE(o.extra_amount_rd, 0)) AS total_rd,
  ((COALESCE(o.order_amount_rd, 0) + COALESCE(o.extra_amount_rd, 0))
   - (o.budget_rd_pax * o.pax))                                 AS variance_rd,
  CASE WHEN o.pax > 0
    THEN (COALESCE(o.order_amount_rd, 0) + COALESCE(o.extra_amount_rd, 0)) / o.pax
    ELSE 0
  END                                                            AS cost_per_pax_rd,
  CASE
    WHEN o.pax > 0 AND o.budget_rd_pax > 0 THEN
      ROUND(
        ((COALESCE(o.order_amount_rd, 0) + COALESCE(o.extra_amount_rd, 0))
        / (o.budget_rd_pax * o.pax)) * 100, 2
      )
    ELSE 0
  END                                                            AS execution_pct
FROM daily_operation_orders o;

-- Vista: pedidos de alimentos con cálculos
CREATE OR REPLACE VIEW daily_food_orders_view AS
SELECT
  f.*,
  r.name                                                          AS restaurant_name,
  r.type                                                          AS restaurant_type,
  (f.budget_rd_pax * f.pax)                                      AS budget_total_rd,
  (COALESCE(f.viveres_rd,0) + COALESCE(f.nevera_rd,0) + COALESCE(f.extras_rd,0)) AS total_rd,
  ((COALESCE(f.viveres_rd,0) + COALESCE(f.nevera_rd,0) + COALESCE(f.extras_rd,0))
   - (f.budget_rd_pax * f.pax))                                  AS variance_rd,
  CASE WHEN f.pax > 0
    THEN (COALESCE(f.viveres_rd,0) + COALESCE(f.nevera_rd,0) + COALESCE(f.extras_rd,0)) / f.pax
    ELSE 0
  END                                                             AS cost_per_pax_rd,
  CASE
    WHEN f.pax > 0 AND f.budget_rd_pax > 0 THEN
      ROUND(
        ((COALESCE(f.viveres_rd,0) + COALESCE(f.nevera_rd,0) + COALESCE(f.extras_rd,0))
        / (f.budget_rd_pax * f.pax)) * 100, 2
      )
    ELSE 0
  END                                                             AS execution_pct
FROM daily_food_orders f
JOIN restaurants r ON r.id = f.restaurant_id;

-- Vista: pedidos de proteínas con costo calculado
CREATE OR REPLACE VIEW daily_protein_orders_view AS
SELECT
  p.*,
  pr.name                              AS product_name,
  pr.category                          AS product_category,
  pr.subcategory                       AS product_subcategory,
  r.name                               AS restaurant_name,
  (p.price_rd_kg * p.quantity_kg)      AS cost_rd
FROM daily_protein_orders p
JOIN products pr ON pr.id = p.product_id
JOIN restaurants r  ON r.id  = p.restaurant_id;

-- Vista: control de proteínas con todos los KPIs calculados
CREATE OR REPLACE VIEW protein_control_view AS
SELECT
  pc.*,
  r.name                                                                         AS restaurant_name,
  (pc.kg_mise_en_place + COALESCE(pc.kg_added,0) - COALESCE(pc.kg_leftover,0)) AS kg_consumed,
  CASE WHEN pc.n_pax > 0 THEN
    ROUND(((pc.kg_mise_en_place + COALESCE(pc.kg_added,0) - COALESCE(pc.kg_leftover,0)) * 1000)
          / pc.n_pax, 1)
    ELSE 0
  END                                                                            AS g_per_pax,
  CASE WHEN pc.n_pax > 0 THEN
    ROUND(((pc.kg_mise_en_place + COALESCE(pc.kg_added,0) - COALESCE(pc.kg_leftover,0)) * 1000)
          / pc.n_pax - 400, 1)
    ELSE 0
  END                                                                            AS deviation_vs_400g,
  CASE WHEN pc.n_pax > 0 THEN
    ROUND(pc.total_cost_rd / pc.n_pax, 2)
    ELSE 0
  END                                                                            AS cost_per_pax_rd
FROM protein_control pc
JOIN restaurants r ON r.id = pc.restaurant_id;

-- ============================================================
-- ÍNDICES DE RENDIMIENTO
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_hotels_user            ON hotels(user_id);
CREATE INDEX IF NOT EXISTS idx_occ_hotel_date         ON occupancy_daily(hotel_id, date);
CREATE INDEX IF NOT EXISTS idx_restaurants_hotel      ON restaurants(hotel_id);
CREATE INDEX IF NOT EXISTS idx_products_hotel_cat     ON products(hotel_id, category);
CREATE INDEX IF NOT EXISTS idx_food_orders_rest_date  ON daily_food_orders(restaurant_id, date);
CREATE INDEX IF NOT EXISTS idx_prot_orders_rest_date  ON daily_protein_orders(restaurant_id, date);
CREATE INDEX IF NOT EXISTS idx_prot_ctrl_rest_date    ON protein_control(restaurant_id, date);
CREATE INDEX IF NOT EXISTS idx_op_orders_hotel_date   ON daily_operation_orders(hotel_id, date);
CREATE INDEX IF NOT EXISTS idx_erp_hotel_date         ON erp_transactions(hotel_id, date);
CREATE INDEX IF NOT EXISTS idx_erp_year_month         ON erp_transactions(year, month);
CREATE INDEX IF NOT EXISTS idx_discharges_hotel_date  ON thematic_discharges(hotel_id, date);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Cada usuario solo ve y modifica sus propios datos
-- ============================================================

ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE occupancy_daily        ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_operations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_restaurants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_operation_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_food_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_protein_orders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE protein_control        ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE thematic_discharges    ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_plans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviewpro_comments     ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (patrón para todas las tablas con user_id)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'hotels','exchange_rates','occupancy_daily','restaurants','products',
    'budget_operations','budget_restaurants','daily_operation_orders',
    'daily_food_orders','daily_protein_orders','protein_control',
    'chart_of_accounts','erp_transactions','thematic_discharges','action_plans'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY "owner_all_%s" ON %s FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
      tbl, tbl
    );
  END LOOP;
END $$;

-- Perfil: solo el propio usuario
CREATE POLICY "owner_profile" ON profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Comentarios ReviewPro: visibles si el plan de acción es del usuario
CREATE POLICY "owner_reviewpro_comments" ON reviewpro_comments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM action_plans ap
      WHERE ap.id = reviewpro_comments.action_plan_id
        AND ap.user_id = auth.uid()
    )
  );

-- ============================================================
-- FUNCIONES DE NEGOCIO
-- ============================================================

-- Función: resumen diario del hotel (para el dashboard JARVIS)
CREATE OR REPLACE FUNCTION get_daily_summary(
  p_hotel_id  UUID,
  p_date      DATE
)
RETURNS TABLE (
  date                  DATE,
  pax                   INTEGER,
  total_food_rd         DECIMAL,
  total_operation_rd    DECIMAL,
  budget_food_rd        DECIMAL,
  budget_operation_rd   DECIMAL,
  variance_food_rd      DECIMAL,
  variance_operation_rd DECIMAL,
  cost_per_pax_rd       DECIMAL,
  execution_pct         DECIMAL
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    p_date,
    o.pax,
    COALESCE(SUM(COALESCE(f.viveres_rd,0) + COALESCE(f.nevera_rd,0) + COALESCE(f.extras_rd,0)), 0),
    COALESCE(SUM(COALESCE(op.order_amount_rd,0) + COALESCE(op.extra_amount_rd,0)), 0),
    COALESCE(SUM(f.budget_rd_pax * o.pax), 0),
    COALESCE(SUM(op.budget_rd_pax * o.pax), 0),
    COALESCE(SUM(COALESCE(f.viveres_rd,0)+COALESCE(f.nevera_rd,0)+COALESCE(f.extras_rd,0))
             - SUM(f.budget_rd_pax * o.pax), 0),
    COALESCE(SUM(COALESCE(op.order_amount_rd,0)+COALESCE(op.extra_amount_rd,0))
             - SUM(op.budget_rd_pax * o.pax), 0),
    CASE WHEN o.pax > 0 THEN
      COALESCE(SUM(COALESCE(f.viveres_rd,0)+COALESCE(f.nevera_rd,0)+COALESCE(f.extras_rd,0)),0) / o.pax
      ELSE 0
    END,
    CASE WHEN SUM(f.budget_rd_pax * o.pax) > 0 THEN
      ROUND((SUM(COALESCE(f.viveres_rd,0)+COALESCE(f.nevera_rd,0)+COALESCE(f.extras_rd,0))
            / SUM(f.budget_rd_pax * o.pax)) * 100, 2)
      ELSE 0
    END
  FROM occupancy_daily o
  LEFT JOIN daily_food_orders f
         ON f.date = p_date
        AND f.restaurant_id IN (SELECT id FROM restaurants WHERE hotel_id = p_hotel_id)
  LEFT JOIN daily_operation_orders op
         ON op.hotel_id = p_hotel_id AND op.date = p_date
  WHERE o.hotel_id = p_hotel_id AND o.date = p_date
  GROUP BY o.pax;
END;
$$;

-- Función: proyección al cierre del mes
CREATE OR REPLACE FUNCTION get_monthly_projection(
  p_hotel_id UUID,
  p_year     INTEGER,
  p_month    INTEGER
)
RETURNS TABLE (
  days_with_data    INTEGER,
  days_in_month     INTEGER,
  actual_cost_rd    DECIMAL,
  avg_daily_cost_rd DECIMAL,
  projected_cost_rd DECIMAL,
  budget_total_rd   DECIMAL,
  projected_variance DECIMAL
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_days_in_month INTEGER;
BEGIN
  v_days_in_month := EXTRACT(DAY FROM (DATE_TRUNC('month',
    MAKE_DATE(p_year, p_month, 1)) + INTERVAL '1 month - 1 day')::DATE);

  RETURN QUERY
  SELECT
    COUNT(DISTINCT f.date)::INTEGER,
    v_days_in_month,
    COALESCE(SUM(COALESCE(f.viveres_rd,0)+COALESCE(f.nevera_rd,0)+COALESCE(f.extras_rd,0)), 0),
    CASE WHEN COUNT(DISTINCT f.date) > 0 THEN
      SUM(COALESCE(f.viveres_rd,0)+COALESCE(f.nevera_rd,0)+COALESCE(f.extras_rd,0))
      / COUNT(DISTINCT f.date)
      ELSE 0
    END,
    CASE WHEN COUNT(DISTINCT f.date) > 0 THEN
      (SUM(COALESCE(f.viveres_rd,0)+COALESCE(f.nevera_rd,0)+COALESCE(f.extras_rd,0))
      / COUNT(DISTINCT f.date)) * v_days_in_month
      ELSE 0
    END,
    COALESCE(SUM(f.budget_rd_pax * o.pax), 0),
    CASE WHEN COUNT(DISTINCT f.date) > 0 THEN
      ((SUM(COALESCE(f.viveres_rd,0)+COALESCE(f.nevera_rd,0)+COALESCE(f.extras_rd,0))
       / COUNT(DISTINCT f.date)) * v_days_in_month)
      - COALESCE(SUM(f.budget_rd_pax * o.pax), 0)
      ELSE 0
    END
  FROM daily_food_orders f
  JOIN restaurants r  ON r.id = f.restaurant_id AND r.hotel_id = p_hotel_id
  JOIN occupancy_daily o ON o.hotel_id = p_hotel_id AND o.date = f.date
  WHERE EXTRACT(YEAR  FROM f.date) = p_year
    AND EXTRACT(MONTH FROM f.date) = p_month;
END;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Trigger: crear perfil automáticamente al registrar usuario
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_occ_updated_at
  BEFORE UPDATE ON occupancy_daily
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_op_orders_updated_at
  BEFORE UPDATE ON daily_operation_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_food_orders_updated_at
  BEFORE UPDATE ON daily_food_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_protein_ctrl_updated_at
  BEFORE UPDATE ON protein_control
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_action_plans_updated_at
  BEFORE UPDATE ON action_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
