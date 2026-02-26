/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · types/api.ts
 *  src/types/api.ts
 *
 *  Canonical TypeScript types for the API transport layer.
 *  Provides typed envelopes, auth tokens, pagination, error
 *  codes, and HTTP utility types used by all services.
 *
 *  Re-exported from
 *   • services/api.ts — ApiError, token helpers
 *
 *  New types defined here
 *   ─ Auth ────────────────────────────────────────────────────
 *   • AuthTokens         — access + refresh token pair
 *   • LoginRequest       — POST /auth/login body
 *   • LoginResponse      — token pair + user metadata
 *   • RefreshResponse    — new access token after refresh
 *   • AuthUser           — authenticated user shape
 *
 *   ─ Generic response envelopes ─────────────────────────────
 *   • ApiResponse<T>     — standard { data, meta? } wrapper
 *   • PaginatedResponse<T>— data[] + pagination cursor
 *   • PaginationMeta     — page, pageSize, total, totalPages
 *
 *   ─ Request helpers ─────────────────────────────────────────
 *   • SortDir            — 'asc' | 'desc'
 *   • SortParams<T>      — sortBy key + sortDir
 *   • DateRangeFilter    — from/to ISO date strings
 *   • RequestConfig      — per-call Axios config overrides
 *
 *   ─ Error codes ─────────────────────────────────────────────
 *   • ApiErrorCode       — known error code strings
 *   • HttpStatus         — common HTTP status codes as const
 *
 *   ─ Real-time ───────────────────────────────────────────────
 *   • PollingConfig      — useRealTimeAPI hook config shape
 *   • WebSocketEvent<T>  — typed WS message envelope
 *
 *  Usage
 *   import type { ApiResponse, PaginatedResponse, AuthTokens } from '@/types/api';
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ─── Re-exports: services/api.ts ─────────────────────────────────────────────

export type { ApiError } from '../services/api';
export {
  setTokens,
  clearTokens,
  getAccessToken,
  normaliseError,
} from '../services/api';

// ─── Auth types ───────────────────────────────────────────────────────────────

/**
 * JWT token pair returned by login and refresh endpoints.
 * Stored in sessionStorage via setTokens() in services/api.ts.
 */
export interface AuthTokens {
  accessToken:  string;
  refreshToken: string;
  /** Unix timestamp (ms) when accessToken expires */
  expiresAt:    number;
}

/**
 * Authenticated user — returned alongside tokens on login.
 * LumindAd.jsx sidebar user: 'Elizabeth D.F.' / 'Sustainable AI'
 *
 * @example
 * const user: AuthUser = {
 *   id:       'usr_001',
 *   name:     'Elizabeth Díaz Familia',
 *   email:    'elizabeth@lumindad.ai',
 *   role:     'admin',
 *   avatar?:  'https://cdn.lumindad.ai/avatars/edf.jpg',
 * };
 */
export interface AuthUser {
  id:      string;
  name:    string;
  email:   string;
  role:    'admin' | 'analyst' | 'viewer';
  avatar?: string;
}

/**
 * POST /auth/login request body.
 */
export interface LoginRequest {
  email:    string;
  password: string;
}

/**
 * POST /auth/login response body.
 * Tokens are consumed by services/api.ts setTokens().
 */
export interface LoginResponse {
  tokens: AuthTokens;
  user:   AuthUser;
}

/**
 * POST /auth/refresh response body.
 * Only the access token is rotated; refresh token stays valid.
 */
export interface RefreshResponse {
  accessToken: string;
  expiresAt:   number;
}

// ─── Generic response envelopes ───────────────────────────────────────────────

/**
 * Standard single-resource API response wrapper.
 * All LumindAd API endpoints return this shape.
 *
 * @example
 * // GET /campaigns/:id
 * const { data } = await api.get<ApiResponse<Campaign>>('/campaigns/C-001');
 * console.log(data.data.name); // 'Summer Sale 2025'
 */
export interface ApiResponse<T> {
  data:   T;
  meta?:  ResponseMeta;
}

/** Optional metadata included in API responses */
export interface ResponseMeta {
  requestId?:  string;
  serverTime?: string;   // ISO date
  version?:    string;   // API version e.g. 'v1'
}

/**
 * Pagination cursor metadata.
 *
 * @example
 * // Matches CampaignListResponse in campaignService.ts
 * const meta: PaginationMeta = {
 *   page: 1, pageSize: 20, total: 6, totalPages: 1,
 * };
 */
export interface PaginationMeta {
  page:       number;
  pageSize:   number;
  total:      number;
  totalPages: number;
}

/**
 * Paginated list response — wraps any array resource.
 *
 * @example
 * // GET /campaigns?page=1&limit=20
 * const res: PaginatedResponse<Campaign> = await campaignService.list();
 * res.data.forEach(c => console.log(c.name));
 */
export interface PaginatedResponse<T> {
  data:       T[];
  pagination: PaginationMeta;
  meta?:      ResponseMeta;
}

// ─── Request helpers ──────────────────────────────────────────────────────────

/**
 * Sort direction — mirrors CampaignListParams.sortDir.
 */
export type SortDir = 'asc' | 'desc';

/**
 * Generic sort parameters for any list endpoint.
 *
 * @example
 * const sort: SortParams<Campaign> = { sortBy: 'roas', sortDir: 'desc' };
 */
export interface SortParams<T> {
  sortBy?:  keyof T;
  sortDir?: SortDir;
}

