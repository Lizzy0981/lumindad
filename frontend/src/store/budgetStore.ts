/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Store · budgetStore
 *  src/store/budgetStore.ts
 *
 *  Purpose
 *   Zustand store that owns all budget state consumed by
 *   BudgetPage, Dashboard, and the AI Recommendation card.
 *   Seed data mirrors every numeric constant in LumindAd.jsx
 *   BudgetPage (lines 497–560) exactly.
 *
 *  Seed data sources
 *   ┌──────────────────────────────────────────────────────┐
 *   │ budgetData (LumindAd.jsx lines 119–123)              │
 *   │  { day, budget:1500, spend }  × 7                    │
 *   │  Mon→1240  Tue→1820  Wed→1470  Thu→2250              │
 *   │  Fri→2480  Sat→1840  Sun→1350                        │
 *   │                                                      │
 *   │ KPI cards (lines 505–510)                            │
 *   │  Total Budget  $28,500  #7c3aed                      │
 *   │  Total Spent   $18,347  #10b981  change+18.2%        │
 *   │  Remaining     $10,153  #06b6d4                      │
 *   │  Budget Used      64%   #f59e0b                      │
 *   │                                                      │
 *   │ platformData (lines 95–101) — first 4 slice          │
 *   │  Google Ads  38%  #4285f4                            │
 *   │  Meta Ads    29%  #1877f2                            │
 *   │  TikTok      18%  #ff0050                            │
 *   │  LinkedIn    10%  #0077b5                            │
 *   │                                                      │
 *   │ AI Recommendation card (lines 550–558)               │
 *   │  "Reallocate $1,200 from Meta to Google Ads.         │
 *   │   XGBoost estimates +23% ROAS improvement."          │
 *   └──────────────────────────────────────────────────────┘
 *
 *  State shape
 *   dailyEntries[]    — 7-day spend vs budget chart data
 *   allocations[]     — per-platform % share + computed $ amount
 *   totalBudget       — $28,500
 *   totalSpent        — $18,347
 *   period            — display label e.g. 'November 2025'
 *   aiRecommendation  — { from, to, amount, roasGain, applied }
 *   loading / error   — async flags
 *
 *  Derived selectors
 *   remaining         — totalBudget − totalSpent  (→ $10,153)
 *   usedPercent       — Math.round(totalSpent/totalBudget*100)  (→ 64)
 *   allocationAmount  — (platform) → Math.round(totalSpent * pct/100)
 *   overBudgetDays    — days where spend > budget (for alerts)
 *
 *  AI Recommendation (lines 550–558)
 *   The BudgetPage renders a card:
 *     "Reallocate $1,200 from Meta to Google Ads.
 *      Predictive model (XGBoost) estimates +23% ROAS improvement."
 *   `applyRecommendation()` updates the allocation percentages
 *   and marks `aiRecommendation.applied = true`.
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface DailyBudgetEntry {
  day:    string;
  budget: number;
  spend:  number;
}

export interface PlatformAllocation {
  name:   string;
  /** Percentage share of total spend (0–100) */
  value:  number;
  color:  string;
}

export interface AIRecommendation {
  from:      string;  // platform name
  to:        string;
  amount:    number;  // $ to reallocate
  roasGain:  number;  // percentage gain estimate e.g. 23
  applied:   boolean;
}

// ─── Seed data (LumindAd.jsx) ─────────────────────────────────────────────────

/** Daily spend vs budget — LumindAd.jsx lines 119–123 */
export const SEED_DAILY_ENTRIES: DailyBudgetEntry[] = [
  { day: 'Mon', budget: 1500, spend: 1240 },
  { day: 'Tue', budget: 1500, spend: 1820 },
  { day: 'Wed', budget: 1500, spend: 1470 },
  { day: 'Thu', budget: 1500, spend: 2250 },
  { day: 'Fri', budget: 1500, spend: 2480 },
  { day: 'Sat', budget: 1500, spend: 1840 },
  { day: 'Sun', budget: 1500, spend: 1350 },
];

/** Platform allocation share — LumindAd.jsx lines 95–101, slice(0,4) */
export const SEED_ALLOCATIONS: PlatformAllocation[] = [
  { name: 'Google Ads', value: 38, color: '#4285f4' },
  { name: 'Meta Ads',   value: 29, color: '#1877f2' },
  { name: 'TikTok',     value: 18, color: '#ff0050' },
  { name: 'LinkedIn',   value: 10, color: '#0077b5' },
  { name: 'Twitter/X',  value:  5, color: '#1da1f2' },
];

/** AI rec — LumindAd.jsx lines 550–558 */
const SEED_AI_REC: AIRecommendation = {
  from:     'Meta Ads',
  to:       'Google Ads',
  amount:   1200,
  roasGain: 23,
  applied:  false,
};

// ─── Store shape ──────────────────────────────────────────────────────────────

interface BudgetState {
  dailyEntries:      DailyBudgetEntry[];
  allocations:       PlatformAllocation[];
  /** Total monthly/period budget — LumindAd.jsx line 506: $28,500 */
  totalBudget:       number;
  /** Total spent so far — LumindAd.jsx line 507: $18,347 */
  totalSpent:        number;
  /** Display label for the period selector button */
  period:            string;
  aiRecommendation:  AIRecommendation;
  loading:           boolean;
  error:             string | null;

