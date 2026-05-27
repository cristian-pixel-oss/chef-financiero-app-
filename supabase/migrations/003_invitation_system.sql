-- ══════════════════════════════════════════════════════════════════════════════
-- CHEF FINANCIERO — Migration 003: Sistema de Invitaciones y Roles
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Extender tabla profiles ──────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS hotel_id   UUID REFERENCES hotels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active     BOOLEAN NOT NULL DEFAULT true;

-- Actualizar constraint de role para admitir los nuevos roles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('chef', 'director', 'admin', 'standard', 'premium'));

-- ─── 2. Tabla de invitaciones ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    UUID        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  role        TEXT        NOT NULL CHECK (role IN ('standard', 'premium', 'admin')),
  token       TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3. RLS para invitations ──────────────────────────────────────────────────
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- El admin puede gestionar invitaciones de su hotel
CREATE POLICY "Admin manages own hotel invitations" ON invitations
  FOR ALL TO authenticated
  USING (
    hotel_id IN (SELECT id FROM hotels WHERE user_id = auth.uid())
  )
  WITH CHECK (
    hotel_id IN (SELECT id FROM hotels WHERE user_id = auth.uid())
  );

-- Cualquiera puede leer una invitación por token (para /invite/[token])
CREATE POLICY "Public read invitation" ON invitations
  FOR SELECT
  USING (true);

-- ─── 4. RPC: Completar invitación ─────────────────────────────────────────────
-- Llamado desde /invite/[token] justo después del signUp
CREATE OR REPLACE FUNCTION complete_invitation(p_token TEXT, p_user_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_inv       invitations%ROWTYPE;
  v_full_name TEXT;
BEGIN
  SELECT * INTO v_inv
  FROM   invitations
  WHERE  token = p_token
    AND  used_at IS NULL
    AND  expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitación no encontrada, expirada o ya utilizada';
  END IF;

  -- Nombre del usuario desde metadata de Auth
  SELECT raw_user_meta_data->>'full_name'
  INTO   v_full_name
  FROM   auth.users
  WHERE  id = p_user_id;

  -- Upsert perfil
  INSERT INTO profiles (id, full_name, role, hotel_id, invited_by, active, created_at, updated_at)
  VALUES (
    p_user_id,
    COALESCE(v_full_name, v_inv.full_name, 'Usuario'),
    v_inv.role,
    v_inv.hotel_id,
    v_inv.invited_by,
    true,
    NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    hotel_id   = v_inv.hotel_id,
    role       = v_inv.role,
    invited_by = v_inv.invited_by,
    active     = true,
    full_name  = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = NOW();

  -- Marcar como usada
  UPDATE invitations SET used_at = NOW() WHERE token = p_token;
END;
$$;

-- ─── 5. RPC: Obtener miembros del hotel ───────────────────────────────────────
CREATE OR REPLACE FUNCTION get_hotel_members(p_hotel_id UUID)
RETURNS TABLE (
  user_id    UUID,
  full_name  TEXT,
  role       TEXT,
  active     BOOLEAN,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT DISTINCT ON (p.id)
    p.id, p.full_name, p.role, p.active, p.created_at
  FROM profiles p
  WHERE
    -- Dueño del hotel (admin original)
    p.id IN (SELECT user_id FROM hotels WHERE id = p_hotel_id)
    OR
    -- Usuarios invitados
    p.hotel_id = p_hotel_id
  ORDER BY p.id, p.created_at;
$$;

-- ─── 6. RPC: Desactivar miembro ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION deactivate_hotel_member(p_member_id UUID, p_hotel_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Solo el admin del hotel puede desactivar
  IF NOT EXISTS (
    SELECT 1 FROM hotels WHERE id = p_hotel_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para esta operación';
  END IF;

  -- No puede desactivarse a sí mismo
  IF p_member_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes desactivar tu propia cuenta';
  END IF;

  UPDATE profiles SET active = false, updated_at = NOW()
  WHERE id = p_member_id;
END;
$$;
