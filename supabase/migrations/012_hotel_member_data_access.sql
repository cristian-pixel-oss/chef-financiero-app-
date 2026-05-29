-- ══════════════════════════════════════════════════════════════════════════════
-- CHEF FINANCIERO — Migration 012: Acceso a datos para miembros del hotel
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════
--
-- PROBLEMA:
--   Todas las tablas tienen la política:
--     USING (auth.uid() = user_id)
--   Eso significa que solo el usuario que creó cada fila puede leerla.
--   Los usuarios invitados (rol premium/standard) tienen hotel_id en su
--   perfil pero sus uid() no coincide con user_id de las filas del admin,
--   por lo que todas las secciones del sistema aparecen vacías.
--
-- SOLUCIÓN:
--   1. Función auxiliar get_my_hotel_id() — devuelve el hotel_id del perfil
--      del usuario actual (SECURITY DEFINER para leer profiles sin RLS).
--   2. Políticas FOR ALL en cada tabla: los miembros del hotel pueden leer
--      y escribir datos cuyo hotel_id coincida con el suyo.
--   3. Para tablas sin hotel_id directo (budget_restaurants, daily_food_orders,
--      daily_protein_orders, protein_control) se accede vía restaurant_id.
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Función auxiliar ──────────────────────────────────────────────────────
-- Devuelve el hotel_id del perfil del usuario actual.
-- SECURITY DEFINER permite leerlo aunque profiles tenga RLS restrictivo.
CREATE OR REPLACE FUNCTION get_my_hotel_id()
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT hotel_id FROM profiles WHERE id = auth.uid();
$$;

-- ─── 2. Tablas con hotel_id directo ──────────────────────────────────────────
-- exchange_rates
CREATE POLICY "hotel_member_all_exchange_rates" ON exchange_rates
  FOR ALL
  USING    (hotel_id = get_my_hotel_id())
  WITH CHECK (hotel_id = get_my_hotel_id());

-- occupancy_daily
CREATE POLICY "hotel_member_all_occupancy_daily" ON occupancy_daily
  FOR ALL
  USING    (hotel_id = get_my_hotel_id())
  WITH CHECK (hotel_id = get_my_hotel_id());

-- restaurants
CREATE POLICY "hotel_member_all_restaurants" ON restaurants
  FOR ALL
  USING    (hotel_id = get_my_hotel_id())
  WITH CHECK (hotel_id = get_my_hotel_id());

-- products
CREATE POLICY "hotel_member_all_products" ON products
  FOR ALL
  USING    (hotel_id = get_my_hotel_id())
  WITH CHECK (hotel_id = get_my_hotel_id());

-- budget_operations
CREATE POLICY "hotel_member_all_budget_operations" ON budget_operations
  FOR ALL
  USING    (hotel_id = get_my_hotel_id())
  WITH CHECK (hotel_id = get_my_hotel_id());

-- daily_operation_orders
CREATE POLICY "hotel_member_all_daily_operation_orders" ON daily_operation_orders
  FOR ALL
  USING    (hotel_id = get_my_hotel_id())
  WITH CHECK (hotel_id = get_my_hotel_id());

-- erp_transactions
CREATE POLICY "hotel_member_all_erp_transactions" ON erp_transactions
  FOR ALL
  USING    (hotel_id = get_my_hotel_id())
  WITH CHECK (hotel_id = get_my_hotel_id());

-- thematic_discharges
CREATE POLICY "hotel_member_all_thematic_discharges" ON thematic_discharges
  FOR ALL
  USING    (hotel_id = get_my_hotel_id())
  WITH CHECK (hotel_id = get_my_hotel_id());

-- action_plans
CREATE POLICY "hotel_member_all_action_plans" ON action_plans
  FOR ALL
  USING    (hotel_id = get_my_hotel_id())
  WITH CHECK (hotel_id = get_my_hotel_id());

-- daily_descargos
CREATE POLICY "hotel_member_all_daily_descargos" ON daily_descargos
  FOR ALL
  USING    (hotel_id = get_my_hotel_id())
  WITH CHECK (hotel_id = get_my_hotel_id());

-- ─── 3. Tablas sin hotel_id directo (via restaurant_id) ──────────────────────
-- Se accede a través de la relación: restaurant_id → restaurants.hotel_id

-- budget_restaurants
CREATE POLICY "hotel_member_all_budget_restaurants" ON budget_restaurants
  FOR ALL
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE hotel_id = get_my_hotel_id()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE hotel_id = get_my_hotel_id()
    )
  );

-- daily_food_orders
CREATE POLICY "hotel_member_all_daily_food_orders" ON daily_food_orders
  FOR ALL
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE hotel_id = get_my_hotel_id()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE hotel_id = get_my_hotel_id()
    )
  );

-- daily_protein_orders
CREATE POLICY "hotel_member_all_daily_protein_orders" ON daily_protein_orders
  FOR ALL
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE hotel_id = get_my_hotel_id()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE hotel_id = get_my_hotel_id()
    )
  );

-- protein_control
CREATE POLICY "hotel_member_all_protein_control" ON protein_control
  FOR ALL
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE hotel_id = get_my_hotel_id()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE hotel_id = get_my_hotel_id()
    )
  );

-- ─── 4. Perfil: los miembros deben poder leer el perfil de otros miembros
--         del mismo hotel (para la página de admin/usuarios)
CREATE POLICY "hotel_member_read_profiles" ON profiles
  FOR SELECT
  USING (
    hotel_id = get_my_hotel_id()
    AND hotel_id IS NOT NULL
  );

-- ─── NOTAS ───────────────────────────────────────────────────────────────────
-- · Las políticas existentes "owner_all_*" siguen activas. PostgreSQL aplica
--   UNION (OR) entre políticas del mismo tipo, así que el admin sigue viendo
--   todos sus datos por user_id y los miembros los ven por hotel_id.
-- · chart_of_accounts no tiene hotel_id — los miembros no acceden a esa tabla
--   desde ninguna sección del dashboard, no requiere cambio.
-- · Para la migración 011 (member_read_own_hotel en hotels): si no fue
--   aplicada antes, este script no la duplica — aplicar por separado.
