'use client'

import { useState, useEffect } from 'react'
import { getExchangeRate, saveExchangeRate } from '@/services/hotelConfig.service'
import { useHotelId } from '@/hooks/useHotelId'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function ExchangeRateConfig() {
  const { hotelId } = useHotelId()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rate, setRate] = useState(59.74)
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

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  return (
    <div className="min-h-screen bg-gray-950 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="text-4xl font-black mb-1">
            <span className="text-white">Chef </span>
            <span className="text-yellow-400">Financiero</span>
          </div>
          <p className="text-gray-400 text-sm">Panel de Configuracion</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-white text-xl font-bold mb-1">Tasa de Cambio</h2>
          <p className="text-gray-400 text-sm mb-6">RD$ por 1 USD para cada mes</p>
          <div className="flex gap-3 mb-6">
            <div className="flex-1">
              <label className="text-gray-400 text-xs uppercase mb-2 block">Mes</label>
              <select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm">
                {MONTHS.map((m, i) => (<option key={i} value={i + 1}>{m}</option>))}
              </select>
            </div>
            <div className="w-32">
              <label className="text-gray-400 text-xs uppercase mb-2 block">Año</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm">
                {years.map(y => (<option key={y} value={y}>{y}</option>))}
              </select>
            </div>
          </div>
          <div className="mb-6">
            <label className="text-gray-400 text-xs uppercase mb-2 block">Tasa</label>
            <div className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
              <span className="text-yellow-400 font-bold text-lg">RD$</span>
              <input type="number" step="0.01" value={rate} onChange={e => setRate(Number(e.target.value))} className="flex-1 bg-transparent text-white text-2xl font-mono font-bold focus:outline-none text-right" />
              <span className="text-gray-500 text-sm">/ USD</span>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} className="w-full bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold py-3 rounded-xl text-sm transition disabled:opacity-50">
            {saving ? 'Guardando...' : saved ? 'Guardado correctamente' : 'Guardar Tasa de Cambio'}
          </button>
        </div>
        <p className="text-center text-gray-600 text-xs mt-6">Los cambios se aplican al dashboard automaticamente</p>
      </div>
    </div>
  )
}