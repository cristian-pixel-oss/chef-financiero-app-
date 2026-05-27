import pandas as pd

USER_ID  = 'afe8866c-0c56-4701-ad7b-3449a930994a'
F1 = r'E:\BAHIA PRINCIPE\PUNTA CANA\CONTROL_PEDIDOS_PROTEINAS_RESTAURANTES_CORREGIDO.xlsx'
F2 = r'E:\BAHIA PRINCIPE\PUNTA CANA\CONTROL_COSTOS_PUNTA_CANA_2026_NUEVO_PPTO (1).xlsx'

# ── Helpers ──────────────────────────────────────────────────────────────────
def esc(s):
    return str(s).replace("'", "''")

def subcategoria_proteina(nombre):
    n = nombre.upper()
    if any(k in n for k in ['POLLO','MUSLO','PECHUGA','PAVO','PATO','ALAS DE POLLO']):
        return 'aves'
    if any(k in n for k in ['CAMARON','CAMARONES','PULPO','ALMEJA','CALAMAR','SEPIA',
                             'VIEIRA','BUEY DE MAR','CIGALA','BOCAYATE','GULAS',
                             'MEJILLON','MEZCLA DE MARISCOS','PALITO DE CANGREJO',
                             'COLA DE CAMARON','COLA CAMARON']):
        return 'mariscos'
    if any(k in n for k in ['SALMON','DORADO','DORADA','MERO','BACALAO','CHILLO',
                             'ATUN','PARGO','CARITE','ROBALO','RODABALLO','LIVINA',
                             'PESCADO','FILETE PERCA','FILETE DE MERO','FILETE DE CHILLO',
                             'FILETE DE DORADO','LOMO ATUN','FILETE SALMON']):
        return 'pescado'
    if any(k in n for k in ['CORDERO','CHIVO']):
        return 'cordero'
    if any(k in n for k in ['CERDO','CHULETA','LOMO DE CERDO','PATICA','LONGANIZA',
                             'CHISTORRA','MORCILLA','SALCHIC','COSTILLA AHUMADA',
                             'COSTILLA FRESCA','PIERNA FRESCA','PIERNA AHUMADA',
                             'ALBONDIGA','CHORIZO CASERO']):
        return 'cerdo'
    if any(k in n for k in ['CHURRASCO','RIBEYE','TENDERLOIN','MIGNON','TOP BUTT',
                             'TOP SIRLOIN','CADERA','PIERNA TRASERA','PECHO D/',
                             'CARNE MOLIDA','HAMBURGUESA','ROTI','OSSOBUCO',
                             'FLAT MEAT','COSTILLA DE TERNERA','NEW YORK','PICANA',
                             'ALAS','ALBONDIGA']):
        return 'res'
    return 'res'  # default

def subcategoria_vegetal(nombre):
    n = nombre.upper()
    if any(k in n for k in ['MANGO','PINA','SANDIA','MELON','LIMON','NARANJA',
                             'FRESAS','KIWI','CIRUELA','MANZANA','CARAMBOLA',
                             'GUAYABA','GUINEO','LECHOSA','UVA','FRUTA DEL DRAGON',
                             'CHINOLA','PAPAYA','AGUACATE']):
        return 'fruta'
    if any(k in n for k in ['PAPA','PATATA','YUCA','ÑAME','NAME','PLATANO','BATATA',
                             'YAUTIA','REMOLACHA']):
        return 'tuberculo'
    return 'verdura'

# ── Leer carnes ───────────────────────────────────────────────────────────────
df = pd.read_excel(F1, sheet_name='PED-ABR-CARN', header=None, usecols=[0, 1])
p = df.iloc[4:].copy(); p.columns = ['nombre', 'precio']
p = p[p['nombre'].notna() & p['precio'].notna() &
      p['nombre'].apply(lambda x: isinstance(x, str)) &
      p['precio'].apply(lambda x: isinstance(x, (int, float)))]
carnes = p.drop_duplicates(subset=['nombre']).reset_index(drop=True)

# ── Leer vegetales ────────────────────────────────────────────────────────────
df2 = pd.read_excel(F1, sheet_name='PED-ABR-VEG', header=None, usecols=[0, 1])
p2 = df2.iloc[4:].copy(); p2.columns = ['nombre', 'precio']
p2 = p2[p2['nombre'].notna() & p2['precio'].notna() &
        p2['nombre'].apply(lambda x: isinstance(x, str)) &
        p2['precio'].apply(lambda x: isinstance(x, (int, float)))]
vegetales = p2.drop_duplicates(subset=['nombre']).reset_index(drop=True)

# ── Leer presupuestos ─────────────────────────────────────────────────────────
df3 = pd.read_excel(F2, sheet_name='📦 PED-ABR', header=None)
# Filas 8-26 contienen restaurantes (columnas 1=nombre, 2=ppto$/pax)
ppto_rows = df3.iloc[8:27, [1, 2]].copy()
ppto_rows.columns = ['area', 'ppto_pax']
ppto_rows = ppto_rows[
    ppto_rows['area'].notna() &
    ppto_rows['ppto_pax'].notna() &
    ppto_rows['area'].apply(lambda x: isinstance(x, str)) &
    ppto_rows['ppto_pax'].apply(lambda x: isinstance(x, (int, float)))
].reset_index(drop=True)

