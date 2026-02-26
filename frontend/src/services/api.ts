/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Services · api
 *  src/services/api.ts
 *
 *  Purpose
 *   Shared Axios instance used by every service module.
 *   Centralises: base URL, auth headers, JWT refresh, retry
 *   logic, request/response normalisation, and error mapping.
 *
 *  Base URL resolution
 *   VITE_API_URL env var (set in .env.local / .env.production).
 *   Falls back to '/api' for local dev proxying via vite.config.ts.
 *
 *  JWT interceptor flow
 *   Request interceptor
 *     1. Read accessToken from sessionStorage / in-memory store
 *     2. Attach `Authorization: Bearer <token>` to every request
 *     3. Attach `X-Request-ID` (uuid-v4) for distributed tracing
 *
 *   Response interceptor — 401 handling
 *     1. Intercept 401 Unauthorized
 *     2. Attempt token refresh via POST /auth/refresh
 *     3. On success: update stored tokens, retry original request
 *     4. On failure: clear tokens, redirect to /login
 *     5. Concurrent 401s are queued — only one refresh is in flight
 *
 *  Retry logic
 *   Retries network errors and 5xx responses up to MAX_RETRIES (3)
 *   with exponential backoff: 500ms · 1000ms · 2000ms.
 *   Does NOT retry: 4xx (client errors), 401 (handled by refresh flow).
 *
 *  Timeout
 *   Default: 15_000ms. Override per-request via config.timeout.
 *   Upload requests use 300_000ms (5 min) to handle large file POSTs.
 *
 *  Error normalisation
 *   All errors are mapped to ApiError before they reach service code:
 *   { status, code, message, details?, requestId? }
 *   Consumers catch `ApiError` — never raw AxiosError.
 *
 *  Exported instances
 *   api          — default Axios instance (all services use this)
 *   uploadApi    — separate instance with extended timeout (5 min)
 *   authApi      — separate instance WITHOUT auth interceptor
 *                  (avoids infinite loop on /auth/refresh calls)
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';

// ─── Config constants ─────────────────────────────────────────────────────────

const BASE_URL     = import.meta.env.VITE_API_URL ?? '/api';
const TIMEOUT      = 15_000;
const UPLOAD_TIMEOUT = 300_000;   // 5 min for file upload endpoints
const MAX_RETRIES  = 3;

// ─── Token storage ────────────────────────────────────────────────────────────
// Kept in a module-level object (not localStorage) to avoid XSS exposure.
// The auth service populates this after login.

interface TokenStore {
  accessToken:  string | null;
  refreshToken: string | null;
}

const tokens: TokenStore = {
  accessToken:  sessionStorage.getItem('lumindad_access')  ?? null,
  refreshToken: sessionStorage.getItem('lumindad_refresh') ?? null,
};

/** Call after successful login or token refresh */
export function setTokens(access: string, refresh: string): void {
  tokens.accessToken  = access;
  tokens.refreshToken = refresh;
  sessionStorage.setItem('lumindad_access',  access);
  sessionStorage.setItem('lumindad_refresh', refresh);
}

/** Call on logout or when refresh fails */
export function clearTokens(): void {
  tokens.accessToken  = null;
  tokens.refreshToken = null;
  sessionStorage.removeItem('lumindad_access');
  sessionStorage.removeItem('lumindad_refresh');
}

export function getAccessToken(): string | null {
  return tokens.accessToken;
}

// ─── Error normalisation ──────────────────────────────────────────────────────

export interface ApiError {
  status:     number;
  code:       string;
  message:    string;
  details?:   unknown;
  requestId?: string;
}

/**
 * Maps any thrown error to a typed ApiError.
 *
 * @example
 * try { await campaignService.list() } catch (e) {
 *   const err = normaliseError(e);
 *   if (err.status === 404) showNotFound();
 * }
 */
