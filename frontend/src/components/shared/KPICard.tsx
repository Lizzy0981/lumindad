/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Shared · KPICard
 *  src/components/shared/KPICard.tsx
 *
 *  Anatomy
 *   ┌────────────────────────────────────────┐ ← .card border-top: 2px solid {color}22
 *   │  [💰]                      ↑ 12.5%    │ ← icon box · tag-up / tag-down
 *   │                                        │
 *   │  TOTAL SPEND                           │ ← label (uppercase, slate-500)
 *   │  $48,290                               │ ← animated value (kpi-val, 28px/900)
 *   │                            ○ ghost     │ ← decorative circle (color 5% opacity)
 *   └────────────────────────────────────────┘
 *
 *  Used in
 *   DashboardPage — 4 KPIs: Total Spend · Impressions · Clicks · Conversions
 *     delays: 0 / 80 / 160 / 240 ms  (staggered float-in)
 *   BudgetPage    — 4 KPIs: Total Budget · Total Spent · Remaining · Budget Used
 *   AnalyticsPage — 4 KPIs: Total Impressions · CTR · Conversion Rate · CPC
 *
 *  useAnimatedValue hook
 *   Animates a numeric value from 0 to `target` over `duration` ms using
 *   a cubic ease-out curve: ease = 1 − (1 − progress)³
 *   This mirrors the exact easing used in LumindAd.jsx (line 146).
 *
 *   When `value` is a string (e.g. "7.32" for CTR), animation is skipped
 *   and the raw string is displayed — strings cannot be interpolated.
 *
 *  counter-up animation (globals.css → .kpi-val)
 *   @keyframes counter-up {
 *     from { opacity: 0; transform: translateY(8px); }
 *     to   { opacity: 1; transform: translateY(0);   }
 *   }
 *   Duration: 0.4s ease forwards
 *
 *  float-in entrance (globals.css → applied inline)
 *   @keyframes float-in {
 *     from { opacity: 0; transform: translateY(20px); }
 *     to   { opacity: 1; transform: translateY(0);    }
 *   }
 *   Duration: 0.5s ease · delay: {delay}ms · fill-mode: both
 *
 *  Delta tag tokens (from globals.css)
 *   .tag-up   bg rgba(16,185,129,.12) · color #10b981 · border rgba(16,185,129,.25)
 *   .tag-down bg rgba(239,68,68,.12)  · color #ef4444 · border rgba(239,68,68,.25)
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – role="region" + aria-label names the card for screen readers
 *   – The animated value has aria-live="polite" so its final value is
 *     announced after animation without interrupting ongoing speech
 *   – change delta has aria-label describing the direction and magnitude
 *   – Decorative ghost circle is aria-hidden
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import {
  useState,
  useEffect,
  type CSSProperties,
} from 'react';

// ─── useAnimatedValue ─────────────────────────────────────────────────────────

/**
 * Animates a number from 0 to `target` using a cubic ease-out curve.
 * Mirrors the useAnimatedValue hook in LumindAd.jsx (line 140) exactly.
 *
 * @param target   - Final numeric value to animate toward.
 * @param duration - Animation duration in milliseconds.
 * @default 1200
 *
 * @returns The current animated value (integer, rounded each frame).
 *
 * @example
 * const animated = useAnimatedValue(48290, 1200);
 * // Renders: 0 → 48,290 over 1.2 s with cubic ease-out
 */
export function useAnimatedValue(target: number, duration = 1200): number {
  const [val, setVal] = useState(0);

  useEffect(() => {
    let startTime:  number | null = null;
    let animFrame:  number;
    const startVal = 0;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;

      const elapsed  = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Cubic ease-out: starts fast, decelerates toward the end
      const ease = 1 - Math.pow(1 - progress, 3);

      setVal(Math.round(startVal + (target - startVal) * ease));

      if (progress < 1) {
        animFrame = requestAnimationFrame(step);
      }
    };

    animFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animFrame);
  }, [target, duration]);

  return val;
}

// ─── Scoped keyframes ─────────────────────────────────────────────────────────

