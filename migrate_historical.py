#!/usr/bin/env python3
"""
migrate_historical.py
Genera un archivo SQL de migración con todos los datos históricos de las hojas Excel.
Produce: migration_data.sql — ejecutar en Supabase SQL Editor o via Management API.
"""
import sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import pandas as pd
from datetime import date, datetime

F1 = 'C:/Users/miche/OneDrive/Desktop/JARVIS/JARVIS/archivos/CONTROL_COSTOS_PUNTA_CANA_2026_NUEVO_PPTO (1).xlsx'
F2 = 'C:/Users/miche/OneDrive/Desktop/JARVIS/JARVIS/archivos/CONTROL_PEDIDOS_PROTEINAS_RESTAURANTES_CORREGIDO.xlsx'

USER_ID  = 'afe8866c-0c56-4701-ad7b-3449a930994a'
MIN_DATE = date(2026, 4, 14)
MAX_DATE = date(2026, 5, 27)

# ── Mapeos de nombres ───────────────────────────────────────────────────────

REST_MAP_FOOD = {
    'COCINA NACAR':        'Cocina Nácar',
    'PANADERÍA+PASTELERÍA':'Panadería + Pastelería',
    'CARNICERÍA CENTRAL':  'Carnicería Central',
    'DESAYUNO NACAR':      'Desayuno Nácar',
    'PANTRY NACAR':        'Pantry Nácar',
    'COCINA LAS OLAS':     'Cocina Las Olas',
    'DESAYUNO LAS OLAS':   'Desayuno Las Olas',
    'PANTRY LAS OLAS':     'Pantry Las Olas',
    'ISLA SNACK':          'Isla Snack',
    'INDU':                'Indu',
    'FLAME':               'Flame',
    'TEQUILA':             'Tequila',
    'CAPRICCIO':           'Capriccio',
    'RODIZIO':             'Rodizio',
    'FISH MARKET':         'Fish Market',
    'MONGOL':              'Mongol',
    'GRIEGO':              'Griego',
    'AYB':                 'A&B General',
    'VEGETALES':           'Vegetales Central',
}

REST_MAP_PROT = {
    'C.CENTRAL':       'Carnicería Central',
    'PANTRY':          'Pantry Nácar',
    'DESAYUNO':        'Desayuno Nácar',
    'PASTELERIA':      'Panadería + Pastelería',
    'COCINA LAS OLAS': 'Cocina Las Olas',
    'DESAYUNO LAS OLAS':'Desayuno Las Olas',
    'PANTRY LAS OLAS': 'Pantry Las Olas',
    'ISLA SNACK':      'Isla Snack',
    'INDU':            'Indu',
    'FLAME':           'Flame',
    'TEQUILA':         'Tequila',
    'CAPRICCIO':       'Capriccio',
    'RODIZIO':         'Rodizio',
    'FISH MARKET':     'Fish Market',
    'MONGOL':          'Mongol',
    'GRIEGO':          'Griego',
    'AYB':             'A&B General',
}

# ── Clasificación de subcategorías ─────────────────────────────────────────

CARN_SUBCATS = {
    'aves':     ['POLLO', 'PECHUGA', 'MUSLO', 'ALAS DE POLLO', 'CARNE MOLIDA DE POLLO', 'HAMBURGUESA DE POLLO', 'PATO', 'CERDO LECHAL', 'PAVO'],
    'res':      ['RIBEYE', 'CHURRASCO', 'TENDERLOIN', 'PECHO D/', 'HAMBURGUESA VACUNO', 'HAMBURGUESA ANGUS', 'CADERA DE RES', 'CADERA DE TERNERA', 'PIERNA TRASERA', 'CARNE MOLIDA DE TERNERA', 'CARNE MOLIDA PREMIUM', 'ROTI', 'TOP BUTT', 'TOP SIRLOIN', 'FLAT MEAT', 'PICANA', 'FILETE MIGNON', 'NEW YORK', 'COSTILLA DE TERNERA', 'COSTILLA FRESCA DE CERDO'],  # costilla de ternera = res
    'cordero':  ['CORDERO', 'CHIVO'],
    'cerdo':    ['FILETE DE CERDO', 'CHULETA FRESCA', 'PATICA', 'LOMO DE CERDO', 'PIERNA FRESCA', 'PIERNA AHUMADA', 'COSTILLA AHUMADA', 'CHULETA AHUMADA', 'MINI HAMBURGUESA', 'ALBONDIGA', 'PIERNA DE CERDO'],
    'embutido': ['LONGANIZA', 'CHORIZO', 'MORCILLA', 'SALCHICHA', 'SALCHICA', 'LIVINA'],
    'mariscos': ['CAMARON', 'CALAMAR', 'MEJILLON', 'ALMEJA', 'PULPO', 'VIEIRAS', 'BUEY DE MAR', 'GULAS', 'MEZCLA DE MARISCOS', 'TINTA DE CALAMAR', 'CARNE DE MEJILLON', 'CARNE DE VIEIRAS'],
    'pescado':  ['ATUN', 'SALMON', 'ROBALO', 'PESCADO', 'DORADO', 'CHILLO', 'BACALAO', 'SEPIA', 'CARITE', 'MERO', 'PERCA', 'CIGALA', 'RODABALLO', 'DORADA ENTERA', 'FILETE DE'],
}

