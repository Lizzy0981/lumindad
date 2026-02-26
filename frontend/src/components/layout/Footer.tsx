/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Layout · Footer
 *  src/components/layout/Footer.tsx
 *
 *  Anatomy (left → right across 3 columns)
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ © 2025 Elizabeth Díaz Familia · LumindAd Enterprise · …     │
 *   │                  [in] [⌥] [𝕏] [📷] [🌐]                    │
 *   │                                 🌱 Green AI · 11 langs · v1.0.0 │
 *   └──────────────────────────────────────────────────────────────┘
 *
 *  Social icon bounce animation
 *   Each icon uses the bounce-social keyframe from globals.css:
 *     0%,100% { transform: translateY(0); }
 *     50%     { transform: translateY(-10px); }
 *   Duration: 1.4s ease-in-out infinite.
 *
 *   Staggered delays (from LumindAd.jsx CSS classes .s1–.s5):
 *     .s1  → 0.00 s  (LinkedIn)
 *     .s2  → 0.18 s  (GitHub)
 *     .s3  → 0.36 s  (Twitter/X)
 *     .s4  → 0.54 s  (Instagram)
 *     .s5  → 0.72 s  (Portfolio)
 *
 *   The delays are applied as inline animationDelay to avoid a
 *   hard dependency on the global CSS class names (.s1–.s5),
 *   making the component self-contained and portable.
 *
 *  Social icon visual tokens (from LumindAd.jsx Footer)
 *   size          30 × 30 px
 *   borderRadius  8px
 *   background    `${color}15`  (colour at 8% opacity)
 *   border        `1px solid ${color}30`  (colour at 19% opacity)
 *   hover         scale(1.15) + stronger glow
 *
 *  prefers-reduced-motion
 *   The bounce animation is paused when the user has requested
 *   reduced motion — handled via the CSS class on the <li> element
 *   and overridden in globals.css with the media query.
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – <footer> is the correct HTML landmark for page footer content
 *   – Each social icon is a focusable <a> with aria-label
 *   – The bouncing animation is decorative — aria-hidden on the icon char
 *   – The icon list is a <ul> inside a <nav aria-label="Social media links">
 *   – Copyright text is inside a <small> element (semantic copyright)
 *
 *  Design tokens (from LumindAd.jsx Footer function)
 *   background     rgba(6, 4, 18, 0.97)
 *   border-top     1px solid rgba(124, 58, 237, 0.1)
 *   padding        16px 24px
 *   copyright text #2d2050
 *   accent purple  #7c3aed
 *   green badge    #10b981
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { type CSSProperties } from 'react';

// ─── Social links data ────────────────────────────────────────────────────────
// Mirrors the socials array in LumindAd.jsx Footer function exactly.

interface SocialLink {
  icon:    string;
  label:   string;
  color:   string;
  href:    string;
  /** animationDelay in seconds — replaces the .s1–.s5 CSS classes */
  delay:   number;
}

const SOCIAL_LINKS: readonly SocialLink[] = [
  {
    icon:  'in',
    label: 'LinkedIn',
    color: '#0077b5',
    href:  'https://linkedin.com/in/eli-familia/',
    delay: 0.00,
  },
  {
    icon:  '⌥',
    label: 'GitHub',
    color: '#a78bfa',
    href:  'https://github.com/Lizzy0981',
    delay: 0.18,
  },
  {
    icon:  '𝕏',
    label: 'Twitter / X',
    color: '#94a3b8',
    href:  'https://x.com/Lizzyfamilia',
    delay: 0.36,
  },
  {
    icon:  '📷',
    label: 'Instagram',
    color: '#e1306c',
    href:  'https://instagram.com/lizzy_familia',
    delay: 0.54,
  },
  {
    icon:  '🌐',
    label: 'Portfolio',
    color: '#06b6d4',
    href:  'https://lizzy0981.github.io',
    delay: 0.72,
  },
] as const;

// ─── Scoped keyframes ─────────────────────────────────────────────────────────
// Defined here as a fallback for environments where globals.css is not loaded.
// If globals.css already defines bounce-social, this declaration is harmless
// (identical keyframe names are de-duplicated by the browser).

