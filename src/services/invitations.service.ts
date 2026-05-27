/**
 * CHEF FINANCIERO — Servicio de Invitaciones
 */

import { supabase } from '@/lib/supabase/client'

export type InviteRole = 'standard' | 'premium' | 'admin'

export interface Invitation {
  id:         string
  hotel_id:   string
  email:      string
  role:       InviteRole
  token:      string
  invited_by: string
  full_name:  string | null
  expires_at: string
  used_at:    string | null
  created_at: string
}

export interface HotelMember {
  user_id:    string
  full_name:  string | null
  role:       string
  active:     boolean
  created_at: string
}

/** Crea una invitación y devuelve el token */
export async function createInvitation(
  hotelId:   string,
  email:     string,
  role:      InviteRole,
  invitedBy: string,
): Promise<Invitation> {
  const { data, error } = await supabase
    .from('invitations')
    .insert({ hotel_id: hotelId, email, role, invited_by: invitedBy })
    .select()
    .single()
  if (error) throw error
  return data as Invitation
}

/** Lista invitaciones pendientes (no usadas) de un hotel */
export async function getPendingInvitations(hotelId: string): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('hotel_id', hotelId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Invitation[]
}

/** Obtiene miembros activos del hotel via RPC */
export async function getHotelMembers(hotelId: string): Promise<HotelMember[]> {
  const { data, error } = await (supabase as any).rpc('get_hotel_members', {
    p_hotel_id: hotelId,
  })
  if (error) throw error
  return (data ?? []) as HotelMember[]
}

/** Desactiva un miembro del hotel */
export async function deactivateHotelMember(memberId: string, hotelId: string): Promise<void> {
  const { error } = await (supabase as any).rpc('deactivate_hotel_member', {
    p_member_id: memberId,
    p_hotel_id:  hotelId,
  })
  if (error) throw error
}

/** Obtiene una invitación por token (pública, para /invite/[token]) */
export async function getInvitationByToken(token: string): Promise<Invitation & { hotel_name: string } | null> {
  const { data: inv, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('token', token)
    .single()
  if (error || !inv) return null

  // Obtener nombre del hotel
  const { data: hotel } = await supabase
    .from('hotels')
    .select('name')
    .eq('id', inv.hotel_id)
    .single()

  return { ...(inv as Invitation), hotel_name: hotel?.name ?? '' }
}

/** Completa la invitación tras el registro (RPC SECURITY DEFINER) */
export async function completeInvitation(token: string, userId: string): Promise<void> {
  const { error } = await (supabase as any).rpc('complete_invitation', {
    p_token:   token,
    p_user_id: userId,
  })
  if (error) throw error
}
