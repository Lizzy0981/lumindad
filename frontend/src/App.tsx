/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Root Component & Application Router
 *  src/App.tsx
 *
 *  Route map
 *   /             → redirect (replace) → /dashboard
 *   /dashboard    → DashboardPage
 *   /campaigns    → CampaignsPage
 *   /budget       → BudgetPage
 *   /analytics    → AnalyticsPage
 *   /upload       → UploadPage
 *   /create-ad    → CreateAdPage
 *   *             → NotFoundPage  (catch-all 404)
 *
 *  Architecture decisions
 *   – Every page is lazy-loaded via React.lazy() + dynamic import().
 *     This splits the JS bundle at the route boundary so users only
 *     download the code for the page they are visiting.
 *   – AppLayout is NOT lazy-loaded. It renders immediately and
 *     provides the Sidebar + TopBar shell while the page chunk loads.
 *   – Suspense boundary wraps all routes. The PageLoader fallback
 *     renders the branded spinner only when a chunk is downloading.
 *   – ScrollToTop resets window scroll on every navigation so the
 *     user always starts at the top of a new page.
 *   – PageTitleManager keeps <title> in sync with the active route
 *     for both SEO and browser tab readability.
 *   – ErrorBoundary is the outermost wrapper; it catches any
 *     unhandled runtime error in the entire tree and renders a
 *     branded recovery UI instead of a blank screen.
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – Each page title update via PageTitleManager improves screen
 *     reader navigation by announcing the new page on route change
 *   – Focus management on navigation is handled by the browser's
 *     native BrowserRouter behaviour (history pushState)
 *   – AppLayout exposes a <main> landmark with id="main-content"
 *     so keyboard users can skip navigation via a skip link
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

// ─── Layout ───────────────────────────────────────────────────────────────────
// AppLayout is eagerly imported: it renders the persistent shell
// (Sidebar, TopBar, Footer) and must be ready before any page loads.
import AppLayout from './components/layout/AppLayout';

// ─── Shared components ────────────────────────────────────────────────────────
import PageLoader    from './components/shared/PageLoader';
import ErrorBoundary from './components/shared/ErrorBoundary';

// ─── Pages (lazy-loaded, each becomes its own JS chunk) ───────────────────────
// Naming the import() calls makes the chunk filenames readable in
// the build output (e.g. "Dashboard.[hash].js").
const DashboardPage = lazy(() => import(/* webpackChunkName: "Dashboard" */  './pages/Dashboard'));
const CampaignsPage = lazy(() => import(/* webpackChunkName: "Campaigns" */  './pages/Campaigns'));
const BudgetPage    = lazy(() => import(/* webpackChunkName: "Budget" */     './pages/Budget'));
const AnalyticsPage = lazy(() => import(/* webpackChunkName: "Analytics" */  './pages/Analytics'));
const UploadPage    = lazy(() => import(/* webpackChunkName: "Upload" */     './pages/Upload'));
const CreateAdPage  = lazy(() => import(/* webpackChunkName: "CreateAd" */   './pages/CreateAd'));
const NotFoundPage  = lazy(() => import(/* webpackChunkName: "NotFound" */   './pages/NotFound'));

// ─── Page title map ───────────────────────────────────────────────────────────
// Maps each pathname to a human-readable segment that is prepended to
// the site name in <title>. Kept outside the component to avoid re-creation
// on every render.
const PAGE_TITLES: Readonly<Record<string, string>> = {
  '/dashboard': 'Dashboard',
  '/campaigns': 'Campaigns',
  '/budget':    'Budget',
  '/analytics': 'Analytics',
  '/upload':    'Upload Data',
  '/create-ad': 'Create Ad',
};

// ─── Utility components ───────────────────────────────────────────────────────

/**
 * Resets the window scroll position to the top on every route change.
 * Without this, navigating from a long page leaves the scroll position
 * of the previous page — a common UX bug in single-page applications.
 *
 * Renders nothing; exists purely for its side-effect.
 */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}

/**
 * Keeps the document <title> synchronised with the active route.
 * Format: "{Page} · LumindAd Enterprise"
 *
 * Benefits:
 *   – Screen readers announce the new page title after navigation
 *   – Browser history shows meaningful labels (not just "LumindAd")
 *   – Search engine crawlers index individual pages correctly
 *
 * Renders nothing; exists purely for its side-effect.
 */
function PageTitleManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    const segment = PAGE_TITLES[pathname] ?? '404 — Not Found';
    document.title = `${segment} · LumindAd Enterprise`;
  }, [pathname]);

  return null;
}

// ─── Root component ───────────────────────────────────────────────────────────

/**
 * Application root — declares the full route tree and wraps it
 * in the error and loading boundaries.
 *
 * Consumed by main.tsx inside <BrowserRouter>.
 * Do not add BrowserRouter here; it lives in main.tsx so that
 * this component remains testable without a router wrapper.
 *
 * @example
 * // main.tsx
 * <BrowserRouter>
 *   <App />
 * </BrowserRouter>
 */
export default function App() {
  return (
    <ErrorBoundary>
      {/* Side-effect utilities — render null, run effects only */}
      <ScrollToTop />
      <PageTitleManager />

      {/*
       * Suspense boundary — PageLoader renders while any lazy chunk
       * is being downloaded. The 150 ms internal delay inside
       * PageLoader prevents a flash of the spinner on fast connections.
       */}
      <Suspense fallback={<PageLoader />}>
        <Routes>

          {/* ── Root redirect ──────────────────────────────────────── */}
          {/* "replace" prevents the redirect from polluting browser history */}
          <Route index element={<Navigate to="/dashboard" replace />} />

          {/*
           * ── Authenticated shell ───────────────────────────────────
           * AppLayout renders the persistent Sidebar, TopBar, and Footer.
           * The matched child page is injected via React Router's <Outlet />.
           * All routes that require the application shell are nested here.
           */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/budget"    element={<BudgetPage />}    />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/upload"    element={<UploadPage />}    />
            <Route path="/create-ad" element={<CreateAdPage />}  />
          </Route>

          {/* ── 404 catch-all ──────────────────────────────────────── */}
          {/* Rendered outside AppLayout so the 404 page has full control
              over its own layout (e.g. centred content, no sidebar). */}
          <Route path="*" element={<NotFoundPage />} />

        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