const KEYFRAMES = `
  @keyframes lad-bounce-social {
    0%, 100% { transform: translateY(0);    }
    50%      { transform: translateY(-10px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .lad-social-icon { animation: none !important; }
  }
`;

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Single animated social icon button. */
function SocialIcon({ link }: { link: SocialLink }) {
  const iconStyle: CSSProperties = {
    width:          '30px',
    height:         '30px',
    borderRadius:   '8px',
    background:     `${link.color}15`,
    border:         `1px solid ${link.color}30`,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    color:           link.color,
    fontSize:       '13px',
    fontWeight:      800,
    textDecoration: 'none',
    fontFamily:    "'Outfit', system-ui, sans-serif",
    transition:    'transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
    // Bounce animation — staggered per icon
    animation:     `lad-bounce-social 1.4s ease-in-out ${link.delay}s infinite`,
  };

  return (
    <li style={{ listStyle: 'none' }}>
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={link.label}
        className="lad-social-icon"
        style={iconStyle}
        onMouseEnter={(e) => {
          Object.assign(e.currentTarget.style, {
            transform:  'scale(1.15)',
            boxShadow: `0 4px 12px ${link.color}40`,
            background: `${link.color}25`,
          });
        }}
        onMouseLeave={(e) => {
          Object.assign(e.currentTarget.style, {
            transform:  '',
            boxShadow:  '',
            background: `${link.color}15`,
          });
        }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = `0 0 0 3px rgba(124,58,237,0.5)`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = '';
        }}
      >
        <span aria-hidden="true">{link.icon}</span>
      </a>
    </li>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Application footer with animated social links, copyright, and meta badges.
 *
 * Rendered once inside AppLayout below the scrollable main content area.
 * Never used directly in page components.
 *
 * Social icons bounce with staggered animation delays (0s → 0.72s) that
 * create a cascading wave effect. The delay values are baked into each
 * icon's inline style rather than CSS classes (.s1–.s5) so the component
 * is fully self-contained with no global stylesheet dependency.
 *
 * @example
 * // AppLayout.tsx — only valid usage
 * <div style={{ display: 'flex', flexDirection: 'column' }}>
 *   <main style={{ flex: 1 }}>…page content…</main>
 *   <Footer />
 * </div>
 *
 * @example
 * // The custom event fired when a social link is clicked can be
 * // intercepted for analytics tracking at the AppLayout level:
 * window.addEventListener('click', (e) => {
 *   const link = (e.target as HTMLElement).closest('a[aria-label]');
 *   if (link) analytics.track('social_click', { platform: link.ariaLabel });
 * });
 */
export function Footer() {
  return (
    <>
      <style>{KEYFRAMES}</style>

      <footer
        style={{
          borderTop:      '1px solid rgba(124, 58, 237, 0.1)',
          padding:        '16px 24px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          background:     'rgba(6, 4, 18, 0.97)',
          flexShrink:      0,
          gap:            '16px',
          flexWrap:       'wrap',
        }}
      >
        {/* ── Left: copyright ──────────────────────────────────── */}
        <small
          style={{
            fontSize:   '11px',
            color:      '#2d2050',
            fontFamily:"'Outfit', system-ui, sans-serif",
            lineHeight:  1.5,
          }}
        >
          © 2025{' '}
          <span style={{ color: '#7c3aed', fontWeight: 600 }}>
            Elizabeth Díaz Familia
          </span>
          {' '}· LumindAd Enterprise · Python · TensorFlow · React · Green AI
        </small>

        {/* ── Centre: bouncing social icons ────────────────────── */}
        <nav aria-label="Social media links">
          <ul
            style={{
              display:    'flex',
              gap:        '10px',
              alignItems: 'center',
              padding:     0,
              margin:      0,
            }}
          >
            <li
              aria-hidden="true"
              style={{
                listStyle:     'none',
                fontSize:      '10px',
                color:         '#2d2050',
                marginRight:   '4px',
                fontFamily:  "'Outfit', system-ui, sans-serif",
                letterSpacing: '1px',
              }}
            >
              FIND ME:
            </li>
            {SOCIAL_LINKS.map((link) => (
              <SocialIcon key={link.label} link={link} />
            ))}
          </ul>
        </nav>

        {/* ── Right: meta badges ───────────────────────────────── */}
        <div
          style={{
            display:    'flex',
            gap:        '16px',
            fontSize:   '10px',
            color:      '#2d2050',
            alignItems: 'center',
            fontFamily:"'Outfit', system-ui, sans-serif",
            letterSpacing: '0.5px',
          }}
        >
          <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span aria-hidden="true">🌱</span> Green AI
          </span>
          <span>i18n 11 langs</span>
          <span>v1.0.0 Enterprise</span>
        </div>
      </footer>
    </>
  );
}

Footer.displayName = 'Footer';

export default Footer;