VEG_SUBCATS = {
    'fruta':    ['MELON', 'PIÑA', 'PINA', 'PLATANO', 'SANDIA', 'CIRUELA', 'KIWI', 'FRESA', 'MANZANA', 'UVA', 'GUAYABA', 'CHINOLA', 'GUINEO', 'LIMON', 'NARANJA', 'LECHOSA'],
    'tuberculo':['YUCA', 'PATATA', 'BATATA', 'LENTEJA', 'YAUTIA', 'JENGIBRE', 'CALABAZA', 'HABICHUELA', 'REMOLACHA', 'MAIZ'],
}

def get_subcat(name, is_veg=False):
    u = name.upper()
    if is_veg:
        for subcat, kws in VEG_SUBCATS.items():
            for kw in kws:
                if kw in u: return subcat
        return 'verdura'
    else:
        for subcat, kws in CARN_SUBCATS.items():
            for kw in kws:
                if kw in u: return subcat
        return 'otro'

def to_title(s):
    """Excel UPPERCASE → Title Case, keeping special chars."""
    articles = {'de', 'del', 'la', 'las', 'los', 'el', 'y', 'con', 'sin', 'en', 's/', 'c/', 'd/'}
    words = s.strip().lower().split()
    result = []
    for i, w in enumerate(words):
        result.append(w if (i > 0 and w in articles) else w.capitalize())
    return ' '.join(result)

def sq(s):
    """Escape single quotes for SQL."""
    return str(s).replace("'", "''")

def fval(v):
    """Format float value: None/NaN → 0.0"""
    if v is None or (isinstance(v, float) and (v != v)): return 0.0
    try: return float(v)
    except: return 0.0

# ═══════════════════════════════════════════════════════════════════════════
# 1. PEDIDOS DE ALMACÉN (daily_food_orders + occupancy_daily)
# ═══════════════════════════════════════════════════════════════════════════

food_orders = []   # (date_str, ocp, rest_db_name, viveres, nevera, extras)
occupancy   = {}   # date_str → pax

def parse_food_sheet(df, month_num, sheet_name):
    block_size = 24
    start_row  = 6
    days_in_month = 30 if month_num == 4 else 31

    for day in range(1, days_in_month + 1):
        r = start_row + (day - 1) * block_size
        if r >= len(df): break

        # Date value from header
        header_raw = str(df.iloc[r, 1])
        # Extract date string  "📅  DD/MM/YYYY  —  ..."
        m = re.search(r'(\d{2}/\d{2}/\d{4})', header_raw)
        if not m: continue
        d, mo, yr = m.group(1).split('/')
        row_date = date(int(yr), int(mo), int(d))
        if row_date < MIN_DATE or row_date > MAX_DATE: continue

        ocp = fval(df.iloc[r, 4])
        if ocp <= 0: continue

        date_str = row_date.isoformat()
        occupancy[date_str] = int(ocp)

        # Restaurant rows: +2 to +20 (19 restaurants)
        for offset in range(2, 22):
            rest_raw = df.iloc[r + offset, 1]
            if not isinstance(rest_raw, str) or not rest_raw.strip(): continue
            rest_key = rest_raw.strip().upper()
            db_name  = REST_MAP_FOOD.get(rest_key)
            if not db_name: continue

            viveres = fval(df.iloc[r + offset, 4])
            nevera  = fval(df.iloc[r + offset, 5])
            extras  = fval(df.iloc[r + offset, 6])
            if viveres == 0 and nevera == 0 and extras == 0: continue

            food_orders.append((date_str, int(ocp), db_name, viveres, nevera, extras))