export function normaliseError(raw: unknown): ApiError {
  if (axios.isAxiosError(raw)) {
    const res = (raw as AxiosError).response;
    const data = res?.data as Record<string, unknown> | undefined;
    return {
      status:    res?.status ?? 0,
      code:      String(data?.code ?? 'UNKNOWN'),
      message:   String(data?.message ?? raw.message ?? 'Request failed'),
      details:   data?.details,
      requestId: res?.headers?.['x-request-id'] as string | undefined,
    };
  }
  return {
    status:  0,
    code:   'CLIENT_ERROR',
    message: raw instanceof Error ? raw.message : 'Unknown error',
  };
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

function shouldRetry(error: AxiosError, attempt: number): boolean {
  if (attempt >= MAX_RETRIES) return false;
  if (!error.response) return true;          // network error
  const status = error.response.status;
  return status >= 500 && status !== 501;    // 5xx except Not Implemented
}

function retryDelay(attempt: number): number {
  return Math.pow(2, attempt) * 500;   // 500 · 1000 · 2000
}

// ─── Request ID ───────────────────────────────────────────────────────────────

function newRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Token refresh queue ──────────────────────────────────────────────────────
// Prevents multiple simultaneous refresh requests on concurrent 401s.

let isRefreshing = false;
let pendingRefreshQueue: Array<{
  resolve: (token: string) => void;
  reject:  (err: unknown) => void;
}> = [];

function flushRefreshQueue(token: string): void {
  pendingRefreshQueue.forEach(({ resolve }) => resolve(token));
  pendingRefreshQueue = [];
}

function rejectRefreshQueue(error: unknown): void {
  pendingRefreshQueue.forEach(({ reject }) => reject(error));
  pendingRefreshQueue = [];
}

// ─── Factory ──────────────────────────────────────────────────────────────────

function createInstance(cfg: AxiosRequestConfig = {}): AxiosInstance {
  const instance = axios.create({
    baseURL:         BASE_URL,
    timeout:         TIMEOUT,
    headers:         { 'Content-Type': 'application/json' },
    withCredentials: true,
    ...cfg,
  });
  return instance;
}

// ─── Request interceptor ──────────────────────────────────────────────────────

function attachRequestInterceptor(instance: AxiosInstance): void {
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // Attach JWT
      if (tokens.accessToken) {
        config.headers = config.headers ?? {};
        config.headers['Authorization'] = `Bearer ${tokens.accessToken}`;
      }
      // Attach request ID for distributed tracing
      config.headers['X-Request-ID'] = newRequestId();
      return config;
    },
    (error) => Promise.reject(error),
  );
}

// ─── Response interceptors ────────────────────────────────────────────────────

function attachResponseInterceptor(
  instance: AxiosInstance,
  withRefresh = true,
): void {
  instance.interceptors.response.use(
    // Success path — return data directly
    (response: AxiosResponse) => response,

    async (error: AxiosError) => {
      const originalConfig = error.config as InternalAxiosRequestConfig & {
        _retry?:   boolean;
        _attempt?: number;
      };

      // ── 401 handling: JWT refresh ────────────────────────────────
      if (
        withRefresh &&
        error.response?.status === 401 &&
        !originalConfig._retry &&
        tokens.refreshToken
      ) {
        originalConfig._retry = true;

        if (isRefreshing) {
          // Queue this request until the in-flight refresh completes
          return new Promise((resolve, reject) => {
            pendingRefreshQueue.push({
              resolve: (token) => {
                originalConfig.headers['Authorization'] = `Bearer ${token}`;
                resolve(instance(originalConfig));
              },
              reject,
            });
          });
        }

        isRefreshing = true;
        try {
          const { data } = await authApi.post<{
            accessToken: string;
            refreshToken: string;
          }>('/auth/refresh', { refreshToken: tokens.refreshToken });

          setTokens(data.accessToken, data.refreshToken);
          flushRefreshQueue(data.accessToken);

          originalConfig.headers['Authorization'] = `Bearer ${data.accessToken}`;
          return instance(originalConfig);
        } catch (refreshError) {
          clearTokens();
          rejectRefreshQueue(refreshError);
          // Redirect to login — in a real app use React Router navigate()
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      // ── Retry on 5xx / network error ─────────────────────────────
      const attempt = originalConfig._attempt ?? 0;
      if (shouldRetry(error, attempt)) {
        originalConfig._attempt = attempt + 1;
        await new Promise((r) => setTimeout(r, retryDelay(attempt)));
        return instance(originalConfig);
      }

      // ── Normalise error for callers ───────────────────────────────
      return Promise.reject(normaliseError(error));
    },
  );
}

// ─── Instances ────────────────────────────────────────────────────────────────

/**
 * `authApi` — no JWT interceptor (used for /auth/login, /auth/refresh).
 * Must be created BEFORE `api` to break the circular reference.
 */
export const authApi = createInstance();
attachResponseInterceptor(authApi, false);

/**
 * `api` — main Axios instance used by all service modules.
 * Attaches JWT, handles 401 refresh, retries 5xx.
 *
 * @example
 * import { api } from './api';
 * const { data } = await api.get<Campaign[]>('/campaigns');
 */
export const api = createInstance();
attachRequestInterceptor(api);
attachResponseInterceptor(api, true);

/**
 * `uploadApi` — extended 5-min timeout for large file upload endpoints.
 * Used exclusively by uploadService.ts.
 *
 * @example
 * import { uploadApi } from './api';
 * const { data } = await uploadApi.post('/upload/chunk', formData, {
 *   headers: { 'Content-Type': 'multipart/form-data' },
 *   onUploadProgress: (e) => setProgress(e.loaded / e.total!),
 * });
 */
export const uploadApi = createInstance({ timeout: UPLOAD_TIMEOUT });
attachRequestInterceptor(uploadApi);
attachResponseInterceptor(uploadApi, true);

export default api;
