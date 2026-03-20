/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Layout · AppLayout
 *  src/components/layout/AppLayout.tsx
 *
 *  Purpose
 *   Root authenticated layout shell. Composes all persistent UI
 *   chrome — Sidebar, TopBar, scrollable content area, Footer —
 *   around the React Router <Outlet /> where active pages render.
 *
 *  Visual structure
 *   ┌────────────┬──────────────────────────────────────────────┐
 *   │            │  TopBar (52px, sticky)                       │
 *   │            │  [Dashboard][Create Ad][Campaigns]…   AI ●  │
 *   │  Sidebar   ├──────────────────────────────────────────────┤
 *   │  (230px    │                                              │
 *   │   fixed)   │  <main> — scrollable page content            │
 *   │            │  background: radial-gradient purple          │
 *   │            │                                              │
 *   │            ├──────────────────────────────────────────────┤
 *   │            │  Footer (48px)                               │
 *   └────────────┴──────────────────────────────────────────────┘
 *
 *  TopBar anatomy
 *   Left  : Tab-style nav buttons, one per route. The active tab
 *           receives color:#a78bfa + borderBottom:2px solid #7c3aed.
 *           Implemented with NavLink so active state is URL-driven.
 *   Right : "AI Online" live indicator (green dot + text) · divider ·
 *           language badge "🌍 EN · 11 langs"
 *
 *  Scrollable content region
 *   The main area has flex:1 + overflowY:auto so it grows to fill
 *   the remaining viewport height between TopBar and Footer.
 *   The subtle radial-gradient background matches LumindAd.jsx:
 *     radial-gradient(ellipse at 20% 0%, rgba(124,58,237,.06) 0%, transparent 60%)
 *
 *  PageWrapper key strategy
 *   PageWrapper is keyed to the current pathname. This tells React
 *   to unmount and remount the wrapper on every navigation, which
 *   re-triggers the float-in entrance animation for every new page.
 *
 *  Skip link
 *   A visually hidden <a href="#main-content"> is the very first
 *   focusable element in the DOM. It becomes visible on keyboard
 *   focus and allows keyboard-only and screen reader users to bypass
 *   the Sidebar + TopBar navigation on every page load. The target
 *   id="main-content" lives on the <main> inside PageWrapper.
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – Skip-to-main-content link as first focusable element
 *   – <aside> landmark for Sidebar (see Sidebar.tsx)
 *   – TopBar tabs use NavLink (native <a>) for keyboard + SR support
 *   – <main id="main-content"> is the page landmark target
 *   – <footer> landmark wraps Footer
 *   – AI Online dot has role="status" + aria-live="polite"
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { type CSSProperties, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGS, changeLanguage } from '../../i18n';

import { Sidebar }     from './Sidebar';
import { Footer }      from './Footer';
import { PageWrapper } from './PageWrapper';

// ─── TopBar navigation map ────────────────────────────────────────────────────
// Mirrors the tab list in LumindAd.jsx root app shell.

interface TopBarTab {
  path:  string;
  label: string;
}

const TOP_TABS: readonly TopBarTab[] = [
  { path: '/dashboard', label: 'Dashboard'   },
  { path: '/create-ad', label: 'Create Ad'   },
  { path: '/campaigns', label: 'Campaigns'   },
  { path: '/budget',    label: 'Budget'      },
  { path: '/analytics', label: 'Analytics'   },
  { path: '/upload',    label: 'Upload Data' },
] as const;

// ─── Page title map ───────────────────────────────────────────────────────────
// Used to populate the aria-label on <PageWrapper> so screen readers
// announce the correct page name on navigation.

const PAGE_LABELS: Readonly<Record<string, string>> = {
  '/dashboard': 'Performance Dashboard',
  '/create-ad': 'Create Ad',
  '/campaigns': 'Campaigns',
  '/budget':    'Budget Management',
  '/analytics': 'Analytics & Reports',
  '/upload':    'Upload Data',
};

// ─── Design tokens ────────────────────────────────────────────────────────────

const TOPBAR_TAB_BASE: CSSProperties = {
  background:    'none',
  border:        'none',
  borderBottom:  '2px solid transparent',
  color:         '#334155',
  cursor:        'pointer',
  fontSize:      '13px',
  fontWeight:    600,
  padding:       '4px 10px',
  borderRadius:  '6px 6px 0 0',
  fontFamily:   "'Outfit', system-ui, sans-serif",
  textDecoration:'none',
  transition:    'color 0.15s ease',
  display:       'flex',
  alignItems:    'center',
  height:        '100%',
  whiteSpace:   'nowrap',
};

