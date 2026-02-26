/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Layout · Sidebar
 *  src/components/layout/Sidebar.tsx
 *
 *  Anatomy (top → bottom)
 *   ┌─────────────────────────────┐
 *   │  ✦ LumindAd  v1.0.0·ENTER  │  ← Logo + wordmark
 *   │  NAVIGATION                 │  ← Section label
 *   │  ⊞  Dashboard               │
 *   │  ✦  Create Ad               │  ← NavLink items
 *   │  ◎  Campaigns               │
 *   │  ◈  Budget                  │
 *   │  ◫  Analytics               │
 *   │  ⤒  Upload Data  [NEW]      │  ← Badge on new feature
 *   │                             │
 *   │  🤖 AI Engine  ●(live)      │  ← AI Engine badge
 *   │  🌱 Green AI · 0.003 gCO₂   │  ← Sustainability badge
 *   │                             │
 *   │  [E]  Elizabeth D.F.  ⌄     │  ← User profile (bottom)
 *   └─────────────────────────────┘
 *
 *  Navigation strategy
 *   React Router v6 NavLink is used instead of the prototype's
 *   useState(page) + setPage() approach. Benefits:
 *   – Real URLs (/dashboard, /campaigns…) appear in the address bar
 *   – Back / forward buttons work correctly
 *   – Deep links are shareable and bookmarkable
 *   – Active state is driven by URL match, not component state
 *
 *  Active nav item styling
 *   NavLink passes isActive to a className callback. When true,
 *   the item receives the "active" class which applies:
 *     background : linear-gradient(135deg, rgba(124,58,237,.25), rgba(91,33,182,.15))
 *     color      : #c4b5fd
 *     border     : 1px solid rgba(124,58,237,.3)
 *   This mirrors the .nav-item.active rule in LumindAd.jsx exactly.
 *
 *  Glow-pulse animation (AI Engine live dot)
 *   The green status dot on the AI Engine badge uses the glow-pulse
 *   keyframe defined in globals.css:
 *     0%,100% { box-shadow: 0 0 8px rgba(124,58,237,.4); }
 *     50%     { box-shadow: 0 0 24px rgba(124,58,237,.8); }
 *   Duration: 2s infinite.
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – <aside> is the correct landmark for complementary navigation
 *   – aria-label="Main navigation" identifies the landmark
 *   – <nav> wraps the NavLink list for screen reader navigation
 *   – aria-current="page" is applied automatically by NavLink
 *   – All decorative icons are aria-hidden
 *   – The glow-pulse dot has aria-label="AI Engine Online"
 *
 *  Design tokens (from LumindAd.jsx Sidebar)
 *   background     rgba(6, 4, 18, 0.97)
 *   border-right   1px solid rgba(124, 58, 237, 0.12)
 *   width          230px
 *   z-index        100
 *   logo bg        linear-gradient(135deg, #7c3aed, #5b21b6)
 *   logo shadow    0 4px 16px rgba(124, 58, 237, 0.5)
 *   nav-item hover rgba(124, 58, 237, 0.12)
 *   nav-item active gradient + border rgba(124,58,237,.3)
 *   section label  #3d3d60  · letter-spacing 1.5px
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { NavLink } from 'react-router-dom';
import { type CSSProperties } from 'react';

// ─── Navigation map ───────────────────────────────────────────────────────────
// Mirrors the nav array in LumindAd.jsx exactly.
// `badge` marks a feature as recently added (renders the cyan "NEW" chip).

interface NavItem {
  id:    string;
  path:  string;
  label: string;
  icon:  string;
  badge?: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard', path: '/dashboard', label: 'Dashboard',   icon: '⊞' },
  { id: 'create',    path: '/create-ad', label: 'Create Ad',   icon: '✦' },
  { id: 'campaigns', path: '/campaigns', label: 'Campaigns',   icon: '◎' },
  { id: 'budget',    path: '/budget',    label: 'Budget',      icon: '◈' },
  { id: 'analytics', path: '/analytics', label: 'Analytics',   icon: '◫' },
  { id: 'upload',    path: '/upload',    label: 'Upload Data', icon: '⤒', badge: 'NEW' },
] as const;

// ─── Design tokens ────────────────────────────────────────────────────────────

const NAV_ITEM_BASE: CSSProperties = {
  display:     'flex',
  alignItems:  'center',
  gap:         '10px',
  padding:     '11px 16px',
  borderRadius:'10px',
  cursor:      'pointer',
  transition:  'all 0.2s ease',
  fontSize:    '14px',
  fontWeight:  500,
  color:       '#94a3b8',
  textDecoration: 'none',
  border:      '1px solid transparent',
  fontFamily: "'Outfit', system-ui, sans-serif",
};

const NAV_ITEM_ACTIVE: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(91,33,182,0.15))',
  color:      '#c4b5fd',
  border:     '1px solid rgba(124, 58, 237, 0.3)',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Horizontal rule used between Sidebar sections. */
