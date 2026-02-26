/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Page Loader
 *  src/components/shared/PageLoader.tsx
 *
 *  Purpose
 *   Branded full-screen loading state rendered as the <Suspense>
 *   fallback in App.tsx while lazy page chunks are downloading.
 *
 *  Design decisions
 *   – 150 ms visibility delay prevents a flash of the spinner
 *     when the chunk is already in the browser cache or on fast
 *     connections. The loader is invisible until delay elapses.
 *   – The ✦ sparkle icon is constructed as inline SVG paths
 *     using the same geometry as the brand icons in public/,
 *     ensuring visual consistency without an extra file import.
 *   – The outer container spins slowly (3 s per revolution) to
 *     indicate activity without the jarring speed of a typical
 *     loading spinner.
 *   – Three staggered dots (0 / 200 / 400 ms delay) provide a
 *     secondary activity signal that works even in reduced-motion
 *     environments where the spin animation may be paused.
 *   – All animations use CSS keyframes injected via a scoped
 *     <style> tag so no global stylesheet dependency is required.
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – role="status" announces the loading state to screen readers
 *     without assertively interrupting ongoing speech (unlike
 *     role="alert" which would be too disruptive)
 *   – aria-label provides a spoken description of the purpose
 *   – Decorative elements (sparkle, dots, rings) are aria-hidden
 *   – prefers-reduced-motion: animations respect user preference
 *     via the CSS media query inside the keyframe declarations
 *
 *  Visual tokens
 *   – Background   #060610  (body background from LumindAd.jsx)
 *   – Gradient     #7c3aed → #5b21b6  (.btn-primary / logo bg)
 *   – Glow shadow  rgba(124,58,237,0.45)  (logo glow in Sidebar)
 *   – Text purple  #c4b5fd → #7c3aed  (gradient-text class)
 *   – Label muted  #4c1d95  (v1.0.0 label in Sidebar)
 *   – Dot accent   #06b6d4  (cyan accent colour)
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { useState, useEffect, type CSSProperties } from 'react';

// ─── Keyframes ────────────────────────────────────────────────────────────────
// All scoped under the `lad-loader-` prefix to prevent any collision
// with third-party or global keyframe declarations.

const KEYFRAMES = `
  @keyframes lad-loader-fadein {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes lad-loader-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes lad-loader-pulse-ring {
    0%   { transform: scale(1);   opacity: 0.7; }
    100% { transform: scale(1.75); opacity: 0;  }
  }
  @keyframes lad-loader-dots {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
    40%           { transform: scale(1.0); opacity: 1.0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .lad-loader-spin-el  { animation: none !important; }
    .lad-loader-ring-el  { animation: none !important; }
    .lad-loader-dot-el   { animation: none !important; }
  }
`;

// ─── Sparkle icon ─────────────────────────────────────────────────────────────

/**
 * Renders the LumindAd ✦ brand mark as an inline SVG.
 * The 4-point star path matches the geometry used in public/icons/.
 *
 * @param size - Outer SVG dimensions in pixels.
 */
