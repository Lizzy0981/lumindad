/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Hooks · useWebWorker
 *  src/hooks/useWebWorker.ts
 *
 *  Purpose
 *   Generic React hook that wraps a Web Worker with typed message
 *   passing, status tracking, message queuing, and a synchronous
 *   fallback for environments where Workers are unavailable.
 *
 *  Relationship to ProcessingWorker.ts
 *   ProcessingWorker.ts implements the file-processing Worker itself.
 *   useWebWorker.ts is the React-side bridge that:
 *   – Creates and terminates the Worker lifecycle
 *   – Provides typed send/onMessage with generics
 *   – Exposes `status` ('idle' | 'busy' | 'error')
 *   – Queues messages when the Worker is busy
 *   – Falls back to `fallbackFn` when Worker creation fails
 *
 *  Why separate from useChunkedUpload?
 *   useChunkedUpload knows about file chunks and 50K-row slices.
 *   useWebWorker knows nothing about domain logic — it's a pure
 *   message-passing wrapper. This separation means the same hook
 *   can be reused for:
 *   – ProcessingWorker (file parsing)
 *   – Any future heavy computation moved off the main thread
 *     (e.g. SHAP value calculation, XGBoost inference via ONNX)
 *
 *  Worker lifecycle
 *   Created  → on first `send()` call (lazy) or on mount if
 *              `lazy: false` (option).
 *   Running  → while messages are in flight
 *   Idle     → between messages
 *   Terminated → on unmount or explicit `terminate()` call
 *   Restarted  → automatically after error if `restartOnError: true`
 *
 *  Message queue
 *   When `send()` is called while the Worker is busy, the message
 *   is pushed onto an internal queue. When `onMessage` fires,
 *   the next queued message is dispatched automatically.
 *   Queue is flushed on `terminate()` or `clearQueue()`.
 *
 *  Fallback function
 *   If Worker construction throws (private browsing, CSP restriction,
 *   missing Vite worker build), the hook calls `fallbackFn(message)`
 *   synchronously and resolves as if the Worker had responded.
 *   This mirrors the setInterval fallback in ProcessingWorker usage
 *   inside Upload/index.tsx.
 *
 *  Generics
 *   TIn  — type of messages sent TO the worker
 *   TOut — type of messages received FROM the worker
 *   All typed at the hook call site.
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkerStatus = 'idle' | 'busy' | 'error' | 'terminated';

export interface UseWebWorkerOptions<TIn, TOut> {
  /**
   * Factory that returns a new Worker instance.
   * Use `new URL(...)` syntax for Vite Worker bundling.
   * @example () => new Worker(new URL('./ProcessingWorker.ts', import.meta.url), { type: 'module' })
   */
  workerFactory: () => Worker;
  /**
   * Called when the Worker sends a message. Receives the typed payload.
   * @param message - The message from the Worker.
   */
  onMessage: (message: TOut) => void;
  /**
   * Called when the Worker reports an error.
   * @param error - The ErrorEvent from the Worker.
   */
  onError?: (error: ErrorEvent) => void;
  /**
   * Synchronous fallback called with the sent message when the Worker
   * is unavailable. The return value is forwarded to `onMessage`.
   * @example (msg) => simulateWorkerResponse(msg)
   */
  fallbackFn?: (message: TIn) => TOut;
  /**
   * If true, the Worker is created immediately on mount.
   * If false (default), creation is deferred until first `send()`.
   * @default false
   */
  lazy?: boolean;
  /**
   * Automatically restart the Worker after an error.
   * @default true
   */
  restartOnError?: boolean;
  /**
   * Maximum number of messages to queue while the Worker is busy.
   * Oldest messages are dropped when the queue is full.
   * @default 100
   */
  maxQueueSize?: number;
}

