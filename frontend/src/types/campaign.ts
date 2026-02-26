/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · types/campaign.ts
 *  src/types/campaign.ts
 *
 *  Canonical TypeScript types for the Campaign domain.
 *  All campaign-related modules import from here — stores,
 *  services, components, and hooks all share this single source
 *  of truth to prevent type drift between layers.
 *
 *  Re-exported from
 *   • store/campaignStore.ts — domain entity + store shapes
 *   • services/campaignService.ts — request/response DTOs
 *
 *  New types defined here (not in store/service)
 *   • AdObjective          — campaign objectives for CreateAd
 *   • AdCreative           — headline + body for CreateAd form
 *   • CreateAdFormState    — full form shape for CreateAdPage
 *   • AIOptimizationScore  — 4-metric score for the score panel
 *   • KPICardProps         — shared KPI card props interface
 *   • NavItem              — sidebar nav item shape
 *   • PageId               — union of all routable page IDs
 *
 *  Dependency graph (no circular imports)
 *   types/campaign.ts
 *     ← store/campaignStore.ts
 *     ← services/campaignService.ts
 *     ← (no external deps — safe for all consumers)
 *
 *  Usage
 *   import type { Campaign, AdCreative, PageId } from '@/types/campaign';
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ─── Re-exports: store/campaignStore.ts ──────────────────────────────────────
// Campaign entity, status/platform unions, filter, KPI aggregation.

export type {
  CampaignStatus,
  CampaignPlatform,
  Campaign,
  CampaignFilter,
  CampaignKPIs,
} from '../store/campaignStore';

export {
  STATUS_COLOR,
  STATUS_BG,
  SEED_CAMPAIGNS,
} from '../store/campaignStore';

// ─── Re-exports: services/campaignService.ts ─────────────────────────────────
// API request/response DTOs for CRUD operations.

export type {
  CampaignListParams,
  CampaignListResponse,
  CreateCampaignPayload,
  UpdateCampaignPayload,
  CampaignPerformance,
} from '../services/campaignService';

// ─── Ad objectives ────────────────────────────────────────────────────────────
// LumindAd.jsx CreateAdPage line 914-915 — the 5 objective options.

/**
 * Campaign objective — drives bid strategy and optimisation signals.
 * LumindAd.jsx CreateAdPage opts: ['Conversions','Awareness','Traffic','Leads','App Installs']
 *
 * @example
 * const [objective, setObjective] = useState<AdObjective>('Conversions');
 */
export type AdObjective =
  | 'Conversions'
  | 'Awareness'
  | 'Traffic'
  | 'Leads'
  | 'App Installs';

// ─── Ad creative ──────────────────────────────────────────────────────────────

/**
 * Ad creative content — headline + body text pair.
 * Used by CreateAdPage and AdPreview component.
 *
 * @example
 * const creative: AdCreative = {
 *   headline: 'Boost Your Business with Smart AI Advertising',
 *   body:     'Reach your ideal customers with precision targeting...',
 * };
 */
export interface AdCreative {
  /** Primary headline — Google Ads: 15–30 chars recommended */
  headline: string;
  /** Body copy — displayed beneath headline in AdPreview */
  body:     string;
}

// ─── Create Ad form state ────────────────────────────────────────────────────

/**
 * Full form state for CreateAdPage.
 * Combines campaign settings, creative, and schedule.
 *
 * Default values mirror LumindAd.jsx lines 883–887:
 *   platform:   'Google Ads'
 *   objective:  'Conversions'
 *   headline:   ''
 *   body:       ''
 *   dailyBudget: undefined
 *
 * @example
 * const [form, setForm] = useState<CreateAdFormState>({
 *   platform:   'Google Ads',
 *   objective:  'Conversions',
 *   headline:   '',
 *   body:       '',
 * });
 */
export interface CreateAdFormState extends AdCreative {
  /** Ad platform — controls AdPreview rendering */
  platform:    import('../store/campaignStore').CampaignPlatform;
  /** Campaign objective */
  objective:   AdObjective;
  /** Daily budget in USD */
  dailyBudget?: number;
  /** ISO date string */
  startDate?:   string;
  /** ISO date string */
  endDate?:     string;
}

// ─── AI Optimization Score ────────────────────────────────────────────────────
// LumindAd.jsx CreateAdPage lines 996–1010 — 4 metrics, each 0–100.

