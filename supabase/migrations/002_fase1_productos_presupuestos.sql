-- ============================================================
-- CHEF FINANCIERO — Migración FASE 1: Productos y Presupuestos
-- Datos reales extraídos de archivos Excel ABR-2026
-- ============================================================

DO $$
DECLARE
  v_user_id UUID := 'afe8866c-0c56-4701-ad7b-3449a930994a';
  v_hotel_id UUID;
BEGIN

-- Obtener el hotel del usuario
SELECT id INTO v_hotel_id FROM hotels WHERE user_id = v_user_id LIMIT 1;
IF v_hotel_id IS NULL THEN
  RAISE EXCEPTION 'No se encontró hotel para el usuario. Ejecuta el seed primero.';
END IF;

-- ── Limpiar productos del seed (reemplazar con datos reales) ──
DELETE FROM products WHERE hotel_id = v_hotel_id AND category IN ('proteina','vegetal');

-- ── Proteínas reales (94 productos) ──────────────────────
INSERT INTO products (user_id, hotel_id, name, category, subcategory, unit_of_measure, price_rd)
VALUES
  (v_user_id, v_hotel_id, 'POLLO ENTERO', 'proteina', 'aves', 'KG', 165.35),
  (v_user_id, v_hotel_id, 'MUSLOS DE POLLO', 'proteina', 'aves', 'KG', 105.82),
  (v_user_id, v_hotel_id, 'CHURRASCO CHOICE', 'proteina', 'res', 'KG', 1654.17),
  (v_user_id, v_hotel_id, 'COSTILLA CORDERO BABY RIBS', 'proteina', 'cordero', 'KG', 310.8),
  (v_user_id, v_hotel_id, 'FILETE TENDERLOIN', 'proteina', 'res', 'KG', 1344.82),
  (v_user_id, v_hotel_id, 'RIBEYE CHOICE IMPORTADO', 'proteina', 'res', 'KG', 1929.05),
  (v_user_id, v_hotel_id, 'RIBEYE CHOICE ENTERO NACIONAL', 'proteina', 'res', 'KG', 727.53),
  (v_user_id, v_hotel_id, 'HAMBURGUESA VACUNO', 'proteina', 'res', 'KG', 231.49),
  (v_user_id, v_hotel_id, 'HAMBURGUESA DE POLLO', 'proteina', 'aves', 'KG', 206.15),
  (v_user_id, v_hotel_id, 'CHIVO ENTERO', 'proteina', 'cordero', 'KG', 485.02),
  (v_user_id, v_hotel_id, 'PIERNA DE CORDERO C/HUESO', 'proteina', 'cordero', 'KG', 650.36),
  (v_user_id, v_hotel_id, 'FILETE DE CERDO', 'proteina', 'cerdo', 'KG', 282.19),
  (v_user_id, v_hotel_id, 'CHULETA FRESCA DE CERDO', 'proteina', 'cerdo', 'KG', 198.42),
  (v_user_id, v_hotel_id, 'PATICA DE CERDO', 'proteina', 'cerdo', 'KG', 149.91),
  (v_user_id, v_hotel_id, 'PECHO D/ RES', 'proteina', 'res', 'KG', 870.83),
  (v_user_id, v_hotel_id, 'TOP BUTT CHOICE', 'proteina', 'res', 'KG', 947.99),
  (v_user_id, v_hotel_id, 'COSTILLA DE TERNERA', 'proteina', 'res', 'KG', 820.12),
  (v_user_id, v_hotel_id, 'COSTILLA FRESCA DE CERDO', 'proteina', 'cerdo', 'KG', 199.8),
  (v_user_id, v_hotel_id, 'MINI HAMBURGUESA VACUNO', 'proteina', 'res', 'KG', 231.49),
  (v_user_id, v_hotel_id, 'CHULETA AHUMADA', 'proteina', 'cerdo', 'KG', 207.23),
  (v_user_id, v_hotel_id, 'COSTILLA AHUMADA', 'proteina', 'cerdo', 'KG', 143.3),
  (v_user_id, v_hotel_id, 'LOMO DE CERDO', 'proteina', 'cerdo', 'KG', 238.1),
  (v_user_id, v_hotel_id, 'ALBONDIGA CARNE', 'proteina', 'cerdo', 'KG', 251.22),
  (v_user_id, v_hotel_id, 'PIERNA FRESCA DE CERDO', 'proteina', 'cerdo', 'KG', 205.03),
  (v_user_id, v_hotel_id, 'PIERNA AHUMADA DE CERDO', 'proteina', 'cerdo', 'KG', 209.44),
  (v_user_id, v_hotel_id, 'PAVO IMPORTADO', 'proteina', 'aves', 'KG', 418.88),
  (v_user_id, v_hotel_id, 'FILETE MIGNON', 'proteina', 'res', 'KG', 518.09),
  (v_user_id, v_hotel_id, 'ROTI S/HUESO', 'proteina', 'res', 'KG', 520.41),
  (v_user_id, v_hotel_id, 'CADERA DE TERNERA IMPORTADA', 'proteina', 'res', 'KG', 694.46),
  (v_user_id, v_hotel_id, 'CADERA DE RES NACIONAL', 'proteina', 'res', 'KG', 388.01),
  (v_user_id, v_hotel_id, 'PIERNA TRASERA DE RES', 'proteina', 'res', 'KG', 275.58),
  (v_user_id, v_hotel_id, 'CARNE MOLIDA DE TERNERA', 'proteina', 'res', 'KG', 341.72),
  (v_user_id, v_hotel_id, 'CARNE MOLIDA PREMIUM', 'proteina', 'res', 'KG', 297.62),
  (v_user_id, v_hotel_id, 'ALAS DE POLLO', 'proteina', 'aves', 'KG', 231.49),
  (v_user_id, v_hotel_id, 'CARNE MOLIDA DE POLLO', 'proteina', 'aves', 'KG', 266.04),
  (v_user_id, v_hotel_id, 'PECHUGA DE POLLO', 'proteina', 'aves', 'KG', 264.55),
  (v_user_id, v_hotel_id, 'CHULETA DE CORDERO', 'proteina', 'cordero', 'KG', 837.76),
  (v_user_id, v_hotel_id, 'PATO', 'proteina', 'aves', 'KG', 1763.7),
  (v_user_id, v_hotel_id, 'CERDO LECHAL', 'proteina', 'cerdo', 'KG', 341.72),
  (v_user_id, v_hotel_id, 'LONGANIZA RANCHERA DE 5.3LIB', 'proteina', 'cerdo', 'KG', 219.78),
  (v_user_id, v_hotel_id, 'CHORIZO CASERO', 'proteina', 'cerdo', 'KG', 377.4),
  (v_user_id, v_hotel_id, 'MORCILLA BURGOS', 'proteina', 'cerdo', 'KG', 416.67),
  (v_user_id, v_hotel_id, 'HAMBURGUESA ANGUS', 'proteina', 'res', 'KG', 462.97),
  (v_user_id, v_hotel_id, 'TOP SIRLOIN', 'proteina', 'res', 'KG', 1198.8),
  (v_user_id, v_hotel_id, 'FLAT MEAT', 'proteina', 'res', 'KG', 1146.4),
  (v_user_id, v_hotel_id, 'SALCHICA PREMIUM', 'proteina', 'cerdo', 'KG', 777.0),
  (v_user_id, v_hotel_id, 'SALCHICHA ITALIANA PICANTE', 'proteina', 'cerdo', 'KG', 1043.4),
  (v_user_id, v_hotel_id, 'LIVINA', 'proteina', 'pescado', 'KG', 798.52),
  (v_user_id, v_hotel_id, 'CAMARONES CON CABEZA', 'proteina', 'mariscos', 'KG', 610.5),
  (v_user_id, v_hotel_id, 'LOMO ATUN ROJO', 'proteina', 'pescado', 'KG', 518.09),
  (v_user_id, v_hotel_id, 'TUBO CALAMAR', 'proteina', 'mariscos', 'KG', 238.1),
  (v_user_id, v_hotel_id, 'PESCADO MINUTA', 'proteina', 'pescado', 'KG', 429.9),
  (v_user_id, v_hotel_id, 'ROBALO', 'proteina', 'pescado', 'KG', 1102.31),
  (v_user_id, v_hotel_id, 'COLA DE CAMARON 16/20', 'proteina', 'mariscos', 'KG', 418.88),
  (v_user_id, v_hotel_id, 'CAMARON KM-0', 'proteina', 'mariscos', 'KG', 606.27),
  (v_user_id, v_hotel_id, 'CARNE DE MEJILLON', 'proteina', 'mariscos', 'KG', 216.58),
  (v_user_id, v_hotel_id, 'TINTA DE CALAMAR', 'proteina', 'mariscos', 'KG', 1430.0),
  (v_user_id, v_hotel_id, 'PICANA', 'proteina', 'res', 'KG', 1266.99),
  (v_user_id, v_hotel_id, 'MEJILLON 1/2 CONCHA NEGRA', 'proteina', 'mariscos', 'KG', 224.87),
  (v_user_id, v_hotel_id, 'NEW YORK CHOICE', 'proteina', 'res', 'KG', 1043.52),
  (v_user_id, v_hotel_id, 'COLA CAMARON BLACK TIGER 21/25', 'proteina', 'mariscos', 'KG', 401.05),
  (v_user_id, v_hotel_id, 'ALMEJA', 'proteina', 'mariscos', 'KG', 198.42),
  (v_user_id, v_hotel_id, 'MEZCLA DE MARISCOS', 'proteina', 'mariscos', 'KG', 202.83),
  (v_user_id, v_hotel_id, 'CALAMAR ROMANA', 'proteina', 'mariscos', 'KG', 239.76),
  (v_user_id, v_hotel_id, 'SALMON AHUMADO PRECORTADO', 'proteina', 'pescado', 'KG', 1289.71),
  (v_user_id, v_hotel_id, 'CAMARON C/CABEZA10/20 JUMBO', 'proteina', 'mariscos', 'KG', 881.85),
  (v_user_id, v_hotel_id, 'ALMEJA CHOCOLATA', 'proteina', 'mariscos', 'KG', 297.62),
  (v_user_id, v_hotel_id, 'MERO ENTERO', 'proteina', 'pescado', 'KG', 529.11),
  (v_user_id, v_hotel_id, 'PALITO DE CANGREJO', 'proteina', 'mariscos', 'KG', 152.12),
  (v_user_id, v_hotel_id, 'MEJILLON NUEVA ZELANDA EXTRA', 'proteina', 'mariscos', 'KG', 692.64),
  (v_user_id, v_hotel_id, 'BUEY DE MAR', 'proteina', 'mariscos', 'KG', 833.25),
  (v_user_id, v_hotel_id, 'VIEIRAS C/ CONCHA', 'proteina', 'mariscos', 'KG', 429.9),
  (v_user_id, v_hotel_id, 'GULAS', 'proteina', 'mariscos', 'KG', 480.61),
  (v_user_id, v_hotel_id, 'CARNE DE VIEIRAS', 'proteina', 'mariscos', 'KG', 921.3),
  (v_user_id, v_hotel_id, 'PULPO', 'proteina', 'mariscos', 'KG', 616.34),
  (v_user_id, v_hotel_id, 'FILETE DE CHILLO 6/8', 'proteina', 'pescado', 'KG', 963.42),
  (v_user_id, v_hotel_id, 'CHILLO ENTERO', 'proteina', 'pescado', 'KG', 573.2),
  (v_user_id, v_hotel_id, 'FILETE SALMON', 'proteina', 'pescado', 'KG', 925.94),
  (v_user_id, v_hotel_id, 'BACALAO LOMO', 'proteina', 'pescado', 'KG', 679.02),
  (v_user_id, v_hotel_id, 'SEPIA LIMPIA PEQ.', 'proteina', 'mariscos', 'KG', 848.78),
  (v_user_id, v_hotel_id, 'CARITE ENTERO', 'proteina', 'pescado', 'KG', 242.51),
  (v_user_id, v_hotel_id, 'FILETE DE DORADO', 'proteina', 'pescado', 'KG', 295.42),
  (v_user_id, v_hotel_id, 'FILETE DE MERO', 'proteina', 'pescado', 'KG', 149.91),
  (v_user_id, v_hotel_id, 'FILETE PERCA', 'proteina', 'pescado', 'KG', 348.33),
  (v_user_id, v_hotel_id, 'BACALAO 55/1', 'proteina', 'pescado', 'KG', 540.13),
  (v_user_id, v_hotel_id, 'DORADO ENTERO', 'proteina', 'pescado', 'KG', 242.51),
  (v_user_id, v_hotel_id, 'SALMON ROJO EXTRA', 'proteina', 'pescado', 'KG', 659.18),
  (v_user_id, v_hotel_id, 'RODABALLO EVISCERADO', 'proteina', 'pescado', 'KG', 1521.19),
  (v_user_id, v_hotel_id, 'CIGALA', 'proteina', 'mariscos', 'KG', 1653.47),
  (v_user_id, v_hotel_id, 'DORADA ENTERA', 'proteina', 'pescado', 'KG', 374.79),
  (v_user_id, v_hotel_id, 'OSSOBUCO', 'proteina', 'res', 'KG', 288.6),
  (v_user_id, v_hotel_id, 'CHISTORRA', 'proteina', 'cerdo', 'KG', 563.56),
  (v_user_id, v_hotel_id, 'BOCAYATE PEQ', 'proteina', 'mariscos', 'KG', 377.4),
  (v_user_id, v_hotel_id, 'PARGO CAPITAN', 'proteina', 'pescado', 'KG', 577.2);

