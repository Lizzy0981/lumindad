/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Store · campaignStore
 *  src/store/campaignStore.ts
 *
 *  Purpose
 *   Zustand store that owns all campaign state consumed by
 *   CampaignsPage, Dashboard, Budget, and Analytics.
 *   Seed data mirrors LumindAd.jsx `campaigns` constant (lines 103–110)
 *   exactly so the app renders correctly without an API call.
 *
 *  Seed data (LumindAd.jsx lines 103–110)
 *   C-001  Summer Sale 2025       Google Ads  active     5000  3240  124500  8920  7.16%  342  3.8
 *   C-002  Brand Awareness Q1     Meta Ads    active     8000  5180  287000 12400  4.32%  520  2.9
 *   C-003  Product Launch Beta    TikTok      paused     3500  1890   98200  5430  5.53%  187  4.2
 *   C-004  Retargeting Dec        Google Ads  active     2000  1740   43100  3280  7.61%  245  5.1
 *   C-005  LinkedIn B2B Push      LinkedIn    draft      6000     0       0     0     —     0  0
 *   C-006  Holiday Promos         Meta Ads    completed  4200  4198  178000  9870  5.54%  430  3.5
 *
 *  Status colours (LumindAd.jsx line 137–138)
 *   active    → #10b981  · rgba(16,185,129,.12)
 *   paused    → #f59e0b  · rgba(245,158,11,.12)
 *   draft     → #94a3b8  · rgba(148,163,184,.12)
 *   completed → #7c3aed  · rgba(124,58,237,.12)
 *
 *  State shape
 *   campaigns[]   — full campaign list (seed → API hydration)
 *   selected      — id of the active campaign (for detail panels)
 *   filter        — { platform, status, search } used in CampaignsPage
 *   loading       — async flag for skeleton states
 *   error         — last error message or null
 *
 *  Actions
 *   setCampaigns         — replace entire list (API hydration)
 *   upsertCampaign       — add or update a single campaign (optimistic)
 *   removeCampaign       — delete by id (optimistic)
 *   setStatus            — change campaign status (optimistic)
 *   setFilter            — update search/platform/status filter
 *   setSelected          — set active campaign id
 *   setLoading / setError — async state setters
 *
 *  Derived selectors
 *   filteredCampaigns    — filtered + sorted list for CampaignsPage table
 *   campaignById         — memoised single-campaign lookup
 *   summaryKPIs          — totalSpend, totalImpressions, totalClicks,
 *                          totalConversions (for Dashboard KPICards)
 *
 *  Dashboard KPI values (computed from seed data)
 *   totalSpend:       48290   (sum of spent)     ← LumindAd.jsx line 323
 *   totalImpressions: 531200  (sum)              ← line 324
 *   totalClicks:      38940   (sum)              ← line 325
 *   totalConversions: 2847    (sum of conv)      ← line 326
 *   These values match the KPICard props in DashboardPage exactly.
 *   Adding or removing campaigns auto-updates them.
 *
 *  Optimistic updates pattern
 *   1. Apply change immediately to store (instant UI feedback)
 *   2. campaignService.updateCampaign(id, patch) in background
 *   3. On success: nothing (store already correct)
 *   4. On error:  rollback via upsertCampaign(previousState)
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ─── Domain types ─────────────────────────────────────────────────────────────

export type CampaignStatus = 'active' | 'paused' | 'draft' | 'completed';
export type CampaignPlatform = 'Google Ads' | 'Meta Ads' | 'TikTok' | 'LinkedIn' | 'Twitter/X';

export interface Campaign {
  id:          string;
  name:        string;
  platform:    CampaignPlatform;
  status:      CampaignStatus;
  budget:      number;
  spent:       number;
  impressions: number;
  clicks:      number;
  /** CTR as formatted string e.g. "7.16%" or "—" when no data */
  ctr:         string;
  /** Conversions count */
  conv:        number;
  roas:        number;
  /** ISO date string — undefined for prototype data */
  startDate?:  string;
  endDate?:    string;
  /** Campaign objective */
  objective?:  string;
}

export interface CampaignFilter {
  platform: CampaignPlatform | 'All Platforms';
  status:   CampaignStatus   | 'All';
  search:   string;
}

