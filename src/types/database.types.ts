/**
 * CHEF FINANCIERO — Tipos TypeScript de la base de datos
 *
 * Estos tipos reflejan exactamente el schema de Supabase.
 * En producción este archivo se puede generar automáticamente con:
 *   npx supabase gen types typescript --project-id <TU_PROJECT_ID> > src/types/database.types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

// ─── Enums ───────────────────────────────────────────────────────────────────

export type UserRole          = 'chef' | 'director' | 'admin' | 'standard' | 'premium'
export type OccupancyStatus   = 'normal' | 'media' | 'alta' | 'sin_datos'
export type RestaurantType    = 'main_kitchen' | 'specialty' | 'snack' | 'production' | 'bakery_pastry' | 'bar' | 'breakfast' | 'pantry'
export type ProductCategory   = 'proteina' | 'vegetal' | 'lacteo' | 'panaderia' | 'limpieza' | 'quimico' | 'desechable' | 'menaje' | 'uniforme' | 'bebida' | 'otro'
export type OrderType         = 'normal' | 'urgente' | 'extra'
export type ActionPlanStatus  = 'pending' | 'in_progress' | 'completed' | 'overdue'
export type GuestClassification = 'Promoter' | 'Passive' | 'Detractor'

// ─── Row types (lo que viene de la BD) ───────────────────────────────────────

export interface Profile {
  id:         string
  full_name:  string | null
  role:       UserRole
  avatar_url: string | null
  hotel_id:   string | null
  invited_by: string | null
  active:     boolean
  created_at: string
  updated_at: string
}

export interface Invitation {
  id:         string
  hotel_id:   string
  email:      string
  role:       'standard' | 'premium' | 'admin'
  token:      string
  invited_by: string
  full_name:  string | null
  expires_at: string
  used_at:    string | null
  created_at: string
}

export interface Hotel {
  id:           string
  user_id:      string
  code:         string
  name:         string
  complex_name: string | null
  country:      string
  city:         string | null
  currency:     string
  active:       boolean
  created_at:   string
}

export interface ExchangeRate {
  id:         string
  user_id:    string
  hotel_id:   string
  year:       number
  month:      number
  rate:       number
  created_at: string
}

export interface Restaurant {
  id:         string
  user_id:    string
  hotel_id:   string
  name:       string
  type:       RestaurantType | null
  active:     boolean
  sort_order: number
  created_at: string
}

export interface OccupancyDaily {
  id:             string
  user_id:        string
  hotel_id:       string
  date:           string
  pax:            number | null
  status:         OccupancyStatus | null
  a_la_carte_usd: number
  notes:          string | null
  created_at:     string
  updated_at:     string
}

export interface Product {
  id:              string
  user_id:         string
  hotel_id:        string
  sap_code:        string | null
  name:            string
  category:        ProductCategory
  subcategory:     string | null
  unit_of_measure: string
  price_rd:        number
  active:          boolean
  created_at:      string
  updated_at:      string
}

export interface BudgetOperation {
  id:             string
  user_id:        string
  hotel_id:       string
  year:           number
  category:       string
  budget_usd_pax: number | null
  budget_rd_pax:  number | null
  created_at:     string
}

export interface BudgetRestaurant {
  id:               string
  user_id:          string
  restaurant_id:    string
  year:             number
  month:            number | null
  budget_rd_pax:    number | null
  distribution_pct: number | null
  reference_pax:    number | null
  created_at:       string
}

export interface DailyOperationOrder {
  id:              string
  user_id:         string
  hotel_id:        string
  date:            string
  category:        string
  pax:             number | null
  budget_rd_pax:   number | null
  order_amount_rd: number
  extra_amount_rd: number
  notes:           string | null
  created_at:      string
  updated_at:      string
}

export interface DailyFoodOrder {
  id:            string
  user_id:       string
  restaurant_id: string
  date:          string
  pax:           number | null
  budget_rd_pax: number | null
  viveres_rd:    number
  nevera_rd:     number
  extras_rd:     number
  notes:         string | null
  created_at:    string
  updated_at:    string
}

export interface DailyProteinOrder {
  id:            string
  user_id:       string
  restaurant_id: string
  product_id:    string | null
  date:          string
  price_rd_kg:   number | null
  quantity_kg:   number
  order_type:    OrderType
  notes:         string | null
  created_at:    string
}

export interface ProteinControl {
  id:               string
  user_id:          string
  restaurant_id:    string
  date:             string
  n_pax:            number | null
  kg_mise_en_place: number
  kg_added:         number
  kg_leftover:      number
  total_cost_rd:    number
  notes:            string | null
  created_at:       string
  updated_at:       string
}

export interface ThematicDischarge {
  id:              string
  user_id:         string
  hotel_id:        string | null
  restaurant_name: string
  date:            string
  covers:          number | null
  amount_rd:       number | null
  amount_usd:      number | null
  exchange_rate:   number | null
  account_code:    string | null
  company:         string | null
  notes:           string | null
  created_at:      string
}

export interface ActionPlan {
  id:               string
  user_id:          string
  hotel_id:         string | null
  opportunity_area: string
  department:       string | null
  actions:          string | null
  responsible:      string | null
  start_date:       string | null
  due_date:         string | null
  monthly_score:    string | null
  status:           ActionPlanStatus
  reference_month:  number | null
  reference_year:   number | null
  created_at:       string
  updated_at:       string
}

export interface ReviewProComment {
  id:             string
  action_plan_id: string
  guest_name:     string | null
  room_number:    string | null
  classification: GuestClassification | null
  comment:        string | null
  comment_date:   string | null
  created_at:     string
}

// ─── View types (incluyen columnas calculadas) ────────────────────────────────

export interface DailyFoodOrderView extends DailyFoodOrder {
  restaurant_name: string
  restaurant_type: RestaurantType | null
  budget_total_rd: number
  total_rd:        number
  variance_rd:     number
  cost_per_pax_rd: number
  execution_pct:   number
}

export interface ProteinControlView extends ProteinControl {
  restaurant_name:   string
  kg_consumed:       number
  g_per_pax:         number
  deviation_vs_400g: number
  cost_per_pax_rd:   number
}

/** Vista daily_protein_orders_view (migration 002) */
export interface DailyProteinOrderView {
  id:                  string
  restaurant_id:       string
  product_id:          string | null
  date:                string
  price_rd_kg:         number | null
  quantity_kg:         number
  order_type:          OrderType
  notes:               string | null
  created_at:          string
  user_id:             string
  product_name:        string
  product_category:    ProductCategory
  product_subcategory: string | null
  product_uom:         string
  restaurant_name:     string
  hotel_id:            string
  cost_rd:             number
}

