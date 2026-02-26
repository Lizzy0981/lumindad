/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Store · analyticsStore
 *  src/store/analyticsStore.ts
 *
 *  Purpose
 *   Zustand store for analytics time-series data, ML model metadata,
 *   and the platform filter consumed by AnalyticsPage.
 *   Seed data mirrors every constant in LumindAd.jsx AnalyticsPage
 *   (lines 112–118, 564–636) exactly.
 *
 *  Seed data sources
 *   ┌──────────────────────────────────────────────────────┐
 *   │ analyticsData (LumindAd.jsx lines 112–118)           │
 *   │  7 weekly snapshots Jan 1 → Feb 12                   │
 *   │  { date, impressions, clicks, conversions }          │
 *   │                                                      │
 *   │ Analytics KPI cards (lines 576–581)                  │
 *   │  Total Impressions  531200  +24.5%  #06b6d4          │
 *   │  Click-Through Rate   7.32%  +12.3%  #a855f7         │
 *   │  Conversion Rate      4.18%   +8.7%  #10b981         │
 *   │  Cost Per Click       $1.24   -5.2%  #f59e0b         │
 *   │                                                      │
 *   │ ML Models panel (lines 630–635)                      │
 *   │  Churn Predictor    XGBoost          87.3%  active   │
 *   │  Anomaly Detector   Isolation Forest 94.1%  active   │
 *   │  Click Predictor    Neural Network   82.7%  active   │
 *   │  ROAS Optimizer     AutoML           91.2%  training │
 *   │                                                      │
 *   │ Platform filter (line 564)                           │
 *   │  'All Platforms' | 'Google Ads' | 'Meta Ads' | 'TikTok'│
 *   └──────────────────────────────────────────────────────┘
 *
 *  State shape
 *   timeSeries[]      — weekly impressions/clicks/conversions
 *   mlModels[]        — 4 ML model cards with accuracy + status
 *   platformFilter    — active filter for PerformanceTrends
 *   kpis              — static Analytics KPI values from prototype
 *   loading / error   — async flags
 *
 *  Derived selectors
 *   filteredSeries     — timeSeries filtered by platformFilter
 *                        (prototype: all platforms use same data;
 *                         future: per-platform API slices)
 *   trendDirection     — 'up' | 'down' | 'flat' from last 2 points
 *   activeModelCount   — models with status === 'active'
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface AnalyticsPoint {
  date:        string;
  impressions: number;
  clicks:      number;
  conversions: number;
}

export type MLModelStatus = 'active' | 'training' | 'error' | 'idle';

export interface MLModel {
  name:     string;
  type:     string;   // e.g. 'XGBoost', 'Isolation Forest'
  /** Formatted accuracy string e.g. "87.3%" */
  acc:      string;
  status:   MLModelStatus;
  color:    string;
}

export type PlatformFilter =
  | 'All Platforms'
  | 'Google Ads'
  | 'Meta Ads'
  | 'TikTok';

/** Static KPI values from AnalyticsPage — LumindAd.jsx lines 576–581 */
export interface AnalyticsKPIs {
  /** Total Impressions: 531200, change +24.5% */
  totalImpressions:   number;
  impressionsChange:  number;
  /** CTR: '7.32', suffix %, change +12.3% */
  ctr:                string;
  ctrChange:          number;
  /** Conversion Rate: '4.18', suffix %, change +8.7% */
  conversionRate:     string;
  conversionChange:   number;
  /** Cost Per Click: '1.24', prefix $, change -5.2% */
  costPerClick:       string;
  cpcChange:          number;
}

// ─── Seed data (LumindAd.jsx) ─────────────────────────────────────────────────

/** Time-series data — LumindAd.jsx lines 112–118 */
export const SEED_ANALYTICS: AnalyticsPoint[] = [
  { date: 'Jan 1',  impressions: 11000, clicks:  780, conversions:  38 },
  { date: 'Jan 8',  impressions: 15200, clicks: 1120, conversions:  67 },
  { date: 'Jan 15', impressions: 18700, clicks: 1480, conversions:  89 },
  { date: 'Jan 22', impressions: 22100, clicks: 1830, conversions: 118 },
  { date: 'Jan 29', impressions: 24800, clicks: 2150, conversions: 142 },
  { date: 'Feb 5',  impressions: 27300, clicks: 2480, conversions: 168 },
  { date: 'Feb 12', impressions: 30100, clicks: 2820, conversions: 198 },
];

/** ML models — LumindAd.jsx lines 630–635 */
export const SEED_ML_MODELS: MLModel[] = [
  { name: 'Churn Predictor',   type: 'XGBoost',          acc: '87.3%', status: 'active',   color: '#7c3aed' },
  { name: 'Anomaly Detector',  type: 'Isolation Forest', acc: '94.1%', status: 'active',   color: '#06b6d4' },
  { name: 'Click Predictor',   type: 'Neural Network',   acc: '82.7%', status: 'active',   color: '#10b981' },
  { name: 'ROAS Optimizer',    type: 'AutoML',           acc: '91.2%', status: 'training', color: '#f59e0b' },
];

