-- ============================================================
-- CHEF FINANCIERO — Datos iniciales (seed)
-- Ejecutar DESPUÉS del schema inicial (001_initial_schema.sql)
-- ============================================================
-- IMPORTANTE: Reemplaza 'YOUR_USER_ID' con el UUID del usuario
-- que aparece en Supabase → Authentication → Users después de
-- registrarte por primera vez.
-- ============================================================

-- Variable de usuario (ajustar antes de ejecutar)
DO $$
DECLARE
  v_user_id   UUID := 'afe8866c-0c56-4701-ad7b-3449a930994a';
  v_hotel_id  UUID;
  v_rest_ids  UUID[] := ARRAY[]::UUID[];
  v_temp_id   UUID;
BEGIN

-- ── Hotel ──────────────────────────────────────────────────────
INSERT INTO hotels (user_id, code, name, complex_name, country, city, currency)
VALUES (v_user_id, 'BPC', 'Bahía Príncipe Grand Punta Cana', 'Complejo Bávaro', 'República Dominicana', 'Punta Cana', 'RD')
RETURNING id INTO v_hotel_id;

-- ── Tasa de cambio ─────────────────────────────────────────────
INSERT INTO exchange_rates (user_id, hotel_id, year, month, rate)
VALUES
  (v_user_id, v_hotel_id, 2026, 4, 59.7404),
  (v_user_id, v_hotel_id, 2026, 5, 59.586);

-- ── Restaurantes / Áreas de cocina ────────────────────────────
WITH inserts AS (
  INSERT INTO restaurants (user_id, hotel_id, name, type, sort_order)
  VALUES
    (v_user_id, v_hotel_id, 'Cocina Nácar',           'main_kitchen',  1),
    (v_user_id, v_hotel_id, 'Panadería + Pastelería', 'bakery_pastry',  2),
    (v_user_id, v_hotel_id, 'Carnicería Central',     'production',     3),
    (v_user_id, v_hotel_id, 'Desayuno Nácar',         'breakfast',      4),
    (v_user_id, v_hotel_id, 'Pantry Nácar',           'pantry',         5),
    (v_user_id, v_hotel_id, 'Cocina Las Olas',        'main_kitchen',   6),
    (v_user_id, v_hotel_id, 'Desayuno Las Olas',      'breakfast',      7),
    (v_user_id, v_hotel_id, 'Pantry Las Olas',        'pantry',         8),
    (v_user_id, v_hotel_id, 'Isla Snack',             'snack',          9),
    (v_user_id, v_hotel_id, 'Indu',                   'specialty',     10),
    (v_user_id, v_hotel_id, 'Flame',                  'specialty',     11),
    (v_user_id, v_hotel_id, 'Tequila',                'specialty',     12),
    (v_user_id, v_hotel_id, 'Capriccio',              'specialty',     13),
    (v_user_id, v_hotel_id, 'Rodizio',                'specialty',     14),
    (v_user_id, v_hotel_id, 'Fish Market',            'specialty',     15),
    (v_user_id, v_hotel_id, 'Mongol',                 'specialty',     16),
    (v_user_id, v_hotel_id, 'Griego',                 'specialty',     17),
    (v_user_id, v_hotel_id, 'A&B General',            'main_kitchen',  18)
  RETURNING id
)
SELECT ARRAY_AGG(id) INTO v_rest_ids FROM inserts;

