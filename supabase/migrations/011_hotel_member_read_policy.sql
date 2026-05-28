-- ══════════════════════════════════════════════════════════════════════════════
-- CHEF FINANCIERO — Migration 011: Política RLS para miembros de hotel
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- Problema: la política "owner_all_hotels" solo permite acceso al dueño del
-- hotel (hotels.user_id = auth.uid()). Los usuarios invitados (rol premium /
-- standard) tienen hotel_id en su perfil pero no pueden leer la tabla hotels,
-- por lo que el dashboard muestra "No hay hoteles configurados".

-- Solución: política SELECT adicional para miembros invitados.
CREATE POLICY "member_read_own_hotel" ON hotels
  FOR SELECT
  USING (
    id IN (
      SELECT hotel_id
      FROM   profiles
      WHERE  id        = auth.uid()
        AND  hotel_id IS NOT NULL
    )
  );
