// Re-exports from cellService for backwards compatibility.
// New code should import from '../services/cellService' directly.
export { cellService as locationCellService } from './cellService';
export type { CellData, LocationCellRecord } from './cellService';