/** Vista daily_cost_consolidated — costos ALM + CARN + VEG por restaurante/día (migration 002) */
export interface DailyCostConsolidatedRow {
  restaurant_id:   string
  restaurant_name: string
  restaurant_type: RestaurantType | null
  hotel_id:        string
  user_id:         string
  date:            string
  pax:             number | null
  viveres_rd:      number
  nevera_rd:       number
  extras_rd:       number
  alm_total_rd:    number
  carn_total_rd:   number
  veg_total_rd:    number
  total_rd:        number
  budget_rd_pax:   number
  budget_total_rd: number
  cost_per_pax_rd: number
  execution_pct:   number
  variance_rd:     number
}

/** Vista daily_hotel_summary — resumen por hotel/día (migration 002) */
export interface DailyHotelSummaryRow {
  hotel_id:        string
  user_id:         string
  date:            string
  pax:             number | null
  total_alm_rd:    number
  total_carn_rd:   number
  total_veg_rd:    number
  total_rd:        number
  budget_total_rd: number
  cost_per_pax_rd: number
  execution_pct:   number
}

/** Tipo de retorno de la RPC get_monthly_projection */
export interface MonthlyProjectionRow {
  days_with_data:     number
  days_in_month:      number
  actual_cost_rd:     number   // gasto bruto acumulado (ALM+CARN+VEG)
  descargos_rd:       number   // descargos del período (a descontar)
  net_actual_cost_rd: number   // actual_cost_rd − descargos_rd
  avg_daily_gross_rd: number   // actual_cost_rd / days_with_data (bruto/día)
  avg_daily_cost_rd:  number   // net_actual_cost_rd / days_with_data (neto/día)
  projected_cost_rd:  number   // avg_daily_cost_rd × days_in_month
  budget_total_rd:    number   // presupuesto mes completo extrapolado (avgDailyBudget × days_in_month)
  projected_variance: number   // budget_total_rd − projected_cost_rd (+= bajo ppto)
}

// ─── Insert types (para crear nuevos registros) ───────────────────────────────

export type HotelInsert          = Omit<Hotel, 'id' | 'created_at'>
export type RestaurantInsert     = Omit<Restaurant, 'id' | 'created_at'>
export type OccupancyDailyInsert = Omit<OccupancyDaily, 'id' | 'created_at' | 'updated_at'>
export type ProductInsert        = Omit<Product, 'id' | 'created_at' | 'updated_at'>
export type DailyFoodOrderInsert = Omit<DailyFoodOrder, 'id' | 'created_at' | 'updated_at'>
export type DailyProteinOrderInsert = Omit<DailyProteinOrder, 'id' | 'created_at'>
export type ProteinControlInsert = Omit<ProteinControl, 'id' | 'created_at' | 'updated_at'>
export type ActionPlanInsert     = Omit<ActionPlan, 'id' | 'created_at' | 'updated_at'>