-- ── Catálogo de proteínas — Carnes y aves ─────────────────────
INSERT INTO products (user_id, hotel_id, name, category, subcategory, unit_of_measure, price_rd)
VALUES
  -- Res
  (v_user_id, v_hotel_id, 'Filete Tenderloin',           'proteina', 'res',     'KG', 1344.82),
  (v_user_id, v_hotel_id, 'Ribeye Choice Importado',     'proteina', 'res',     'KG', 1929.05),
  (v_user_id, v_hotel_id, 'Churrasco Choice',            'proteina', 'res',     'KG', 1654.17),
  (v_user_id, v_hotel_id, 'Picana',                      'proteina', 'res',     'KG',  812.50),
  (v_user_id, v_hotel_id, 'Carne Molida',                'proteina', 'res',     'KG',  385.20),
  (v_user_id, v_hotel_id, 'Costillas Res',               'proteina', 'res',     'KG',  598.40),
  -- Cerdo
  (v_user_id, v_hotel_id, 'Chuleta de Cerdo',            'proteina', 'cerdo',   'KG',  325.60),
  (v_user_id, v_hotel_id, 'Lomo de Cerdo',               'proteina', 'cerdo',   'KG',  410.80),
  (v_user_id, v_hotel_id, 'Bacon Precortado',            'proteina', 'cerdo',   'KG',  598.30),
  (v_user_id, v_hotel_id, 'Pernil de Cerdo',             'proteina', 'cerdo',   'KG',  285.40),
  -- Aves
  (v_user_id, v_hotel_id, 'Pechuga de Pollo',            'proteina', 'aves',    'KG',  215.80),
  (v_user_id, v_hotel_id, 'Pollo Entero',                'proteina', 'aves',    'KG',  165.35),
  (v_user_id, v_hotel_id, 'Muslo de Pollo',              'proteina', 'aves',    'KG',  148.90),
  (v_user_id, v_hotel_id, 'Pollo Parrillero',            'proteina', 'aves',    'KG',  185.20),
  -- Mariscos
  (v_user_id, v_hotel_id, 'Camarones c/Cabeza',          'proteina', 'mariscos','KG',  881.85),
  (v_user_id, v_hotel_id, 'Camarones Pelados 16/20',     'proteina', 'mariscos','KG', 1245.60),
  (v_user_id, v_hotel_id, 'Pulpo',                       'proteina', 'mariscos','KG',  616.34),
  (v_user_id, v_hotel_id, 'Langosta Entera',             'proteina', 'mariscos','KG', 2850.00),
  (v_user_id, v_hotel_id, 'Mejillones',                  'proteina', 'mariscos','KG',  385.70),
  (v_user_id, v_hotel_id, 'Calamar',                     'proteina', 'mariscos','KG',  425.30),
  -- Pescados
  (v_user_id, v_hotel_id, 'Salmón Fresco',               'proteina', 'pescado', 'KG',  985.40),
  (v_user_id, v_hotel_id, 'Salmón Ahumado',              'proteina', 'pescado', 'KG', 1289.71),
  (v_user_id, v_hotel_id, 'Tilapia Filete',              'proteina', 'pescado', 'KG',  285.60),
  (v_user_id, v_hotel_id, 'Dorado Filete',               'proteina', 'pescado', 'KG',  524.80),
  (v_user_id, v_hotel_id, 'Atún Fresco',                 'proteina', 'pescado', 'KG',  756.40),
  -- Embutidos
  (v_user_id, v_hotel_id, 'Jamón de Pavo',               'proteina', 'embutido','KG',  298.50),
  (v_user_id, v_hotel_id, 'Salami',                      'proteina', 'embutido','KG',  385.20),
  (v_user_id, v_hotel_id, 'Chorizo',                     'proteina', 'embutido','KG',  425.60);

-- ── Catálogo de vegetales ──────────────────────────────────────
INSERT INTO products (user_id, hotel_id, name, category, subcategory, unit_of_measure, price_rd)
VALUES
  -- Verduras
  (v_user_id, v_hotel_id, 'Lechuga Romana',              'vegetal', 'verdura',   'KG',   59.52),
  (v_user_id, v_hotel_id, 'Tomate',                      'vegetal', 'verdura',   'KG',   45.80),
  (v_user_id, v_hotel_id, 'Cebolla Blanca',              'vegetal', 'verdura',   'KG',   38.40),
  (v_user_id, v_hotel_id, 'Cebolla Morada',              'vegetal', 'verdura',   'KG',   42.60),
  (v_user_id, v_hotel_id, 'Pimiento Rojo',               'vegetal', 'verdura',   'KG',   85.40),
  (v_user_id, v_hotel_id, 'Pimiento Verde',              'vegetal', 'verdura',   'KG',   72.30),
  (v_user_id, v_hotel_id, 'Pepino',                      'vegetal', 'verdura',   'KG',   35.20),
  (v_user_id, v_hotel_id, 'Zanahoria',                   'vegetal', 'verdura',   'KG',   28.90),
  (v_user_id, v_hotel_id, 'Brócoli',                     'vegetal', 'verdura',   'KG',   98.50),
  (v_user_id, v_hotel_id, 'Col/Repollo',                 'vegetal', 'verdura',   'KG',   22.40),
  (v_user_id, v_hotel_id, 'Apio',                        'vegetal', 'verdura',   'KG',   45.60),
  (v_user_id, v_hotel_id, 'Espinaca',                    'vegetal', 'verdura',   'KG',   85.30),
  -- Frutas
  (v_user_id, v_hotel_id, 'Mango',                       'vegetal', 'fruta',     'KG',   32.50),
  (v_user_id, v_hotel_id, 'Piña',                        'vegetal', 'fruta',     'KG',   28.40),
  (v_user_id, v_hotel_id, 'Sandía',                      'vegetal', 'fruta',     'KG',   18.60),
  (v_user_id, v_hotel_id, 'Melón',                       'vegetal', 'fruta',     'KG',   22.80),
  (v_user_id, v_hotel_id, 'Papaya',                      'vegetal', 'fruta',     'KG',   25.40),
  (v_user_id, v_hotel_id, 'Limón',                       'vegetal', 'fruta',     'KG',   38.50),
  (v_user_id, v_hotel_id, 'Naranja',                     'vegetal', 'fruta',     'KG',   28.90),
  (v_user_id, v_hotel_id, 'Fresas',                      'vegetal', 'fruta',     'KG',  185.40),
  -- Tubérculos
  (v_user_id, v_hotel_id, 'Papa Blanca',                 'vegetal', 'tuberculo', 'KG',   32.80),
  (v_user_id, v_hotel_id, 'Yuca',                        'vegetal', 'tuberculo', 'KG',   28.40),
  (v_user_id, v_hotel_id, 'Ñame',                        'vegetal', 'tuberculo', 'KG',   35.60),
  (v_user_id, v_hotel_id, 'Plátano Verde',               'vegetal', 'tuberculo', 'KG',   22.30);

