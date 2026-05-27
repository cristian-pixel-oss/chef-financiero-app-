import pandas as pd

f1 = r'E:\BAHIA PRINCIPE\PUNTA CANA\CONTROL_PEDIDOS_PROTEINAS_RESTAURANTES_CORREGIDO.xlsx'
f2 = r'E:\BAHIA PRINCIPE\PUNTA CANA\CONTROL_COSTOS_PUNTA_CANA_2026_NUEVO_PPTO (1).xlsx'

# ─── CARNES ───────────────────────────────────────────────────────────────────
df = pd.read_excel(f1, sheet_name='PED-ABR-CARN', header=None, usecols=[0, 1])
p = df.iloc[4:].copy()
p.columns = ['nombre', 'precio']
p = p[
    p['nombre'].notna() & p['precio'].notna() &
    p['nombre'].apply(lambda x: isinstance(x, str)) &
    p['precio'].apply(lambda x: isinstance(x, (int, float)))
]
carnes = p.drop_duplicates(subset=['nombre']).sort_values('nombre').reset_index(drop=True)
print(f'=== CARNES/PROTEINAS UNICAS: {len(carnes)} ===')
for _, r in carnes.iterrows():
    print(f"  {r['nombre']:<50} {r['precio']}")

# ─── VEGETALES ────────────────────────────────────────────────────────────────
df2 = pd.read_excel(f1, sheet_name='PED-ABR-VEG', header=None, usecols=[0, 1])
p2 = df2.iloc[4:].copy()
p2.columns = ['nombre', 'precio']
p2 = p2[
    p2['nombre'].notna() & p2['precio'].notna() &
    p2['nombre'].apply(lambda x: isinstance(x, str)) &
    p2['precio'].apply(lambda x: isinstance(x, (int, float)))
]
vegetales = p2.drop_duplicates(subset=['nombre']).sort_values('nombre').reset_index(drop=True)
print(f'\n=== VEGETALES UNICOS: {len(vegetales)} ===')
for _, r in vegetales.iterrows():
    print(f"  {r['nombre']:<50} {r['precio']}")

# ─── PRESUPUESTOS (archivo costos) ────────────────────────────────────────────
xl2 = pd.ExcelFile(f2)
print('\n=== HOJAS ARCHIVO COSTOS ===')
for s in xl2.sheet_names:
    print(f'  {repr(s)}')

# Buscar hoja con PED y ABR
hojas_ped = [s for s in xl2.sheet_names if 'PED' in s.upper() and 'ABR' in s.upper()]
print(f'\nHojas PED-ABR encontradas: {hojas_ped}')
for h in hojas_ped:
    df3 = pd.read_excel(f2, sheet_name=h, header=None)
    print(f'\n=== Hoja {repr(h)} shape={df3.shape} ===')
    print(df3.head(30).iloc[:, :6].to_string())
