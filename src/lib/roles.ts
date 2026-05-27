/**
 * CHEF FINANCIERO — Helpers de roles
 *
 * Mapeo: roles legacy (chef/director) → nuevo sistema (standard/premium/admin)
 */

export type RoleLevel = 'admin' | 'premium' | 'standard'

/** Normaliza cualquier role string al nivel canónico */
export function getRoleLevel(role: string | null | undefined): RoleLevel {
  if (role === 'admin')                    return 'admin'
  if (role === 'premium' || role === 'director') return 'premium'
  return 'standard'   // chef, standard, o cualquier otro
}

/** Etiqueta legible del rol */
export function getRoleLabel(role: string | null | undefined): string {
  const level = getRoleLevel(role)
  if (level === 'admin')   return 'Admin'
  if (level === 'premium') return 'Premium'
  return 'Estándar'
}

/** Color badge por rol */
export function getRoleBadgeClass(role: string | null | undefined): string {
  const level = getRoleLevel(role)
  if (level === 'admin')   return 'text-amber-400 bg-amber-400/10 border border-amber-400/30'
  if (level === 'premium') return 'text-violet-400 bg-violet-400/10 border border-violet-400/30'
  return 'text-blue-400 bg-blue-400/10 border border-blue-400/30'
}

/** Rutas a las que tiene acceso cada nivel */
export const ROUTE_ACCESS: Record<string, RoleLevel> = {
  '/dashboard':        'premium',
  '/budget':           'premium',
  '/proyeccion':       'premium',
  '/costs':            'standard',
  '/dispatches':       'standard',
  '/descargos':        'standard',
  '/admin/usuarios':   'admin',
}

/** True si el nivel del usuario puede acceder a esa ruta */
export function canAccessRoute(userRole: string | null | undefined, pathname: string): boolean {
  const level    = getRoleLevel(userRole)
  const required = Object.entries(ROUTE_ACCESS).find(([path]) => pathname.startsWith(path))?.[1]
  if (!required) return true   // ruta no restringida

  if (required === 'standard') return true
  if (required === 'premium')  return level === 'premium' || level === 'admin'
  if (required === 'admin')    return level === 'admin'
  return false
}