-- ── Vegetales reales (72 productos) ──────────────────────
INSERT INTO products (user_id, hotel_id, name, category, subcategory, unit_of_measure, price_rd)
VALUES
  (v_user_id, v_hotel_id, 'LECHUGA ROMANA', 'vegetal', 'verdura', 'KG', 59.52),
  (v_user_id, v_hotel_id, 'LECHUGA RIZADA', 'vegetal', 'verdura', 'KG', 59.52),
  (v_user_id, v_hotel_id, 'LENTEJA SECA', 'vegetal', 'verdura', 'KG', 132.28),
  (v_user_id, v_hotel_id, 'MAIZ TIERNO', 'vegetal', 'verdura', 'KG', 99.21),
  (v_user_id, v_hotel_id, 'MELON CANTALOUPE', 'vegetal', 'fruta', 'KG', 55.12),
  (v_user_id, v_hotel_id, 'PINA', 'vegetal', 'fruta', 'KG', 77.16),
  (v_user_id, v_hotel_id, 'PLATANO VERDE', 'vegetal', 'tuberculo', 'KG', 92.59),
  (v_user_id, v_hotel_id, 'PLATANO MADURO', 'vegetal', 'tuberculo', 'KG', 92.59),
  (v_user_id, v_hotel_id, 'PUERRO FINO', 'vegetal', 'verdura', 'KG', 99.21),
  (v_user_id, v_hotel_id, 'PUERRO', 'vegetal', 'verdura', 'KG', 88.18),
  (v_user_id, v_hotel_id, 'REMOLACHA FRESCA', 'vegetal', 'tuberculo', 'KG', 39.68),
  (v_user_id, v_hotel_id, 'REPOLLO CRIOLLO', 'vegetal', 'verdura', 'KG', 74.96),
  (v_user_id, v_hotel_id, 'REPOLLO ROJO', 'vegetal', 'verdura', 'KG', 105.82),
  (v_user_id, v_hotel_id, 'REPOLLO CHINO', 'vegetal', 'verdura', 'KG', 55.12),
  (v_user_id, v_hotel_id, 'ROMERO', 'vegetal', 'verdura', 'KG', 132.28),
  (v_user_id, v_hotel_id, 'SANDIA BLANCA', 'vegetal', 'fruta', 'KG', 56.22),
  (v_user_id, v_hotel_id, 'TAYOTA', 'vegetal', 'verdura', 'KG', 50.71),
  (v_user_id, v_hotel_id, 'TOMATE BARCELO', 'vegetal', 'verdura', 'KG', 88.18),
  (v_user_id, v_hotel_id, 'TOMATE CHERRY', 'vegetal', 'verdura', 'KG', 110.23),
  (v_user_id, v_hotel_id, 'TOMATE ENSALADA', 'vegetal', 'verdura', 'KG', 105.82),
  (v_user_id, v_hotel_id, 'YUCA', 'vegetal', 'tuberculo', 'KG', 77.16),
  (v_user_id, v_hotel_id, 'ZANAHORIA', 'vegetal', 'verdura', 'KG', 92.59),
  (v_user_id, v_hotel_id, 'ZUKINI CRIOLLO', 'vegetal', 'verdura', 'KG', 77.16),
  (v_user_id, v_hotel_id, 'ZUKINI', 'vegetal', 'verdura', 'KG', 77.16),
  (v_user_id, v_hotel_id, 'CIRUELA ROJA', 'vegetal', 'fruta', 'KG', 540.13),
  (v_user_id, v_hotel_id, 'KIWI', 'vegetal', 'fruta', 'KG', 529.11),
  (v_user_id, v_hotel_id, 'YAUTIA BLANCA', 'vegetal', 'tuberculo', 'KG', 141.1),
  (v_user_id, v_hotel_id, 'YAUTIA COCO', 'vegetal', 'tuberculo', 'KG', 141.1),
  (v_user_id, v_hotel_id, 'FRESAS EN BANDEJA', 'vegetal', 'fruta', 'KG', 264.55),
  (v_user_id, v_hotel_id, 'FLORES COMESTIBLES', 'vegetal', 'verdura', 'KG', 606.27),
  (v_user_id, v_hotel_id, 'MANZANA ROJA', 'vegetal', 'fruta', 'KG', 196.21),
  (v_user_id, v_hotel_id, 'MANZANA VERDE', 'vegetal', 'fruta', 'KG', 200.62),
  (v_user_id, v_hotel_id, 'UVA BLANCA', 'vegetal', 'fruta', 'KG', 529.11),
  (v_user_id, v_hotel_id, 'UVA ROJA', 'vegetal', 'fruta', 'KG', 396.83),
  (v_user_id, v_hotel_id, 'PEPINO LARGO', 'vegetal', 'verdura', 'KG', 48.5),
  (v_user_id, v_hotel_id, 'PEREJIL', 'vegetal', 'verdura', 'KG', 88.18),
  (v_user_id, v_hotel_id, 'PIMIENTO AMARILLO', 'vegetal', 'verdura', 'KG', 180.78),
  (v_user_id, v_hotel_id, 'PIMIENTO VERDE 1a', 'vegetal', 'verdura', 'KG', 180.78),
  (v_user_id, v_hotel_id, 'PIMIENTO ROJO 1a', 'vegetal', 'verdura', 'KG', 180.78),
  (v_user_id, v_hotel_id, 'LIMON', 'vegetal', 'fruta', 'KG', 143.3),
  (v_user_id, v_hotel_id, 'PATATA', 'vegetal', 'tuberculo', 'KG', 97.0),
  (v_user_id, v_hotel_id, 'AGUACATE', 'vegetal', 'fruta', 'KG', 94.8),
  (v_user_id, v_hotel_id, 'AJI CUBANELA', 'vegetal', 'verdura', 'KG', 103.62),
  (v_user_id, v_hotel_id, 'AJO', 'vegetal', 'verdura', 'KG', 385.81),
  (v_user_id, v_hotel_id, 'ALBAHACA', 'vegetal', 'verdura', 'KG', 154.32),
  (v_user_id, v_hotel_id, 'APIO VERDE', 'vegetal', 'verdura', 'KG', 61.73),
  (v_user_id, v_hotel_id, 'CALABAZA', 'vegetal', 'verdura', 'KG', 41.89),
  (v_user_id, v_hotel_id, 'BATATA', 'vegetal', 'tuberculo', 'KG', 68.34),
  (v_user_id, v_hotel_id, 'BERENJENA', 'vegetal', 'verdura', 'KG', 61.73),
  (v_user_id, v_hotel_id, 'CEBOLLA ROJA', 'vegetal', 'verdura', 'KG', 123.46),
  (v_user_id, v_hotel_id, 'CEBOLLA', 'vegetal', 'verdura', 'KG', 121.25),
  (v_user_id, v_hotel_id, 'CHINOLA', 'vegetal', 'fruta', 'KG', 138.89),
  (v_user_id, v_hotel_id, 'CILANTRICO', 'vegetal', 'verdura', 'KG', 187.39),
  (v_user_id, v_hotel_id, 'CILANTRO', 'vegetal', 'verdura', 'KG', 187.39),
  (v_user_id, v_hotel_id, 'GERMEN DE SOYA', 'vegetal', 'verdura', 'KG', 187.39),
  (v_user_id, v_hotel_id, 'GUAYABA', 'vegetal', 'fruta', 'KG', 99.21),
  (v_user_id, v_hotel_id, 'JENGIBRE', 'vegetal', 'verdura', 'KG', 209.44),
  (v_user_id, v_hotel_id, 'GUINEO MADURO', 'vegetal', 'fruta', 'KG', 48.5),
  (v_user_id, v_hotel_id, 'HABICHUELA BLANCA', 'vegetal', 'verdura', 'KG', 165.35),
  (v_user_id, v_hotel_id, 'HABICHUELA NEGRA', 'vegetal', 'verdura', 'KG', 132.28),
  (v_user_id, v_hotel_id, 'HABICHUELA ROJA', 'vegetal', 'verdura', 'KG', 165.35),
  (v_user_id, v_hotel_id, 'HINOJO', 'vegetal', 'verdura', 'KG', 132.28),
  (v_user_id, v_hotel_id, 'HONGO FRESCO', 'vegetal', 'verdura', 'KG', 529.11),
  (v_user_id, v_hotel_id, 'LECHOSA CRIOLLA', 'vegetal', 'fruta', 'KG', 57.32),
  (v_user_id, v_hotel_id, 'RUCULA', 'vegetal', 'verdura', 'KG', 121.25),
  (v_user_id, v_hotel_id, 'LECHUGA REPOLLADA', 'vegetal', 'verdura', 'KG', 77.16),
  (v_user_id, v_hotel_id, 'LECHUGA MORADA', 'vegetal', 'verdura', 'KG', 59.52),
  (v_user_id, v_hotel_id, 'MANGO', 'vegetal', 'fruta', 'KG', 57.52),
  (v_user_id, v_hotel_id, 'NARANJA', 'vegetal', 'fruta', 'KG', 93.24),
  (v_user_id, v_hotel_id, 'FRUTA DEL DRAGON', 'vegetal', 'fruta', 'KG', 310.8),
  (v_user_id, v_hotel_id, 'CARAMBOLA', 'vegetal', 'fruta', 'KG', 82.14),
  (v_user_id, v_hotel_id, 'ALFALFA', 'vegetal', 'verdura', 'KG', 388.5);