const TOPBAR_TAB_ACTIVE: CSSProperties = {
  color:        '#a78bfa',
  borderBottom: '2px solid #7c3aed',
};

// ─── Skip link ────────────────────────────────────────────────────────────────

const SKIP_LINK_STYLE: CSSProperties = {
  position:   'absolute',
  left:        '-9999px',
  top:         '0',
  zIndex:      9999,
  padding:    '8px 16px',
  background: '#7c3aed',
  color:      '#ffffff',
  fontSize:   '13px',
  fontWeight:  600,
  fontFamily:"'Outfit', system-ui, sans-serif",
  borderRadius:'0 0 8px 8px',
  textDecoration: 'none',
  transition: 'left 0s',
};

// ─── Language Selector ────────────────────────────────────────────────────────

function LanguageSelector() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = SUPPORTED_LANGS.find((l) => l.code === i18n.language) ?? SUPPORTED_LANGS[0];

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [open]);

  const handleSelectLanguage = async (code: string) => {
    try {
      await changeLanguage(code);
    } catch (err) {
      console.error('[i18n] Error changing language:', err);
    } finally {
      setOpen(false);
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Language: ${current.labelEn}. Click to change`}
        style={{
          background:   'rgba(124,58,237,0.08)',
          border:       '1px solid rgba(124,58,237,0.2)',
          borderRadius: '8px',
          padding:      '5px 12px',
          cursor:       'pointer',
          display:      'flex',
          alignItems:   'center',
          gap:          '6px',
          fontSize:     '12px',
          color:        '#a78bfa',
          fontFamily:  "'Outfit', system-ui, sans-serif",
          fontWeight:   600,
        }}
      >
        <span aria-hidden="true" style={{ fontSize: '16px' }}>{current.flag}</span>
        <span>{current.code.toUpperCase()}</span>
        <span aria-hidden="true" style={{ fontSize: '9px', opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select language"
          style={{
            position:           'absolute',
            right:               0,
            top:                'calc(100% + 6px)',
            background:         'rgba(8,6,18,0.98)',
            border:             '1px solid rgba(124,58,237,0.3)',
            borderRadius:       '14px',
            padding:            '8px',
            zIndex:              9999,
            display:            'grid',
            gridTemplateColumns:'1fr 1fr',
            gap:                '3px',
            minWidth:           '230px',
            backdropFilter:     'blur(20px)',
            boxShadow:          '0 24px 48px rgba(0,0,0,0.7)',
          }}
        >
          {SUPPORTED_LANGS.map((l) => {
            const isActive = l.code === i18n.language;
            return (
              <button
                key={l.code}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelectLanguage(l.code)}
                style={{
                  background:   isActive ? 'rgba(124,58,237,0.2)' : 'transparent',
                  border:       isActive ? '1px solid rgba(124,58,237,0.5)' : '1px solid transparent',
                  borderRadius: '9px',
                  padding:      '8px 10px',
                  cursor:       'pointer',
                  display:      'flex',
                  alignItems:   'center',
                  gap:          '8px',
                  fontFamily:  "'Outfit', system-ui, sans-serif",
                  transition:  'all 0.15s',
                  textAlign:   'left',
                  color:        'inherit',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(124,58,237,0.12)';
                    e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'transparent';
                  }
                }}
              >
                <span aria-hidden="true" style={{ fontSize: '18px' }}>{l.flag}</span>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: isActive ? '#a78bfa' : '#e8e8f8' }}>
                    {l.label}
                  </div>
                  <div style={{ fontSize: '10px', color: '#475569' }}>{l.labelEn}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Authenticated application shell. Consumed by App.tsx as a route element
 * that wraps all protected page routes via React Router's nested routing.
 *
 * @example
 * // App.tsx — correct usage as a layout route
 * <Route element={<AppLayout />}>
 *   <Route path="/dashboard" element={<DashboardPage />} />
 *   <Route path="/campaigns" element={<CampaignsPage />} />
 *   <Route path="/budget"    element={<BudgetPage />}    />
 *   <Route path="/analytics" element={<AnalyticsPage />} />
 *   <Route path="/upload"    element={<UploadPage />}    />
 *   <Route path="/create-ad" element={<CreateAdPage />}  />
 * </Route>
 *
 * @example
 * // Result DOM hierarchy on /dashboard
 * // <aside>          ← Sidebar (fixed, 230px)
 * // <header>         ← TopBar  (52px, sticky)
 * // <div>            ← scroll container + radial bg
 * //   <main>         ← PageWrapper (float-in animation, key=pathname)
 * //     <DashboardPage />   ← Outlet renders here
 * //   </main>
 * // </div>
 * // <footer>         ← Footer (bouncing social icons)
 *
 * Never import or use this component directly in page files.
 */
export default function AppLayout() {
  const { pathname } = useLocation();
  const pageLabel   = PAGE_LABELS[pathname] ?? 'LumindAd';

  return (
    <div
      style={{
        display:    'flex',
        height:     '100vh',
        background: '#060610',
        fontFamily:"'Outfit', system-ui, sans-serif",
        overflow:  'hidden',
      }}
    >
      {/* ── Skip to main content (keyboard accessibility) ──────── */}
      <a
        href="#main-content"
        style={SKIP_LINK_STYLE}
        onFocus={(e) => { e.currentTarget.style.left = '0'; }}
        onBlur={(e)  => { e.currentTarget.style.left = '-9999px'; }}
      >
        Skip to main content
      </a>

      {/* ── Sidebar — fixed left panel ───────────────────────────── */}
      <Sidebar />

      {/* ── Main column (marginLeft matches Sidebar width) ─────── */}
      <div
        style={{
          marginLeft:    '230px',
          flex:           1,
          display:       'flex',
          flexDirection: 'column',
          height:        '100vh',
          overflow:      'hidden',
          minWidth:       0,    // prevents flex overflow on narrow viewports
        }}
      >
        {/* ── TopBar ─────────────────────────────────────────────── */}
        <header
          style={{
            height:        '52px',
            borderBottom:  '1px solid rgba(124, 58, 237, 0.1)',
            background:    'rgba(6, 4, 18, 0.97)',
            display:       'flex',
            alignItems:    'center',
            padding:       '0 28px',
            gap:           '12px',
            flexShrink:     0,
            position:      'relative',
            zIndex:         10,
          }}
        >
          {/* Tab navigation */}
          <nav
            aria-label="Page navigation"
            style={{
              flex:       1,
              display:   'flex',
              gap:       '4px',
              height:    '100%',
              alignItems:'center',
              overflowX: 'auto',
              scrollbarWidth: 'none',
            }}
          >
            {TOP_TABS.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                style={({ isActive }) => ({
                  ...TOPBAR_TAB_BASE,
                  ...(isActive ? TOPBAR_TAB_ACTIVE : {}),
                })}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.style.borderBottom.includes('#7c3aed')) {
                    e.currentTarget.style.color = '#a78bfa';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!e.currentTarget.style.borderBottom.includes('#7c3aed')) {
                    e.currentTarget.style.color = '#334155';
                  }
                }}
                onFocus={(e) => {
                  e.currentTarget.style.outline = '2px solid rgba(124,58,237,0.5)';
                  e.currentTarget.style.outlineOffset = '2px';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.outline = '';
                }}
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>

          {/* Right indicators */}
          <div
            style={{
              display:    'flex',
              gap:        '8px',
              alignItems: 'center',
              flexShrink:  0,
            }}
          >
            {/* AI Engine status */}
            <div
              role="status"
              aria-live="polite"
              aria-label="AI Engine is online"
              style={{
                fontSize:   '11px',
                color:      '#10b981',
                display:    'flex',
                alignItems: 'center',
                gap:        '5px',
                fontFamily:"'Outfit', system-ui, sans-serif",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width:        '6px',
                  height:       '6px',
                  borderRadius: '50%',
                  background:   '#10b981',
                  display:      'inline-block',
                  flexShrink:    0,
                }}
              />
              AI Online
            </div>

            {/* Vertical divider */}
            <div
              aria-hidden="true"
              style={{
                width:      '1px',
                height:     '16px',
                background: 'rgba(124, 58, 237, 0.2)',
              }}
            />

            {/* Language selector */}
            <LanguageSelector />
          </div>
        </header>

        {/* ── Scrollable content + radial background ─────────────── */}
        <div
          style={{
            flex:       1,
            overflowY: 'auto',
            padding:   '28px',
            background:'radial-gradient(ellipse at 20% 0%, rgba(124,58,237,0.06) 0%, transparent 60%)',
            scrollbarWidth:  'thin',
            scrollbarColor:  '#4c1d95 #0c0c1a',
          }}
        >
          {/*
           * PageWrapper is keyed to pathname so React remounts it on
           * every navigation, re-triggering the float-in animation.
           */}
          <PageWrapper key={pathname} ariaLabel={pageLabel}>
            <Outlet />
          </PageWrapper>
        </div>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <Footer />
      </div>
    </div>
  );
}

AppLayout.displayName = 'AppLayout';
