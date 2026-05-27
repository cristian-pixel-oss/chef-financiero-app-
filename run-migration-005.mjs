/**
 * run-migration-005.mjs
 * Ejecuta 005_fix_cost_logic.sql en Supabase via Management API.
 *
 * Uso:
 *   node run-migration-005.mjs <PAT>
 *
 * El PAT se genera en: https://supabase.com/dashboard/account/tokens
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const PAT   = process.argv[2]
const REF   = 'monopapkwavhphuewqkf'

if (!PAT) {
  console.error('❌ Uso: node run-migration-005.mjs <PAT>')
  console.error('   Genera un PAT en: https://supabase.com/dashboard/account/tokens')
  process.exit(1)
}

async function runSQL(sql, label) {
  console.log(`\n▶ Ejecutando: ${label} (${(sql.length / 1024).toFixed(1)} KB)...`)
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  )
  const text = await res.text()
  if (!res.ok) {
    console.error(`❌ Error HTTP ${res.status}:`, text.slice(0, 500))
    throw new Error(`HTTP ${res.status}`)
  }
  let json
  try { json = JSON.parse(text) } catch { json = text }
  if (json?.error || (typeof json === 'object' && json?.message)) {
    const msg = json.error || json.message
    console.error('❌ SQL error:', msg)
    throw new Error(msg)
  }
  console.log(`✅ ${label} — OK`)
  return json
}

async function main() {
  const sqlPath = join(__dir, 'supabase', 'migrations', '005_fix_cost_logic.sql')
  const sql = readFileSync(sqlPath, 'utf-8')
  console.log(`📄 Archivo: 005_fix_cost_logic.sql (${(sql.length / 1024).toFixed(1)} KB)`)

  await runSQL(sql, 'Fix costos — eliminar doble conteo proteínas')

  console.log('\n🎉 Migración 005 completada exitosamente.')
  console.log('   Las vistas daily_cost_consolidated y daily_hotel_summary')
  console.log('   ahora usan solo ALM como total_rd.')
  console.log('\n   Revoca este PAT en: https://supabase.com/dashboard/account/tokens')
}

main().catch(err => {
  console.error('\n💥 Migración fallida:', err.message)
  process.exit(1)
})
