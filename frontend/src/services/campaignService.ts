/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Services · campaignService
 *  src/services/campaignService.ts
 *
 *  Purpose
 *   API client for all campaign operations. Consumed by
 *   campaignStore actions and CampaignsPage components.
 *   Returns typed domain objects that match the store's Campaign
 *   interface exactly — no transformation needed at the call site.
 *
 *  Endpoints (REST convention)
 *   GET    /campaigns                    → Campaign[]
 *   GET    /campaigns/:id                → Campaign
 *   POST   /campaigns                    → Campaign (created)
 *   PATCH  /campaigns/:id                → Campaign (updated)
 *   DELETE /campaigns/:id                → void
 *   PATCH  /campaigns/:id/status         → Campaign (status only)
 *   GET    /campaigns/:id/performance    → CampaignPerformance
 *   GET    /campaigns/summary            → CampaignKPIs
 *
 *  Query params for list()
 *   platform  — 'Google Ads' | 'Meta Ads' | 'TikTok' | 'LinkedIn' | 'Twitter/X'
 *   status    — 'active' | 'paused' | 'draft' | 'completed'
 *   search    — free-text search against name, id, platform
 *   page      — 1-based page number (default 1)
 *   limit     — items per page (default 50)
 *   sortBy    — 'name' | 'roas' | 'spent' | 'impressions' (default 'name')
 *   sortDir   — 'asc' | 'desc' (default 'asc')
 *
 *  Seed data compatibility
 *   When VITE_USE_SEED_DATA=true, all service methods return the
 *   SEED_CAMPAIGNS from campaignStore.ts with simulated latency.
 *   This keeps the prototype fully functional without a backend.
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { api } from './api';
import type {
  Campaign,
  CampaignStatus,
  CampaignKPIs,
  CampaignFilter,
} from '../store/campaignStore';
import { SEED_CAMPAIGNS } from '../store/campaignStore';

// ─── Config ───────────────────────────────────────────────────────────────────

const USE_SEED = import.meta.env.VITE_USE_SEED_DATA === 'true';
const simDelay = (ms = 400) =>
  new Promise<void>((r) => setTimeout(r, ms));

// ─── Request/Response types ───────────────────────────────────────────────────

export interface CampaignListParams extends Partial<CampaignFilter> {
  page?:    number;
  limit?:   number;
  sortBy?:  'name' | 'roas' | 'spent' | 'impressions' | 'clicks';
  sortDir?: 'asc' | 'desc';
}

export interface CampaignListResponse {
  data:       Campaign[];
  total:      number;
  page:       number;
  totalPages: number;
}

export interface CreateCampaignPayload {
  name:       string;
  platform:   Campaign['platform'];
  objective:  string;
  budget:     number;
  startDate?: string;
  endDate?:   string;
  headline?:  string;
  body?:      string;
}

export interface UpdateCampaignPayload {
  name?:      string;
  budget?:    number;
  startDate?: string;
  endDate?:   string;
  objective?: string;
}

export interface CampaignPerformance {
  campaignId:  string;
  daily:       Array<{ date: string; impressions: number; clicks: number; spend: number; conversions: number }>;
  weekly:      Array<{ week: string; roas: number; ctr: number }>;
  topKeywords: Array<{ keyword: string; clicks: number; ctr: string }>;
}

// ─── Service ──────────────────────────────────────────────────────────────────