function SectionLabel({ children }: { children: string }) {
  return (
    <div
      aria-hidden="true"
      style={{
        fontSize:      '10px',
        color:         '#3d3d60',
        fontWeight:    700,
        letterSpacing: '1.5px',
        padding:       '0 10px',
        marginBottom:  '10px',
        fontFamily:   "'Outfit', system-ui, sans-serif",
      }}
    >
      {children}
    </div>
  );
}

/** Cyan "NEW" chip rendered on recently added nav items. */
function NewBadge({ label }: { label: string }) {
  return (
    <span
      style={{
        marginLeft:   'auto',
        background:   'rgba(6, 182, 212, 0.15)',
        color:        '#06b6d4',
        padding:      '2px 7px',
        borderRadius: '10px',
        fontSize:     '10px',
        fontWeight:   700,
        fontFamily:  "'Outfit', system-ui, sans-serif",
        letterSpacing:'0.3px',
      }}
    >
      {label}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Fixed left navigation panel for the LumindAd platform.
 *
 * Consumes no props — active route state is derived from the URL
 * via React Router's NavLink component. NavLink sets aria-current="page"
 * automatically on the active route, fulfilling the WCAG 2.1 AA
 * requirement for indicating the current page within a nav landmark.
 *
 * @example
 * // Rendered once inside AppLayout — never used directly in pages
 * <Sidebar />
 *
 * @example
 * // AppLayout.tsx — only valid usage
 * export default function AppLayout() {
 *   return (
 *     <div style={{ display: 'flex' }}>
 *       <Sidebar />
 *       <main style={{ marginLeft: 230 }}>…</main>
 *     </div>
 *   );
 * }
 */
export function Sidebar() {
  return (
    <aside
      aria-label="Main navigation"
      style={{
        width:           '230px',
        height:          '100vh',
        background:      'rgba(6, 4, 18, 0.97)',
        borderRight:     '1px solid rgba(124, 58, 237, 0.12)',
        display:         'flex',
        flexDirection:   'column',
        padding:         '20px 12px',
        position:        'fixed',
        left:             0,
        top:              0,
        zIndex:           100,
        overflowY:       'auto',
        scrollbarWidth:  'thin',
        scrollbarColor:  '#4c1d95 #0c0c1a',
      }}
    >
      {/* ── Logo + wordmark ──────────────────────────────────────── */}
      <div
        style={{
          display:     'flex',
          alignItems:  'center',
          gap:         '12px',
          padding:     '8px 10px',
          marginBottom:'28px',
        }}
      >
        {/* Brand mark */}
        <div
          aria-hidden="true"
          style={{
            width:          '38px',
            height:         '38px',
            borderRadius:   '11px',
            background:     'linear-gradient(135deg, #7c3aed, #5b21b6)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       '18px',
            boxShadow:      '0 4px 16px rgba(124, 58, 237, 0.5)',
            flexShrink:      0,
          }}
        >
          ✦
        </div>
        {/* Wordmark */}
        <div>
          <div
            style={{
              fontWeight:           800,
              fontSize:             '16px',
              letterSpacing:        '0.2px',
              background:           'linear-gradient(135deg, #c4b5fd, #7c3aed)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor:  'transparent',
              backgroundClip:       'text',
              fontFamily:          "'Outfit', system-ui, sans-serif",
            }}
          >
            LumindAd
          </div>
          <div
            style={{
              fontSize:      '10px',
              color:         '#4c1d95',
              fontWeight:    500,
              letterSpacing: '0.5px',
              fontFamily:   "'Outfit', system-ui, sans-serif",
            }}
          >
            v1.0.0 · ENTERPRISE
          </div>
        </div>
      </div>

      {/* ── Navigation ───────────────────────────────────────────── */}
      <SectionLabel>NAVIGATION</SectionLabel>

      <nav>
        <ul
          style={{
            display:       'flex',
            flexDirection: 'column',
            gap:           '3px',
            listStyle:     'none',
            padding:        0,
            margin:         0,
          }}
        >
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <NavLink
                to={item.path}
                style={({ isActive }) => ({
                  ...NAV_ITEM_BASE,
                  ...(isActive ? NAV_ITEM_ACTIVE : {}),
                })}
                onMouseEnter={(e) => {
                  // Only apply hover style when the item is not active
                  const el = e.currentTarget;
                  if (!el.style.background.includes('linear-gradient')) {
                    el.style.background = 'rgba(124, 58, 237, 0.12)';
                    el.style.color      = '#a78bfa';
                  }
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  if (!el.style.background.includes('linear-gradient')) {
                    el.style.background = 'transparent';
                    el.style.color      = '#94a3b8';
                  }
                }}
              >
                {/* Icon */}
                <span
                  aria-hidden="true"
                  style={{ fontSize: '16px', width: '20px', textAlign: 'center', flexShrink: 0 }}
                >
                  {item.icon}
                </span>

                {/* Label */}
                <span>{item.label}</span>

                {/* Optional "NEW" badge */}
                {item.badge && <NewBadge label={item.badge} />}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── AI Engine badge ──────────────────────────────────────── */}
      <div
        style={{
          margin:     '20px 4px 0',
          padding:    '14px',
          borderRadius:'12px',
          background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(6,182,212,0.08))',
          border:     '1px solid rgba(124, 58, 237, 0.2)',
        }}
      >
        <div
          style={{
            display:    'flex',
            alignItems: 'center',
            gap:        '8px',
            marginBottom:'8px',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: '16px' }}>🤖</span>
          <span
            style={{
              fontSize:   '12px',
              fontWeight:  700,
              color:      '#a78bfa',
              fontFamily:"'Outfit', system-ui, sans-serif",
            }}
          >
            AI Engine
          </span>
          {/* Live status dot */}
          <span
            role="status"
            aria-label="AI Engine online"
            style={{
              marginLeft:   'auto',
              width:        '7px',
              height:       '7px',
              borderRadius: '50%',
              background:   '#10b981',
              display:      'inline-block',
              animation:    'glow-pulse 2s ease-in-out infinite',
            }}
          />
        </div>
        <div
          style={{
            fontSize:   '10px',
            color:      '#64748b',
            lineHeight:  1.5,
            fontFamily:"'Outfit', system-ui, sans-serif",
          }}
        >
          TensorFlow · XGBoost
          <br />
          SHAP · Anomaly Detection
        </div>
      </div>

      {/* ── Green AI badge ───────────────────────────────────────── */}
      <div
        style={{
          margin:      '12px 4px 16px',
          padding:     '12px',
          borderRadius:'12px',
          background:  'rgba(16, 185, 129, 0.06)',
          border:      '1px solid rgba(16, 185, 129, 0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span aria-hidden="true" style={{ fontSize: '14px' }}>🌱</span>
          <div>
            <div
              style={{
                fontSize:   '11px',
                fontWeight:  700,
                color:      '#10b981',
                fontFamily:"'Outfit', system-ui, sans-serif",
              }}
            >
              Green AI
            </div>
            <div
              style={{
                fontSize:   '9px',
                color:      '#047857',
                fontFamily:"'Outfit', system-ui, sans-serif",
                marginTop:  '2px',
              }}
            >
              0.003 gCO₂ · GHG Scope 2
            </div>
          </div>
        </div>
      </div>

      {/* ── User profile (pinned to bottom) ─────────────────────── */}
      <div
        style={{
          marginTop:    'auto',
          display:      'flex',
          alignItems:   'center',
          gap:          '10px',
          padding:      '12px',
          borderRadius: '12px',
          border:       '1px solid rgba(124, 58, 237, 0.1)',
          cursor:       'pointer',
          background:   'rgba(124, 58, 237, 0.05)',
          transition:   'all 0.2s ease',
        }}
        role="button"
        aria-label="User profile menu"
        tabIndex={0}
        onMouseEnter={(e) => {
          Object.assign(e.currentTarget.style, {
            background:   'rgba(124, 58, 237, 0.1)',
            borderColor:  'rgba(124, 58, 237, 0.25)',
          });
        }}
        onMouseLeave={(e) => {
          Object.assign(e.currentTarget.style, {
            background:   'rgba(124, 58, 237, 0.05)',
            borderColor:  'rgba(124, 58, 237, 0.1)',
          });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            // Profile menu will be wired when ProfileMenu component exists
          }
        }}
      >
        {/* Avatar initials */}
        <div
          aria-hidden="true"
          style={{
            width:          '34px',
            height:         '34px',
            borderRadius:   '10px',
            background:     'linear-gradient(135deg, #7c3aed, #5b21b6)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontWeight:      800,
            fontSize:       '13px',
            color:          '#fff',
            flexShrink:      0,
            fontFamily:    "'Outfit', system-ui, sans-serif",
          }}
        >
          E
        </div>
        {/* Name + role */}
        <div style={{ overflow: 'hidden' }}>
          <div
            style={{
              fontSize:     '13px',
              fontWeight:    600,
              color:        '#c4b5fd',
              fontFamily:  "'Outfit', system-ui, sans-serif",
              whiteSpace:  'nowrap',
              overflow:    'hidden',
              textOverflow:'ellipsis',
            }}
          >
            Elizabeth D.F.
          </div>
          <div
            style={{
              fontSize:   '10px',
              color:      '#4c1d95',
              fontFamily:"'Outfit', system-ui, sans-serif",
            }}
          >
            Sustainable AI
          </div>
        </div>
        {/* Chevron */}
        <span
          aria-hidden="true"
          style={{ marginLeft: 'auto', color: '#4c1d95', fontSize: '12px' }}
        >
          ⌄
        </span>
      </div>
    </aside>
  );
}

Sidebar.displayName = 'Sidebar';

export default Sidebar;
