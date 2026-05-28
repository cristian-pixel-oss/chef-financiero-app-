'use client'

/**
 * CHEF FINANCIERO — Hook: useHotelId
 *
 * Resuelve el hotel_id y hotel_name del usuario actual, soportando dos casos:
 *
 *  - Admin/dueño  → el hotel tiene hotels.user_id = auth.uid()
 *  - Invitado     → tiene profiles.hotel_id asignado por la invitación
 *
 * La política RLS de hotels solo permite SELECT al dueño, por eso primero
 * se lee profiles para obtener hotel_id y luego se consulta hotels.
 * Si la consulta a hotels falla (RLS aún no actualizada), se devuelve el
 * hotel_id del perfil con name vacío para que las páginas sigan funcionando.
 */

import { useState, useEffect } from 'react'
import { supabase }            from '@/lib/supabase/client'

export interface UseHotelIdResult {
  hotelId:      string
  hotelName:    string
  hotelLoading: boolean
}

export function useHotelId(): UseHotelIdResult {
  const [hotelId,      setHotelId]      = useState('')
  const [hotelName,    setHotelName]    = useState('')
  const [hotelLoading, setHotelLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function resolve() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) { setHotelLoading(false); return }

      // 1. Leer perfil — profiles tiene RLS: el usuario solo ve el suyo
      const { data: profile } = await supabase
        .from('profiles')
        .select('hotel_id')
        .eq('id', user.id)
        .single()

      const profileHotelId: string | null = profile?.hotel_id ?? null

      if (profileHotelId) {
        // Usuario invitado: hotel_id conocido, intentar leer nombre
        const { data: hotel } = await supabase
          .from('hotels')
          .select('id, name')
          .eq('id', profileHotelId)
          .single()
        if (!cancelled) {
          setHotelId(hotel?.id ?? profileHotelId)
          setHotelName(hotel?.name ?? '')
        }
      } else {
        // Admin/dueño: hotels.user_id = uid
        const { data: hotel } = await supabase
          .from('hotels')
          .select('id, name')
          .eq('active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .single()
        if (!cancelled) {
          if (hotel) { setHotelId(hotel.id); setHotelName(hotel.name) }
        }
      }

      if (!cancelled) setHotelLoading(false)
    }

    resolve()
    return () => { cancelled = true }
  }, [])

  return { hotelId, hotelName, hotelLoading }
}
