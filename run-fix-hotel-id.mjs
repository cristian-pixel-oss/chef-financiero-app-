/**
 * run-fix-hotel-id.mjs
 * Diagnostica y corrige el hotel_id mismatch en daily_descargos.
 *
 * Uso:  node run-fix-hotel-id.mjs <PAT>
 * PAT:  https://supabase.com/dashboard/account/tokens
 */

import { fileURLToPath } from 'url'
const PAT = process.argv[2]
const REF = 'monopapkwavhphuewqkf'

if (!PAT) {
  console.error('❌ Uso: node run-fix-hotel-id.mjs <PAT>')
  process.exit(1)
}

async function query(sql, label) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${PAT}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    }
  )
  const text = await res.text()
  if (!res.ok) { console.error(`❌ HTTP ${res.status}:`, text.slice(0, 300)); throw new Error(`HTTP ${res.status}`) }
  let json; try { json = JSON.parse(text) } catch { json = text }
  if (json?.error || json?.message) { throw new Error(json.error || json.message) }
  console.log(`\n── ${label} ──`)
  console.table(json)
  return json
}

async function run() {
  // 1. Ver todos los hoteles
  const hotels = await query(
    `SELECT id, name, active FROM hotels ORDER BY created_at`,
    'Todos los hoteles'
  )

  // 2. Ver qué hotel_id tienen los descargos importados
  const descargoHotels = await query(
    `SELECT DISTINCT d.hotel_id, h.name AS hotel_name, h.active, COUNT(*) AS registros
     FROM daily_descargos d
     LEFT JOIN hotels h ON h.id = d.hotel_id
     WHERE d.restaurant_id IS NULL
     GROUP BY d.hotel_id, h.name, h.active`,
    'Hotel_id en daily_descargos (registros históricos)'
  )

  // 3. El hotel activo que usa el dashboard
  const activeHotel = await query(
    `SELECT id, name FROM hotels WHERE active = true ORDER BY created_at LIMIT 1`,
    'Hotel activo (el que usa el dashboard)'
  )

  if (!activeHotel?.length) {
    console.error('\n❌ No hay hoteles activos. Verifica la tabla hotels.')
    process.exit(1)
  }

  const correctId = activeHotel[0].id
  const correctName = activeHotel[0].name

  // 4. Verificar si hay mismatch
  const wrongIds = (descargoHotels ?? []).filter(r => r.hotel_id !== correctId)

  if (wrongIds.length === 0) {
    console.log(`\n✅ No hay mismatch. hotel_id correcto: ${correctId} (${correctName})`)
    console.log('   El problema de descargos=0 tiene otra causa.')
    return
  }

  console.log(`\n⚠️  MISMATCH DETECTADO:`)
  for (const w of wrongIds) {
    console.log(`   hotel_id actual: ${w.hotel_id} (${w.hotel_name ?? 'sin nombre'}) — ${w.registros} registros`)
  }
  console.log(`   hotel_id correcto: ${correctId} (${correctName})`)

  // 5. Corregir: actualizar todos los registros históricos al hotel_id correcto
  console.log('\n▶ Corrigiendo hotel_id en daily_descargos...')
  const fix = await query(
    `UPDATE daily_descargos
     SET hotel_id = '${correctId}'
     WHERE restaurant_id IS NULL
       AND hotel_id != '${correctId}'`,
    'Fix hotel_id'
  )

  // 6. Verificar corrección
  await query(
    `SELECT d.hotel_id, h.name, COUNT(*) AS registros,
            MIN(d.date) AS desde, MAX(d.date) AS hasta,
            ROUND(SUM(d.amount_rd)::NUMERIC, 2) AS total_rd
     FROM daily_descargos d
     JOIN hotels h ON h.id = d.hotel_id
     WHERE d.restaurant_id IS NULL
     GROUP BY d.hotel_id, h.name`,
    'Estado final — daily_descargos históricos'
  )

  console.log('\n🎉 Fix completado. Recarga el dashboard y verifica los descargos.')
  console.log('   ⚠️  Revoca el PAT: https://supabase.com/dashboard/account/tokens')
}

run().catch(e => { console.error('\n💥', e.message); process.exit(1) })
