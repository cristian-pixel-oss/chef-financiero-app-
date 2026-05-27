/**
 * run-migration-data.mjs
 * Ejecuta migration_data.sql en Supabase via Management API.
 *
 * Uso:
 *   node run-migration-data.mjs <PAT>
 *
 * El PAT se genera en: https://supabase.com/dashboard/account/tokens
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const PAT    = process.argv[2]
const REF    = 'monopapkwavhphuewqkf'

if (!PAT) {
  console.error('❌ Uso: node run-migration-data.mjs <PAT>')
  console.error('   Genera un PAT en: https://supabase.com/dashboard/account/tokens')
  process.exit(1)
}

async function runSQL(sql, label) {
  console.log(`\n▶ Ejecutando: ${label} (${(sql.length / 1024).toFixed(0)} KB)...`)
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
  if (json?.notice) console.log('   Notice:', json.notice)
  return json
}

async function main() {
  const sqlPath = join(__dir, 'migration_data.sql')
  const fullSQL = readFileSync(sqlPath, 'utf-8')
  console.log(`📄 Archivo: migration_data.sql (${(fullSQL.length / 1024).toFixed(0)} KB)`)

  // The SQL is a single DO $$ ... $$ block — execute it as one transaction.
  // If too large for one request, split by the batch markers.
  const MAX_SIZE = 480 * 1024  // 480 KB safe limit per request

  if (fullSQL.length <= MAX_SIZE) {
    await runSQL(fullSQL, 'Migración completa')
  } else {
    // Split into two halves:
    // Part 1: occupancy + food orders + products (everything up to protein batches)
    // Part 2+: protein order batches
    const batchMarker = '-- Batch 2 /'
    const splitIdx = fullSQL.indexOf(batchMarker)

    if (splitIdx === -1) {
      // Can't split, send as one
      await runSQL(fullSQL, 'Migración completa (large)')
    } else {
      // Part 1: close the DO block after batch 1
      const part1Raw = fullSQL.slice(0, splitIdx)
      // Find the last ON CONFLICT block and END $$ to close it
      const endMarker = "  RAISE NOTICE"
      const endIdx = fullSQL.lastIndexOf(endMarker)
      const part1 = part1Raw + '\n' + fullSQL.slice(endIdx)

      // Part 2: remaining batches wrapped in their own DO block
      const part2Inner = fullSQL.slice(splitIdx, endIdx)
      const declareBlock = fullSQL.slice(0, fullSQL.indexOf('\nBEGIN\n') + 7)
      const part2 = declareBlock + '\n' + part2Inner + '\n' +
        `  RAISE NOTICE 'Proteínas batch 2+ completado';\nEND $$;`

      await runSQL(part1, 'Parte 1: ocupación + almacén + productos + proteínas batch 1')
      await runSQL(part2, 'Parte 2: proteínas batches restantes')
    }
  }

  console.log('\n🎉 Migración completada exitosamente.')
  console.log('   Revoca este PAT en: https://supabase.com/dashboard/account/tokens')
}

main().catch(err => {
  console.error('\n💥 Migración fallida:', err.message)
  process.exit(1)
})
