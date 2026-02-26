/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Budget · BudgetByPlatform
 *  src/pages/Budget/BudgetByPlatform.tsx
 *
 *  Purpose
 *   Right column (300px) of the Budget page charts row. Contains
 *   two stacked cards:
 *
 *   1. "By Platform" card  — platform spend breakdown (top 4)
 *   2. "AI Recommendation" card — XGBoost reallocation suggestion
 *
 *  Anatomy
 *   ┌──────────────────────────────────────────┐
 *   │  By Platform                             │  ← card padding:20
 *   │  Google Ads  ················  $6,972    │
 *   │  ████████████████████████░░░░ (38% blue) │
 *   │  Meta Ads    ················  $5,321    │
 *   │  ███████████████████░░░░░░░░░ (29% blue) │
 *   │  TikTok      ················  $3,302    │
 *   │  ██████████████░░░░░░░░░░░░░░ (18% red)  │
 *   │  LinkedIn    ················  $1,835    │
 *   │  ████████░░░░░░░░░░░░░░░░░░░░ (10% blue) │
 *   └──────────────────────────────────────────┘
 *   ┌──────────────────────────────────────────┐
 *   │  🤖 AI Recommendation                    │  ← card gradient bg
 *   │  Reallocate $1,200 from Meta to          │
 *   │  Google Ads. XGBoost estimates +23% ROAS │
 *   │  [Apply Suggestion]                      │
 *   └──────────────────────────────────────────┘
 *
 *  By Platform row anatomy (from LumindAd.jsx lines 533–544)
 *   – Data source: platformData.slice(0,4) — first 4 platforms only
 *   – Dollar amount: Math.round(totalSpend * platform.value / 100)
 *     totalSpend = 18347 in prototype
 *   – Progress bar fill: p.color directly (each platform's own brand colour)
 *     ⚠️  NOT the standard #7c3aed→#06b6d4 gradient used elsewhere
 *     This is an intentional design choice — each bar is the platform's brand
 *   – Row margin: marginBottom 14px
 *   – Name row: space-between, fontSize 12, name slate-400, value #e8e8f8/700
 *   – Progress bar height: 4px (matches .progress-bar in globals.css)
 *
 *  AI Recommendation card tokens (from LumindAd.jsx lines 546–554)
 *   background linear-gradient(135deg, rgba(124,58,237,.1), rgba(16,185,129,.05))
 *   border     1px solid rgba(124,58,237,.2)
 *   padding    20px
 *   title      fontSize 14 · fontWeight 700 · color #a78bfa · marginBottom 10
 *   body       fontSize 12 · color #64748b · lineHeight 1.6
 *   $1,200     highlighted in #10b981 (green)
 *   +23% ROAS  highlighted in #f59e0b (amber)
 *   CTA button full-width · btn-primary style · fontSize 12 · marginTop 14
 *
 *  Applied state
 *   After clicking "Apply Suggestion" the button transitions to a
 *   green "✓ Applied" state and becomes disabled. Announced via
 *   aria-live="polite" on the button container.
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – By Platform card has role="region" + aria-label
 *   – Each platform row is a <li> within a <ul role="list">
 *   – Progress bars have role="progressbar" + aria-valuenow + aria-label
 *   – Dollar amounts are read as part of the list item label
 *   – AI card has role="region" + aria-label
 *   – Applied state change announced via aria-live
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { useState } from 'react';

// ─── Platform data type ───────────────────────────────────────────────────────
// Re-uses the same shape as the Dashboard's PlatformSplit
// but this component imports only the data it needs.

export interface PlatformSpendRecord {
  name:  string;
  value: number;   // percentage share (0–100)
  color: string;   // brand hex colour
}

/**
 * Default data — mirrors platformData in LumindAd.jsx (line 95).
 * Only the first 4 entries are shown (slice(0,4) in the JSX).
 */
export const PLATFORM_DATA_DEFAULT: PlatformSpendRecord[] = [
  { name: 'Google Ads', value: 38, color: '#4285f4' },
  { name: 'Meta Ads',   value: 29, color: '#1877f2' },
  { name: 'TikTok',     value: 18, color: '#ff0050' },
  { name: 'LinkedIn',   value: 10, color: '#0077b5' },
  { name: 'Twitter/X',  value:  5, color: '#1da1f2' },
];

// ─── Card shell token ─────────────────────────────────────────────────────────

const CARD_STYLE = {
  background:     'rgba(15, 10, 30, 0.85)',
  border:         '1px solid rgba(124, 58, 237, 0.15)',
  borderRadius:   '16px',
  backdropFilter: 'blur(12px)',
  transition:     'border-color 0.25s ease, transform 0.25s ease',
} as const;

// ─── Public API ───────────────────────────────────────────────────────────────

export interface BudgetByPlatformProps {
  /**
   * Full platform data array. Only the first 4 entries are rendered,
   * matching the `platformData.slice(0, 4)` in LumindAd.jsx.
   */
  platforms?: PlatformSpendRecord[];
  /**
   * Total spend used to compute per-platform dollar amounts.
   * Formula: Math.round(totalSpend × platform.value / 100)
   * Matches LumindAd.jsx line 538 where totalSpend = 18347.
   * @default 18347
   */
  totalSpend?: number;
  /**
   * Fired when the user clicks "Apply Suggestion" on the AI card.
   */
  onApplySuggestion?: () => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Single platform row: name + dollar amount + progress bar.
 * Progress fill uses p.color directly — each platform's own brand colour.
 * This differs from the standard gradient (#7c3aed → #06b6d4) used elsewhere.
 */
function PlatformRow({
  platform,
  spendAmount,
}: {
  platform:    PlatformSpendRecord;
  spendAmount: number;
}) {
  return (
    <li
      style={{ listStyle: 'none', marginBottom: '14px' }}
      aria-label={`${platform.name}: $${spendAmount.toLocaleString()} (${platform.value}%)`}
    >
      {/* Name + dollar row */}
      <div
        style={{
          display:        'flex',
          justifyContent: 'space-between',
          marginBottom:   '5px',
          fontSize:       '12px',
        }}
      >
        <span
          style={{
            color:      '#94a3b8',
            fontFamily:"'Outfit', system-ui, sans-serif",
          }}
        >
          {platform.name}
        </span>
        <span
          style={{
            fontWeight:  700,
            color:      '#e8e8f8',
            fontFamily:"'Outfit', system-ui, sans-serif",
          }}
        >
          ${spendAmount.toLocaleString()}
        </span>
      </div>

      {/* Progress bar — fill is platform.color (brand colour, NOT standard gradient) */}
      <div
        role="progressbar"
        aria-valuenow={platform.value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${platform.name} budget share: ${platform.value}%`}
        style={{
          height:       '4px',
          borderRadius: '2px',
          background:   '#1e1e35',
          overflow:     'hidden',
        }}
      >
        <div
          style={{
            height:      '100%',
            borderRadius:'2px',
            width:       `${platform.value}%`,
            // ⚠️ Platform brand colour — not the standard gradient
            // Matches JSX line 542: style={{width:`${p.value}%`,background:p.color}}
            background:   platform.color,
            transition:  'width 0.4s ease',
          }}
        />
      </div>
    </li>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Right column of the Budget page: platform spend breakdown + AI recommendation.
 *
 * @example
 * // Budget/index.tsx — default prototype data
 * <BudgetByPlatform />
 *
 * @example
 * // With real API data
 * <BudgetByPlatform
 *   platforms={apiResponse.platformBreakdown}
 *   totalSpend={apiResponse.totalSpent}
 *   onApplySuggestion={() => handleApplyAIRecommendation()}
 * />
 *
 * @example
 * // Isolating just the AI card for a different page context
 * <BudgetByPlatform
 *   platforms={[]}
 *   totalSpend={0}
 *   onApplySuggestion={handleApply}
 * />
 */
export function BudgetByPlatform({
  platforms          = PLATFORM_DATA_DEFAULT,
  totalSpend         = 18347,
  onApplySuggestion,
}: BudgetByPlatformProps) {
  const [applied, setApplied] = useState(false);

  const visiblePlatforms = platforms.slice(0, 4);   // mirrors .slice(0,4) in JSX

  const handleApply = () => {
    setApplied(true);
    onApplySuggestion?.();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Card 1: By Platform ────────────────────────────────── */}
      <section
        role="region"
        aria-label="Ad spend by platform"
        style={{ ...CARD_STYLE, padding: '20px' }}
        onMouseEnter={(e) => {
          Object.assign(e.currentTarget.style, {
            borderColor: 'rgba(124,58,237,0.4)',
            transform:   'translateY(-2px)',
          });
        }}
        onMouseLeave={(e) => {
          Object.assign(e.currentTarget.style, {
            borderColor: 'rgba(124,58,237,0.15)',
            transform:   '',
          });
        }}
      >
        <div
          style={{
            fontWeight:   700,
            fontSize:     '15px',
            marginBottom: '16px',
            color:        '#e8e8f8',
            fontFamily:  "'Outfit', system-ui, sans-serif",
          }}
        >
          By Platform
        </div>

        <ul
          role="list"
          aria-label="Platform spend breakdown"
          style={{ padding: 0, margin: 0 }}
        >
          {visiblePlatforms.map((p) => (
            <PlatformRow
              key={p.name}
              platform={p}
              spendAmount={Math.round(totalSpend * p.value / 100)}
            />
          ))}
        </ul>
      </section>

      {/* ── Card 2: AI Recommendation ──────────────────────────── */}
      {/* Background: linear-gradient(135deg, rgba(124,58,237,.1), rgba(16,185,129,.05)) */}
      {/* Matches LumindAd.jsx lines 546–554 exactly */}
      <section
        role="region"
        aria-label="AI budget recommendation"
        style={{
          ...CARD_STYLE,
          padding:    '20px',
          background: 'linear-gradient(135deg, rgba(124,58,237,0.10), rgba(16,185,129,0.05))',
          border:     '1px solid rgba(124, 58, 237, 0.2)',
        }}
      >
        {/* Title */}
        <div
          style={{
            fontSize:     '14px',
            fontWeight:    700,
            color:        '#a78bfa',
            marginBottom: '10px',
            fontFamily:  "'Outfit', system-ui, sans-serif",
          }}
        >
          🤖 AI Recommendation
        </div>

        {/* Body — $1,200 green · +23% ROAS amber */}
        <p
          style={{
            fontSize:   '12px',
            color:      '#64748b',
            lineHeight:  1.6,
            margin:      0,
            fontFamily:"'Outfit', system-ui, sans-serif",
          }}
        >
          Reallocate{' '}
          <strong style={{ color: '#10b981' }}>$1,200</strong>
          {' '}from Meta to Google Ads.
          Predictive model (XGBoost) estimates{' '}
          <strong style={{ color: '#f59e0b' }}>+23% ROAS</strong>{' '}
          improvement.
        </p>

        {/* Apply Suggestion CTA */}
        <div aria-live="polite" aria-atomic="true">
          <button
            onClick={applied ? undefined : handleApply}
            disabled={applied}
            style={{
              marginTop:    '14px',
              width:        '100%',
              padding:      '10px 22px',
              fontSize:     '12px',
              fontWeight:    600,
              letterSpacing:'0.3px',
              borderRadius: '10px',
              border:       'none',
              cursor:        applied ? 'default' : 'pointer',
              fontFamily:  "'Outfit', system-ui, sans-serif",
              background:    applied
                ? 'linear-gradient(135deg, #059669, #065f46)'
                : 'linear-gradient(135deg, #7c3aed, #5b21b6)',
              color:        '#fff',
              transition:   'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!applied) {
                Object.assign(e.currentTarget.style, {
                  transform:  'translateY(-2px)',
                  boxShadow: '0 8px 24px rgba(124,58,237,0.45)',
                });
              }
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, { transform: '', boxShadow: '' });
            }}
          >
            {applied ? '✓ Applied' : 'Apply Suggestion'}
          </button>
        </div>
      </section>
    </div>
  );
}

BudgetByPlatform.displayName = 'BudgetByPlatform';

export default BudgetByPlatform;
