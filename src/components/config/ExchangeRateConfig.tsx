'use client'

import { useState, useEffect } from 'react'
import { getExchangeRate, saveExchangeRate } from '@/services/hotelConfig.service'
import { useHotelId } from '@/hooks/useHotelId'

export default function ExchangeRateConfig() {
  const { hotelId } = useHotelId()
  const now = new Date()
  const [year] = useState(now.getFullYear())
  const [month] = useState(now.getMonth() + 1)
  const [rate, setRate] = useState<number>(59.74)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!hotelId) return
    getExchangeRate(hotelId, year, month).then(setRate)
  }, [hotelId, year, month])

  const handleSave = async () => {
    if (!hotelId) return
    setSaving(true)
    try {
      await saveExchangeRate(hotelId, year, month, rate)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-6 max-w-sm">
      <h3 className="text-lg font-semibold text-gray-800 mb-1">Tasa de Cambio</h3>
      <p className="text-sm text-gray-500 mb-4">RD$ por 1 USD — {month}/{year}</p>
      <div className="flex items-center gap-3">
        <span className="text-gray-600 font-medium">RD$</span>
        <input
          type="number"
          step="0.01"
          value={rate}
          onChange={e => setRate(Number(e.target.value))}
          className="border rounded-lg px-3 py-2 w-32 text-right font-mono text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition"
        >
          {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