const KEYFRAMES = `
  @keyframes lad-counter-up {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0);   }
  }
  @keyframes lad-float-in {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @media (prefers-reduced-motion: reduce) {
    .lad-kpi-val  { animation: none !important; opacity: 1 !important; }
    .lad-kpi-card { animation: none !important; opacity: 1 !important; }
  }
`;

// ─── Public API ───────────────────────────────────────────────────────────────

export interface KPICardProps {
  /** Card heading — displayed uppercase in muted slate. */
  title: string;
  /**
   * Metric value. Pass a `number` to enable the animated counter.
   * Pass a `string` (e.g. "7.32") for pre-formatted values that cannot
   * be interpolated (percentages, currency strings).
   */
  value: number | string;
  /**
   * Symbol prepended to the value (e.g. "$").
   * @default ""
   */
  prefix?: string;
  /**
   * Symbol appended to the value (e.g. "%", "x").
   * @default ""
   */
  suffix?: string;
  /**
   * Period-over-period change expressed as a percentage.
   * Positive → green tag-up arrow. Negative → red tag-down arrow.
   * Omit to hide the delta tag.
   *
   * @example 12.5   → "↑ 12.5%"
   * @example -5.2   → "↓ 5.2%"
   */
  change?: number;
  /**
   * Emoji or icon character rendered inside the coloured icon box.
   * @example "💰" | "👁" | "⚡" | "🎯"
   */
  icon: string;
  /**
   * Accent colour applied to the icon box background, the top border
   * strip, and the decorative ghost circle.
   * @example "#7c3aed" | "#06b6d4" | "#10b981" | "#f59e0b"
   */
  color: string;
  /**
   * Entrance animation delay in milliseconds. Staggers the float-in
   * across a row of KPI cards so they cascade rather than appear all at once.
   * @default 0
   *
   * @example
   * // 4-card row with 80 ms stagger (matches DashboardPage)
   * <KPICard delay={0}   … />
   * <KPICard delay={80}  … />
   * <KPICard delay={160} … />
   * <KPICard delay={240} … />
   */
  delay?: number;
  /**
   * Counter animation duration in milliseconds.
   * @default 1200
   */
  duration?: number;
}

// ─── Delta tag ────────────────────────────────────────────────────────────────

/**
 * Renders the change delta as a green ↑ or red ↓ tag.
 * Sourced from .tag-up / .tag-down in globals.css.
 */
