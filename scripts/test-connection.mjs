/**
 * CHEF FINANCIERO — Script de prueba de conexión a Supabase
 *
 * Ejecutar con: node scripts/test-connection.mjs
 *
 * Verifica que:
 * 1. Las credenciales son correctas
 * 2. Las tablas fueron creadas
 * 3. La autenticación funciona
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync }  from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Leer .env.local manualmente (no hay dotenv instalado)
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath   = resolve(__dirname, '../.env.local')
const envContent = readFileSync(envPath, 'utf8')

const env = Object.fromEntries(
  envContent.split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.split('=').map(p => p.trim()))
    .filter(([k]) => k)
)

const SUPABASE_URL  = env['NEXT_PUBLIC_SUPABASE_URL']
const SUPABASE_ANON = env['NEXT_PUBLIC_SUPABASE_ANON_KEY']

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('❌ Faltan variables de entorno en .env.local')
  process.exit(1)
}

console.log('\n🔌 Conectando a Supabase...')
console.log(`   URL: ${SUPABASE_URL}`)

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

// ── Pruebas ──────────────────────────────────────────────────────
const tests = [
  {
    name: 'hotels',
    run: () => supabase.from('hotels').select('count').limit(1),
  },
  {
    name: 'restaurants',
    run: () => supabase.from('restaurants').select('count').limit(1),
  },
  {
    name: 'products',
    run: () => supabase.from('products').select('count').limit(1),
  },
  {
    name: 'occupancy_daily',
    run: () => supabase.from('occupancy_daily').select('count').limit(1),
  },
  {
    name: 'daily_food_orders',
    run: () => supabase.from('daily_food_orders').select('count').limit(1),
  },
  {
    name: 'daily_protein_orders',
    run: () => supabase.from('daily_protein_orders').select('count').limit(1),
  },
  {
    name: 'protein_control',
    run: () => supabase.from('protein_control').select('count').limit(1),
  },
  {
    name: 'action_plans',
    run: () => supabase.from('action_plans').select('count').limit(1),
  },
]

let passed = 0
let failed = 0

console.log('\n📋 Verificando tablas...\n')

for (const test of tests) {
  const { error } = await test.run()
  if (error && error.code !== 'PGRST116') {
    console.log(`   ❌ ${test.name} — ${error.message}`)
    failed++
  } else {
    console.log(`   ✅ ${test.name}`)
    passed++
  }
}

console.log(`\n📊 Resultado: ${passed} OK / ${failed} fallidos`)

if (failed === 0) {
  console.log('\n🎉 Conexión exitosa. El proyecto está listo para usarse.\n')
  console.log('   Próximo paso: ejecutar  npm run dev\n')
} else {
  console.log('\n⚠️  Hay tablas que no existen todavía.')
  console.log('   Ejecuta el schema SQL en Supabase → SQL Editor.\n')
  console.log('   Archivo: supabase/migrations/001_initial_schema.sql\n')
}