function SparkleIcon({ size }: { size: number }) {
  // Geometry constants
  const cx   = size / 2;
  const cy   = size / 2;
  const R    = size * 0.40;   // outer radius of the sparkle arms
  const r    = R * 0.13;      // inner radius (pinch between arms)
  const d45  = Math.SQRT2 / 2;

  // ✦ outer 4-point star path (8 vertices alternating R and r)
  const outer = [
    [cx,           cy - R],
    [cx + r * d45, cy - r * d45],
    [cx + R,       cy],
    [cx + r * d45, cy + r * d45],
    [cx,           cy + R],
    [cx - r * d45, cy + r * d45],
    [cx - R,       cy],
    [cx - r * d45, cy - r * d45],
  ];

  // Small inner sparkle (white highlight — creates depth)
  const R2   = R * 0.38;
  const r2   = R2 * 0.20;
  const inner = [
    [cx,            cy - R2],
    [cx + r2 * d45, cy - r2 * d45],
    [cx + R2,       cy],
    [cx + r2 * d45, cy + r2 * d45],
    [cx,            cy + R2],
    [cx - r2 * d45, cy + r2 * d45],
    [cx - R2,       cy],
    [cx - r2 * d45, cy - r2 * d45],
  ];

  const toPath = (pts: number[][]) =>
    `M ${pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' L ')} Z`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lad-loader-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#c4b5fd" />
          <stop offset="45%"  stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      {/* Outer sparkle — brand gradient */}
      <path d={toPath(outer)} fill="url(#lad-loader-grad)" />
      {/* Inner sparkle — white highlight */}
      <path d={toPath(inner)} fill="#ffffff" fillOpacity={0.92} />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Full-screen branded loading overlay used as the React Suspense fallback.
 *
 * The component is intentionally simple and has zero dependencies on
 * application state, routing, or the design system — it must render
 * correctly even before those systems have initialised.
 *
 * @example
 * // App.tsx — used as the Suspense fallback
 * <Suspense fallback={<PageLoader />}>
 *   <Routes>…</Routes>
 * </Suspense>
 */
export default function PageLoader() {
  // ── Visibility delay ─────────────────────────────────────────────
  // Start hidden, become visible after 150 ms.
  // Prevents a flash of the spinner on fast connections where the
  // chunk is served from cache and Suspense resolves near-instantly.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  // ── Styles ───────────────────────────────────────────────────────
  const containerStyle: CSSProperties = {
    position:        'fixed',
    inset:           0,
    display:         'flex',
    flexDirection:   'column',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             '24px',
    background:      '#060610',
    zIndex:          9999,
    animation:       'lad-loader-fadein 0.25s ease forwards',
  };

  const logoWrapStyle: CSSProperties = {
    position: 'relative',
    width:    '72px',
    height:   '72px',
  };

  const pulseRingStyle: CSSProperties = {
    position:     'absolute',
    inset:        '-8px',
    borderRadius: '50%',
    border:       '2px solid #7c3aed',
    animation:    'lad-loader-pulse-ring 1.6s ease-out infinite',
  };

  const logoBoxStyle: CSSProperties = {
    width:          '72px',
    height:         '72px',
    borderRadius:   '18px',
    background:     'linear-gradient(135deg, #7c3aed, #5b21b6)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    boxShadow:      '0 0 32px rgba(124, 58, 237, 0.45)',
    animation:      'lad-loader-spin 3s linear infinite',
  };

  return (
    <>
      <style>{KEYFRAMES}</style>

      <div
        role="status"
        aria-label="Loading LumindAd — please wait"
        style={containerStyle}
      >
        {/* ── Brand mark ──────────────────────────────────────── */}
        <div style={logoWrapStyle}>
          {/* Pulse ring — visual activity signal */}
          <div
            className="lad-loader-ring-el"
            aria-hidden="true"
            style={pulseRingStyle}
          />
          {/* Spinning logo box */}
          <div
            className="lad-loader-spin-el"
            aria-hidden="true"
            style={logoBoxStyle}
          >
            <SparkleIcon size={40} />
          </div>
        </div>

        {/* ── App name ─────────────────────────────────────────── */}
        <div style={{ textAlign: 'center' }} aria-hidden="true">
          <div
            style={{
              fontFamily:           "'Outfit', system-ui, sans-serif",
              fontWeight:            800,
              fontSize:             '22px',
              letterSpacing:        '0.5px',
              background:           'linear-gradient(135deg, #c4b5fd, #7c3aed)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor:  'transparent',
              backgroundClip:       'text',
            }}
          >
            LumindAd
          </div>
          <div
            style={{
              fontFamily:    "'Outfit', system-ui, sans-serif",
              fontSize:      '10px',
              color:         '#4c1d95',
              fontWeight:    500,
              letterSpacing: '1.5px',
              marginTop:     '4px',
            }}
          >
            v1.0.0 · ENTERPRISE
          </div>
        </div>

        {/* ── Loading dots ─────────────────────────────────────── */}
        <div
          style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
          aria-hidden="true"
        >
          {([0, 1, 2] as const).map((i) => (
            <div
              key={i}
              className="lad-loader-dot-el"
              style={{
                width:        '8px',
                height:       '8px',
                borderRadius: '50%',
                background:   i === 1 ? '#06b6d4' : '#7c3aed',
                animation:    `lad-loader-dots 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>

        {/* ── Status text ──────────────────────────────────────── */}
        {/* Visible to sighted users; the role="status" above handles SR */}
        <div
          aria-hidden="true"
          style={{
            fontFamily:    "'Outfit', system-ui, sans-serif",
            fontSize:      '11px',
            color:         '#334155',
            letterSpacing: '0.5px',
          }}
        >
          Initializing AI Engine…
        </div>
      </div>
    </>
  );
}

PageLoader.displayName = 'PageLoader';