-- ── Catálogo de artículos de operación ────────────────────────
INSERT INTO products (user_id, hotel_id, name, category, unit_of_measure, price_rd)
VALUES
  (v_user_id, v_hotel_id, 'Cloro Líquido Clorox',        'limpieza',    'L',   17.20),
  (v_user_id, v_hotel_id, 'Detergente Multiuso',         'limpieza',    'KG',  45.80),
  (v_user_id, v_hotel_id, 'Desinfectante de Pisos',      'limpieza',    'L',   28.40),
  (v_user_id, v_hotel_id, 'Esponjas Scotch Brite',       'limpieza',    'UN',   8.50),
  (v_user_id, v_hotel_id, 'Guantes de Látex',            'limpieza',    'PAR',  6.80),
  (v_user_id, v_hotel_id, 'Desengrasante Industrial',    'quimico',     'L',   38.60),
  (v_user_id, v_hotel_id, 'Sanitizante de Superficies',  'quimico',     'L',   42.30),
  (v_user_id, v_hotel_id, 'Papel Aluminio',              'desechable',  'UN',  85.40),
  (v_user_id, v_hotel_id, 'Papel Film',                  'desechable',  'UN',  68.50),
  (v_user_id, v_hotel_id, 'Guantes Desechables Nitril',  'desechable',  'CAJA', 145.00),
  (v_user_id, v_hotel_id, 'Tapabocas Desechable',        'desechable',  'CAJA',  95.00);

-- ── Cuentas contables ──────────────────────────────────────────
INSERT INTO chart_of_accounts (user_id, code, description, department, label_n1, label_n3)
VALUES
  (v_user_id, '6000.005', 'Consumos Comida TI',            'COC', 'Alimentos', 'Todo Incluido'),
  (v_user_id, '6000.100', 'Consumos Alimentos',            'COC', 'Alimentos', 'General'),
  (v_user_id, '6000.150', 'Consumos Bebidas',              'BYR', 'Bebidas',   'General'),
  (v_user_id, '6000.300', 'Consumos Artículos Limpieza',   'COC', 'Operación', 'Limpieza'),
  (v_user_id, '6000.310', 'Consumos Químicos',             'COC', 'Operación', 'Químicos'),
  (v_user_id, '6000.320', 'Consumos Desechables',          'COC', 'Operación', 'Desechables'),
  (v_user_id, '6000.210', 'Consumos Menaje',               'COC', 'Operación', 'Menaje'),
  (v_user_id, '6000.200', 'Consumos Lencería',             'COC', 'Operación', 'Uniformes'),
  (v_user_id, '6000.880', 'Mermas Almacén',                'COC', 'Mermas',    'Mermas');

RAISE NOTICE 'Seed completado. Hotel ID: %', v_hotel_id;
END $$;