const campaignService = {
  /**
   * Fetch paginated campaign list with optional filters.
   *
   * @example
   * // Load all active Google Ads campaigns
   * const { data } = await campaignService.list({
   *   platform: 'Google Ads', status: 'active',
   * });
   *
   * @example
   * // CampaignStore hydration on app boot
   * const { data: campaigns } = await campaignService.list({ limit: 100 });
   * useCampaignStore.getState().setCampaigns(campaigns);
   */
  async list(params: CampaignListParams = {}): Promise<CampaignListResponse> {
    if (USE_SEED) {
      await simDelay();
      let result = [...SEED_CAMPAIGNS];
      if (params.platform && params.platform !== 'All Platforms')
        result = result.filter((c) => c.platform === params.platform);
      if (params.status && params.status !== 'All')
        result = result.filter((c) => c.status === params.status);
      if (params.search) {
        const q = params.search.toLowerCase();
        result = result.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.platform.toLowerCase().includes(q),
        );
      }
      return { data: result, total: result.length, page: 1, totalPages: 1 };
    }

    const { data } = await api.get<CampaignListResponse>('/campaigns', { params });
    return data;
  },

  /**
   * Fetch a single campaign by id.
   *
   * @example
   * const campaign = await campaignService.getById('C-001');
   * // → { id:'C-001', name:'Summer Sale 2025', ... }
   */
  async getById(id: string): Promise<Campaign> {
    if (USE_SEED) {
      await simDelay(200);
      const found = SEED_CAMPAIGNS.find((c) => c.id === id);
      if (!found) throw { status: 404, code: 'NOT_FOUND', message: `Campaign ${id} not found` };
      return found;
    }
    const { data } = await api.get<Campaign>(`/campaigns/${id}`);
    return data;
  },

  /**
   * Create a new campaign. Returns the created Campaign from the server.
   *
   * @example
   * const campaign = await campaignService.create({
   *   name:      'Summer Sale 2025',
   *   platform:  'Google Ads',
   *   objective: 'Conversions',
   *   budget:    5000,
   * });
   * useCampaignStore.getState().upsertCampaign(campaign);
   */
  async create(payload: CreateCampaignPayload): Promise<Campaign> {
    if (USE_SEED) {
      await simDelay(600);
      const mock: Campaign = {
        id:          `C-${Date.now().toString(36).toUpperCase()}`,
        name:         payload.name,
        platform:     payload.platform,
        status:      'draft',
        budget:       payload.budget,
        spent:        0,
        impressions:  0,
        clicks:       0,
        ctr:         '—',
        conv:         0,
        roas:         0,
        startDate:    payload.startDate,
        endDate:      payload.endDate,
        objective:    payload.objective,
      };
      return mock;
    }
    const { data } = await api.post<Campaign>('/campaigns', payload);
    return data;
  },

  /**
   * Partial update a campaign. Used for inline edits on the table.
   *
   * @example
   * // Update budget
   * const updated = await campaignService.update('C-001', { budget: 6000 });
   * useCampaignStore.getState().upsertCampaign(updated);
   */
  async update(id: string, payload: UpdateCampaignPayload): Promise<Campaign> {
    if (USE_SEED) {
      await simDelay(400);
      const found = SEED_CAMPAIGNS.find((c) => c.id === id);
      if (!found) throw { status: 404, code: 'NOT_FOUND', message: `Campaign ${id} not found` };
      return { ...found, ...payload };
    }
    const { data } = await api.patch<Campaign>(`/campaigns/${id}`, payload);
    return data;
  },

  /**
   * Delete a campaign by id.
   *
   * @example
   * await campaignService.remove('C-001');
   * useCampaignStore.getState().removeCampaign('C-001');
   */
  async remove(id: string): Promise<void> {
    if (USE_SEED) { await simDelay(300); return; }
    await api.delete(`/campaigns/${id}`);
  },

  /**
   * Update only the status field (optimistic-update target).
   * Lighter than a full PATCH — used for the status toggle in the table.
   *
   * @example
   * // Optimistic status toggle with rollback
   * const prev = useCampaignStore.getState().campaignById('C-003');
   * useCampaignStore.getState().setStatus('C-003', 'active');
   * try {
   *   await campaignService.updateStatus('C-003', 'active');
   * } catch {
   *   useCampaignStore.getState().upsertCampaign(prev!);
   * }
   */
  async updateStatus(id: string, status: CampaignStatus): Promise<Campaign> {
    if (USE_SEED) {
      await simDelay(200);
      const found = SEED_CAMPAIGNS.find((c) => c.id === id);
      if (!found) throw { status: 404, code: 'NOT_FOUND', message: `Campaign ${id} not found` };
      return { ...found, status };
    }
    const { data } = await api.patch<Campaign>(`/campaigns/${id}/status`, { status });
    return data;
  },

  /**
   * Fetch daily + weekly performance breakdown for a campaign.
   *
   * @example
   * const perf = await campaignService.getPerformance('C-001');
   * // perf.daily → [{ date:'2025-11-01', impressions:4200, clicks:312, ... }, ...]
   */
  async getPerformance(id: string): Promise<CampaignPerformance> {
    if (USE_SEED) {
      await simDelay(500);
      return {
        campaignId:   id,
        daily:        [],
        weekly:       [],
        topKeywords:  [],
      };
    }
    const { data } = await api.get<CampaignPerformance>(`/campaigns/${id}/performance`);
    return data;
  },

  /**
   * Fetch aggregated KPI summary across all campaigns.
   * Server-side computation of Dashboard KPICard values.
   *
   * @example
   * const kpis = await campaignService.getSummary();
   * // kpis.totalSpend       → 48290  (LumindAd.jsx line 323)
   * // kpis.totalImpressions → 531200 (LumindAd.jsx line 324)
   */
  async getSummary(): Promise<CampaignKPIs> {
    if (USE_SEED) {
      await simDelay(300);
      return useSeedKPIs();
    }
    const { data } = await api.get<CampaignKPIs>('/campaigns/summary');
    return data;
  },
};

/** Compute KPIs from seed data (mirrors campaignStore.summaryKPIs) */
function useSeedKPIs(): CampaignKPIs {
  const active = SEED_CAMPAIGNS.filter((c) => c.roas > 0);
  return {
    totalSpend:       SEED_CAMPAIGNS.reduce((s, c) => s + c.spent,       0),
    totalImpressions: SEED_CAMPAIGNS.reduce((s, c) => s + c.impressions, 0),
    totalClicks:      SEED_CAMPAIGNS.reduce((s, c) => s + c.clicks,      0),
    totalConversions: SEED_CAMPAIGNS.reduce((s, c) => s + c.conv,        0),
    avgRoas:
      active.length
        ? Math.round((active.reduce((s, c) => s + c.roas, 0) / active.length) * 10) / 10
        : 0,
  };
}

export default campaignService;
