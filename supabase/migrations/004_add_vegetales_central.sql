-- ============================================================
-- CHEF FINANCIERO — Migration 004: Agregar Vegetales Central
-- ============================================================
-- Agrega "Vegetales Central" como punto de servicio independiente
-- (sort_order = 19, después de A&B General que es el 18).
-- ============================================================

DO $$
DECLARE
  v_hotel_id uuid;
  v_user_id  uuid;
BEGIN
  SELECT id, user_id INTO v_hotel_id, v_user_id
  FROM hotels
  WHERE active = true
  LIMIT 1;

  IF v_hotel_id IS NULL THEN
    RAISE NOTICE 'No se encontró hotel activo. Saltando migración.';
    RETURN;
  END IF;

  -- Insertar solo si no existe ya
  INSERT INTO restaurants (user_id, hotel_id, name, type, sort_order)
  SELECT v_user_id, v_hotel_id, 'Vegetales Central', 'production', 19
  WHERE NOT EXISTS (
    SELECT 1 FROM restaurants
    WHERE hotel_id = v_hotel_id AND name = 'Vegetales Central'
  );

  RAISE NOTICE 'Vegetales Central asegurado para hotel %', v_hotel_id;
END;
$$;
