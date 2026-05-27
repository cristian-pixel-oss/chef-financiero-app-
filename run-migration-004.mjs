/**
 * Ejecuta la migración 004 (Vegetales Central) en Supabase
 * usando la Management API.
 *
 * Uso:
 *   node run-migration-004.mjs <PERSONAL_ACCESS_TOKEN>
 *
 * Obtén el token en: https://supabase.com/dashboard/account/tokens
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir  = dirname(fileURLToPath(import.meta.url))
const PROJECT_REF = 'monopapkwavhphuewqkf'
const PAT         = process.argv[2]

if (!PAT) {
  console.error('Uso: node run-migration-004.mjs <PERSONAL_ACCESS_TOKEN>')
  process.exit(1)
}

const sql = readFileSync(
  join(__dir, 'supabase', 'migrations', '004_add_vegetales_central.sql'),
  'utf-8'
)

console.log('▶ Ejecutando Migration 004 — Vegetales Central …')

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
  {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${PAT}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ query: sql }),
  }
)

const body = await res.json()
if (!res.ok) {
  console.error('✗ Error:', body)
  process.exit(1)
}

console.log('✓ Migración ejecutada correctamente')
console.log('Respuesta:', JSON.stringify(body, null, 2))
