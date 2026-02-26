/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · types/analytics.ts
 *  src/types/analytics.ts
 *
 *  Canonical TypeScript types for the Analytics, ML, and Budget
 *  domains. Aggregates types from three sources into one import:
 *
 *   store/analyticsStore  — time-series, ML models, KPIs
 *   store/budgetStore     — daily entries, allocations, AI rec
 *   services/mlService    — predictions, anomalies, SHAP, metrics
 *   services/budgetService— budget summary, forecast
 *
 *  New types defined here
 *   • ChartSeries         — generic chart data point with optional platform
 *   • InsightCard         — AI-Generated Insight panel item
 *   • InsightSeverity     — 'peak' | 'anomaly' | 'opportunity'
 *   • MLModelCardProps    — props for ML model card in Analytics page
 *   • SHAPBarEntry        — prepared entry for SHAP waterfall bar
 *   • BudgetPeriod        — time-window selector for Budget page
 *   • AllocationChange    — diff when applyRecommendation fires
 *   • TrendDirection      — 'up' | 'down' | 'flat' from timeSeries
 *   • ExportFormat        — BI export format options
 *
 *  Usage
 *   import type { InsightCard, SHAPBarEntry, TrendDirection } from '@/types/analytics';
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ─── Re-exports: store/analyticsStore.ts ─────────────────────────────────────

export type {
  AnalyticsPoint,
  MLModelStatus,
  MLModel,
  PlatformFilter,
  AnalyticsKPIs,
} from '../store/analyticsStore';

export {
  SEED_ANALYTICS,
  SEED_ML_MODELS,
} from '../store/analyticsStore';

// ─── Re-exports: store/budgetStore.ts ────────────────────────────────────────

export type {
  DailyBudgetEntry,
  PlatformAllocation,
  AIRecommendation,
} from '../store/budgetStore';

export {
  SEED_DAILY_ENTRIES,
  SEED_ALLOCATIONS,
} from '../store/budgetStore';

// ─── Re-exports: services/mlService.ts ───────────────────────────────────────
// Telecom X churn + ad-level predictions + SHAP explainability.

export type {
  CustomerFeatures,
  AdFeatures,
  ChurnPrediction,
  ClickPrediction,
  ROASPrediction,
  AnomalyInput,
  AnomalyResult,
  AnomalyAlert,
  SHAPFeatureValue,
  SHAPExplanation,
  ModelMetrics,
} from '../services/mlService';

// ─── Re-exports: services/budgetService.ts ───────────────────────────────────

export type {
  BudgetSummary,
  BudgetForecast,
} from '../services/budgetService';

// ─── Chart series ─────────────────────────────────────────────────────────────

/**
 * Generic time-series data point for Recharts.
 * Extends AnalyticsPoint with an optional platform dimension
 * for platform-filtered views (AnalyticsPage filter dropdown).
 *
 * @example
 * const data: ChartSeries[] = timeSeries.map(p => ({
 *   ...p,
 *   platform: 'Google Ads',
 * }));
 */
export interface ChartSeries {
  /** ISO date string or label like 'Jan 1', 'Week 4' */
  date:        string;
  impressions: number;
  clicks:      number;
  conversions: number;
  platform?:   string;
}

/**
 * A single [x, y] data point for a bi-axis Recharts chart.
 * Used by PerformanceTrends when rendering two Y-axes (impressions + clicks).
 *
 * @example
 * const clicks: BiAxisPoint[] = data.map(p => ({ x: p.date, y: p.clicks }));
 */
export interface BiAxisPoint {
  x: string;
  y: number;
}

/**
 * A PieChart or RadialBar data entry with brand colour.
 * Used by PlatformSplit in DashboardPage and BudgetPage allocation chart.
 *
 * @example
 * const pieData: PieSlice[] = allocations.map(a => ({
 *   name:  a.name,
 *   value: a.value,
 *   color: a.color,
 * }));
 */
export interface PieSlice {
  name:  string;
  value: number;
  color: string;
}

// ─── AI Insight panel ─────────────────────────────────────────────────────────
// LumindAd.jsx DashboardPage AI-Generated Insights — lines 619–631.

/**
 * Severity category for an AI insight card.
 * Controls the accent colour and icon shown:
 *   peak       → 🎯  purple  — positive opportunity
 *   anomaly    → ⚠️  amber   — detected issue (Isolation Forest)
 *   opportunity→ 📈  green   — growth recommendation
 */
export type InsightSeverity = 'peak' | 'anomaly' | 'opportunity';

/**
 * A single AI-generated insight displayed in the DashboardPage
 * insights panel. Matches the shape at LumindAd.jsx lines 622–630.
 *
 * @example
 * const insight: InsightCard = {
 *   icon:     '⚠️',
 *   title:    'Anomaly Detected',
 *   desc:     'TikTok campaign CTR dropped 18% vs last week.',
 *   severity: 'anomaly',
 *   color:    '#f59e0b',
 * };
 */