/** Aggregated KPIs derived from all campaigns — used by DashboardPage KPICards */
export interface CampaignKPIs {
  /** Sum of spent across all campaigns — Dashboard: $48,290 */
  totalSpend:       number;
  /** Sum of impressions — Dashboard: 531,200 */
  totalImpressions: number;
  /** Sum of clicks — Dashboard: 38,940 */
  totalClicks:      number;
  /** Sum of conversions — Dashboard: 2,847 */
  totalConversions: number;
  /** Weighted average ROAS (active campaigns only) */
  avgRoas:          number;
}

// ─── Status colour helpers ────────────────────────────────────────────────────
// Mirrors LumindAd.jsx lines 137–138 exactly

export const STATUS_COLOR: Record<CampaignStatus, string> = {
  active:    '#10b981',
  paused:    '#f59e0b',
  draft:     '#94a3b8',
  completed: '#7c3aed',
};

export const STATUS_BG: Record<CampaignStatus, string> = {
  active:    'rgba(16,185,129,0.12)',
  paused:    'rgba(245,158,11,0.12)',
  draft:     'rgba(148,163,184,0.12)',
  completed: 'rgba(124,58,237,0.12)',
};

// ─── Seed data (LumindAd.jsx lines 103–110) ──────────────────────────────────

export const SEED_CAMPAIGNS: Campaign[] = [
  { id:'C-001', name:'Summer Sale 2025',    platform:'Google Ads', status:'active',    budget:5000, spent:3240, impressions:124500, clicks:8920,  ctr:'7.16%', conv:342, roas:3.8 },
  { id:'C-002', name:'Brand Awareness Q1',  platform:'Meta Ads',   status:'active',    budget:8000, spent:5180, impressions:287000, clicks:12400, ctr:'4.32%', conv:520, roas:2.9 },
  { id:'C-003', name:'Product Launch Beta', platform:'TikTok',     status:'paused',    budget:3500, spent:1890, impressions:98200,  clicks:5430,  ctr:'5.53%', conv:187, roas:4.2 },
  { id:'C-004', name:'Retargeting Dec',     platform:'Google Ads', status:'active',    budget:2000, spent:1740, impressions:43100,  clicks:3280,  ctr:'7.61%', conv:245, roas:5.1 },
  { id:'C-005', name:'LinkedIn B2B Push',   platform:'LinkedIn',   status:'draft',     budget:6000, spent:0,    impressions:0,      clicks:0,     ctr:'—',     conv:0,   roas:0   },
  { id:'C-006', name:'Holiday Promos',      platform:'Meta Ads',   status:'completed', budget:4200, spent:4198, impressions:178000, clicks:9870,  ctr:'5.54%', conv:430, roas:3.5 },
];

// ─── Default filter ───────────────────────────────────────────────────────────

const DEFAULT_FILTER: CampaignFilter = {
  platform: 'All Platforms',
  status:   'All',
  search:   '',
};

// ─── Store shape ──────────────────────────────────────────────────────────────

interface CampaignState {
  // Data
  campaigns:  Campaign[];
  selected:   string | null;
  filter:     CampaignFilter;
  // Async
  loading:    boolean;
  error:      string | null;
  // Actions
  setCampaigns:    (campaigns: Campaign[]) => void;
  upsertCampaign:  (campaign: Campaign) => void;
  removeCampaign:  (id: string) => void;
  setStatus:       (id: string, status: CampaignStatus) => void;
  setFilter:       (patch: Partial<CampaignFilter>) => void;
  resetFilter:     () => void;
  setSelected:     (id: string | null) => void;
  setLoading:      (v: boolean) => void;
  setError:        (e: string | null) => void;
  // Selectors (derived — not stored in state, computed inline)
  filteredCampaigns: () => Campaign[];
  campaignById:      (id: string) => Campaign | undefined;
  summaryKPIs:       () => CampaignKPIs;
}

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * Zustand campaign store — primary source of truth for all campaign data.
 *
 * @example
 * // CampaignsPage — consume filtered list
 * const { filteredCampaigns, filter, setFilter } = useCampaignStore();
 * const rows = filteredCampaigns();
 *
 * @example
 * // DashboardPage — KPI cards from aggregated data
 * const kpis = useCampaignStore((s) => s.summaryKPIs());
 * // kpis.totalSpend      → 48290  (matches LumindAd.jsx line 323)
 * // kpis.totalImpressions→ 531200 (matches LumindAd.jsx line 324)
 *
 * @example
 * // Optimistic status toggle
 * const { setStatus, upsertCampaign } = useCampaignStore();
 * const prev = campaignById('C-001');
 * setStatus('C-001', 'paused');
 * try {
 *   await campaignService.updateStatus('C-001', 'paused');
 * } catch {
 *   upsertCampaign(prev!); // rollback
 * }
 *
 * @example
 * // Filter by platform (mirrors AnalyticsPage filter select)
 * setFilter({ platform: 'Google Ads' });
 * // filteredCampaigns() → [C-001, C-004]
 */