// ─── Database type (para pasar a createClient<Database>) ─────────────────────
// Nota: Supabase JS v2 requiere el campo Relationships en cada tabla/vista.
// Usamos never[] cuando no hay relaciones explícitas definidas.

export interface Database {
  public: {
    Tables: {
      profiles:               { Row: Profile;              Insert: Omit<Profile, 'created_at' | 'updated_at'>;                    Update: Partial<Profile>;              Relationships: never[] }
      hotels:                 { Row: Hotel;                Insert: HotelInsert;                                                    Update: Partial<Hotel>;                Relationships: never[] }
      exchange_rates:         { Row: ExchangeRate;         Insert: Omit<ExchangeRate, 'id' | 'created_at'>;                        Update: Partial<ExchangeRate>;         Relationships: never[] }
      restaurants:            { Row: Restaurant;           Insert: RestaurantInsert;                                               Update: Partial<Restaurant>;           Relationships: never[] }
      occupancy_daily:        { Row: OccupancyDaily;       Insert: OccupancyDailyInsert;                                           Update: Partial<OccupancyDaily>;       Relationships: never[] }
      products:               { Row: Product;              Insert: ProductInsert;                                                  Update: Partial<Product>;              Relationships: never[] }
      budget_operations:      { Row: BudgetOperation;      Insert: Omit<BudgetOperation, 'id' | 'created_at'>;                     Update: Partial<BudgetOperation>;      Relationships: never[] }
      budget_restaurants:     { Row: BudgetRestaurant;     Insert: Omit<BudgetRestaurant, 'id' | 'created_at'>;                    Update: Partial<BudgetRestaurant>;     Relationships: never[] }
      daily_operation_orders: { Row: DailyOperationOrder;  Insert: Omit<DailyOperationOrder, 'id' | 'created_at' | 'updated_at'>; Update: Partial<DailyOperationOrder>;  Relationships: never[] }
      daily_food_orders:      { Row: DailyFoodOrder;       Insert: DailyFoodOrderInsert;                                           Update: Partial<DailyFoodOrder>;       Relationships: never[] }
      daily_protein_orders:   { Row: DailyProteinOrder;    Insert: DailyProteinOrderInsert;                                        Update: Partial<DailyProteinOrder>;    Relationships: never[] }
      protein_control:        { Row: ProteinControl;       Insert: ProteinControlInsert;                                           Update: Partial<ProteinControl>;       Relationships: never[] }
      thematic_discharges:    { Row: ThematicDischarge;    Insert: Omit<ThematicDischarge, 'id' | 'created_at'>;                   Update: Partial<ThematicDischarge>;    Relationships: never[] }
      action_plans:           { Row: ActionPlan;           Insert: ActionPlanInsert;                                               Update: Partial<ActionPlan>;           Relationships: never[] }
      reviewpro_comments:     { Row: ReviewProComment;     Insert: Omit<ReviewProComment, 'id' | 'created_at'>;                    Update: Partial<ReviewProComment>;     Relationships: never[] }
    }
    Views: {
      daily_food_orders_view:    { Row: DailyFoodOrderView;       Relationships: never[] }
      protein_control_view:      { Row: ProteinControlView;       Relationships: never[] }
      daily_protein_orders_view: { Row: DailyProteinOrderView;    Relationships: never[] }
      daily_cost_consolidated:   { Row: DailyCostConsolidatedRow; Relationships: never[] }
      daily_hotel_summary:       { Row: DailyHotelSummaryRow;     Relationships: never[] }
    }
    Functions: {
      get_daily_summary: {
        Args: { p_hotel_id: string; p_date: string }
        Returns: {
          date: string; pax: number; total_food_rd: number
          total_operation_rd: number; budget_food_rd: number
          budget_operation_rd: number; variance_food_rd: number
          variance_operation_rd: number; cost_per_pax_rd: number
          execution_pct: number
        }[]
      }
      get_monthly_projection: {
        Args: { p_hotel_id: string; p_year: number; p_month: number }
        Returns: {
          days_with_data: number; days_in_month: number
          actual_cost_rd: number; avg_daily_cost_rd: number
          projected_cost_rd: number; budget_total_rd: number
          projected_variance: number
        }[]
      }
    }
  }
}