export interface InsightCard {
  icon:     string;
  title:    string;
  desc:     string;
  severity: InsightSeverity;
  /** Accent colour for border and background tint */
  color:    string;
  /** Optional campaign ID for drill-down */
  campaignId?: string;
}

// ─── ML model card ────────────────────────────────────────────────────────────
// LumindAd.jsx AnalyticsPage MLModelsPanel lines 630–635.

/**
 * Props for the MLModelCard component in the Analytics → ML Panel.
 * Extends MLModel with an optional `metrics` sub-object for
 * the expanded view (precision, recall, F1, AUC).
 *
 * @example
 * <MLModelCard
 *   name="Churn Predictor"
 *   type="XGBoost"
 *   acc="87.3%"
 *   status="active"
 *   color="#7c3aed"
 * />
 */
export interface MLModelCardProps {
  name:     string;
  type:     string;
  acc:      string;
  status:   import('../store/analyticsStore').MLModelStatus;
  color:    string;
  /** Expanded metrics — shown when user clicks the card */
  metrics?: import('../services/mlService').ModelMetrics;
  /** Handler for "View SHAP explanation" button */
  onViewSHAP?: (modelName: string) => void;
}

// ─── SHAP visualisation ───────────────────────────────────────────────────────

/**
 * A single bar entry in the SHAP waterfall / horizontal bar chart.
 * Built from SHAPFeatureValue by normalising shapValues to percentages.
 *
 * @example
 * const bars: SHAPBarEntry[] = explanation.features.map(f => ({
 *   label:      f.displayName,
 *   rawValue:   f.shapValue,
 *   pct:        Math.abs(f.shapValue) / maxAbs * 100,
 *   direction:  f.shapValue >= 0 ? 'positive' : 'negative',
 *   feature:    f.feature,
 * }));
 */
export interface SHAPBarEntry {
  /** Human-readable label e.g. 'Monthly Charges' */
  label:     string;
  /** Raw SHAP value — positive pushes prediction higher */
  rawValue:  number;
  /** Normalised 0–100 for bar width */
  pct:       number;
  /** Visual direction for colouring */
  direction: 'positive' | 'negative';
  /** Raw feature key for tooltip */
  feature:   string;
}

// ─── Budget period selector ───────────────────────────────────────────────────

/**
 * Time-window options for the Budget page period selector.
 * Maps to the `period` field in BudgetSummary from the API.
 */
export type BudgetPeriod = 'week' | 'month' | 'quarter' | 'year';

// ─── Allocation change ────────────────────────────────────────────────────────

/**
 * Diff produced when an AI reallocation recommendation is applied.
 * Emitted by budgetStore.applyRecommendation() for UI confirmation toast.
 *
 * @example
 * const change: AllocationChange = {
 *   from: 'Meta Ads',
 *   to:   'Google Ads',
 *   amount: 1200,
 *   newFromPct: 23,
 *   newToPct:   44,
 * };
 */
export interface AllocationChange {
  from:       string;
  to:         string;
  amount:     number;
  newFromPct: number;
  newToPct:   number;
}

// ─── Trend direction ──────────────────────────────────────────────────────────

/**
 * Overall trend direction — computed by analyticsStore.trendDirection()
 * by comparing the first and last data points in timeSeries.
 *
 * Used to colour the trend arrow in KPICards and chart headers.
 */
export type TrendDirection = 'up' | 'down' | 'flat';

// ─── BI export formats ────────────────────────────────────────────────────────
// LumindAd.jsx Analytics & BIExport module — supported export targets.

/**
 * Supported BI / export formats from the Analytics → Export Report flow.
 *
 * @example
 * const format: ExportFormat = 'powerbi';
 * await biExport.export(format, analyticsData);
 */
export type ExportFormat = 'powerbi' | 'tableau' | 'excel' | 'pdf';

/**
 * Export job status — returned by biExport service.
 */
export interface ExportJob {
  jobId:     string;
  format:    ExportFormat;
  status:    'pending' | 'processing' | 'done' | 'error';
  url?:      string;    // download URL when done
  createdAt: number;    // unix ms
}

// ─── Anomaly feed ─────────────────────────────────────────────────────────────

/**
 * Configuration for the real-time anomaly polling hook (useRealTimeAPI).
 * LumindAd.jsx footer: "SHAP · Anomaly Detection"
 *
 * @example
 * const config: AnomalyFeedConfig = {
 *   pollingIntervalMs: 30_000,
 *   severity:          ['high', 'critical'],
 * };
 */
export interface AnomalyFeedConfig {
  /** Milliseconds between polls — useRealTimeAPI default: 30000 */
  pollingIntervalMs: number;
  /** Only surface anomalies at or above these severity levels */
  severity?: Array<import('../services/mlService').AnomalyResult['severity']>;
  /** Filter to a specific campaign — undefined = all campaigns */
  campaignId?: string;
}
