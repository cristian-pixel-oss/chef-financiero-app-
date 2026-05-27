/**
 * CHEF FINANCIERO — Constantes globales del negocio
 *
 * Centraliza los valores aprobados por DG para que sean consistentes
 * en todas las páginas (Dashboard, Presupuesto, Pedidos).
 */

/** Presupuesto aprobado por Dirección General RD$/PAX */
export const DG_BUDGET_RD_PAX = 839.31

/** Tasa de cambio de referencia aprobada por DG (RD$/USD) */
export const DG_EXCHANGE_RATE = 59.74

/** Equivalente USD/PAX del presupuesto DG */
export const DG_BUDGET_USD_PAX = DG_BUDGET_RD_PAX / DG_EXCHANGE_RATE   // ≈ 14.05
