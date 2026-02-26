/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Analytics · BIExport · data.ts
 *  src/pages/Analytics/BIExport/data.ts
 *
 *  Single source of truth for all BIExport components.
 *  Mirrors the global constants in LumindAd.jsx exactly so that
 *  every exporter (Power BI / Tableau / Excel / PDF) uses
 *  identical data without prop-drilling from the page.
 *
 *  In a real deployment these would come from an API hook:
 *    const { campaigns, analytics, budget, platforms } = useDashboardData();
 *  The type definitions remain identical regardless of data source.
 *
 *  Author : Elizabeth Díaz Familia
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ─── Campaign data (from LumindAd.jsx line 103) ───────────────────────────────

export interface CampaignRow {
  id:          string;
  name:        string;
  platform:    string;
  status:      string;
  budget:      number;
  spent:       number;
  impressions: number;
  clicks:      number;
  ctr:         string;
  conv:        number;
  roas:        number;
}

export const CAMPAIGNS: CampaignRow[] = [
  { id:'C-001', name:'Summer Sale 2025',    platform:'Google Ads', status:'active',    budget:5000, spent:3240, impressions:124500, clicks:8920,  ctr:'7.16%', conv:342, roas:3.8 },
  { id:'C-002', name:'Brand Awareness Q1',  platform:'Meta Ads',   status:'active',    budget:8000, spent:5180, impressions:287000, clicks:12400, ctr:'4.32%', conv:520, roas:2.9 },
  { id:'C-003', name:'Product Launch Beta', platform:'TikTok',     status:'paused',    budget:3500, spent:1890, impressions:98200,  clicks:5430,  ctr:'5.53%', conv:187, roas:4.2 },
  { id:'C-004', name:'Retargeting Dec',     platform:'Google Ads', status:'active',    budget:2000, spent:1740, impressions:43100,  clicks:3280,  ctr:'7.61%', conv:245, roas:5.1 },
  { id:'C-005', name:'LinkedIn B2B Push',   platform:'LinkedIn',   status:'draft',     budget:6000, spent:0,    impressions:0,      clicks:0,     ctr:'—',     conv:0,   roas:0   },
  { id:'C-006', name:'Holiday Promos',      platform:'Meta Ads',   status:'completed', budget:4200, spent:4198, impressions:178000, clicks:9870,  ctr:'5.54%', conv:430, roas:3.5 },
];

// ─── Analytics trend data (from LumindAd.jsx line 112) ───────────────────────

export interface AnalyticsRow {
  date:        string;
  impressions: number;
  clicks:      number;
  conversions: number;
}

export const ANALYTICS_DATA: AnalyticsRow[] = [
  { date:'Jan 1',  impressions:11000, clicks: 780, conversions: 38 },
  { date:'Jan 8',  impressions:15200, clicks:1120, conversions: 67 },
  { date:'Jan 15', impressions:18700, clicks:1480, conversions: 89 },
  { date:'Jan 22', impressions:22100, clicks:1830, conversions:118 },
  { date:'Jan 29', impressions:24800, clicks:2150, conversions:142 },
  { date:'Feb 5',  impressions:27300, clicks:2480, conversions:168 },
  { date:'Feb 12', impressions:30100, clicks:2820, conversions:198 },
];

// ─── Budget data (from LumindAd.jsx line 119) ─────────────────────────────────

export interface BudgetRow {
  day:    string;
  budget: number;
  spend:  number;
}

export const BUDGET_DATA: BudgetRow[] = [
  { day:'Mon', budget:1500, spend:1240 },
  { day:'Tue', budget:1500, spend:1820 },
  { day:'Wed', budget:1500, spend:1470 },
  { day:'Thu', budget:1500, spend:2250 },
  { day:'Fri', budget:1500, spend:2480 },
  { day:'Sat', budget:1500, spend:1840 },
  { day:'Sun', budget:1500, spend:1350 },
];

// ─── Platform data (from LumindAd.jsx line 95) ───────────────────────────────

export interface PlatformRow {
  name:  string;
  value: number;   // percentage
  color: string;
}

export const PLATFORM_DATA: PlatformRow[] = [
  { name:'Google Ads', value:38, color:'#4285f4' },
  { name:'Meta Ads',   value:29, color:'#1877f2' },
  { name:'TikTok',     value:18, color:'#ff0050' },
  { name:'LinkedIn',   value:10, color:'#0077b5' },
  { name:'Twitter/X',  value: 5, color:'#1da1f2' },
];

// ─── ML Models (from LumindAd.jsx line 629) ──────────────────────────────────

export interface MLModelRow {
  name:     string;
  type:     string;
  accuracy: string;
  status:   string;
}

export const ML_MODELS: MLModelRow[] = [
  { name:'Churn Predictor',  type:'XGBoost',          accuracy:'87.3%', status:'active'   },
  { name:'Anomaly Detector', type:'Isolation Forest', accuracy:'94.1%', status:'active'   },
  { name:'Click Predictor',  type:'Neural Network',   accuracy:'82.7%', status:'active'   },
  { name:'ROAS Optimizer',   type:'AutoML',           accuracy:'91.2%', status:'training' },
];

// ─── KPI Summary (derived from LumindAd.jsx Dashboard + Analytics KPIs) ──────

export const KPI_SUMMARY = {
  totalSpend:       48290,
  totalImpressions: 531200,
  totalClicks:      38940,
  totalConversions: 2847,
  avgCTR:           '7.32%',
  avgConvRate:      '4.18%',
  avgCPC:           '$1.24',
  totalBudget:      28500,
  totalSpent:       18347,
  budgetUsedPct:    64,
} as const;

// ─── Shared download utility ──────────────────────────────────────────────────

/**
 * Triggers a browser download of a Blob with the given filename.
 * Works in all modern browsers without a server round-trip.
 *
 * @example
 * downloadBlob(new Blob([csvString], { type: 'text/csv' }), 'report.csv');
 *
 * @param blob     - The Blob to download.
 * @param filename - The suggested filename shown in the save dialog.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement('a'), {
    href:     url,
    download: filename,
    style:    'display:none',
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after 60 s to free memory
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Converts an array of objects to a CSV string.
 * Values containing commas or quotes are properly escaped.
 *
 * @example
 * const csv = toCSV([{ id: 'C-001', name: 'Summer Sale' }]);
 * // → 'id,name\r\nC-001,Summer Sale'
 *
 * @param rows    - Array of plain objects (all values coerced to string).
 * @param headers - Optional explicit column order; defaults to Object.keys(rows[0]).
 */
export function toCSV(rows: Record<string, unknown>[], headers?: string[]): string {
  if (rows.length === 0) return '';
  const keys = headers ?? Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    keys.join(','),
    ...rows.map((r) => keys.map((k) => escape(r[k])).join(',')),
  ].join('\r\n');
}

/** Today's date in YYYY-MM-DD format for export filenames. */
export const EXPORT_DATE = new Date().toISOString().slice(0, 10);
