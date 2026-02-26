/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Hooks · useRealTimeAPI
 *  src/hooks/useRealTimeAPI.ts
 *
 *  Purpose
 *   Provides real-time data subscriptions via WebSocket with an
 *   automatic polling fallback. Designed to power the live KPI
 *   updates, campaign status changes and anomaly alerts visible
 *   on the LumindAd Dashboard and Analytics pages.
 *
 *  Connection strategy
 *   1. Primary — WebSocket (`wss://`)
 *      Opens on mount (or first subscribe). Reconnects automatically
 *      with exponential backoff on unexpected close.
 *   2. Fallback — HTTP polling
 *      Activates when:
 *        a) WebSocket construction throws (CSP / proxy block)
 *        b) `maxReconnects` is exceeded
 *        c) Caller passes `mode: 'poll'` explicitly
 *      Polling interval doubles on each failed request up to `maxPollInterval`.
 *
 *  WebSocket message protocol
 *   ─── Server → Client ────────────────────────────────────────
 *   { type: 'kpi_update',      payload: KPIUpdate        }
 *   { type: 'campaign_update', payload: CampaignUpdate   }
 *   { type: 'anomaly_alert',   payload: AnomalyAlert     }
 *   { type: 'ml_update',       payload: MLModelUpdate    }
 *   { type: 'ping' }   — server heartbeat, replied with 'pong'
 *   { type: 'pong' }   — server reply to client ping
 *
 *   ─── Client → Server ────────────────────────────────────────
 *   { type: 'subscribe',   channels: string[] }
 *   { type: 'unsubscribe', channels: string[] }
 *   { type: 'ping' }
 *
 *  Subscriptions
 *   subscribe(channel, handler) registers a typed callback for a
 *   named channel. Multiple handlers per channel are supported.
 *   unsubscribe(channel) removes all handlers for that channel.
 *   On reconnect, all active subscriptions are re-sent to the server.
 *
 *  Heartbeat
 *   Client sends `ping` every `heartbeatInterval` ms (default 30s).
 *   If no `pong` arrives within `heartbeatTimeout` ms (default 5s),
 *   the connection is considered dead and reconnect logic fires.
 *
 *  Exponential backoff (reconnect)
 *   Attempt 1  →  1s
 *   Attempt 2  →  2s
 *   Attempt 3  →  4s
 *   Attempt 4  →  8s
 *   …capped at `maxReconnectDelay` (default 30s)
 *   After `maxReconnects` (default 10) failed attempts → switch to polling.
 *
 *  Polling fallback
 *   Calls `pollFn()` every `pollInterval` ms (default 15s).
 *   `pollFn` must return a Promise<PollResponse>.
 *   The hook dispatches the response to all active channel handlers.
 *   On poll error: interval doubles (exponential backoff) up to `maxPollInterval`.
 *
 *  Connection status
 *   'connecting' → WebSocket opening or first poll pending
 *   'connected'  → WebSocket open OR last poll succeeded
 *   'degraded'   → Using polling fallback (WebSocket failed)
 *   'offline'    → All connection attempts exhausted
 *   'closed'     → Manually disconnected
 *
 *  LumindAd integration
 *   Dashboard KPI live updates:
 *     subscribe('kpi_update', (data) => setKPIs(data))
 *   Campaign status changes:
 *     subscribe('campaign_update', (data) => updateCampaign(data))
 *   Anomaly detector alerts:
 *     subscribe('anomaly_alert', (alert) => showToast(alert))
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'degraded'
  | 'offline'
  | 'closed';

export type TransportMode = 'websocket' | 'poll' | 'auto';

// ── Payload types for built-in LumindAd channels ─────────────────────────────

export interface KPIUpdate {
  impressions:     number;
  clicks:          number;
  conversions:     number;
  spend:           number;
  ctr:             number;
  cpc:             number;
  timestamp:       number;
}

export interface CampaignUpdate {
  id:      string;
  status:  'active' | 'paused' | 'completed' | 'draft';
  spent:   number;
  roas:    number;
  timestamp: number;
}

export interface AnomalyAlert {
  id:        string;
  severity:  'low' | 'medium' | 'high' | 'critical';
  message:   string;
  metric:    string;
  value:     number;
  threshold: number;
  timestamp: number;
}

export interface MLModelUpdate {
  modelId:   string;
  accuracy:  number;
  status:    'active' | 'training' | 'error';
  timestamp: number;
}

// ── Generic channel message map ───────────────────────────────────────────────

