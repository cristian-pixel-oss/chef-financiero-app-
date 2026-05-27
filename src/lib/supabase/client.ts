/**
 * CHEF FINANCIERO — Cliente Supabase
 *
 * Este archivo exporta el cliente de Supabase de forma compatible con:
 *   - Next.js (App Router, Server Components, Client Components)
 *   - Expo / React Native (en el futuro — mismo API, distinto storage)
 *
 * NO importes createClient directamente en los componentes.
 * Usa siempre las funciones exportadas desde aquí.
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

/**
 * Cliente principal para uso en Client Components ('use client').
 *
 * Usa createClientComponentClient de @supabase/auth-helpers-nextjs para que
 * la sesión se almacene en cookies HTTP y el middleware pueda leerla.
 * (createClient de supabase-js guarda en localStorage → el middleware no la ve)
 *
 * Nota: el genérico <Database> se omite deliberadamente porque supabase-js 2.106
 * usa un fallback `: never` (en lugar de `: any`) cuando la estructura de
 * Database no satisface exactamente GenericSchema. El resultado práctico es que
 * todos los tipos de datos se resuelven como `never`. En su lugar los servicios
 * usan cast explícitos en sus valores de retorno, lo que proporciona la misma
 * seguridad de tipos sin conflictos con los genéricos del cliente.
 */
export const supabase = createClientComponentClient({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key',
})

/**
 * Helper para obtener el usuario autenticado actual.
 * Usar en Client Components o en hooks.
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

/**
 * Helper para obtener la sesión actual.
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) throw error
  return session
}
