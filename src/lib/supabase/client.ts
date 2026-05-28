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
 * - getSession / getUser retornan null sin crash → la app muestra el login.
 * - signInWithPassword / signUp retornan un error EXPLÍCITO para que el
 *   formulario de login muestre un mensaje en lugar de navegar sin sesión
 *   y causar el loop: /login → /home → /login.
 * - Los métodos .from() nunca se invocan aquí: los useEffect guardan con
 *   `if (!user) return` antes de llamarlos.
 */
function buildStub(): Client {
  if (typeof window !== 'undefined') {
    console.error(
      '[Chef Financiero] NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
      'no encontradas en el bundle. ' +
      'Verifica Vercel → Settings → Environment Variables (todos los entornos) ' +
      'y vuelve a hacer deploy para que el build las embeba correctamente.'
    )
  }

  const configErr = {
    name:    'AuthApiError',
    message: 'Supabase no configurado. Contacta al administrador ' +
             '(faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).',
    status:  500,
  }

  return {
    auth: {
      getSession:            async () => ({ data: { session: null },              error: null      }),
      getUser:               async () => ({ data: { user: null },                 error: null      }),
      onAuthStateChange:     ()      => ({ data: { subscription: { unsubscribe: () => {}, id: 'stub' } } }),
      signInWithPassword:    async () => ({ data: { user: null, session: null }, error: configErr }),
      signUp:                async () => ({ data: { user: null, session: null }, error: configErr }),
      signOut:               async () => ({ error: null }),
      resetPasswordForEmail: async () => ({ data: {},                            error: configErr }),
      updateUser:            async () => ({ data: { user: null },                error: configErr }),
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
