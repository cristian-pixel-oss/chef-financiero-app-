/**
 * run-migration-010.mjs
 * Ejecuta 010_descargos_scalar_fn.sql en Supabase via Management API.
 *
 * Uso:  node run-migration-010.mjs <PAT>
 * PAT:  https://supabase.com/dashboard/account/tokens
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const PAT   = process.argv[2]
const REF   = 'monopapkwavhphuewqkf'

if (!PAT) {
  console.error('❌ Uso: node run-migration-010.mjs <PAT>')
  process.exit(1)
}

async function runSQL(sql, label) {
  console.log(`\n▶ ${label}...`)
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
  console.log(`✅ OK`)
  if (Array.isArray(json) && json.length > 0) { console.table(json) }
  return json
}

const sql = readFileSync(join(__dir, 'supabase', 'migrations', '010_descargos_scalar_fn.sql'), 'utf-8')

runSQL(sql, 'Crear get_descargos_total() escalar + NOTIFY pgrst')
  .then(() => {
    console.log('\n🎉 Migración 010 completada.')
    console.log('   ⚠️  Revoca el PAT: https://supabase.com/dashboard/account/tokens')
  })
  .catch((e) => { console.error('\n💥', e.message); process.exit(1) })