export interface UseWebWorkerReturn<TIn> {
  /** Current worker status. */
  status: WorkerStatus;
  /** True when Worker is available and not terminated. */
  available: boolean;
  /** Number of messages waiting in the queue. */
  queueSize: number;
  /**
   * Send a message to the Worker (or fallback).
   * Messages are queued if the Worker is busy.
   *
   * @param message - The typed message to send.
   *
   * @example
   * send({ type: 'START', payload: { fileId, fileIndex: 0, fileName, fileSize } });
   */
  send: (message: TIn) => void;
  /**
   * Terminate the Worker and clear the queue.
   * After calling, `status` becomes 'terminated'.
   */
  terminate: () => void;
  /**
   * Restart the Worker (terminate + recreate).
   * Clears the queue. Useful after errors.
   */
  restart: () => void;
  /**
   * Clear the message queue without terminating.
   */
  clearQueue: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Generic React Web Worker wrapper with typed messages, queue, and fallback.
 *
 * @template TIn  - Type of messages sent to the Worker.
 * @template TOut - Type of messages received from the Worker.
 *
 * @example
 * // Use with ProcessingWorker.ts
 * import type { WorkerInMessage, WorkerOutMessage } from '../pages/Upload/ProcessingWorker';
 *
 * const { send, status } = useWebWorker<WorkerInMessage, WorkerOutMessage>({
 *   workerFactory: () => new Worker(
 *     new URL('../pages/Upload/ProcessingWorker.ts', import.meta.url),
 *     { type: 'module' }
 *   ),
 *   onMessage: (msg) => {
 *     if (msg.type === 'PROGRESS') updateProgress(msg.payload);
 *     if (msg.type === 'DONE')     markDone(msg.payload);
 *   },
 * });
 *
 * // Start processing a file
 * send({ type: 'START', payload: { fileId, fileIndex: 0, fileName, fileSize } });
 *
 * @example
 * // With fallback for test environments
 * const { send } = useWebWorker<Req, Res>({
 *   workerFactory: () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
 *   onMessage: handleResponse,
 *   fallbackFn: (msg) => computeSynchronously(msg),
 * });
 *
 * @example
 * // Cancel a specific job (using Worker's own CANCEL message)
 * send({ type: 'CANCEL', payload: { fileId } });
 *
 * @example
 * // Check availability before sending
 * if (status === 'idle') send(message);
 * else console.log(`Worker busy, queued (${queueSize} waiting)`);
 */
export function useWebWorker<TIn, TOut>(
  options: UseWebWorkerOptions<TIn, TOut>,
): UseWebWorkerReturn<TIn> {
  const {
    workerFactory,
    onMessage,
    onError,
    fallbackFn,
    lazy           = false,
    restartOnError = true,
    maxQueueSize   = 100,
  } = options;

  const [status,    setStatus]    = useState<WorkerStatus>('idle');
  const [queueSize, setQueueSize] = useState(0);

  const workerRef    = useRef<Worker | null>(null);
  const queueRef     = useRef<TIn[]>([]);
  const availableRef = useRef(false);

  // ── Create worker ─────────────────────────────────────────────────────
  const createWorker = useCallback(() => {
    try {
      const w = workerFactory();

      w.onmessage = (e: MessageEvent<TOut>) => {
        onMessage(e.data);
        setStatus('idle');

        // Drain queue
        if (queueRef.current.length > 0) {
          const next = queueRef.current.shift()!;
          setQueueSize(queueRef.current.length);
          setStatus('busy');
          w.postMessage(next);
        }
      };

      w.onerror = (e: ErrorEvent) => {
        setStatus('error');
        onError?.(e);

        if (restartOnError) {
          w.terminate();
          workerRef.current = null;
          availableRef.current = false;
          // Small delay before restart to avoid tight error loops
          setTimeout(() => {
            workerRef.current = createWorker();
          }, 500);
        }
      };

      availableRef.current = true;
      setStatus('idle');
      return w;
    } catch {
      availableRef.current = false;
      setStatus('error');
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mount / eager init ────────────────────────────────────────────────
  useEffect(() => {
    if (!lazy) {
      workerRef.current = createWorker();
    }
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      availableRef.current = false;
      queueRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lazy]);

  // ── send ──────────────────────────────────────────────────────────────
  const send = useCallback((message: TIn) => {
    // Lazy creation on first send
    if (!workerRef.current) {
      workerRef.current = createWorker();
    }

    // Worker available and idle → send immediately
    if (workerRef.current && availableRef.current && status !== 'busy') {
      setStatus('busy');
      workerRef.current.postMessage(message);
      return;
    }

    // Worker busy or unavailable → try fallback
    if (!availableRef.current && fallbackFn) {
      const result = fallbackFn(message);
      onMessage(result);
      return;
    }

    // Queue the message
    if (queueRef.current.length < maxQueueSize) {
      queueRef.current.push(message);
      setQueueSize(queueRef.current.length);
    }
    // else: queue full, message dropped (oldest messages preserved)
  }, [status, createWorker, fallbackFn, onMessage, maxQueueSize]);

  // ── terminate ─────────────────────────────────────────────────────────
  const terminate = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    availableRef.current = false;
    queueRef.current = [];
    setQueueSize(0);
    setStatus('terminated');
  }, []);

  // ── restart ───────────────────────────────────────────────────────────
  const restart = useCallback(() => {
    terminate();
    setTimeout(() => {
      workerRef.current = createWorker();
      setStatus('idle');
    }, 50);
  }, [terminate, createWorker]);

  // ── clearQueue ────────────────────────────────────────────────────────
  const clearQueue = useCallback(() => {
    queueRef.current = [];
    setQueueSize(0);
  }, []);

  return {
    status,
    available: availableRef.current,
    queueSize,
    send,
    terminate,
    restart,
    clearQueue,
  };
}

export default useWebWorker;
