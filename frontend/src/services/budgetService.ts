/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Services · budgetService
 *  src/services/budgetService.ts
 *
 *  Purpose
 *   API client for all budget operations. Consumed by budgetStore
 *   actions and BudgetPage components.
 *
 *  Endpoints
 *   GET    /budget/summary              → BudgetSummary
 *   GET    /budget/daily?period=...     → DailyBudgetEntry[]
 *   GET    /budget/allocations          → PlatformAllocation[]
 *   PATCH  /budget/allocations          → PlatformAllocation[] (updated)
 *   GET    /budget/recommendation       → AIBudgetRecommendation
 *   POST   /budget/recommendation/apply → BudgetSummary (after realloc)
 *   GET    /budget/forecast?days=N      → BudgetForecast
 *
 *  Seed data compatibility
 *   VITE_USE_SEED_DATA=true → returns budgetStore seed values
 *   with simulated latency. No backend required for prototype.
 *
 *  Seed values (LumindAd.jsx)
 *   totalBudget: 28500  (line 506)
 *   totalSpent:  18347  (line 507)
 *   remaining:   10153  (computed)
 *   usedPct:        64  (computed)
 *   dailyEntries:  Mon–Sun, budget:1500 each (lines 119–123)
 *   allocations:   Google38 Meta29 TikTok18 LinkedIn10 (lines 95–101)
 *   AI rec:        $1200 Meta→Google, +23% ROAS (lines 550–558)
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { api } from './api';
import {
  DailyBudgetEntry,
  PlatformAllocation,
  AIRecommendation,
  SEED_DAILY_ENTRIES,
  SEED_ALLOCATIONS,
} from '../store/budgetStore';

// ─── Config ───────────────────────────────────────────────────────────────────

const USE_SEED = import.meta.env.VITE_USE_SEED_DATA === 'true';
const simDelay = (ms = 400) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Response types ───────────────────────────────────────────────────────────

export interface BudgetSummary {
  totalBudget:  number;
  totalSpent:   number;
  remaining:    number;
  usedPercent:  number;
  period:       string;
  spendChange:  number;   // % change vs previous period e.g. +18.2
}

export interface BudgetForecast {
  projectedSpend: number;
  projectedEnd:   string;   // ISO date
  confidence:     number;   // 0–100
  overBudgetRisk: boolean;
  dailyForecast:  Array<{ date: string; projected: number; upperBound: number; lowerBound: number }>;
}

// ─── Service ──────────────────────────────────────────────────────────────────