export interface ChannelMap {
  kpi_update:      KPIUpdate;
  campaign_update: CampaignUpdate;
  anomaly_alert:   AnomalyAlert;
  ml_update:       MLModelUpdate;
  [channel: string]: unknown;  // allow custom channels
}

export type ChannelHandler<C extends keyof ChannelMap> =
  (payload: ChannelMap[C]) => void;

// ── Poll response ─────────────────────────────────────────────────────────────

/** Shape returned by `pollFn()` — map of channel → payload */
export type PollResponse = Partial<ChannelMap>;

// ── Options ───────────────────────────────────────────────────────────────────

export interface UseRealTimeAPIOptions {
  /**
   * WebSocket server URL (e.g. 'wss://api.lumindad.io/ws').
   * Required when mode is 'websocket' or 'auto'.
   */
  wsUrl?: string;
  /**
   * Polling endpoint or async function called at each poll interval.
   * Required when mode is 'poll' or 'auto' (fallback).
   * @example () => fetch('/api/realtime').then(r => r.json())
   */
  pollFn?: () => Promise<PollResponse>;
  /**
   * Connection mode.
   * @default 'auto'  — WebSocket first, poll fallback
   */
  mode?: TransportMode;
  /**
   * Base polling interval in ms.
   * @default 15_000
   */
  pollInterval?: number;
  /**
   * Maximum poll interval after exponential backoff.
   * @default 120_000
   */
  maxPollInterval?: number;
  /**
   * Heartbeat ping interval in ms.
   * @default 30_000
   */
  heartbeatInterval?: number;
  /**
   * Heartbeat timeout — if no pong arrives within this window, reconnect.
   * @default 5_000
   */
  heartbeatTimeout?: number;
  /**
   * Maximum WebSocket reconnect attempts before switching to polling.
   * @default 10
   */
  maxReconnects?: number;
  /**
   * Maximum reconnect delay in ms (exponential backoff cap).
   * @default 30_000
   */
  maxReconnectDelay?: number;
  /**
   * Whether to automatically connect on mount.
   * @default true
   */
  autoConnect?: boolean;
}

export interface UseRealTimeAPIReturn {
  /** Current connection status. */
  status: ConnectionStatus;
  /** Active transport: 'websocket' | 'poll' | null */
  transport: 'websocket' | 'poll' | null;
  /** Number of reconnect attempts since last successful connection. */
  reconnectAttempts: number;
  /** Timestamp of last successful data receipt. */
  lastUpdated: number | null;
  /**
   * Subscribe to a typed channel.
   * Multiple handlers per channel are supported.
   *
   * @example
   * // Dashboard KPI live updates
   * const unsub = subscribe('kpi_update', (kpi) => setKPIs(kpi));
   * return unsub; // call in useEffect cleanup
   *
   * @example
   * // Anomaly alerts
   * subscribe('anomaly_alert', (alert) => showToast(alert.message));
   */
  subscribe: <C extends keyof ChannelMap>(
    channel: C,
    handler: ChannelHandler<C>,
  ) => () => void;
  /**
   * Unsubscribe all handlers from a channel.
   * The client sends an 'unsubscribe' message to the server.
   */
  unsubscribe: (channel: string) => void;
  /**
   * Manually trigger a poll (useful for "refresh" buttons).
   */
  poll: () => Promise<void>;
  /**
   * Disconnect WebSocket and stop polling.
   * Status becomes 'closed'.
   */
  disconnect: () => void;
  /**
   * Reconnect after manual disconnect or following 'offline' state.
   */
  reconnect: () => void;
  /**
   * Send a raw message to the WebSocket server.
   * No-op when transport is 'poll'.
   */
  send: (message: unknown) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Real-time data hook: WebSocket primary · HTTP polling fallback.
 *
 * @example
 * // Dashboard — live KPI stream
 * const rt = useRealTimeAPI({
 *   wsUrl:   'wss://api.lumindad.io/ws',
 *   pollFn:  () => fetch('/api/dashboard/live').then(r => r.json()),
 * });
 *
 * useEffect(() => {
 *   const unsub = rt.subscribe('kpi_update', (kpi) => {
 *     setImpressions(kpi.impressions);
 *     setClicks(kpi.clicks);
 *   });
 *   return unsub;
 * }, []);
 *
 * @example
 * // Analytics — anomaly alerts from ML Isolation Forest
 * const { subscribe, status } = useRealTimeAPI({ wsUrl, pollFn });
 * useEffect(() => {
 *   return subscribe('anomaly_alert', (alert) => {
 *     if (alert.severity === 'critical') showBanner(alert.message);
 *   });
 * }, [subscribe]);
 *
 * @example
 * // Poll-only mode (no WebSocket)
 * const { poll, lastUpdated } = useRealTimeAPI({
 *   mode:     'poll',
 *   pollFn:   () => fetch('/api/stats').then(r => r.json()),
 *   pollInterval: 10_000,
 * });
 *
 * @example
 * // Manual refresh button
 * <button onClick={poll}>↻ Refresh</button>
 * {lastUpdated && <span>Updated {new Date(lastUpdated).toLocaleTimeString()}</span>}
 *
 * @example
 * // Connection status badge
 * const { status, transport, reconnectAttempts } = useRealTimeAPI({ wsUrl });
 * // status: 'connected' | 'degraded' | 'offline' | 'connecting' | 'closed'
 * // transport: 'websocket' | 'poll' | null
 */
export function useRealTimeAPI(
  options: UseRealTimeAPIOptions = {},
): UseRealTimeAPIReturn {
  const {
    wsUrl,
    pollFn,
    mode              = 'auto',
    pollInterval      = 15_000,
    maxPollInterval   = 120_000,
    heartbeatInterval = 30_000,
    heartbeatTimeout  = 5_000,
    maxReconnects     = 10,
    maxReconnectDelay = 30_000,
    autoConnect       = true,
  } = options;

  const [status,            setStatus]            = useState<ConnectionStatus>('closed');
  const [transport,         setTransport]         = useState<'websocket' | 'poll' | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastUpdated,       setLastUpdated]       = useState<number | null>(null);

