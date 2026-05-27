# Chef Financiero — Instrucciones de conexión a Supabase

## 1. Crear el proyecto en Supabase

1. Ve a https://supabase.com y crea una cuenta gratuita
2. Clic en **"New project"**
3. Nombre: `chef-financiero`
4. Región: `US East (N. Virginia)` o la más cercana a República Dominicana
5. Elige una contraseña segura para la base de datos
6. Espera ~2 minutos a que el proyecto esté listo

---

## 2. Ejecutar el schema SQL

1. En tu proyecto de Supabase ve a **SQL Editor** (icono de base de datos en el menú izquierdo)
2. Clic en **"New query"**
3. Abre el archivo `supabase/migrations/001_initial_schema.sql`
4. Pega todo el contenido en el editor
5. Clic en **"Run"** (o `Ctrl + Enter`)
6. Verifica que diga **"Success. No rows returned"**

> Si ves errores, asegúrate de ejecutar el script completo desde el inicio.
> El orden de las sentencias importa (las tablas referenciadas deben existir antes).

---

## 3. Obtener las claves de API

1. En Supabase ve a **Settings → API**
2. Copia los dos valores:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 4. Configurar el proyecto Next.js

```bash
# Instalar dependencias
cd chef-financiero-app
npm install

# Crear el archivo de entorno
cp .env.example .env.local

# Editar .env.local con tus valores reales de Supabase
# (abrir con cualquier editor de texto)
```

Editar `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anon
```

---

## 5. Instalar dependencias del proyecto

```bash
npm install @supabase/supabase-js
npm install next react react-dom
npm install -D tailwindcss postcss autoprefixer typescript @types/react @types/node
npx tailwindcss init -p
```

O si prefieres iniciar desde cero con el template oficial:

```bash
npx create-next-app@latest chef-financiero-app \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*"
cd chef-financiero-app
npm install @supabase/supabase-js
```

---

## 6. Verificar que todo funciona

```bash
npm run dev
```

Abre http://localhost:3000 en el navegador.

---

## 7. Configurar autenticación en Supabase

1. En Supabase ve a **Authentication → Settings**
2. En **"Site URL"** pon: `http://localhost:3000`
3. En **"Redirect URLs"** agrega: `http://localhost:3000/auth/callback`
4. Para producción, agrega también tu dominio real

---

## 8. Migración de datos desde Excel (pasos opcionales)

Para importar los datos históricos de los archivos Excel:

1. Exporta cada hoja del Excel como CSV
2. En Supabase ve a **Table Editor → tu tabla → Import data**
3. Sube el CSV y mapea las columnas

O usa el script de migración (a desarrollar) que lee los .xlsx y los inserta via Supabase.

---

## 9. Estructura de archivos creados

```
chef-financiero-app/
├── .env.example                          # Variables de entorno (copiar como .env.local)
├── INSTRUCCIONES_SUPABASE.md             # Este archivo
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql        # Schema completo de la BD
└── src/
    ├── lib/
    │   └── supabase/
    │       └── client.ts                 # Cliente Supabase (Next.js + RN compatible)
    ├── types/
    │   └── database.types.ts             # Tipos TypeScript de la BD
    ├── services/
    │   ├── costs.service.ts              # Lógica de costos diarios
    │   └── proteins.service.ts           # Lógica de proteínas y vegetales
    ├── hooks/
    │   ├── useAuth.ts                    # Autenticación
    │   └── useDailyCosts.ts              # Estado y operaciones de costos
    └── app/
        ├── (auth)/login/page.tsx         # Página de login
        └── (dashboard)/dashboard/page.tsx # Dashboard JARVIS principal
```

---

## 10. Para el futuro móvil (Expo / React Native)

Los servicios (`/services`) y los tipos (`/types`) son 100% reutilizables en React Native.

Para usar Supabase en Expo solo cambia el cliente:

```typescript
// En móvil: src/lib/supabase/client.native.ts
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(url, anon, {
  auth: {
    storage: AsyncStorage,  // <-- única diferencia
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // false en RN
  },
})
```

Los hooks también son reutilizables en RN **si no usan APIs del navegador** (`window`, `document`).
El hook `useAuth.ts` tiene una línea con `window.location.origin` que hay que ajustar para RN.

---

## Tablas creadas en Supabase

| Tabla                    | Descripción |
|--------------------------|-------------|
| `profiles`               | Perfil del usuario (extiende auth.users) |
| `hotels`                 | Hoteles / propiedades del usuario |
| `exchange_rates`         | Tasas de cambio RD$/USD por mes |
| `restaurants`            | Áreas y puntos de servicio |
| `occupancy_daily`        | Ocupación diaria (PAX) |
| `products`               | Catálogo de proteínas, vegetales, operación |
| `budget_operations`      | Presupuesto de artículos de operación |
| `budget_restaurants`     | Presupuesto de A&B por restaurante |
| `daily_operation_orders` | Pedidos diarios de operación |
| `daily_food_orders`      | Pedidos diarios de alimentos por restaurante |
| `daily_protein_orders`   | Pedidos de proteínas/vegetales (nivel producto) |
| `protein_control`        | Control de mise en place y consumo |
| `chart_of_accounts`      | Catálogo de cuentas contables 6000.xxx |
| `erp_transactions`       | Transacciones brutas del ERP |
| `thematic_discharges`    | Descargos de restaurantes temáticos |
| `action_plans`           | Planes de acción A&B |
| `reviewpro_comments`     | Comentarios de huéspedes |

**Vistas calculadas** (equivalen a fórmulas del Excel):
- `daily_food_orders_view` — pedidos con total, varianza y costo/PAX
- `daily_protein_orders_view` — pedidos con costo calculado
- `protein_control_view` — control con kg consumido, g/PAX y desviación vs 400g

**Funciones RPC**:
- `get_daily_summary(hotel_id, date)` — resumen del día para el dashboard
- `get_monthly_projection(hotel_id, year, month)` — proyección al cierre del mes
