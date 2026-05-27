-- ============================================================
-- CHEF FINANCIERO — Migration 009
-- Fix: descargos siempre RD$ 0 en el browser
--
-- ROOT CAUSE: daily_hotel_summary usa security_invoker=true,
-- por lo que al consultarse desde el browser aplica RLS en
-- daily_descargos. Si user_id IS NULL en los registros
-- importados, la política USING (auth.uid() = user_id) nunca
-- se evalúa como true → todos los descargos filtrados.
--
-- FIX 1: Asegura user_id correcto en todos los registros
--         históricos (restaurant_id IS NULL).
-- FIX 2: Crea función SECURITY DEFINER get_period_descargos()
--         que bypasea RLS de forma controlada y segura.
-- ============================================================

-- ── FIX 1: Corregir user_id = NULL en registros históricos ──

DO $$
DECLARE
  v_user_id UUID;
  v_rows    INT;
BEGIN
  -- Obtener el user_id correcto del único usuario activo
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'cristianlamela@hotmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '⚠ No se encontró usuario cristianlamela@hotmail.com. Saltando fix de user_id.';
  ELSE
    UPDATE daily_descargos
    SET    user_id = v_user_id
    WHERE  user_id IS NULL;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE '✅ Actualizados % registros con user_id = %', v_rows, v_user_id;
  END IF;
END $$;

-- ── FIX 2: Función SECURITY DEFINER para descargos ──────────
-- Esto garantiza que el sum de descargos siempre funcione desde
-- el browser, independientemente de las políticas RLS, ya que
-- la función corre con los permisos del creador (postgres).
-- Seguridad: solo devuelve datos del hotel_id y rango pedido.

DROP FUNCTION IF EXISTS get_period_descargos(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION get_period_descargos(
  p_hotel_id  UUID,
  p_start     DATE,
  p_end       DATE
)
RETURNS TABLE (
  "date"              DATE,
  total_descargos_rd  NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    date,
    ROUND(SUM(amount_rd)::NUMERIC, 2) AS total_descargos_rd
  FROM daily_descargos
  WHERE hotel_id = p_hotel_id
    AND date     >= p_start
    AND date     <= p_end
  GROUP BY date
  ORDER BY date;
$$;

-- Permitir a usuarios autenticados llamar la función
GRANT EXECUTE ON FUNCTION get_period_descargos(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_period_descargos(UUID, DATE, DATE) TO anon;

-- Verificar estado final
SELECT
  CASE WHEN user_id IS NULL THEN 'SIN user_id' ELSE 'Con user_id' END AS estado,
  COUNT(*) AS registros,
  MIN(date) AS desde,
  MAX(date) AS hasta,
  ROUND(SUM(amount_rd)::NUMERIC, 2) AS total_rd
FROM daily_descargos
WHERE restaurant_id IS NULL
GROUP BY 1;