  // Subscription registry: channel → Set<handler>
  const subsRef = useRef<Map<string, Set<ChannelHandler<string>>>>(new Map());

  // Internal refs
  const wsRef              = useRef<WebSocket | null>(null);
  const pollTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pongTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountRef  = useRef(0);
  const currentPollIntRef  = useRef(pollInterval);
  const intentionalClose   = useRef(false);

  // ── Dispatch to channel handlers ─────────────────────────────────────
  const dispatch = useCallback((channel: string, payload: unknown) => {
    const handlers = subsRef.current.get(channel);
    if (handlers) {
      handlers.forEach((h) => {
        try { h(payload as ChannelHandler<string>); } catch { /* per-handler errors don't crash the hook */ }
      });
    }
    setLastUpdated(Date.now());
  }, []);

  // ── Process incoming WS message ───────────────────────────────────────
  const handleWsMessage = useCallback((raw: MessageEvent) => {
    try {
      const msg = JSON.parse(raw.data) as { type: string; payload?: unknown };

      if (msg.type === 'ping') {
        wsRef.current?.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (msg.type === 'pong') {
        if (pongTimerRef.current !== null) {
          clearTimeout(pongTimerRef.current);
          pongTimerRef.current = null;
        }
        return;
      }

      dispatch(msg.type, msg.payload);
    } catch {
      // Non-JSON frame or malformed message — ignore
    }
  }, [dispatch]);

  // ── Polling ───────────────────────────────────────────────────────────
  const schedulePoll = useCallback(() => {
    if (pollTimerRef.current !== null) clearTimeout(pollTimerRef.current);
    if (!pollFn || intentionalClose.current) return;

    pollTimerRef.current = setTimeout(async () => {
      try {
        const data = await pollFn();
        for (const [channel, payload] of Object.entries(data)) {
          dispatch(channel, payload);
        }
        // Reset poll interval on success
        currentPollIntRef.current = pollInterval;
        setStatus('connected'); // or 'degraded' if WS was the primary
      } catch {
        // Exponential backoff on poll error
        currentPollIntRef.current = Math.min(
          currentPollIntRef.current * 2,
          maxPollInterval,
        );
        setStatus('degraded');
      } finally {
        if (!intentionalClose.current) schedulePoll();
      }
    }, currentPollIntRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollFn, pollInterval, maxPollInterval, dispatch]);

  // ── Heartbeat ─────────────────────────────────────────────────────────
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current !== null) clearInterval(heartbeatTimerRef.current);

    heartbeatTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));

        // Expect pong within heartbeatTimeout ms
        pongTimerRef.current = setTimeout(() => {
          wsRef.current?.close(1001, 'heartbeat timeout');
        }, heartbeatTimeout);
      }
    }, heartbeatInterval);
  }, [heartbeatInterval, heartbeatTimeout]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current !== null) clearInterval(heartbeatTimerRef.current);
    if (pongTimerRef.current !== null)      clearTimeout(pongTimerRef.current);
  }, []);

  // ── WebSocket connect ─────────────────────────────────────────────────
  const connectWs = useCallback(() => {
    if (!wsUrl || intentionalClose.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    setTransport('websocket');

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      // WS construction failed → switch to polling
      setStatus('degraded');
      setTransport('poll');
      schedulePoll();
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      setTransport('websocket');
      reconnectCountRef.current = 0;
      setReconnectAttempts(0);

      // Re-subscribe all active channels
      const activeChannels = [...subsRef.current.keys()];
      if (activeChannels.length) {
        ws.send(JSON.stringify({ type: 'subscribe', channels: activeChannels }));
      }

      startHeartbeat();
    };

    ws.onmessage = handleWsMessage;

    ws.onclose = (e) => {
      stopHeartbeat();
      if (intentionalClose.current) return;

      // Unexpected close → reconnect with backoff
      reconnectCountRef.current++;
      setReconnectAttempts(reconnectCountRef.current);

      if (reconnectCountRef.current > maxReconnects) {
        // Max reconnects exceeded → fall back to polling
        setStatus('degraded');
        setTransport('poll');
        schedulePoll();
        return;
      }

      const delay = Math.min(
        Math.pow(2, reconnectCountRef.current - 1) * 1000,
        maxReconnectDelay,
      );

      setStatus('connecting');
      reconnectTimerRef.current = setTimeout(connectWs, delay);
      void e; // suppress unused var warning
    };

    ws.onerror = () => {
      // onerror always precedes onclose → let onclose handle reconnect
      setStatus('degraded');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl, handleWsMessage, startHeartbeat, stopHeartbeat, schedulePoll, maxReconnects, maxReconnectDelay]);

  // ── Auto-connect on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!autoConnect) return;

    if (mode === 'poll' || (!wsUrl && pollFn)) {
      setStatus('connecting');
      setTransport('poll');
      schedulePoll();
    } else {
      connectWs();
    }

    return () => {
      intentionalClose.current = true;
      wsRef.current?.close(1000, 'unmount');
      stopHeartbeat();
      if (pollTimerRef.current)     clearTimeout(pollTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Public API ────────────────────────────────────────────────────────

  const subscribe = useCallback(<C extends keyof ChannelMap>(
    channel: C,
    handler: ChannelHandler<C>,
  ): (() => void) => {
    if (!subsRef.current.has(channel as string)) {
      subsRef.current.set(channel as string, new Set());

      // Notify server of new channel subscription
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type:     'subscribe',
          channels: [channel],
        }));
      }
    }

    subsRef.current.get(channel as string)!.add(handler as ChannelHandler<string>);

    // Return unsubscribe function
    return () => {
      const handlers = subsRef.current.get(channel as string);
      if (handlers) {
        handlers.delete(handler as ChannelHandler<string>);
        if (handlers.size === 0) {
          subsRef.current.delete(channel as string);
        }
      }
    };
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    subsRef.current.delete(channel);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', channels: [channel] }));
    }
  }, []);

  const poll = useCallback(async (): Promise<void> => {
    if (!pollFn) return;
    try {
      const data = await pollFn();
      for (const [channel, payload] of Object.entries(data)) {
        dispatch(channel, payload);
      }
    } catch { /* consumer handles errors */ }
  }, [pollFn, dispatch]);

  const disconnect = useCallback(() => {
    intentionalClose.current = true;
    wsRef.current?.close(1000, 'manual disconnect');
    stopHeartbeat();
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setStatus('closed');
    setTransport(null);
  }, [stopHeartbeat]);

  const reconnect = useCallback(() => {
    intentionalClose.current = false;
    reconnectCountRef.current = 0;
    setReconnectAttempts(0);

    if (mode === 'poll' || (!wsUrl && pollFn)) {
      setStatus('connecting');
      setTransport('poll');
      schedulePoll();
    } else {
      connectWs();
    }
  }, [mode, wsUrl, pollFn, connectWs, schedulePoll]);

  const send = useCallback((message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return {
    status,
    transport,
    reconnectAttempts,
    lastUpdated,
    subscribe,
    unsubscribe,
    poll,
    disconnect,
    reconnect,
    send,
  };
}

export default useRealTimeAPI;
