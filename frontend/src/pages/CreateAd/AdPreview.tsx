/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · CreateAd · AdPreview
 *  src/pages/CreateAd/AdPreview.tsx
 *
 *  Purpose
 *   Live Google Ads mock preview card. Mirrors the "Ad Preview"
 *   section from LumindAd.jsx CreateAdPage (lines 969–991) exactly.
 *   Updates in real time as the user types headline/body.
 *
 *  Anatomy
 *   ┌─────────────────────────────────────────────┐
 *   │  Ad Preview                          ← card title 700 14px #e8e8f8
 *   │  ┌──────────────────────────────────────┐   │
 *   │  │  Sponsored                           │   │  ← 10px #666
 *   │  │  Your Ad Headline Here               │   │  ← 700 14px #1a0dab
 *   │  │  Your ad body text will appear here. │   │  ← 12px #555 lh 1.5
 *   │  │  [ Learn More → ]                   │   │  ← #7c3aed pill
 *   │  └──────────────────────────────────────┘   │
 *   └─────────────────────────────────────────────┘
 *
 *  White-box tokens (LumindAd.jsx line 977)
 *   background    #fff
 *   borderRadius  10px
 *   padding       16px
 *   color         #111
 *
 *  Inner element tokens
 *   "Sponsored"  fontSize 10 · color #666 · marginBottom 4
 *   headline     fontWeight 700 · color #1a0dab · fontSize 14 · marginBottom 4
 *   body         fontSize 12 · color #555 · lineHeight 1.5
 *   CTA          marginTop 10 · padding '6px 14px' · background #7c3aed
 *                borderRadius 6 · fontSize 12 · color #fff
 *                display inline-block · cursor pointer
 *
 *  Placeholder text (when fields are empty, from LumindAd.jsx lines 982–983)
 *   headline placeholder: 'Your Ad Headline Here'
 *   body placeholder:     'Your ad body text will appear here. Make it compelling!'
 *
 *  Platform variants
 *   The preview box style adapts subtly per platform:
 *   Google Ads  — white box (default, matches prototype exactly)
 *   Meta Ads    — off-white #fafafa · rounded header strip
 *   TikTok      — dark #111 box · white text (dark-mode mock)
 *   LinkedIn    — white box · LinkedIn blue CTA (#0077b5)
 *   Twitter/X   — white box · black CTA (#000)
 *   All share the same headline/body/CTA structure.
 *   The Google Ads rendering is the primary "preview" the prototype shows.
 *
 *  Character count indicators
 *   Google Ads limits: headline 30 chars · description 90 chars
 *   Shown as a subtle counter below each field when content is present.
 *   Color: under limit → #10b981 · at limit → #f59e0b · over → #ef4444
 *   These limits are informational — no truncation applied in preview.
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – Outer card: role="region" aria-label="Ad preview"
 *   – White box: aria-live="polite" aria-atomic="true" (updates with typing)
 *   – Headline: aria-label="Preview headline"
 *   – Body:     aria-label="Preview body text"
 *   – CTA is role="button" aria-label="Learn More — ad call to action"
 *   – "Sponsored" label: aria-hidden (decorative, not real link)
 *   – char counters: aria-label="X of 30 characters used"
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ─── Types ────────────────────────────────────────────────────────────────────

type AdPlatform = 'Google Ads' | 'Meta Ads' | 'TikTok' | 'LinkedIn' | 'Twitter/X';

// ─── Platform variant configs ─────────────────────────────────────────────────

interface PlatformStyle {
  boxBg:       string;
  boxColor:    string;
  headlineColor: string;
  bodyColor:   string;
  ctaBg:       string;
  ctaColor:    string;
  sponsoredLabel: string;
  platformLabel:  string;
}

const PLATFORM_STYLES: Record<AdPlatform, PlatformStyle> = {
  'Google Ads': {
    boxBg:          '#fff',
    boxColor:       '#111',
    headlineColor:  '#1a0dab',   // Google Ads blue — exact from LumindAd.jsx line 980
    bodyColor:      '#555',
    ctaBg:          '#7c3aed',   // LumindAd brand (prototype) — line 986
    ctaColor:       '#fff',
    sponsoredLabel: 'Sponsored',
    platformLabel:  'google.com',
  },
  'Meta Ads': {
    boxBg:          '#fafafa',
    boxColor:       '#111',
    headlineColor:  '#1877f2',
    bodyColor:      '#444',
    ctaBg:          '#1877f2',
    ctaColor:       '#fff',
    sponsoredLabel: 'Sponsored',
    platformLabel:  'facebook.com',
  },
  'TikTok': {
    boxBg:          '#111',
    boxColor:       '#fff',
    headlineColor:  '#fff',
    bodyColor:      '#bbb',
    ctaBg:          '#ff0050',
    ctaColor:       '#fff',
    sponsoredLabel: 'Ad',
    platformLabel:  'tiktok.com',
  },
  'LinkedIn': {
    boxBg:          '#fff',
    boxColor:       '#111',
    headlineColor:  '#0077b5',
    bodyColor:      '#333',
    ctaBg:          '#0077b5',
    ctaColor:       '#fff',
    sponsoredLabel: 'Promoted',
    platformLabel:  'linkedin.com',
  },
  'Twitter/X': {
    boxBg:          '#fff',
    boxColor:       '#111',
    headlineColor:  '#000',
    bodyColor:      '#333',
    ctaBg:          '#000',
    ctaColor:       '#fff',
    sponsoredLabel: 'Ad',
    platformLabel:  'x.com',
  },
};

// ─── Character limits per platform ───────────────────────────────────────────

const CHAR_LIMITS: Record<AdPlatform, { headline: number; body: number }> = {
  'Google Ads': { headline: 30,  body: 90  },
  'Meta Ads':   { headline: 40,  body: 125 },
  'TikTok':     { headline: 100, body: 150 },
  'LinkedIn':   { headline: 70,  body: 150 },
  'Twitter/X':  { headline: 70,  body: 280 },
};

// ─── Shared tokens ────────────────────────────────────────────────────────────

const F = "'Outfit', system-ui, sans-serif";

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Character counter badge shown under headline/body fields in the preview */
function CharCounter({
  current,
  max,
  label,
}: {
  current: number;
  max:     number;
  label:   string;
}) {
  if (current === 0) return null;
  const color =
    current > max     ? '#ef4444' :
    current > max * 0.9 ? '#f59e0b' :
    '#10b981';

  return (
    <div
      aria-label={`${current} of ${max} characters used for ${label}`}
      style={{
        fontSize:   '10px',
        color,
        marginTop:  '6px',
        textAlign:  'right',
        fontFamily:  F,
        fontWeight:  600,
        transition: 'color 0.2s ease',
      }}
    >
      {current}/{max}
    </div>
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface AdPreviewProps {
  headline?: string;
  body?:     string;
  platform?: AdPlatform;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Live Google Ads mock preview — matches LumindAd.jsx Ad Preview card exactly.
 * The Google Ads variant is the default (matching prototype). Platform prop
 * switches the colour palette while keeping the same structural tokens.
 *
 * @example
 * // CreateAd/index.tsx — primary usage
 * <AdPreview headline={headline} body={body} platform={platform} />
 *
 * @example
 * // Google Ads default (no platform prop needed)
 * <AdPreview headline="Boost Your Business" body="Precision targeting…" />
 *
 * @example
 * // Platform variant
 * <AdPreview headline={headline} body={body} platform="Meta Ads" />
 */
export function AdPreview({
  headline = '',
  body     = '',
  platform = 'Google Ads',
}: AdPreviewProps) {
  const ps     = PLATFORM_STYLES[platform] ?? PLATFORM_STYLES['Google Ads'];
  const limits = CHAR_LIMITS[platform]     ?? CHAR_LIMITS['Google Ads'];

  const displayHeadline = headline || 'Your Ad Headline Here';
  const displayBody     = body     || 'Your ad body text will appear here. Make it compelling!';

  return (
    <section
      role="region"
      aria-label={`${platform} ad preview`}
      style={{
        background:     'rgba(15, 10, 30, 0.85)',
        border:         '1px solid rgba(124, 58, 237, 0.15)',
        borderRadius:   '16px',
        backdropFilter: 'blur(12px)',
        padding:        '20px',
      }}
    >
      {/* ── Card title ──────────────────────────────────── */}
      {/* LumindAd.jsx line 970: fontWeight 700 fontSize 14 #e8e8f8 marginBottom 14 */}
      <div
        style={{
          fontWeight:   700,
          fontSize:     '14px',
          color:        '#e8e8f8',
          marginBottom: '14px',
          fontFamily:    F,
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'space-between',
        }}
      >
        Ad Preview
        {/* Platform pill */}
        <span
          style={{
            fontSize:     '10px',
            fontWeight:    600,
            color:        '#475569',
            background:   'rgba(124,58,237,0.08)',
            border:       '1px solid rgba(124,58,237,0.15)',
            borderRadius: '5px',
            padding:      '2px 8px',
            fontFamily:    F,
            letterSpacing:'0.3px',
          }}
        >
          {platform}
        </span>
      </div>

      {/* ── White ad box ────────────────────────────────── */}
      {/* LumindAd.jsx line 972: background #fff borderRadius 10 padding 16 color #111 */}
      <div
        aria-live="polite"
        aria-atomic="true"
        aria-label={`Ad preview content for ${platform}`}
        style={{
          background:   ps.boxBg,
          borderRadius: '10px',
          padding:      '16px',
          color:         ps.boxColor,
          boxShadow:    '0 2px 12px rgba(0,0,0,0.18)',
          transition:   'background 0.25s ease',
        }}
      >
        {/* "Sponsored" — fontSize 10 color #666 marginBottom 4 */}
        {/* LumindAd.jsx line 974 */}
        <div
          aria-hidden="true"
          style={{
            fontSize:     '10px',
            color:         ps.boxBg === '#111' ? '#888' : '#666',
            marginBottom: '4px',
            fontFamily:    F,
          }}
        >
          {ps.sponsoredLabel}
          <span
            style={{
              marginLeft:  '6px',
              fontSize:    '10px',
              color:        ps.boxBg === '#111' ? '#555' : '#999',
            }}
          >
            {ps.platformLabel}
          </span>
        </div>

        {/* Headline — fontWeight 700 color #1a0dab fontSize 14 marginBottom 4 */}
        {/* LumindAd.jsx line 975–977 */}
        <div
          aria-label="Preview headline"
          style={{
            fontWeight:   700,
            color:         ps.headlineColor,
            fontSize:     '14px',
            marginBottom: '4px',
            fontFamily:    F,
            lineHeight:    1.3,
            transition:   'color 0.2s ease',
            minHeight:    '20px',
            wordBreak:    'break-word',
          }}
        >
          {displayHeadline}
        </div>

        {/* Body — fontSize 12 color #555 lineHeight 1.5 */}
        {/* LumindAd.jsx line 978–980 */}
        <div
          aria-label="Preview body text"
          style={{
            fontSize:   '12px',
            color:       ps.bodyColor,
            lineHeight:  1.5,
            fontFamily:  F,
            wordBreak:  'break-word',
            transition: 'color 0.2s ease',
          }}
        >
          {displayBody}
        </div>

        {/* CTA button */}
        {/* LumindAd.jsx lines 981–987: marginTop 10 padding 6px 14px #7c3aed
            borderRadius 6 fontSize 12 color #fff inline-block cursor pointer */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Learn More — ad call to action"
          style={{
            marginTop:    '10px',
            padding:      '6px 14px',
            background:    ps.ctaBg,
            borderRadius: '6px',
            fontSize:     '12px',
            color:         ps.ctaColor,
            display:      'inline-block',
            cursor:       'pointer',
            fontFamily:    F,
            fontWeight:    600,
            userSelect:   'none',
            transition:   'opacity 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
          }}
        >
          Learn More →
        </div>
      </div>

      {/* ── Char counters ────────────────────────────────── */}
      <div style={{ marginTop: '10px' }}>
        <CharCounter current={headline.length} max={limits.headline} label="headline" />
        <CharCounter current={body.length}     max={limits.body}     label="body"     />
      </div>

      {/* ── Quality hint ─────────────────────────────────── */}
      {headline.length === 0 && body.length === 0 && (
        <div
          aria-live="polite"
          style={{
            marginTop:  '10px',
            fontSize:   '11px',
            color:      '#334155',
            fontFamily:  F,
            textAlign:  'center',
          }}
        >
          Start typing to see your ad come to life →
        </div>
      )}
    </section>
  );
}

AdPreview.displayName = 'AdPreview';
export default AdPreview;
