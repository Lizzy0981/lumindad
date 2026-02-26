/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Charts · Public API
 *  src/components/charts/index.ts
 *
 *  Central barrel file — import any chart component from this path:
 *
 *    import { LumindAreaChart, LumindPieChart, CustomTooltip }
 *      from '@/components/charts';
 *
 *  Component name convention
 *   All chart wrappers are prefixed with "Lumind" to avoid import
 *   collisions with the underlying Recharts primitives.
 *   Consumer code that also imports directly from "recharts" will
 *   never face a naming conflict:
 *
 *     import { LumindLineChart } from '@/components/charts';
 *     import { LineChart }       from 'recharts';   // no conflict
 *
 *  Type exports
 *   All prop interfaces and variant types are re-exported so
 *   consuming pages can type their own data without reaching into
 *   individual component files.
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ─── CustomTooltip ────────────────────────────────────────────────────────────
// Shared tooltip used as the `content` prop on every Recharts <Tooltip />.
// Also exported for cases where a page needs to build a custom chart
// with the same branded popup without using the wrapper components.
export { CustomTooltip }                        from './CustomTooltip';
export type { CustomTooltipProps, SwatchShape } from './CustomTooltip';

// ─── AreaChart ────────────────────────────────────────────────────────────────
// Used in: AnalyticsPage — "Performance Trends" (impressions over time)
export { LumindAreaChart }                      from './AreaChart';
export type { AreaChartProps, AreaSeries }       from './AreaChart';

// ─── LineChart ────────────────────────────────────────────────────────────────
// Used in: DashboardPage — "Weekly Performance" (impressions + clicks)
//          AnalyticsPage — "Click & Conversion Trends"
export { LumindLineChart }                      from './LineChart';
export type { LineChartProps, LineSeries }       from './LineChart';

// ─── BarChart ─────────────────────────────────────────────────────────────────
// Used in: BudgetPage — "Daily Spend vs Budget" (grouped bars + gap)
export { LumindBarChart }                       from './BarChart';
export type { BarChartProps, BarSeries, BarRadius } from './BarChart';

// ─── PieChart ─────────────────────────────────────────────────────────────────
// Used in: DashboardPage — "Platform Split" (donut, innerRadius 45)
export { LumindPieChart }                       from './PieChart';
export type { PieChartProps, PieDataItem }       from './PieChart';
