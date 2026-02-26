/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Entry Point
 *  src/main.tsx
 *
 *  Responsibilities
 *   – Bootstraps the React 18 concurrent-mode root
 *   – Wraps the application in BrowserRouter for client-side routing
 *   – Imports i18n initialisation before any component renders
 *     so translations are ready on first paint
 *   – Imports the global stylesheet (fonts, CSS variables, resets)
 *   – Registers the PWA Service Worker after the page loads
 *   – Validates that the #root mount point exists and throws an
 *     actionable error if it is missing (faster debugging)
 *
 *  Render order (matters — do not reorder imports)
 *   1. i18n          — must run before React tree mounts
 *   2. globals.css   — establishes CSS variables used by all components
 *   3. ReactDOM      — mounts <App /> into #root
 *   4. registerSW()  — deferred to window "load" event inside the utility
 *
 *  StrictMode
 *   Enabled in every environment including production.
 *   Intentional: surfaces deprecated API usage and unexpected
 *   side-effects early, not only during development.
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// ─── i18n initialisation ──────────────────────────────────────────────────────
// Must be the first application import so the i18next instance is configured
// before any component that calls useTranslation() mounts.
import './i18n';

// ─── Global stylesheet ────────────────────────────────────────────────────────
// Establishes: CSS custom properties (design tokens), Outfit + DM Mono font
// imports, universal box-sizing reset, custom scrollbar, and keyframe
// animations shared across the entire platform.
import './styles/globals.css';

// ─── PWA Service Worker ───────────────────────────────────────────────────────
// Imported here so the registration side-effect is colocated with the entry
// point. The utility guards against non-production environments internally.
import { registerSW } from './utils/registerSW';

// ─── Mount point validation ───────────────────────────────────────────────────
// Fail loudly with a clear message rather than a cryptic React error if the
// HTML template is missing the root element.
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    '[LumindAd] Mount point not found.\n' +
    'Expected: <div id="root"></div> in index.html.\n' +
    'This error means the HTML template was modified or is missing.',
  );
}

// ─── React root ───────────────────────────────────────────────────────────────
// createRoot enables React 18 concurrent features:
//   – Automatic batching of state updates
//   – Suspense for data fetching and lazy loading
//   – useTransition / useDeferredValue for non-blocking UI updates
//
// BrowserRouter is placed here rather than inside App.tsx so that
// App stays testable without a router wrapper in unit tests.
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

// ─── Service Worker registration ──────────────────────────────────────────────
// Called after render so the SW registration never delays the initial paint.
// The utility attaches its own window "load" listener for further deferral.
// No-ops in development (import.meta.env.PROD guard is inside registerSW).
registerSW();