/**
 * The 4 optimization score dimensions shown in the AI score panel.
 * Each value is 0–100; displayed as a progress bar.
 *
 * LumindAd.jsx line 996:
 *   ['Relevance','CTR Prediction','Quality Score','Targeting Match']
 *
 * @example
 * const score: AIOptimizationScore = {
 *   relevance:  82,
 *   ctrPrediction: 74,
 *   qualityScore:  90,
 *   targetingMatch: 68,
 * };
 */
export interface AIOptimizationScore {
  /** 0–100: how well the creative matches the target audience */
  relevance:      number;
  /** 0–100: predicted click-through rate relative to platform avg */
  ctrPrediction:  number;
  /** 0–100: Google-style quality score equivalent */
  qualityScore:   number;
  /** 0–100: audience targeting precision */
  targetingMatch: number;
}

/**
 * An individual AI score dimension entry — used for rendering
 * the 4 progress bars in the score panel.
 *
 * @example
 * const dimensions: AIScoreDimension[] = [
 *   { label: 'Relevance',       key: 'relevance',      value: 82, color: '#7c3aed' },
 *   { label: 'CTR Prediction',  key: 'ctrPrediction',  value: 74, color: '#06b6d4' },
 * ];
 */
export interface AIScoreDimension {
  label: string;
  key:   keyof AIOptimizationScore;
  value: number;
  color: string;
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
// LumindAd.jsx KPICard component lines 175–200.

/**
 * Props for the KPICard component used across Dashboard, Budget, Analytics.
 *
 * @example
 * <KPICard
 *   title="Total Spend"
 *   value={48290}
 *   prefix="$"
 *   change={12.5}
 *   icon="💰"
 *   color="#7c3aed"
 *   delay={0}
 * />
 */
export interface KPICardProps {
  title:   string;
  /** Number → animated counter. String → displayed as-is (e.g. '7.32') */
  value:   number | string;
  prefix?: string;
  suffix?: string;
  /** Percentage change vs prior period — positive = up (green), negative = down (red) */
  change?: number;
  icon:    string;
  color:   string;
  /** CSS animation delay in ms — used to stagger card entrances */
  delay?:  number;
}

// ─── Navigation ───────────────────────────────────────────────────────────────
// LumindAd.jsx Sidebar lines 207–212.

/**
 * All routable page IDs — must match the keys in renderPage().
 * LumindAd.jsx lines 207–212:
 *   dashboard | create | campaigns | budget | analytics | upload
 */
export type PageId =
  | 'dashboard'
  | 'create'
  | 'campaigns'
  | 'budget'
  | 'analytics'
  | 'upload';

/**
 * A single navigation item in the sidebar.
 * LumindAd.jsx nav array lines 207–212.
 *
 * @example
 * const nav: NavItem[] = [
 *   { id: 'dashboard', label: 'Dashboard',   icon: '⊞' },
 *   { id: 'create',    label: 'Create Ad',   icon: '✦' },
 * ];
 */
export interface NavItem {
  id:      PageId;
  label:   string;
  /** Single emoji or Unicode glyph */
  icon:    string;
  /** Optional badge text — e.g. 'NEW' on the Upload tab */
  badge?:  string;
}

// ─── Platform colours ─────────────────────────────────────────────────────────
// LumindAd.jsx lines 95–101 — platformData used by PlatformSplit pie chart.

/**
 * Brand colour for each ad platform — used by PlatformSplit chart and
 * allocation progress bars in BudgetPage.
 *
 * LumindAd.jsx lines 95–101 (platformData).
 *
 * @example
 * const color = PLATFORM_COLOR['Google Ads']; // → '#4285f4'
 */
export const PLATFORM_COLOR: Record<
  import('../store/campaignStore').CampaignPlatform,
  string
> = {
  'Google Ads': '#4285f4',
  'Meta Ads':   '#1877f2',
  'TikTok':     '#ff0050',
  'LinkedIn':   '#0077b5',
  'Twitter/X':  '#1da1f2',
};

// ─── Table column config ──────────────────────────────────────────────────────

/**
 * A generic sortable table column descriptor.
 * Used by CampaignsPage table header.
 *
 * @example
 * const cols: TableColumn<Campaign>[] = [
 *   { key: 'name',  label: 'Campaign',    sortable: true  },
 *   { key: 'roas',  label: 'ROAS',        sortable: true, align: 'right' },
 *   { key: 'status',label: 'Status',      sortable: false },
 * ];
 */
export interface TableColumn<T> {
  key:       keyof T | string;
  label:     string;
  sortable?: boolean;
  align?:    'left' | 'center' | 'right';
  width?:    number;
}

/**
 * Current table sort state.
 */
export interface TableSort<T> {
  key:  keyof T | string;
  dir:  'asc' | 'desc';
}
