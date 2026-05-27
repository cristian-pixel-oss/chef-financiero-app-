-- ============================================================
-- CHEF FINANCIERO — Migration 010
-- Crea función escalar get_descargos_total() como alternativa
-- más robusta a la función TABLE de la migración 009.
--
-- Las funciones que retornan TABLE tienen problemas ocasionales
-- con el schema cache de PostgREST. Una función RETURNS NUMERIC
-- siempre funciona: retorna un escalar directo.
--
-- También fuerza la recarga del schema de PostgREST.
-- ============================================================

-- Función escalar SECURITY DEFINER
-- Bypasea RLS, segura porque filtra siempre por hotel_id + fechas
DROP FUNCTION IF EXISTS get_descargos_total(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION get_descargos_total(
  p_hotel_id  UUID,
  p_start     DATE,
  p_end       DATE
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount_rd), 0)
    INTO v_total
  FROM daily_descargos
  WHERE hotel_id = p_hotel_id
    AND date >= p_start
    AND date <= p_end;

  RETURN ROUND(v_total, 2);
END;
$$;

GRANT EXECUTE ON FUNCTION get_descargos_total(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_descargos_total(UUID, DATE, DATE) TO anon;

-- Forzar recarga inmediata del schema cache de PostgREST
NOTIFY pgrst, 'reload schema';

-- Verificar: las dos funciones deben existir
SELECT
  proname              AS funcion,
  prosecdef            AS security_definer,
  pg_get_function_arguments(oid) AS argumentos
FROM pg_proc
WHERE proname IN ('get_period_descargos', 'get_descargos_total')
  AND pronamespace = 'public'::regnamespace
ORDER BY proname;