print('Parsing PED-ABR...')
df_abr = pd.read_excel(F1, sheet_name='📦 PED-ABR', header=None)
parse_food_sheet(df_abr, 4, 'ABR')

print('Parsing PED-MAY...')
df_may = pd.read_excel(F1, sheet_name='📦 PED-MAY', header=None)
parse_food_sheet(df_may, 5, 'MAY')

print(f'Food orders: {len(food_orders)}, Occupancy days: {len(occupancy)}')

# ═══════════════════════════════════════════════════════════════════════════
# 2. PEDIDOS DE PROTEÍNAS (daily_protein_orders)
# ═══════════════════════════════════════════════════════════════════════════

# products_catalog: name_normalized → (category, subcategory, price_rd)
products_catalog = {}

# protein_orders: list of (date_str, rest_db_name, prod_normalized, price_rd_kg, qty_kg)
protein_orders = []

def parse_protein_sheet(df, category, month_num, sheet_name):
    is_veg = (category == 'vegetal')
    block_size = 86 if is_veg else 108
    n_restaurants = 17

    # Get restaurant names from row 2 of first block
    rests_in_sheet = []
    for i in range(n_restaurants):
        col = i * 4
        if col >= df.shape[1]: break
        rname = str(df.iloc[2, col]).strip()
        db_name = REST_MAP_PROT.get(rname.upper()) or REST_MAP_PROT.get(rname)
        rests_in_sheet.append(db_name)  # may be None if unmapped

    # Get product names from first block (rows 4..block_size-1 of col 0)
    prod_rows_start = 3  # row index within block for col headers
    prod_data_start = prod_rows_start + 1  # row 4 has first product
    n_products = block_size - prod_data_start - 1  # last row = TOTAL

    # Parse each day block
    days_in_month = 30 if month_num == 4 else 31
    for day in range(1, days_in_month + 1):
        # Block start: row 1 + (day-1)*block_size  (row 0 is global title)
        block_start = (day - 1) * block_size
        date_row = block_start + 1

        if date_row >= len(df): break

        # Get date
        date_val = df.iloc[date_row, 0]
        if pd.isna(date_val):
            # Day 1 of April VEG has no date in col0
            if day == 1 and month_num == 4:
                row_date = date(2026, 4, 1)
            elif day == 1 and month_num == 5:
                # May day 1 uses Excel serial (46143)
                import datetime as dt
                excel_serial = df.iloc[date_row, 0]
                if pd.notna(excel_serial) and isinstance(excel_serial, (int, float)):
                    row_date = dt.date(1899, 12, 30) + dt.timedelta(days=int(excel_serial))
                else:
                    row_date = date(2026, 5, 1)
            else:
                continue
        elif isinstance(date_val, (int, float)) and 46000 < date_val < 47000:
            import datetime as dt
            row_date = dt.date(1899, 12, 30) + dt.timedelta(days=int(date_val))
        elif hasattr(date_val, 'date'):
            row_date = date_val.date() if hasattr(date_val, 'date') else date_val
        elif isinstance(date_val, str):
            try: row_date = datetime.strptime(date_val[:10], '%Y-%m-%d').date()
            except: continue
        else:
            continue

        if row_date < MIN_DATE or row_date > MAX_DATE: continue
        date_str = row_date.isoformat()

        # Product rows: block_start + prod_data_start to block_start + block_size - 2
        for prod_offset in range(prod_data_start, block_size - 1):
            pr = block_start + prod_offset
            if pr >= len(df): break

            prod_raw = df.iloc[pr, 0]
            if pd.isna(prod_raw) or str(prod_raw).strip().upper() in ['', 'TOTAL']: continue
            prod_name = to_title(str(prod_raw).strip())

            # Price for this product (from col 1 of C.CENTRAL block)
            price_raw = df.iloc[pr, 1]
            price = fval(price_raw)

            # Register product in catalog
            if prod_name not in products_catalog:
                subcat = get_subcat(str(prod_raw).strip(), is_veg)
                products_catalog[prod_name] = (category, subcat, price)

            # For each restaurant
            for ri, db_rest in enumerate(rests_in_sheet):
                if db_rest is None: continue
                kg_col = ri * 4 + 2   # ENTREGA KGR column
                if kg_col >= df.shape[1]: continue
                qty = fval(df.iloc[pr, kg_col])
                if qty <= 0: continue

                # Price per this restaurant (col ri*4+1)
                price_col = ri * 4 + 1
                p = fval(df.iloc[pr, price_col])
                if p <= 0: p = price

                protein_orders.append((date_str, db_rest, prod_name, round(p, 4), round(qty, 3)))

