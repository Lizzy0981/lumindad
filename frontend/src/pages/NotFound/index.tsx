/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Pages · 404 Not Found
 *  src/pages/NotFound/index.tsx
 *
 *  Route   *  (catch-all in App.tsx — rendered outside AppLayout)
 *
 *  Layout
 *   Full-viewport centred column — no Sidebar, no TopBar.
 *   The 404 page owns its entire layout so broken routes don't
 *   show a half-rendered shell with a missing page body.
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │                                                         │
 *   │               🔍  404                                   │
 *   │         Page not found                                  │
 *   │   The page you're looking for doesn't exist.            │
 *   │                                                         │
 *   │              [ ← Back to Dashboard ]                   │
 *   │                                                         │
 *   └─────────────────────────────────────────────────────────┘
 *
 *  Design tokens
 *   Matches LumindAd.jsx visual language exactly:
 *   background  #060610  (deep navy — same as app root)
 *   card bg     rgba(15,10,30,0.85)
 *   card border 1px solid rgba(124,58,237,0.15)
 *   headline    #e8e8f8  · 48px / 700 (display size)
 *   subhead     #a78bfa  · 18px / 600
 *   body        #64748b  · 14px / 400
 *   CTA button  linear-gradient(135deg, #7c3aed, #5b21b6) — btn-primary
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – <main> landmark wraps the entire content
 *   – Heading hierarchy: h1 (404) → p (description)
 *   – CTA link uses <a> not <button> — navigates to /dashboard
 *   – No focus-trap needed (not a modal)
 *   – Document title updated via App.tsx PageTitleManager ("404 — Not Found")
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { useNavigate } from 'react-router-dom';

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Full-page 404 Not Found — catch-all route rendered outside AppLayout.
 *
 * @example
 * // App.tsx — placed outside the AppLayout shell
 * <Route path="*" element={<NotFoundPage />} />
 */
export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main
      style={{
        minHeight:      '100vh',
        background:     '#060610',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '24px',
        fontFamily:    "'Outfit', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          background:     'rgba(15, 10, 30, 0.85)',
          border:         '1px solid rgba(124, 58, 237, 0.15)',
          borderRadius:   '20px',
          backdropFilter: 'blur(12px)',
          padding:        '56px 48px',
          textAlign:      'center',
          maxWidth:       '480px',
          width:          '100%',
        }}
      >
        {/* Icon */}
        <div
          aria-hidden="true"
          style={{ fontSize: '56px', marginBottom: '16px', lineHeight: 1 }}
        >
          🔍
        </div>

        {/* 404 headline */}
        <h1
          style={{
            fontSize:     '72px',
            fontWeight:    800,
            color:        '#e8e8f8',
            margin:        0,
            lineHeight:    1,
            letterSpacing:'-2px',
            background:   'linear-gradient(135deg, #a78bfa, #7c3aed)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          404
        </h1>

        {/* Subheading */}
        <p
          style={{
            fontSize:     '18px',
            fontWeight:    600,
            color:        '#a78bfa',
            margin:       '12px 0 8px',
          }}
        >
          Page not found
        </p>

        {/* Body */}
        <p
          style={{
            fontSize:     '14px',
            color:        '#64748b',
            lineHeight:    1.6,
            margin:       '0 0 32px',
          }}
        >
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Head back to the dashboard to continue.
        </p>

        {/* CTA — btn-primary style from globals.css */}
        <button
          onClick={() => navigate('/dashboard', { replace: true })}
          style={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:          '8px',
            padding:      '12px 28px',
            background:  'linear-gradient(135deg, #7c3aed, #5b21b6)',
            border:       'none',
            borderRadius: '10px',
            color:        '#fff',
            fontSize:     '14px',
            fontWeight:    600,
            fontFamily:  "'Outfit', system-ui, sans-serif",
            letterSpacing:'0.3px',
            cursor:       'pointer',
            transition:  'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={(e) => {
            Object.assign(e.currentTarget.style, {
              transform:  'translateY(-2px)',
              boxShadow: '0 8px 24px rgba(124, 58, 237, 0.45)',
            });
          }}
          onMouseLeave={(e) => {
            Object.assign(e.currentTarget.style, {
              transform:  '',
              boxShadow: '',
            });
          }}
        >
          ← Back to Dashboard
        </button>
      </div>
    </main>
  );
}

NotFoundPage.displayName = 'NotFoundPage';