const budgetService = {
  /**
   * Fetch top-level budget summary for the given period.
   *
   * @example
   * const summary = await budgetService.getSummary();
   * // → { totalBudget:28500, totalSpent:18347, remaining:10153, usedPercent:64 }
   * // Matches LumindAd.jsx KPI cards lines 505–510 exactly.
   */
  async getSummary(period?: string): Promise<BudgetSummary> {
    if (USE_SEED) {
      await simDelay(300);
      return {
        totalBudget:  28_500,
        totalSpent:   18_347,
        remaining:    10_153,
        usedPercent:  64,
        period:       period ?? 'November 2025',
        spendChange:  18.2,
      };
    }
    const { data } = await api.get<BudgetSummary>('/budget/summary', {
      params: period ? { period } : undefined,
    });
    return data;
  },

  /**
   * Fetch daily spend vs budget chart data.
   * Returns 7 entries for the current week by default.
   *
   * @example
   * const daily = await budgetService.getDailyEntries();
   * // daily[0] → { day:'Mon', budget:1500, spend:1240 }
   * // Matches budgetData LumindAd.jsx lines 119–123.
   */
  async getDailyEntries(period?: string): Promise<DailyBudgetEntry[]> {
    if (USE_SEED) {
      await simDelay(300);
      return SEED_DAILY_ENTRIES;
    }
    const { data } = await api.get<DailyBudgetEntry[]>('/budget/daily', {
      params: period ? { period } : undefined,
    });
    return data;
  },

  /**
   * Fetch current platform allocation percentages.
   *
   * @example
   * const allocs = await budgetService.getAllocations();
   * // allocs[0] → { name:'Google Ads', value:38, color:'#4285f4' }
   * // LumindAd.jsx platformData lines 95–101, slice(0,4)
   */
  async getAllocations(): Promise<PlatformAllocation[]> {
    if (USE_SEED) {
      await simDelay(200);
      return SEED_ALLOCATIONS;
    }
    const { data } = await api.get<PlatformAllocation[]>('/budget/allocations');
    return data;
  },

  /**
   * Update platform allocation percentages.
   * Values must sum to 100.
   *
   * @example
   * // After AI recommendation: shift 7% from Meta to Google Ads
   * const updated = await budgetService.updateAllocations([
   *   { name:'Google Ads', value:45, color:'#4285f4' },
   *   { name:'Meta Ads',   value:22, color:'#1877f2' },
   *   { name:'TikTok',     value:18, color:'#ff0050' },
   *   { name:'LinkedIn',   value:10, color:'#0077b5' },
   *   { name:'Twitter/X',  value:5,  color:'#1da1f2' },
   * ]);
   */
  async updateAllocations(
    allocations: PlatformAllocation[],
  ): Promise<PlatformAllocation[]> {
    if (USE_SEED) {
      await simDelay(400);
      return allocations;
    }
    const { data } = await api.patch<PlatformAllocation[]>(
      '/budget/allocations',
      { allocations },
    );
    return data;
  },

  /**
   * Fetch the current AI budget recommendation.
   * Mirrors LumindAd.jsx lines 550–558 AI Recommendation card.
   *
   * @example
   * const rec = await budgetService.getRecommendation();
   * // rec.from       → 'Meta Ads'
   * // rec.to         → 'Google Ads'
   * // rec.amount     → 1200
   * // rec.roasGain   → 23
   * // "Reallocate $1,200 from Meta to Google Ads. XGBoost estimates +23% ROAS."
   */
  async getRecommendation(): Promise<AIRecommendation> {
    if (USE_SEED) {
      await simDelay(500);
      return {
        from:     'Meta Ads',
        to:       'Google Ads',
        amount:   1_200,
        roasGain: 23,
        applied:  false,
      };
    }
    const { data } = await api.get<AIRecommendation>('/budget/recommendation');
    return data;
  },

  /**
   * Apply the AI recommendation server-side.
   * Returns updated summary after reallocation.
   *
   * @example
   * // "Apply Suggestion" button — LumindAd.jsx line 557
   * const newSummary = await budgetService.applyRecommendation();
   * useBudgetStore.getState().setTotals(newSummary.totalBudget, newSummary.totalSpent);
   */
  async applyRecommendation(): Promise<BudgetSummary> {
    if (USE_SEED) {
      await simDelay(700);
      return {
        totalBudget:  28_500,
        totalSpent:   18_347,
        remaining:    10_153,
        usedPercent:  64,
        period:       'November 2025',
        spendChange:  21.3,  // improved after reallocation
      };
    }
    const { data } = await api.post<BudgetSummary>(
      '/budget/recommendation/apply',
    );
    return data;
  },

  /**
   * Fetch spend forecast for the next N days.
   * Used for the "over-budget risk" indicator on BudgetPage.
   *
   * @example
   * const forecast = await budgetService.getForecast(14);
   * if (forecast.overBudgetRisk) showAlert('Projected to exceed budget in 14 days');
   */
  async getForecast(days = 14): Promise<BudgetForecast> {
    if (USE_SEED) {
      await simDelay(600);
      return {
        projectedSpend: 24_800,
        projectedEnd:   new Date(Date.now() + days * 86_400_000).toISOString(),
        confidence:     87,
        overBudgetRisk: false,
        dailyForecast:  [],
      };
    }
    const { data } = await api.get<BudgetForecast>('/budget/forecast', {
      params: { days },
    });
    return data;
  },
};

export default budgetService;
