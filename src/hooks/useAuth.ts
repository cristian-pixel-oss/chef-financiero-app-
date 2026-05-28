/**
 * CHEF FINANCIERO — Hook: useAuth
 *
 * Gestiona autenticación, sesión y perfil del usuario.
 * Compatible con Next.js y React Native (Expo).
 */

'use client'

import { useState, useEffect } from 'react'
import type { User, Session }  from '@supabase/supabase-js'
import { supabase }            from '@/lib/supabase/client'
import type { Profile }        from '@/types/database.types'

export function useAuth() {
  const [user, setUser]       = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Obtener sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      setLoading(false)
    })

    // Escuchar cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) loadProfile(session.user.id)
        else setProfile(null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  /**
   * Registro de nuevo usuario con email y contraseña.
   */
  async function signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw error
    return data
  }

  /**
   * Login con email y contraseña.
   * Lanza siempre una instancia de Error (no un objeto plano) para que el
   * catch del componente pueda extraer err.message con instanceof Error.
   */
  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      // error puede ser AuthApiError (tiene .message) o un objeto plano (stub)
      const msg = typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message
        : 'Error al iniciar sesión'
      throw new Error(msg)
    }
    if (!data?.user) throw new Error('No se pudo iniciar sesión. Verifica tus credenciales.')
    return data
  }

  /**
   * Logout del usuario actual.
   */
  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  /**
   * Solicitar recuperación de contraseña por email.
   */
  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) throw error
  }

  /**
   * Actualizar perfil del usuario.
   */
  async function updateProfile(updates: Partial<Pick<Profile, 'full_name' | 'avatar_url'>>) {
    if (!user) throw new Error('No hay usuario autenticado')
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single()
    if (error) throw error
    setProfile(data)
    return data
  }

  return {
    user,
    profile,
    session,
    loading,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateProfile,
  }
}