  // Actions
  setDailyEntries:      (entries: DailyBudgetEntry[]) => void;
  setAllocations:       (allocs: PlatformAllocation[]) => void;
  setTotals:            (budget: number, spent: number) => void;
  setPeriod:            (label: string) => void;
  updateAllocation:     (name: string, value: number) => void;
  applyRecommendation:  () => void;
  setLoading:           (v: boolean) => void;
  setError:             (e: string | null) => void;

  // Derived selectors
  /** totalBudget - totalSpent → $10,153 (LumindAd.jsx line 508) */
  remaining:           () => number;
  /** Math.round(totalSpent / totalBudget * 100) → 64 (line 509) */
  usedPercent:         () => number;
  /**
   * Computed $ amount for a platform allocation bar.
   * LumindAd.jsx line 536: Math.round(18347 * p.value / 100)
   * @example allocationAmount('Google Ads') → Math.round(18347 * 38/100) = 6972
   */
  allocationAmount:    (name: string) => number;
  /** Days where spend > budget (used for budget alert badges) */
  overBudgetDays:      () => DailyBudgetEntry[];
}

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * Zustand budget store — source of truth for all budget data.
 *
 * @example
 * // BudgetPage KPI cards
 * const { totalBudget, totalSpent, remaining, usedPercent } = useBudgetStore(s => ({
 *   totalBudget: s.totalBudget,          // 28500
 *   totalSpent:  s.totalSpent,           // 18347
 *   remaining:   s.remaining(),          // 10153
 *   usedPercent: s.usedPercent(),        // 64
 * }));
 *
 * @example
 * // Platform allocation bar — mirrors LumindAd.jsx line 536
 * const amount = useBudgetStore(s => s.allocationAmount('Google Ads')); // 6972
 *
 * @example
 * // Apply AI recommendation (reallocate $1,200 Meta → Google Ads)
 * const apply = useBudgetStore(s => s.applyRecommendation);
 * <button onClick={apply}>Apply Suggestion</button>
 *
 * @example
 * // Over-budget alert
 * const alerts = useBudgetStore(s => s.overBudgetDays());
 * // → [{ day:'Tue', budget:1500, spend:1820 }, { day:'Thu'... }, ...]
 */
export const useBudgetStore = create<BudgetState>()(
  devtools(
    persist(
      (set, get) => ({
        // ── Initial state ───────────────────────────────────────────
        dailyEntries:     SEED_DAILY_ENTRIES,
        allocations:      SEED_ALLOCATIONS,
        totalBudget:      28_500,   // LumindAd.jsx line 506
        totalSpent:       18_347,   // LumindAd.jsx line 507
        period:           'November 2025',
        aiRecommendation: SEED_AI_REC,
        loading:          false,
        error:            null,

        // ── Actions ─────────────────────────────────────────────────

        setDailyEntries: (dailyEntries) =>
          set({ dailyEntries }, false, 'setDailyEntries'),

        setAllocations: (allocations) =>
          set({ allocations }, false, 'setAllocations'),

        setTotals: (totalBudget, totalSpent) =>
          set({ totalBudget, totalSpent }, false, 'setTotals'),

        setPeriod: (period) =>
          set({ period }, false, 'setPeriod'),

        updateAllocation: (name, value) =>
          set(
            (s) => ({
              allocations: s.allocations.map((a) =>
                a.name === name ? { ...a, value } : a,
              ),
            }),
            false,
            'updateAllocation',
          ),

        /**
         * Apply the AI recommendation: shift `amount` budget share
         * from `from` platform to `to` platform, then mark applied.
         * Mirrors the "Apply Suggestion" btn in LumindAd.jsx line 557.
         */
        applyRecommendation: () => {
          const { aiRecommendation, totalSpent, allocations } = get();
          if (aiRecommendation.applied) return;

          const shiftPct = Math.round(
            (aiRecommendation.amount / totalSpent) * 100,
          );

          set(
            {
              allocations: allocations.map((a) => {
                if (a.name === aiRecommendation.from)
                  return { ...a, value: Math.max(0, a.value - shiftPct) };
                if (a.name === aiRecommendation.to)
                  return { ...a, value: a.value + shiftPct };
                return a;
              }),
              aiRecommendation: { ...aiRecommendation, applied: true },
            },
            false,
            'applyRecommendation',
          );
        },

        setLoading: (loading) => set({ loading }, false, 'setLoading'),
        setError:   (error)   => set({ error },   false, 'setError'),

        // ── Derived selectors ────────────────────────────────────────

        /** $28,500 - $18,347 = $10,153  (LumindAd.jsx line 508) */
        remaining: () => get().totalBudget - get().totalSpent,

        /** Math.round(18347 / 28500 * 100) = 64  (LumindAd.jsx line 509) */
        usedPercent: () =>
          get().totalBudget > 0
            ? Math.round((get().totalSpent / get().totalBudget) * 100)
            : 0,

        /** Math.round(totalSpent * alloc.value / 100)  (LumindAd.jsx line 536) */
        allocationAmount: (name) => {
          const alloc = get().allocations.find((a) => a.name === name);
          return alloc
            ? Math.round(get().totalSpent * alloc.value / 100)
            : 0;
        },

        overBudgetDays: () =>
          get().dailyEntries.filter((e) => e.spend > e.budget),
      }),
      {
        name:       'lumindad-budget',
        partialize: (s) => ({
          dailyEntries: s.dailyEntries,
          allocations:  s.allocations,
          totalBudget:  s.totalBudget,
          totalSpent:   s.totalSpent,
          period:       s.period,
        }),
      },
    ),
    { name: 'BudgetStore' },
  ),
);

export default useBudgetStore;
