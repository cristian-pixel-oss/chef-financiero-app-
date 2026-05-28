/**
 * CHEF FINANCIERO — Cliente Supabase
 *
 * Exporta el cliente Supabase compatible con Next.js App Router.
 *
 * IMPORTANTE sobre variables de entorno:
 *   NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY deben estar
 *   configuradas en Vercel → Settings → Environment Variables (Production,
 *   Preview y Development) ANTES del build.  Next.js las embebe en el bundle
 *   en tiempo de compilación; si faltan, el bundle lleva `undefined` y el
 *   cliente no puede inicializarse correctamente.
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

type Client = ReturnType<typeof createClientComponentClient>

/**
 * Stub seguro para cuando las env vars no están disponibles en el bundle.
 *
 * Devuelve sesión/usuario nulos (sin lanzar TypeError) para que la app
 * muestre la pantalla de login en lugar de romperse con un crash.
 * Los métodos de .from() nunca se llaman en este estado porque todos los
 * useEffect que los usan tienen un guard  `if (!user) return`.
 */
function buildStub(): Client {
  const nil = async () => ({ data: null, error: null })

  if (typeof window !== 'undefined') {
    console.error(
      '[Chef Financiero] NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
      'no encontradas en el bundle. ' +
      'Verifica Vercel → Settings → Environment Variables (todos los entornos) ' +
      'y vuelve a hacer deploy para que el build las embeba correctamente.'
    )
  }

  return {
    auth: {
      getSession:            async () => ({ data: { session: null },    error: null }),
      getUser:               async () => ({ data: { user: null },       error: null }),
      onAuthStateChange:     ()      => ({ data: { subscription: { unsubscribe: () => {}, id: 'stub' } } }),
      signInWithPassword:    nil,
      signUp:                nil,
      signOut:               nil,
      resetPasswordForEmail: nil,
      updateUser:            nil,
    },
  } as unknown as Client
}

/**
 * Crea el cliente Supabase.
 *
 * - Si las vars están disponibles (runtime normal) → cliente real con cookies.
 * - Si faltan (build sin vars en Vercel)           → stub seguro sin crashes.
 */
function createSafeClient(): Client {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (url && key) {
    return createClientComponentClient({ supabaseUrl: url, supabaseKey: key })
  }

  return buildStub()
}

export const supabase = createSafeClient()

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