# Mapeo nombre Excel → nombre en tabla restaurants (del seed)
RESTAURANT_MAP = {
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
}

# ── Generar SQL ───────────────────────────────────────────────────────────────
lines = []
lines.append("-- ============================================================")
lines.append("-- CHEF FINANCIERO — Migración FASE 1: Productos y Presupuestos")
lines.append("-- Datos reales extraídos de archivos Excel ABR-2026")
lines.append("-- ============================================================")
lines.append("")
lines.append("DO $$")
lines.append("DECLARE")
lines.append(f"  v_user_id UUID := '{USER_ID}';")
lines.append("  v_hotel_id UUID;")
lines.append("BEGIN")
lines.append("")
lines.append("-- Obtener el hotel del usuario")
lines.append("SELECT id INTO v_hotel_id FROM hotels WHERE user_id = v_user_id LIMIT 1;")
lines.append("IF v_hotel_id IS NULL THEN")
lines.append("  RAISE EXCEPTION 'No se encontró hotel para el usuario. Ejecuta el seed primero.';")
lines.append("END IF;")
lines.append("")

# ── DELETE productos anteriores del seed (reemplazar con datos reales) ────────
lines.append("-- ── Limpiar productos del seed (reemplazar con datos reales) ──")
lines.append("DELETE FROM products WHERE hotel_id = v_hotel_id AND category IN ('proteina','vegetal');")
lines.append("")

# ── INSERT proteínas ──────────────────────────────────────────────────────────
lines.append(f"-- ── Proteínas reales ({len(carnes)} productos) ──────────────────────")
lines.append("INSERT INTO products (user_id, hotel_id, name, category, subcategory, unit_of_measure, price_rd)")
lines.append("VALUES")
rows_carne = []
for _, r in carnes.iterrows():
    sub = subcategoria_proteina(r['nombre'])
    rows_carne.append(
        f"  (v_user_id, v_hotel_id, '{esc(r['nombre'])}', 'proteina', '{sub}', 'KG', {round(float(r['precio']),4)})"
    )
lines.append(',\n'.join(rows_carne) + ';')
lines.append("")

# ── INSERT vegetales ──────────────────────────────────────────────────────────
lines.append(f"-- ── Vegetales reales ({len(vegetales)} productos) ──────────────────────")
lines.append("INSERT INTO products (user_id, hotel_id, name, category, subcategory, unit_of_measure, price_rd)")
lines.append("VALUES")
rows_veg = []
for _, r in vegetales.iterrows():
    sub = subcategoria_vegetal(r['nombre'])
    rows_veg.append(
        f"  (v_user_id, v_hotel_id, '{esc(r['nombre'])}', 'vegetal', '{sub}', 'KG', {round(float(r['precio']),4)})"
    )
lines.append(',\n'.join(rows_veg) + ';')
lines.append("")

# ── INSERT presupuestos por restaurante ───────────────────────────────────────
lines.append("-- ── Presupuestos por restaurante — Abril 2026 ──────────────")
for _, r in ppto_rows.iterrows():
    nombre_excel = str(r['area']).strip().upper()
    nombre_db    = RESTAURANT_MAP.get(nombre_excel)
    if not nombre_db:
        lines.append(f"-- SKIP sin mapeo: {nombre_excel}")
        continue
    ppto = round(float(r['ppto_pax']), 4)
    lines.append(
        f"INSERT INTO budget_restaurants (user_id, restaurant_id, year, month, budget_rd_pax)"
        f"\nSELECT v_user_id, id, 2026, 4, {ppto}"
        f"\nFROM restaurants WHERE hotel_id = v_hotel_id AND name = '{esc(nombre_db)}'"
        f"\nON CONFLICT (restaurant_id, year, month) DO UPDATE SET budget_rd_pax = EXCLUDED.budget_rd_pax;"
    )
lines.append("")
lines.append("RAISE NOTICE 'Migración FASE 1 completada. Hotel: %', v_hotel_id;")
lines.append("END $$;")

sql = '\n'.join(lines)

# Guardar SQL
out = r'E:\BAHIA PRINCIPE\chef-financiero-app\supabase\migrations\002_fase1_productos_presupuestos.sql'
with open(out, 'w', encoding='utf-8') as f:
    f.write(sql)

print(f"SQL generado: {out}")
print(f"  Proteinas : {len(carnes)} productos")
print(f"  Vegetales : {len(vegetales)} productos")
print(f"  Presupuestos: {len(ppto_rows)} restaurantes")
print("\n--- PREVIEW (primeras 60 líneas) ---")
for line in lines[:60]:
    print(line)
