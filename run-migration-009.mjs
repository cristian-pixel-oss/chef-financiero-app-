/**
 * run-migration-009.mjs
 * Ejecuta 009_fix_descargos_rls.sql en Supabase via Management API.
 *
 * FIX: descargos siempre RD$ 0 en el browser
 *   1. Corrige user_id IS NULL en daily_descargos históricos
 *   2. Crea función get_period_descargos() con SECURITY DEFINER
 *
 * Uso:  node run-migration-009.mjs <PAT>
 * PAT:  https://supabase.com/dashboard/account/tokens
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const PAT   = process.argv[2]
const REF   = 'monopapkwavhphuewqkf'

if (!PAT) {
  console.error('❌ Uso: node run-migration-009.mjs <PAT>')
  process.exit(1)
}

async function runSQL(sql, label) {
  console.log(`\n▶ ${label} (${(sql.length / 1024).toFixed(1)} KB)...`)
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${PAT}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    }
  )
  const text = await res.text()
  if (!res.ok) { console.error(`❌ HTTP ${res.status}:`, text.slice(0, 400)); throw new Error(`HTTP ${res.status}`) }
  let json; try { json = JSON.parse(text) } catch { json = text }
  if (json?.error || json?.message) { const m = json.error || json.message; console.error('❌', m); throw new Error(m) }
  console.log(`✅ ${label} — OK`)
  if (Array.isArray(json) && json.length > 0) {
    console.log('   Resultado:')
    console.table(json)
  }
  return json
}

const sql = readFileSync(join(__dir, 'supabase', 'migrations', '009_fix_descargos_rls.sql'), 'utf-8')
console.log(`📄 009_fix_descargos_rls.sql (${(sql.length / 1024).toFixed(1)} KB)`)

runSQL(sql, 'Fix user_id + crear get_period_descargos() SECURITY DEFINER')
  .then(() => {
    console.log('\n🎉 Migración 009 completada.')
    console.log('   ✅ Función get_period_descargos() disponible en el API.')
    console.log('   ⚠️  Revoca el PAT: https://supabase.com/dashboard/account/tokens')
  })
  .catch((e) => { console.error('\n💥', e.message); process.exit(1) })
