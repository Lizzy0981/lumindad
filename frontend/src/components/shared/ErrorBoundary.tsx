/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Error Boundary
 *  src/components/shared/ErrorBoundary.tsx
 *
 *  Purpose
 *   Catches any unhandled JavaScript error thrown within the
 *   React component tree and renders a branded recovery UI
 *   instead of the default blank white screen.
 *
 *  Why a class component?
 *   React's error boundary API requires getDerivedStateFromError
 *   and componentDidCatch lifecycle methods, which are only
 *   available on class components. Functional components cannot
 *   be error boundaries (as of React 18).
 *
 *  Recovery behaviour
 *   – "Back to Dashboard" resets boundary state and navigates to
 *     /dashboard via window.location.href (full reload), ensuring
 *     any corrupted in-memory state is cleared completely.
 *   – "Reload page" performs a hard refresh — same as F5 — which
 *     forces the browser to re-execute the JS bundle from scratch.
 *   – Both actions are intentionally destructive: after an
 *     unhandled error the safest recovery is a clean slate.
 *
 *  Error reporting
 *   – In development: full error + component stack is printed to
 *     the console and exposed in a collapsible <details> panel.
 *   – In production: the technical details block is hidden from
 *     users. A TODO comment marks the integration point for an
 *     external error tracking service (Sentry, Datadog, etc.).
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – role="alert" announces the error to screen readers
 *     immediately on mount (assertive live region)
 *   – Recovery buttons are native <button> elements with
 *     descriptive labels — no custom roles needed
 *   – Focus is not forcibly moved on error; the last focused
 *     element retains focus or the browser's default applies
 *
 *  Visual tokens (matches LumindAd design system exactly)
 *   – Background   #060610              (body bg)
 *   – Logo bg      linear-gradient(135deg, #7c3aed, #5b21b6)
 *   – Error chip   rgba(220,38,38,0.12) / #fca5a5
 *   – Primary btn  linear-gradient(135deg, #7c3aed, #5b21b6)
 *   – Secondary btn transparent / border #2d2050 / color #a78bfa
 *   – Code block   rgba(15,10,30,0.8) / border rgba(124,58,237,0.15)
 *   – Mono font    'DM Mono' (matches DM Mono import in globals.css)
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import {
  Component,
  type ErrorInfo,
  type ReactNode,
  type CSSProperties,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  /** The component subtree to protect. Required. */
  children: ReactNode;
  /**
   * Optional custom fallback rendered instead of the default error UI.
   * Receives no props — if you need the error object, build a
   * dedicated error component and use it here.
   */
  fallback?: ReactNode;
}

interface State {
  hasError:  boolean;
  error:     Error | null;
  errorInfo: ErrorInfo | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Catches errors in the React component tree and renders a safe recovery UI.
 *
 * Place this component as high in the tree as possible — typically wrapping
 * the entire application in App.tsx — so no unhandled error reaches the user
 * as a blank screen.
 *
 * @example
 * // App.tsx — wraps the full application
 * <ErrorBoundary>
 *   <Suspense fallback={<PageLoader />}>
 *     <Routes>…</Routes>
 *   </Suspense>
 * </ErrorBoundary>
 *
 * @example
 * // Scoped to a single widget with a custom fallback
 * <ErrorBoundary fallback={<p>Chart unavailable</p>}>
 *   <AnalyticsChart />
 * </ErrorBoundary>
 */
export default class ErrorBoundary extends Component<Props, State> {
  static displayName = 'ErrorBoundary';

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError:  false,
      error:     null,
      errorInfo: null,
    };
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Static method called synchronously after an error is thrown.
   * Returns the state update that switches the boundary into error mode.
   * This is the only place where we can update state in response to an error
   * without triggering a second render cycle.
   */
  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  /**
   * Called after the error is captured and the boundary has re-rendered.
   * Use this for side-effects: logging, analytics, error reporting.
   */
  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Store the component stack for the dev panel
    this.setState({ errorInfo });

    // ── Development: full output in the browser console ──────────
    if (import.meta.env.DEV) {
      console.group('🔴 [LumindAd] Unhandled Error');
      console.error('Message:', error.message);
      console.error('Stack:\n',  error.stack);
      console.error('Component stack:\n', errorInfo.componentStack);
      console.groupEnd();
    }

    // ── Production: send to error tracking ───────────────────────
    // TODO: integrate your error tracking service here, e.g.:
    // Sentry.captureException(error, { extra: errorInfo });
    // logRocket.captureException(error);
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  /**
   * Resets boundary state and navigates to /dashboard.
   * Uses a full page reload (window.location.href) rather than
   * React Router's navigate() to guarantee a clean JS runtime state.
   */
  private handleGoToDashboard = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/dashboard';
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  override render(): ReactNode {
    // ── Happy path: render children normally ─────────────────────
    if (!this.state.hasError) return this.props.children;

    // ── Custom fallback provided by consumer ─────────────────────
    if (this.props.fallback) return this.props.fallback;

    // ── Default branded error UI ──────────────────────────────────
    const { error, errorInfo } = this.state;
    const isDev = import.meta.env.DEV;

    // Shared inline style helpers to keep the render readable
    const s = {
      page: {
        minHeight:      '100vh',
        background:     '#060610',
        display:        'flex',
        flexDirection:  'column' as const,
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '40px 24px',
        fontFamily:     "'Outfit', system-ui, sans-serif",
        gap:            '0',
      } as CSSProperties,

      logo: {
        width:          '56px',
        height:         '56px',
        borderRadius:   '14px',
        background:     'linear-gradient(135deg, #7c3aed, #5b21b6)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        fontSize:       '26px',
        boxShadow:      '0 0 24px rgba(124, 58, 237, 0.4)',
        marginBottom:   '24px',
        flexShrink:     0,
      } as CSSProperties,

      errorChip: {
        display:        'flex',
        alignItems:     'center',
        gap:            '8px',
        background:     'rgba(220, 38, 38, 0.12)',
        border:         '1px solid rgba(220, 38, 38, 0.3)',
        borderRadius:   '10px',
        padding:        '6px 14px',
        marginBottom:   '20px',
      } as CSSProperties,

      chipLabel: {
        fontSize:      '11px',
        color:         '#fca5a5',
        fontWeight:    600 as const,
        letterSpacing: '1px',
        textTransform: 'uppercase' as const,
      } as CSSProperties,

      title: {
        fontSize:    '28px',
        fontWeight:  800 as const,
        color:       '#e8e8f8',
        marginBottom:'8px',
        marginTop:   0,
        textAlign:   'center' as const,
      } as CSSProperties,

      subtitle: {
        fontSize:     '15px',
        color:        '#64748b',
        marginBottom: '32px',
        marginTop:    0,
        textAlign:    'center' as const,
        maxWidth:     '460px',
        lineHeight:   1.6,
      } as CSSProperties,

      actions: {
        display:      'flex',
        gap:          '12px',
        marginBottom: '40px',
        flexWrap:     'wrap' as const,
        justifyContent:'center',
      } as CSSProperties,

      btnPrimary: {
        background:    'linear-gradient(135deg, #7c3aed, #5b21b6)',
        border:        'none',
        color:         '#fff',
        padding:       '10px 24px',
        borderRadius:  '10px',
        fontFamily:    "'Outfit', sans-serif",
        fontWeight:    600 as const,
        fontSize:      '14px',
        cursor:        'pointer',
        letterSpacing: '0.3px',
        transition:    'transform 0.15s ease, box-shadow 0.15s ease',
      } as CSSProperties,

      btnSecondary: {
        background:    'transparent',
        border:        '1px solid #2d2050',
        color:         '#a78bfa',
        padding:       '10px 24px',
        borderRadius:  '10px',
        fontFamily:    "'Outfit', sans-serif",
        fontWeight:    600 as const,
        fontSize:      '14px',
        cursor:        'pointer',
        letterSpacing: '0.3px',
        transition:    'all 0.15s ease',
      } as CSSProperties,

      details: {
        maxWidth:    '640px',
        width:       '100%',
        background:  'rgba(15, 10, 30, 0.8)',
        border:      '1px solid rgba(124, 58, 237, 0.15)',
        borderRadius:'12px',
        padding:     '20px',
      } as CSSProperties,

      code: {
        fontFamily:  "'DM Mono', 'Courier New', monospace",
        fontSize:    '11px',
        color:       '#475569',
        whiteSpace:  'pre-wrap' as const,
        wordBreak:   'break-all' as const,
        lineHeight:  1.6,
        maxHeight:   '160px',
        overflowY:   'auto' as const,
        margin:      0,
      } as CSSProperties,
    };

    return (
      <div role="alert" style={s.page}>

        {/* Brand logo — decorative, aria-hidden */}
        <div style={s.logo} aria-hidden="true">✦</div>

        {/* Error type chip */}
        <div style={s.errorChip}>
          <span aria-hidden="true">⚠️</span>
          <span style={s.chipLabel}>Unexpected Error</span>
        </div>

        {/* Heading */}
        <h1 style={s.title}>Something went wrong</h1>

        {/* Description */}
        <p style={s.subtitle}>
          LumindAd encountered an unexpected error. Your data is safe.
          Use the buttons below to recover.
        </p>

        {/* Recovery actions */}
        <div style={s.actions}>
          <button
            style={s.btnPrimary}
            onClick={this.handleGoToDashboard}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, {
                transform:  'translateY(-2px)',
                boxShadow: '0 8px 24px rgba(124,58,237,0.45)',
              });
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, {
                transform:  '',
                boxShadow: '',
              });
            }}
          >
            ↩ Back to Dashboard
          </button>

          <button
            style={s.btnSecondary}
            onClick={() => window.location.reload()}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, {
                background:  '#1a0f3a',
                borderColor: '#7c3aed',
              });
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, {
                background:  'transparent',
                borderColor: '#2d2050',
              });
            }}
          >
            ↻ Reload page
          </button>
        </div>

        {/* ── Technical details — development only ──────────────── */}
        {isDev && error && (
          <details style={s.details}>
            <summary
              style={{
                cursor:        'pointer',
                fontSize:      '12px',
                color:         '#7c3aed',
                fontWeight:    600,
                letterSpacing: '0.5px',
                userSelect:    'none',
                marginBottom:  '12px',
                listStyle:     'none',
              }}
            >
              🔍 Technical details (visible in development only)
            </summary>

            {/* Error message */}
            <p style={{ fontFamily: "'DM Mono',monospace", fontSize: '11px',
              color: '#fca5a5', marginBottom: '12px', lineHeight: 1.6 }}>
              <strong style={{ color: '#f87171' }}>Error:</strong>{' '}
              {error.message}
            </p>

            {/* Stack trace */}
            {error.stack && (
              <>
                <p style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600,
                  marginBottom: '6px' }}>
                  Stack trace:
                </p>
                <pre style={s.code}>{error.stack}</pre>
              </>
            )}

            {/* Component stack */}
            {errorInfo?.componentStack && (
              <>
                <p style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600,
                  marginBottom: '6px', marginTop: '14px' }}>
                  Component stack:
                </p>
                <pre style={{ ...s.code, maxHeight: '120px' }}>
                  {errorInfo.componentStack}
                </pre>
              </>
            )}
          </details>
        )}

        {/* Brand footer */}
        <p style={{ position: 'absolute', bottom: '24px', fontSize: '11px',
          color: '#2d2050', margin: 0 }}>
          LumindAd v1.0.0 · Enterprise Edition
        </p>
      </div>
    );
  }
}
