-- ============================================================
-- CHEF FINANCIERO — Importación Descargos Históricos
-- ABRIL (desde 14/04) y MAYO (01-25/05) 2026
-- ============================================================
-- NOTA: Se ajusta la tabla para soportar descargos a nivel hotel
-- (sin restaurant_id = totales diarios agregados).
-- ============================================================

-- ── 1. Hacer restaurant_id nullable (soporte para totales por hotel) ──────────
ALTER TABLE daily_descargos
  ALTER COLUMN restaurant_id DROP NOT NULL;

-- Eliminar la UNIQUE anterior (requería restaurant_id NOT NULL)
ALTER TABLE daily_descargos
  DROP CONSTRAINT IF EXISTS daily_descargos_restaurant_id_date_key;

-- Nueva UNIQUE: un total por hotel+fecha cuando restaurant_id IS NULL
-- Nota: en PostgreSQL < 15 los NULLs se permiten duplicados en UNIQUE;
-- usamos partial UNIQUE para el caso hotel-level:
CREATE UNIQUE INDEX IF NOT EXISTS daily_descargos_hotel_date_uniq
  ON daily_descargos (hotel_id, date)
  WHERE restaurant_id IS NULL;

-- ── 2. Insertar datos históricos ──────────────────────────────────────────────

DO $$
DECLARE
  v_hotel_id UUID;
  v_user_id  UUID;
BEGIN
  SELECT id INTO v_hotel_id FROM hotels LIMIT 1;
  SELECT id INTO v_user_id  FROM auth.users LIMIT 1;

  DELETE FROM daily_descargos
  WHERE hotel_id       = v_hotel_id
    AND restaurant_id IS NULL
    AND date BETWEEN '2026-04-14' AND '2026-05-25';

  -- ABRIL (desde 14/04)
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-04-14', 5267.21, 314663.13, 59.74, 'Descargos Temáticos ABRIL 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-04-15', 4804.35, 287011.87, 59.74, 'Descargos Temáticos ABRIL 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-04-16', 4609.30, 275359.58, 59.74, 'Descargos Temáticos ABRIL 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-04-17', 4405.17, 263164.86, 59.74, 'Descargos Temáticos ABRIL 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-04-18', 5233.96, 312676.77, 59.74, 'Descargos Temáticos ABRIL 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-04-19', 5052.42, 301831.57, 59.74, 'Descargos Temáticos ABRIL 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-04-20', 3924.25, 234434.70, 59.74, 'Descargos Temáticos ABRIL 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-04-21', 3959.63, 236548.30, 59.74, 'Descargos Temáticos ABRIL 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-04-22', 5270.47, 314857.88, 59.74, 'Descargos Temáticos ABRIL 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-04-23', 4960.53, 296342.06, 59.74, 'Descargos Temáticos ABRIL 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-04-24', 4392.01, 262378.68, 59.74, 'Descargos Temáticos ABRIL 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-04-25', 4385.18, 261970.65, 59.74, 'Descargos Temáticos ABRIL 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-04-26', 5209.22, 311198.80, 59.74, 'Descargos Temáticos ABRIL 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-04-27', 5094.43, 304341.25, 59.74, 'Descargos Temáticos ABRIL 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-04-28', 3776.28, 225594.97, 59.74, 'Descargos Temáticos ABRIL 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-04-29', 3756.99, 224442.58, 59.74, 'Descargos Temáticos ABRIL 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-04-30', 3756.99, 224442.58, 59.74, 'Descargos Temáticos ABRIL 2026', v_user_id);

  -- MAYO (01-25)
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-01', 5072.25, 303016.22, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-02', 4688.44, 280087.41, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-03', 3819.32, 228166.18, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-04', 4893.54, 292340.08, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-05', 4301.31, 256960.26, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-06', 4013.46, 239764.10, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-07', 4109.96, 245529.01, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-08', 5499.23, 328524.00, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-09', 4879.60, 291507.30, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-10', 4612.39, 275544.18, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-11', 4176.82, 249523.23, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-12', 4104.41, 245197.45, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-13', 4437.54, 265098.64, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-14', 4401.30, 262933.66, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-15', 4021.59, 240249.79, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-16', 4948.79, 295640.71, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-17', 4955.86, 296063.08, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-18', 4835.98, 288901.45, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-19', 3126.63, 186784.88, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-20', 4977.83, 297375.56, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-21', 4355.42, 260192.79, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-22', 4894.26, 292383.09, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-23', 4243.36, 253498.33, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-24', 4859.65, 290315.49, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);
  INSERT INTO daily_descargos (hotel_id, date, amount_usd, amount_rd, exchange_rate, notes, user_id) VALUES (v_hotel_id, '2026-05-25', 4935.51, 294847.37, 59.74, 'Descargos Temáticos MAYO 2026', v_user_id);

  RAISE NOTICE 'Descargos históricos importados: 41 registros (Abril 14-30 + Mayo 1-25)';
END $$;