-- ── Presupuestos por restaurante — Abril 2026 ──────────────
INSERT INTO budget_restaurants (user_id, restaurant_id, year, month, budget_rd_pax)
SELECT v_user_id, id, 2026, 4, 35.84
FROM restaurants WHERE hotel_id = v_hotel_id AND name = 'Cocina Nácar'
ON CONFLICT (restaurant_id, year, month) DO UPDATE SET budget_rd_pax = EXCLUDED.budget_rd_pax;
INSERT INTO budget_restaurants (user_id, restaurant_id, year, month, budget_rd_pax)
SELECT v_user_id, id, 2026, 4, 89.61
FROM restaurants WHERE hotel_id = v_hotel_id AND name = 'Panadería + Pastelería'
ON CONFLICT (restaurant_id, year, month) DO UPDATE SET budget_rd_pax = EXCLUDED.budget_rd_pax;
INSERT INTO budget_restaurants (user_id, restaurant_id, year, month, budget_rd_pax)
SELECT v_user_id, id, 2026, 4, 307.66
FROM restaurants WHERE hotel_id = v_hotel_id AND name = 'Carnicería Central'
ON CONFLICT (restaurant_id, year, month) DO UPDATE SET budget_rd_pax = EXCLUDED.budget_rd_pax;
INSERT INTO budget_restaurants (user_id, restaurant_id, year, month, budget_rd_pax)
SELECT v_user_id, id, 2026, 4, 143.38
FROM restaurants WHERE hotel_id = v_hotel_id AND name = 'Desayuno Nácar'
ON CONFLICT (restaurant_id, year, month) DO UPDATE SET budget_rd_pax = EXCLUDED.budget_rd_pax;
INSERT INTO budget_restaurants (user_id, restaurant_id, year, month, budget_rd_pax)
SELECT v_user_id, id, 2026, 4, 119.48
FROM restaurants WHERE hotel_id = v_hotel_id AND name = 'Pantry Nácar'
ON CONFLICT (restaurant_id, year, month) DO UPDATE SET budget_rd_pax = EXCLUDED.budget_rd_pax;
INSERT INTO budget_restaurants (user_id, restaurant_id, year, month, budget_rd_pax)
SELECT v_user_id, id, 2026, 4, 29.87
FROM restaurants WHERE hotel_id = v_hotel_id AND name = 'Cocina Las Olas'
ON CONFLICT (restaurant_id, year, month) DO UPDATE SET budget_rd_pax = EXCLUDED.budget_rd_pax;
INSERT INTO budget_restaurants (user_id, restaurant_id, year, month, budget_rd_pax)
SELECT v_user_id, id, 2026, 4, 11.95
FROM restaurants WHERE hotel_id = v_hotel_id AND name = 'Desayuno Las Olas'
ON CONFLICT (restaurant_id, year, month) DO UPDATE SET budget_rd_pax = EXCLUDED.budget_rd_pax;
INSERT INTO budget_restaurants (user_id, restaurant_id, year, month, budget_rd_pax)
SELECT v_user_id, id, 2026, 4, 8.96
FROM restaurants WHERE hotel_id = v_hotel_id AND name = 'Pantry Las Olas'
ON CONFLICT (restaurant_id, year, month) DO UPDATE SET budget_rd_pax = EXCLUDED.budget_rd_pax;
INSERT INTO budget_restaurants (user_id, restaurant_id, year, month, budget_rd_pax)
SELECT v_user_id, id, 2026, 4, 35.84
FROM restaurants WHERE hotel_id = v_hotel_id AND name = 'Isla Snack'
ON CONFLICT (restaurant_id, year, month) DO UPDATE SET budget_rd_pax = EXCLUDED.budget_rd_pax;
INSERT INTO budget_restaurants (user_id, restaurant_id, year, month, budget_rd_pax)
SELECT v_user_id, id, 2026, 4, 5.97
FROM restaurants WHERE hotel_id = v_hotel_id AND name = 'Indu'
ON CONFLICT (restaurant_id, year, month) DO UPDATE SET budget_rd_pax = EXCLUDED.budget_rd_pax;
INSERT INTO budget_restaurants (user_id, restaurant_id, year, month, budget_rd_pax)
SELECT v_user_id, id, 2026, 4, 5.97
FROM restaurants WHERE hotel_id = v_hotel_id AND name = 'Flame'
ON CONFLICT (restaurant_id, year, month) DO UPDATE SET budget_rd_pax = EXCLUDED.budget_rd_pax;
INSERT INTO budget_restaurants (user_id, restaurant_id, year, month, budget_rd_pax)
SELECT v_user_id, id, 2026, 4, 5.97
FROM restaurants WHERE hotel_id = v_hotel_id AND name = 'Tequila'
ON CONFLICT (restaurant_id, year, month) DO UPDATE SET budget_rd_pax = EXCLUDED.budget_rd_pax;
INSERT INTO budget_restaurants (user_id, restaurant_id, year, month, budget_rd_pax)
SELECT v_user_id, id, 2026, 4, 5.97
FROM restaurants WHERE hotel_id = v_hotel_id AND name = 'Capriccio'
ON CONFLICT (restaurant_id, year, month) DO UPDATE SET budget_rd_pax = EXCLUDED.budget_rd_pax;
INSERT INTO budget_restaurants (user_id, restaurant_id, year, month, budget_rd_pax)
SELECT v_user_id, id, 2026, 4, 5.97
FROM restaurants WHERE hotel_id = v_hotel_id AND name = 'Rodizio'
ON CONFLICT (restaurant_id, year, month) DO UPDATE SET budget_rd_pax = EXCLUDED.budget_rd_pax;
INSERT INTO budget_restaurants (user_id, restaurant_id, year, month, budget_rd_pax)
SELECT v_user_id, id, 2026, 4, 5.97
FROM restaurants WHERE hotel_id = v_hotel_id AND name = 'Fish Market'
ON CONFLICT (restaurant_id, year, month) DO UPDATE SET budget_rd_pax = EXCLUDED.budget_rd_pax;
INSERT INTO budget_restaurants (user_id, restaurant_id, year, month, budget_rd_pax)
SELECT v_user_id, id, 2026, 4, 5.97
FROM restaurants WHERE hotel_id = v_hotel_id AND name = 'Mongol'
ON CONFLICT (restaurant_id, year, month) DO UPDATE SET budget_rd_pax = EXCLUDED.budget_rd_pax;
INSERT INTO budget_restaurants (user_id, restaurant_id, year, month, budget_rd_pax)
SELECT v_user_id, id, 2026, 4, 5.97
FROM restaurants WHERE hotel_id = v_hotel_id AND name = 'Griego'
ON CONFLICT (restaurant_id, year, month) DO UPDATE SET budget_rd_pax = EXCLUDED.budget_rd_pax;
INSERT INTO budget_restaurants (user_id, restaurant_id, year, month, budget_rd_pax)
SELECT v_user_id, id, 2026, 4, 4.0
FROM restaurants WHERE hotel_id = v_hotel_id AND name = 'A&B General'
ON CONFLICT (restaurant_id, year, month) DO UPDATE SET budget_rd_pax = EXCLUDED.budget_rd_pax;
-- SKIP sin mapeo: VEGETALES

RAISE NOTICE 'Migración FASE 1 completada. Hotel: %', v_hotel_id;
END $$;