/** Analytics KPIs — LumindAd.jsx lines 576–581 */
const SEED_KPIS: AnalyticsKPIs = {
  totalImpressions:  531_200,
  impressionsChange:  24.5,
  ctr:               '7.32',
  ctrChange:          12.3,
  conversionRate:    '4.18',
  conversionChange:   8.7,
  costPerClick:      '1.24',
  cpcChange:         -5.2,
};

// ─── Store shape ──────────────────────────────────────────────────────────────

interface AnalyticsState {
  timeSeries:     AnalyticsPoint[];
  mlModels:       MLModel[];
  platformFilter: PlatformFilter;
  kpis:           AnalyticsKPIs;
  loading:        boolean;
  error:          string | null;

  // Actions
  setTimeSeries:     (data: AnalyticsPoint[]) => void;
  setMLModels:       (models: MLModel[]) => void;
  upsertMLModel:     (model: MLModel) => void;
  setPlatformFilter: (f: PlatformFilter) => void;
  setKPIs:           (kpis: Partial<AnalyticsKPIs>) => void;
  setLoading:        (v: boolean) => void;
  setError:          (e: string | null) => void;

  // Derived selectors
  /**
   * Returns timeSeries filtered by platformFilter.
   * In the prototype all platforms share the same data (no per-platform
   * breakdown). Future: returns a filtered API slice.
   */
  filteredSeries:    () => AnalyticsPoint[];
  /**
   * Impression trend from last two data points.
   * @example trendDirection() → 'up' (30100 > 27300)
   */
  trendDirection:    () => 'up' | 'down' | 'flat';
  /** Number of models with status === 'active' */
  activeModelCount:  () => number;
}

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * Zustand analytics store — time-series data, ML models, platform filter.
 *
 * @example
 * // AnalyticsPage — KPI cards (mirrors LumindAd.jsx lines 576–581)
 * const kpis = useAnalyticsStore(s => s.kpis);
 * // kpis.totalImpressions → 531200
 * // kpis.ctr              → '7.32'  (rendered as 7.32%)
 * // kpis.costPerClick     → '1.24'  (rendered as $1.24)
 *
 * @example
 * // PerformanceTrends chart — filtered series
 * const data = useAnalyticsStore(s => s.filteredSeries());
 * // data[0] → { date:'Jan 1', impressions:11000, clicks:780, conversions:38 }
 *
 * @example
 * // MLModelsPanel — all 4 models
 * const models = useAnalyticsStore(s => s.mlModels);
 * // models[0] → { name:'Churn Predictor', type:'XGBoost', acc:'87.3%', status:'active', color:'#7c3aed' }
 *
 * @example
 * // Platform filter (matches AnalyticsPage select)
 * const { platformFilter, setPlatformFilter } = useAnalyticsStore();
 * setPlatformFilter('Google Ads');
 *
 * @example
 * // Trend indicator for screen reader summary
 * const dir = useAnalyticsStore(s => s.trendDirection()); // 'up'
 * // → "Impressions trending up: 27,300 → 30,100"
 */
export const useAnalyticsStore = create<AnalyticsState>()(
  devtools(
    persist(
      (set, get) => ({
        // ── Initial state ───────────────────────────────────────────
        timeSeries:     SEED_ANALYTICS,
        mlModels:       SEED_ML_MODELS,
        platformFilter: 'All Platforms',
        kpis:           SEED_KPIS,
        loading:        false,
        error:          null,

        // ── Actions ─────────────────────────────────────────────────

        setTimeSeries: (timeSeries) =>
          set({ timeSeries }, false, 'setTimeSeries'),

        setMLModels: (mlModels) =>
          set({ mlModels }, false, 'setMLModels'),

        upsertMLModel: (model) =>
          set(
            (s) => ({
              mlModels: s.mlModels.some((m) => m.name === model.name)
                ? s.mlModels.map((m) => (m.name === model.name ? model : m))
                : [...s.mlModels, model],
            }),
            false,
            'upsertMLModel',
          ),

        setPlatformFilter: (platformFilter) =>
          set({ platformFilter }, false, 'setPlatformFilter'),

        setKPIs: (patch) =>
          set((s) => ({ kpis: { ...s.kpis, ...patch } }), false, 'setKPIs'),

        setLoading: (loading) => set({ loading }, false, 'setLoading'),
        setError:   (error)   => set({ error },   false, 'setError'),

        // ── Derived selectors ────────────────────────────────────────

        filteredSeries: () => {
          const { timeSeries, platformFilter } = get();
          // Prototype: same data for all platforms
          // TODO: return platform-specific slice when API supports it
          void platformFilter;
          return timeSeries;
        },

        trendDirection: () => {
          const { timeSeries } = get();
          if (timeSeries.length < 2) return 'flat';
          const last    = timeSeries[timeSeries.length - 1].impressions;
          const prevVal = timeSeries[timeSeries.length - 2].impressions;
          if (last > prevVal) return 'up';
          if (last < prevVal) return 'down';
          return 'flat';
        },

        activeModelCount: () =>
          get().mlModels.filter((m) => m.status === 'active').length,
      }),
      {
        name:       'lumindad-analytics',
        partialize: (s) => ({
          timeSeries:     s.timeSeries,
          mlModels:       s.mlModels,
          platformFilter: s.platformFilter,
          kpis:           s.kpis,
        }),
      },
    ),
    { name: 'AnalyticsStore' },
  ),
);

export default useAnalyticsStore;
