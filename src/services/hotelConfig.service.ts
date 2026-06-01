import { supabase } from '@/lib/supabase/client'

export interface HotelConfig {
  id?: string
  hotel_id: string
  year: number
  month: number
  exchange_rate: number
}

export async function getExchangeRate(hotelId: string, year: number, month: number): Promise<number> {
  const { data, error } = await supabase
    .from('hotel_config')
    .select('exchange_rate')
    .eq('hotel_id', hotelId)
    .eq('year', year)
    .eq('month', month)
    .single()

  if (error || !data) return 59.74
  return Number(data.exchange_rate)
}

export async function saveExchangeRate(
  hotelId: string,
  year: number,
  month: number,
  exchangeRate: number
): Promise<void> {
  const { error } = await supabase
    .from('hotel_config')
    .upsert(
      { hotel_id: hotelId, year, month, exchange_rate: exchangeRate, updated_at: new Date().toISOString() },
      { onConflict: 'hotel_id,year,month' }
    )

  if (error) throw error
}

export async function getCurrentExchangeRate(hotelId: string): Promise<number> {
  const now = new Date()
  return getExchangeRate(hotelId, now.getFullYear(), now.getMonth() + 1)
}