/**
 * ISO date range filter used by analytics and budget endpoints.
 *
 * @example
 * const range: DateRangeFilter = {
 *   from: '2025-01-01T00:00:00Z',
 *   to:   '2025-11-30T23:59:59Z',
 * };
 */
export interface DateRangeFilter {
  /** ISO 8601 start date (inclusive) */
  from: string;
  /** ISO 8601 end date (inclusive) */
  to:   string;
}

/**
 * Per-request Axios config overrides.
 * Passed as the last arg to service methods when non-default
 * behaviour is needed (e.g., custom timeout for a slow endpoint).
 *
 * @example
 * await mlService.predictChurn(features, { timeout: 30_000 });
 */
export interface RequestConfig {
  /** Override default timeout (ms) */
  timeout?:  number;
  /** Additional request headers */
  headers?:  Record<string, string>;
  /** Abort signal for cancellation */
  signal?:   AbortSignal;
}

// ─── Error codes ──────────────────────────────────────────────────────────────

/**
 * Known API error codes returned in ApiError.code.
 * Used for switch-based error handling in components.
 *
 * @example
 * try {
 *   await campaignService.create(payload);
 * } catch (e) {
 *   const err = normaliseError(e);
 *   if (err.code === 'VALIDATION_ERROR') showFieldErrors(err.details);
 *   if (err.code === 'AUTH_EXPIRED')     navigate('/login');
 * }
 */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'      // 422 — field-level validation failed
  | 'NOT_FOUND'             // 404 — resource does not exist
  | 'UNAUTHORIZED'          // 401 — missing or invalid token
  | 'FORBIDDEN'             // 403 — valid token, insufficient role
  | 'AUTH_EXPIRED'          // 401 — token expired, refresh triggered
  | 'REFRESH_FAILED'        // 401 — refresh token also expired → re-login
  | 'RATE_LIMITED'          // 429 — too many requests
  | 'SERVER_ERROR'          // 5xx — unexpected server error
  | 'NETWORK_ERROR'         // 0   — offline / DNS failure
  | 'TIMEOUT'               // 408 — request timed out
  | 'UPLOAD_TOO_LARGE'      // 413 — file > 2 GB
  | 'UPLOAD_QUOTA_EXCEEDED' // 429 — monthly row limit reached
  | 'ML_MODEL_UNAVAILABLE'  // 503 — ML service not ready
  | 'UNKNOWN';              // catch-all

/**
 * Commonly used HTTP status codes as a const object.
 * Avoids magic numbers in service-layer error handling.
 *
 * @example
 * if (error.status === HttpStatus.UNAUTHORIZED) triggerRefresh();
 */
export const HttpStatus = {
  OK:                   200,
  CREATED:              201,
  NO_CONTENT:           204,
  BAD_REQUEST:          400,
  UNAUTHORIZED:         401,
  FORBIDDEN:            403,
  NOT_FOUND:            404,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS:    429,
  INTERNAL_SERVER_ERROR:500,
  BAD_GATEWAY:          502,
  SERVICE_UNAVAILABLE:  503,
} as const;

export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus];

// ─── Real-time / polling ──────────────────────────────────────────────────────

/**
 * Configuration for the useRealTimeAPI hook (hooks/useRealTimeAPI.ts).
 * Used by anomaly feed and live KPI updates.
 *
 * @example
 * const config: PollingConfig = {
 *   url:              '/api/anomalies/feed',
 *   intervalMs:       30_000,
 *   enabled:          true,
 *   retryOnError:     true,
 *   maxConsecErrors:  3,
 * };
 */
export interface PollingConfig {
  /** Endpoint to poll */
  url:              string;
  /** Polling interval in milliseconds */
  intervalMs:       number;
  /** Pause polling when false — e.g. when tab is hidden */
  enabled?:         boolean;
  /** Retry on network/server error (default: true) */
  retryOnError?:    boolean;
  /** Stop polling after N consecutive errors (default: 5) */
  maxConsecErrors?: number;
}

/**
 * A typed WebSocket message envelope.
 * Used by the real-time anomaly stream and campaign status updates.
 *
 * @example
 * // Server emits:
 * const msg: WebSocketEvent<AnomalyAlert> = {
 *   event:   'anomaly.detected',
 *   payload: { id: '...', severity: 'high', ... },
 *   ts:      Date.now(),
 * };
 */
export interface WebSocketEvent<T> {
  /** Event name — dot-separated namespacing e.g. 'campaign.status_changed' */
  event:   string;
  payload: T;
  /** Unix timestamp (ms) when event was emitted */
  ts:      number;
}

// ─── Utility types ────────────────────────────────────────────────────────────

/**
 * Makes all properties of T nullable (adds null to every value type).
 * Useful for form state where optional fields may not yet be set.
 *
 * @example
 * type NullableForm = Nullable<CreateAdFormState>;
 * // headline: string | null, body: string | null, ...
 */
export type Nullable<T> = { [K in keyof T]: T[K] | null };

/**
 * Extracts the resolved value from a Promise type.
 *
 * @example
 * type CampaignList = Awaited<ReturnType<typeof campaignService.list>>;
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/**
 * Makes a subset of properties required while leaving the rest partial.
 *
 * @example
 * type WithId<T> = RequireFields<T, 'id'>;
 */
export type RequireFields<T, K extends keyof T> =
  Omit<T, K> & Required<Pick<T, K>>;