function DeltaTag({ change }: { change: number }) {
  const positive = change >= 0;

  const style: CSSProperties = positive
    ? {
        background: 'rgba(16, 185, 129, 0.12)',
        color:      '#10b981',
        border:     '1px solid rgba(16, 185, 129, 0.25)',
      }
    : {
        background: 'rgba(239, 68, 68, 0.12)',
        color:      '#ef4444',
        border:     '1px solid rgba(239, 68, 68, 0.25)',
      };

  return (
    <span
      aria-label={`${positive ? 'Up' : 'Down'} ${Math.abs(change)} percent`}
      style={{
        ...style,
        display:       'inline-flex',
        alignItems:    'center',
        gap:           '4px',
        padding:       '3px 10px',
        borderRadius:  '20px',
        fontSize:      '11px',
        fontWeight:     600,
        letterSpacing: '0.4px',
        fontFamily:   "'Outfit', system-ui, sans-serif",
        flexShrink:    0,
      }}
    >
      {positive ? '↑' : '↓'} {Math.abs(change)}%
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Animated KPI metric card used in Dashboard, Budget, and Analytics pages.
 *
 * Numeric values count up from 0 to the target using a cubic ease-out
 * curve over 1200 ms. String values (CTR, CPC) are displayed immediately.
 *
 * @example
 * // Dashboard — 4-card staggered row (matches LumindAd.jsx exactly)
 * <KPICard title="Total Spend"  value={48290}  prefix="$"  change={12.5} icon="💰" color="#7c3aed" delay={0}   />
 * <KPICard title="Impressions"  value={531200}             change={8.3}  icon="👁"  color="#06b6d4" delay={80}  />
 * <KPICard title="Clicks"       value={38940}              change={15.2} icon="⚡"  color="#a855f7" delay={160} />
 * <KPICard title="Conversions"  value={2847}               change={22.1} icon="🎯" color="#f59e0b" delay={240} />
 *
 * @example
 * // Analytics — string value for pre-formatted metric
 * <KPICard title="Click-Through Rate" value="7.32" suffix="%" change={12.3} icon="🎯" color="#a855f7" />
 *
 * @example
 * // No change delta (Remaining budget)
 * <KPICard title="Remaining" value={10153} prefix="$" icon="🏦" color="#06b6d4" />
 */
export function KPICard({
  title,
  value,
  prefix   = '',
  suffix   = '',
  change,
  icon,
  color,
  delay    = 0,
  duration = 1200,
}: KPICardProps) {
  const isNumeric = typeof value === 'number';
  const animated  = useAnimatedValue(isNumeric ? value : 0, duration);

  const displayValue = isNumeric
    ? animated.toLocaleString()
    : String(value);

  return (
    <>
      <style>{KEYFRAMES}</style>

      <article
        role="region"
        aria-label={title}
        className="lad-kpi-card"
        style={{
          // .card tokens from LumindAd.jsx
          background:      'rgba(15, 10, 30, 0.85)',
          border:          '1px solid rgba(124, 58, 237, 0.15)',
          borderRadius:    '16px',
          backdropFilter:  'blur(12px)',
          // Accent strip on top — color at ~13% opacity
          borderTop:       `2px solid ${color}22`,
          padding:         '22px',
          position:        'relative',
          overflow:        'hidden',
          // float-in entrance — staggered by delay
          animation:       `lad-float-in 0.5s ease ${delay}ms both`,
          transition:      'border-color 0.25s, transform 0.25s',
        }}
        onMouseEnter={(e) => {
          Object.assign(e.currentTarget.style, {
            borderColor: 'rgba(124, 58, 237, 0.4)',
            transform:   'translateY(-2px)',
          });
        }}
        onMouseLeave={(e) => {
          Object.assign(e.currentTarget.style, {
            borderColor: 'rgba(124, 58, 237, 0.15)',
            transform:   '',
          });
        }}
      >
        {/* ── Decorative ghost circle ──────────────────────────── */}
        <div
          aria-hidden="true"
          style={{
            position:     'absolute',
            top:          '-20px',
            right:        '-20px',
            width:        '80px',
            height:       '80px',
            borderRadius: '50%',
            background:   `${color}0d`,   // color at 5% opacity
            pointerEvents:'none',
          }}
        />

        {/* ── Icon + delta row ─────────────────────────────────── */}
        <div
          style={{
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'flex-start',
            marginBottom:   '16px',
          }}
        >
          {/* Icon box */}
          <div
            aria-hidden="true"
            style={{
              width:          '44px',
              height:         '44px',
              borderRadius:   '12px',
              background:     `${color}20`,   // color at 12.5% opacity
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              fontSize:       '20px',
              flexShrink:      0,
            }}
          >
            {icon}
          </div>

          {/* Delta tag */}
          {change !== undefined && <DeltaTag change={change} />}
        </div>

        {/* ── Label ────────────────────────────────────────────── */}
        <div
          style={{
            color:         '#64748b',
            fontSize:      '12px',
            fontWeight:     500,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            marginBottom:  '6px',
            fontFamily:   "'Outfit', system-ui, sans-serif",
          }}
        >
          {title}
        </div>

        {/* ── Animated value ───────────────────────────────────── */}
        <div
          className="lad-kpi-val"
          aria-live="polite"
          aria-atomic="true"
          style={{
            animation:    'lad-counter-up 0.4s ease forwards',
            fontSize:     '28px',
            fontWeight:    800,
            color:        '#f0f0ff',
            letterSpacing:'-0.5px',
            lineHeight:    1,
            fontFamily:  "'Outfit', system-ui, sans-serif",
          }}
        >
          {prefix}{displayValue}{suffix}
        </div>
      </article>
    </>
  );
}

KPICard.displayName = 'KPICard';

export default KPICard;