print('Parsing PED-ABR-CARN...')
df_ac = pd.read_excel(F2, sheet_name='PED-ABR-CARN', header=None)
parse_protein_sheet(df_ac, 'proteina', 4, 'ABR-CARN')

print('Parsing PED-ABR-VEG...')
df_av = pd.read_excel(F2, sheet_name='PED-ABR-VEG', header=None)
parse_protein_sheet(df_av, 'vegetal', 4, 'ABR-VEG')

print('Parsing PED-MAY-CARN...')
df_mc = pd.read_excel(F2, sheet_name='PED-MAY-CARN', header=None)
parse_protein_sheet(df_mc, 'proteina', 5, 'MAY-CARN')

print('Parsing PED-MAY-VEG...')
df_mv = pd.read_excel(F2, sheet_name='PED-MAY-VEG', header=None)
parse_protein_sheet(df_mv, 'vegetal', 5, 'MAY-VEG')

print(f'Protein orders: {len(protein_orders)}, Products: {len(products_catalog)}')

# ═══════════════════════════════════════════════════════════════════════════
# 3. GENERAR SQL
# ═══════════════════════════════════════════════════════════════════════════

lines = []
A = lines.append

A("-- ============================================================")
A("-- CHEF FINANCIERO — Migración de datos históricos")
A("-- Generado automáticamente. Ejecutar en Supabase SQL Editor.")
A("-- Cubre: 14/04/2026 – 27/05/2026")
A("-- ============================================================")
A("")
A("DO $$")
A("DECLARE")
A(f"  v_user_id UUID := '{USER_ID}';")
A("  v_hotel_id UUID;")
A("BEGIN")
A("")
A("-- ── Obtener hotel ──────────────────────────────────────────────")
A("  SELECT id INTO v_hotel_id FROM hotels WHERE user_id = v_user_id LIMIT 1;")
A("  IF v_hotel_id IS NULL THEN")
A("    RAISE EXCEPTION 'Hotel no encontrado para user_id %', v_user_id;")
A("  END IF;")
A("")

# ── OCUPACIÓN ──────────────────────────────────────────────────────────────
A("-- ── Ocupación diaria ───────────────────────────────────────────")
A("  INSERT INTO occupancy_daily (user_id, hotel_id, date, pax, status)")
A("  VALUES")
ocp_rows = [f"    ('{USER_ID}', v_hotel_id, '{d}', {p}, 'normal')" for d, p in sorted(occupancy.items())]
A(',\n'.join(ocp_rows))
A("  ON CONFLICT (hotel_id, date) DO UPDATE")
A("    SET pax = EXCLUDED.pax, status = EXCLUDED.status;")
A("")

# ── PEDIDOS DE ALMACÉN ────────────────────────────────────────────────────
A("-- ── Pedidos de almacén (daily_food_orders) ─────────────────────")
A("  INSERT INTO daily_food_orders (user_id, restaurant_id, date, pax, viveres_rd, nevera_rd, extras_rd)")
A("  SELECT")
A("    '" + USER_ID + "',")
A("    (SELECT id FROM restaurants WHERE hotel_id = v_hotel_id AND name = t.rest_name),")
A("    t.date::DATE,")
A("    t.pax,")
A("    t.viveres,")
A("    t.nevera,")
A("    t.extras")
A("  FROM (VALUES")

food_rows = []
for (date_str, ocp, rest_name, viveres, nevera, extras) in food_orders:
    food_rows.append(
        f"    ('{sq(rest_name)}', '{date_str}', {ocp}, {round(viveres,2)}, {round(nevera,2)}, {round(extras,2)})"
    )
