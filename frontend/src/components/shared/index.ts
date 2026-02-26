/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Shared Components · Public API
 *  src/components/shared/index.ts
 *
 *  Central barrel — import any shared component from this path:
 *
 *    import { KPICard, DataTable, SearchInput } from '@/components/shared';
 *    import { AIInsightPanel, PageLoader }       from '@/components/shared';
 *    import { ErrorBoundary, useAnimatedValue }  from '@/components/shared';
 *
 *  Inventory
 *   KPICard          Animated metric card (cubic ease-out counter, delta tag)
 *   DataTable        Typed generic table (badges, progress, actions, skeleton)
 *   SearchInput      Branded search field (debounce, clear btn, focus ring)
 *   AIInsightPanel   AI recommendation card + ML models status grid
 *   PageLoader       Branded Suspense fallback (✦ spinner, 150 ms delay)
 *   ErrorBoundary    Class-based error boundary (recovery UI, dev stack)
 *
 *  Utility exports
 *   useAnimatedValue Hook exported from KPICard for use in custom cards
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ─── KPICard ──────────────────────────────────────────────────────────────────
// Animated metric card — used in Dashboard, Budget, Analytics pages.
// Also exports the useAnimatedValue hook for custom animated cards.
export { KPICard, useAnimatedValue }  from './KPICard';
export type { KPICardProps }          from './KPICard';

// ─── DataTable ────────────────────────────────────────────────────────────────
// Generic typed table — campaigns, budget breakdowns, uploaded files.
export { DataTable }                  from './DataTable';
export type {
  DataTableProps,
  ColumnDef,
  RowAction,
  CellType,
}                                     from './DataTable';

// ─── SearchInput ──────────────────────────────────────────────────────────────
// Branded search field — used in CampaignsPage header actions slot.
export { SearchInput }                from './SearchInput';
export type { SearchInputProps }      from './SearchInput';

// ─── AIInsightPanel ───────────────────────────────────────────────────────────
// AI recommendation card (BudgetPage) + ML models grid (AnalyticsPage).
export { AIInsightPanel }             from './AIInsightPanel';
export type {
  AIInsightPanelProps,
  AIInsightVariant,
  MLModel,
  RecommendationPanelProps,
  ModelsPanelProps,
}                                     from './AIInsightPanel';

// ─── PageLoader ───────────────────────────────────────────────────────────────
// Branded Suspense fallback: ✦ spinner + 3 dots + 150 ms visibility delay.
// Already created in a previous session — re-exported here for barrel access.
export { default as PageLoader }      from './PageLoader';

// ─── ErrorBoundary ────────────────────────────────────────────────────────────
// Class-based error boundary: recovery UI + dev-only technical stack.
// Already created in a previous session — re-exported here for barrel access.
export { default as ErrorBoundary }   from './ErrorBoundary';