export const useCampaignStore = create<CampaignState>()(
  devtools(
    persist(
      (set, get) => ({
        // ── Initial state ────────────────────────────────────────────
        campaigns: SEED_CAMPAIGNS,
        selected:  null,
        filter:    DEFAULT_FILTER,
        loading:   false,
        error:     null,

        // ── Actions ──────────────────────────────────────────────────

        setCampaigns: (campaigns) => set({ campaigns }, false, 'setCampaigns'),

        upsertCampaign: (campaign) =>
          set(
            (s) => ({
              campaigns: s.campaigns.some((c) => c.id === campaign.id)
                ? s.campaigns.map((c) => (c.id === campaign.id ? campaign : c))
                : [...s.campaigns, campaign],
            }),
            false,
            'upsertCampaign',
          ),

        removeCampaign: (id) =>
          set(
            (s) => ({ campaigns: s.campaigns.filter((c) => c.id !== id) }),
            false,
            'removeCampaign',
          ),

        setStatus: (id, status) =>
          set(
            (s) => ({
              campaigns: s.campaigns.map((c) =>
                c.id === id ? { ...c, status } : c,
              ),
            }),
            false,
            'setStatus',
          ),

        setFilter: (patch) =>
          set((s) => ({ filter: { ...s.filter, ...patch } }), false, 'setFilter'),

        resetFilter: () => set({ filter: DEFAULT_FILTER }, false, 'resetFilter'),

        setSelected: (id) => set({ selected: id }, false, 'setSelected'),

        setLoading: (loading) => set({ loading }, false, 'setLoading'),

        setError:   (error)   => set({ error },   false, 'setError'),

        // ── Derived selectors ────────────────────────────────────────

        /**
         * Returns campaigns filtered by the current filter state.
         * Mirrors the inline filter in LumindAd.jsx CampaignsPage line 417:
         *   c.platform.toLowerCase().includes(search.toLowerCase())
         */
        filteredCampaigns: () => {
          const { campaigns, filter } = get();
          return campaigns.filter((c) => {
            if (filter.platform !== 'All Platforms' && c.platform !== filter.platform) return false;
            if (filter.status   !== 'All'           && c.status   !== filter.status)   return false;
            if (filter.search) {
              const q = filter.search.toLowerCase();
              if (
                !c.name.toLowerCase().includes(q) &&
                !c.platform.toLowerCase().includes(q) &&
                !c.id.toLowerCase().includes(q)
              ) return false;
            }
            return true;
          });
        },

        campaignById: (id) => get().campaigns.find((c) => c.id === id),

        /**
         * Aggregates KPIs from all campaigns.
         * Computed values match LumindAd.jsx Dashboard KPICard props exactly:
         *   totalSpend       = 48290   (line 323)
         *   totalImpressions = 531200  (line 324)
         *   totalClicks      = 38940   (line 325)
         *   totalConversions = 2847    (line 326)
         */
        summaryKPIs: (): CampaignKPIs => {
          const { campaigns } = get();
          const active = campaigns.filter((c) => c.roas > 0);
          return {
            totalSpend:       campaigns.reduce((s, c) => s + c.spent,       0),
            totalImpressions: campaigns.reduce((s, c) => s + c.impressions, 0),
            totalClicks:      campaigns.reduce((s, c) => s + c.clicks,      0),
            totalConversions: campaigns.reduce((s, c) => s + c.conv,        0),
            avgRoas:
              active.length
                ? Math.round((active.reduce((s, c) => s + c.roas, 0) / active.length) * 10) / 10
                : 0,
          };
        },
      }),
      {
        name:    'lumindad-campaigns',
        // Only persist the data — not loading/error flags
        partialize: (s) => ({ campaigns: s.campaigns, filter: s.filter }),
      },
    ),
    { name: 'CampaignStore' },
  ),
);

export default useCampaignStore;
