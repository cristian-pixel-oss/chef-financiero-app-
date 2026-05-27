// Temporary type diagnostic file
import type { Database } from '@/types/database.types'

// Check if Database['public'] extends GenericSchema
type Public = Database['public']
type HasTables   = Public['Tables']
type HasViews    = Public['Views']
type HasFunctions = Public['Functions']

// Check a specific table
type HotelsTable = Public['Tables']['hotels']
type HotelsRow   = HotelsTable['Row']
type HotelsRel   = HotelsTable['Relationships']

// This is a diagnostic only, never runs
export type _Diagnostic = {
  public:    Public
  tables:    HasTables
  views:     HasViews
  functions: HasFunctions
  hotelsRow: HotelsRow
  hotelsRel: HotelsRel
}