A(',\n'.join(food_rows))
A("  ) AS t(rest_name, date, pax, viveres, nevera, extras)")
A("  ON CONFLICT (restaurant_id, date) DO UPDATE")
A("    SET viveres_rd = EXCLUDED.viveres_rd,")
A("        nevera_rd  = EXCLUDED.nevera_rd,")
A("        extras_rd  = EXCLUDED.extras_rd,")
A("        pax        = EXCLUDED.pax;")
A("")

# ── PRODUCTOS ──────────────────────────────────────────────────────────────
A("-- ── Productos del catálogo (upsert por nombre) ──────────────────")
A("  INSERT INTO products (user_id, hotel_id, name, category, subcategory, unit_of_measure, price_rd)")
A("  SELECT v_user_id, v_hotel_id, t.pname, t.cat, t.subcat, 'KG', t.price")
A("  FROM (VALUES")

prod_rows = []
for pname, (cat, subcat, price) in sorted(products_catalog.items()):
    prod_rows.append(f"    ('{sq(pname)}', '{cat}', '{subcat}', {round(price,4)})")
A(',\n'.join(prod_rows))
A("  ) AS t(pname, cat, subcat, price)")
A("  WHERE NOT EXISTS (")
A("    SELECT 1 FROM products WHERE hotel_id = v_hotel_id AND name = t.pname")
A("  );")
A("")

# ── PEDIDOS DE PROTEÍNAS ───────────────────────────────────────────────────
# Batch in chunks of 1000 to avoid SQL size limits
A("-- ── Despachos de proteínas (daily_protein_orders) ───────────────")

BATCH = 1000
total = len(protein_orders)
for batch_start in range(0, total, BATCH):
    batch = protein_orders[batch_start:batch_start + BATCH]
    A(f"  -- Batch {batch_start//BATCH + 1} / {(total + BATCH - 1)//BATCH}")
    A("  INSERT INTO daily_protein_orders (user_id, restaurant_id, product_id, date, price_rd_kg, quantity_kg, order_type)")
    A("  SELECT")
    A(f"    '{USER_ID}',")
    A("    (SELECT id FROM restaurants WHERE hotel_id = v_hotel_id AND name = t.rest_name),")
    A("    (SELECT id FROM products     WHERE hotel_id = v_hotel_id AND name = t.prod_name),")
    A("    t.date::DATE,")
    A("    t.price,")
    A("    t.qty,")
    A("    'normal'")
    A("  FROM (VALUES")

    prot_rows = []
    for (date_str, rest_name, prod_name, price, qty) in batch:
        prot_rows.append(
            f"    ('{sq(rest_name)}', '{sq(prod_name)}', '{date_str}', {price}, {qty})"
        )
    A(',\n'.join(prot_rows))
    A("  ) AS t(rest_name, prod_name, date, price, qty)")
    A("  WHERE (SELECT id FROM restaurants WHERE hotel_id = v_hotel_id AND name = t.rest_name) IS NOT NULL")
    A("    AND (SELECT id FROM products     WHERE hotel_id = v_hotel_id AND name = t.prod_name) IS NOT NULL")
    A("  ON CONFLICT (restaurant_id, product_id, date) DO UPDATE")
    A("    SET quantity_kg  = EXCLUDED.quantity_kg,")
    A("        price_rd_kg  = EXCLUDED.price_rd_kg;")
    A("")

A(f"  RAISE NOTICE 'Migración completada: {len(occupancy)} días ocupación, {len(food_orders)} pedidos almacén, {len(protein_orders)} despachos proteínas';")
A("END $$;")

sql_content = '\n'.join(lines)

out_path = 'E:/BAHIA PRINCIPE/chef-financiero-app/migration_data.sql'
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(sql_content)

print(f'\nSQL generado: {out_path}')
print(f'Tamaño: {len(sql_content):,} chars ({len(sql_content)//1024} KB)')
print(f'\nResumen:')
print(f'  Ocupación:          {len(occupancy):4d} días')
print(f'  Pedidos almacén:    {len(food_orders):4d} registros')
print(f'  Productos catálogo: {len(products_catalog):4d} productos')
print(f'  Despachos proteína: {len(protein_orders):4d} registros')
