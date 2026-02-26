/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Pages · Create New Ad
 *  src/pages/CreateAd/index.tsx
 *
 *  Route   /create-ad  (matched by App.tsx inside AppLayout)
 *
 *  Layout  (mirrors LumindAd.jsx lines 899–1017 exactly)
 *  ┌──────────────────────────────────────────────────────────┐
 *  │  Header — "Create New Ad"                                │
 *  │  [Preview] [✓ Save Draft]                                │
 *  ├──────────────────┬───────────────────────────────────────┤
 *  │  Form (1fr)      │  Right column (340px)                 │
 *  │                  │                                       │
 *  │  Campaign        │  AdPreview                            │
 *  │  Settings        │  (live mock, updates as user types)   │
 *  │  ─────────────── │  ──────────────────────────────────── │
 *  │  Ad Copy         │  AIOptimizationScore                  │
 *  │  [🤖 AI Gen]     │  (4 bars · reactive scores)           │
 *  │  ─────────────── │                                       │
 *  │  Budget &        │                                       │
 *  │  Schedule        │                                       │
 *  │  ─────────────── │                                       │
 *  │  [🚀 Launch]     │                                       │
 *  └──────────────────┴───────────────────────────────────────┘
 *
 *  Grid layout (LumindAd.jsx line 904)
 *   gridTemplateColumns: '1fr 340px'   gap: 20
 *
 *  Header actions (LumindAd.jsx lines 901–903)
 *   <button className="btn-secondary">Preview</button>
 *   <button className="btn-primary">✓ Save Draft</button>
 *
 *  State
 *   platform   'Google Ads' | 'Meta Ads' | 'TikTok' | 'LinkedIn' | 'Twitter/X'
 *   objective  'Conversions' | 'Awareness' | 'Traffic' | 'Leads' | 'App Installs'
 *   headline   string (empty until typed or AI-generated)
 *   body       string (empty until typed or AI-generated)
 *   aiSuggest  boolean — true while AI Generate timeout is pending
 *
 *  generateAI (LumindAd.jsx lines 893–897)
 *   setAiSuggest(true)
 *   setTimeout 800ms →
 *     setHeadline('Boost Your Business with Smart AI Advertising')
 *     setBody('Reach your ideal customers with precision targeting and
 *              real-time optimization. Powered by machine learning for maximum ROI.')
 *   setAiSuggest(false) after timeout
 *
 *  Card 1 — Campaign Settings (lines 908–928)
 *   Inner grid: 1fr 1fr  gap 14
 *   Select style: rgba(124,58,237,.08) bg · rgba(124,58,237,.2) border
 *                 borderRadius 10 · padding 10px 14px · #e8e8f8 · fontSize 13
 *   Platform opts: ['Google Ads','Meta Ads','TikTok','LinkedIn','Twitter/X']
 *   Objective opts: ['Conversions','Awareness','Traffic','Leads','App Installs']
 *
 *  Card 2 — Ad Copy (lines 930–960)
 *   "🤖 AI Generate" btn-primary fontSize 11 padding 7px 16px
 *   Input style: rgba(124,58,237,.08) bg · rgba(124,58,237,.2) border
 *                borderRadius 10 · padding 11px 14px · #e8e8f8 · fontSize 13
 *   Textarea: same + resize:vertical rows=4
 *   Placeholder when aiSuggest: 'Generating...' (both fields)
 *
 *  Card 3 — Budget & Schedule (lines 962–977)
 *   Inner grid: 1fr 1fr 1fr  gap 14
 *   Labels: ['Daily Budget ($)', 'Start Date', 'End Date']
 *   Types:  [i===0 ? 'number' : 'date']
 *
 *  Launch button (lines 979–981)
 *   className="btn-primary" · padding 14px · fontSize 14 · fontWeight 700
 *   '🚀 Launch Campaign'
 *
 *  Label style (all form labels, from lines 914,940,948,965)
 *   fontSize 12 · color #475569 · display block · marginBottom 6 · fontWeight 600
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – All <select> and <input>/<textarea> have associated <label htmlFor>
 *   – AI Generate button: aria-busy while aiSuggest is true
 *   – Campaign Settings fieldset uses role="group" + aria-labelledby
 *   – Budget section: date inputs have type="date" (native calendar)
 *   – Launch button: aria-label with current platform + objective
 *   – Preview/Save Draft: aria-label reflecting current ad state
 *   – Form uses noValidate (client UX only — server validates)
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { useState, useCallback, useId }  from 'react';
import { Header }              from '../../components/layout/Header';
import { AdPreview }           from './AdPreview';
import { AIOptimizationScore } from './AIOptimizationScore';

// ─── Constants (from LumindAd.jsx inline arrays) ──────────────────────────────

const PLATFORM_OPTIONS  = ['Google Ads', 'Meta Ads', 'TikTok', 'LinkedIn', 'Twitter/X'] as const;
const OBJECTIVE_OPTIONS = ['Conversions', 'Awareness', 'Traffic', 'Leads', 'App Installs'] as const;

type Platform  = typeof PLATFORM_OPTIONS[number];
type Objective = typeof OBJECTIVE_OPTIONS[number];

// ─── Shared style helpers ─────────────────────────────────────────────────────

const F = "'Outfit', system-ui, sans-serif";

/** Form input style (LumindAd.jsx lines 919–922, 941–944) */
const INPUT_STYLE: React.CSSProperties = {
  width:        '100%',
  background:   'rgba(124,58,237,0.08)',
  border:       '1px solid rgba(124,58,237,0.20)',
  borderRadius: '10px',
  padding:      '11px 14px',
  color:        '#e8e8f8',
  fontSize:     '13px',
  outline:      'none',
  fontFamily:    F,
  transition:   'border-color 0.15s ease',
  boxSizing:    'border-box',
};

/** Select style (LumindAd.jsx lines 917–921) */
const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  padding:       '10px 14px',
  cursor:       'pointer',
  appearance:   'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23a78bfa'/%3E%3C/svg%3E")`,
  backgroundRepeat:   'no-repeat',
  backgroundPosition: 'right 12px center',
  backgroundSize:     '10px 6px',
  paddingRight:       '30px',
};

/** Label style (LumindAd.jsx line 914 pattern) */
const LABEL_STYLE: React.CSSProperties = {
  fontSize:     '12px',
  color:        '#475569',
  display:      'block',
  marginBottom: '6px',
  fontWeight:    600,
  fontFamily:    F,
};

/** Card container */
const CARD: React.CSSProperties = {
  background:     'rgba(15, 10, 30, 0.85)',
  border:         '1px solid rgba(124, 58, 237, 0.15)',
  borderRadius:   '16px',
  backdropFilter: 'blur(12px)',
  padding:        '24px',
};

const CARD_SM: React.CSSProperties = { ...CARD, padding: '20px' };

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Create New Ad page — route /create-ad.
 *
 * @example
 * // React Router in App.tsx
 * <Route path="/create-ad" element={<CreateAdPage />} />
 *
 * @example
 * // generateAI flow (LumindAd.jsx lines 893–897):
 * // setAiSuggest(true) → setTimeout 800ms → setHeadline + setBody → setAiSuggest(false)
 * // Placeholder changes to 'Generating...' while pending
 *
 * @example
 * // Layout: grid '1fr 340px' gap:20 — form on left, preview+score on right
 */
export default function CreateAdPage() {
  const id = useId();

  // ── State (LumindAd.jsx lines 883–886) ────────────────────────────────────
  const [platform,  setPlatform]  = useState<Platform>('Google Ads');
  const [objective, setObjective] = useState<Objective>('Conversions');
  const [headline,  setHeadline]  = useState('');
  const [body,      setBody]      = useState('');
  const [aiSuggest, setAiSuggest] = useState(false);

  // Budget/Schedule — not in prototype state but needed for controlled inputs
  const [budget,    setBudget]    = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');

  // ── generateAI (LumindAd.jsx lines 889–897) ───────────────────────────────
  const generateAI = useCallback(() => {
    setAiSuggest(true);
    setTimeout(() => {
      setHeadline('Boost Your Business with Smart AI Advertising');
      setBody(
        'Reach your ideal customers with precision targeting and real-time optimization. Powered by machine learning for maximum ROI.',
      );
      setAiSuggest(false);
    }, 800);
  }, []);

  const handleFocusHighlight = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = 'rgba(124,58,237,0.55)';
  };
  const handleBlurReset = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = 'rgba(124,58,237,0.20)';
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page-enter">

      {/* ── Header ──────────────────────────────────────── */}
      {/* LumindAd.jsx lines 899–903 */}
      <Header
        title="Create New Ad"
        subtitle="AI-powered ad creation with automatic optimization"
        actions={[
          <button
            key="p"
            type="button"
            className="btn-secondary"
            aria-label="Preview ad in a new tab"
          >
            Preview
          </button>,
          <button
            key="s"
            type="button"
            className="btn-primary"
            aria-label="Save current ad as draft"
          >
            ✓ Save Draft
          </button>,
        ]}
      />

      {/* ── Main grid: 1fr 340px  gap:20 ──────────────── */}
      {/* LumindAd.jsx line 904 */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: '1fr 340px',
          gap:                 '20px',
          alignItems:          'start',
        }}
      >
        {/* ════════════════════════════════════════════════
            LEFT COLUMN — form cards
            ════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ── Card 1: Campaign Settings ─────────────────── */}
          {/* LumindAd.jsx lines 908–928 */}
          <div style={CARD}>
            <div
              id={`${id}-settings-title`}
              style={{
                fontWeight:   700,
                fontSize:     '15px',
                color:        '#e8e8f8',
                marginBottom: '16px',
                fontFamily:    F,
              }}
            >
              Campaign Settings
            </div>

            <div
              role="group"
              aria-labelledby={`${id}-settings-title`}
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}
            >
              {/* Platform */}
              <div>
                <label
                  htmlFor={`${id}-platform`}
                  style={LABEL_STYLE}
                >
                  Platform
                </label>
                <select
                  id={`${id}-platform`}
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as Platform)}
                  style={SELECT_STYLE}
                  onFocus={handleFocusHighlight}
                  onBlur={handleBlurReset}
                >
                  {PLATFORM_OPTIONS.map((o) => (
                    <option key={o} value={o} style={{ background: '#0f0f1a' }}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              {/* Objective */}
              <div>
                <label
                  htmlFor={`${id}-objective`}
                  style={LABEL_STYLE}
                >
                  Objective
                </label>
                <select
                  id={`${id}-objective`}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value as Objective)}
                  style={SELECT_STYLE}
                  onFocus={handleFocusHighlight}
                  onBlur={handleBlurReset}
                >
                  {OBJECTIVE_OPTIONS.map((o) => (
                    <option key={o} value={o} style={{ background: '#0f0f1a' }}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── Card 2: Ad Copy ───────────────────────────── */}
          {/* LumindAd.jsx lines 930–960 */}
          <div style={CARD}>
            {/* Header row: title + AI Generate btn */}
            <div
              style={{
                display:        'flex',
                justifyContent: 'space-between',
                alignItems:     'center',
                marginBottom:   '16px',
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize:   '15px',
                  color:      '#e8e8f8',
                  fontFamily:  F,
                }}
              >
                Ad Copy
              </div>

              {/* 🤖 AI Generate — btn-primary fontSize 11 padding 7px 16px */}
              {/* LumindAd.jsx line 935–936 */}
              <button
                type="button"
                className="btn-primary"
                onClick={generateAI}
                disabled={aiSuggest}
                aria-busy={aiSuggest}
                aria-label={aiSuggest ? 'Generating AI copy…' : 'Generate ad copy with AI'}
                style={{
                  fontSize:  '11px',
                  padding:   '7px 16px',
                  opacity:    aiSuggest ? 0.7 : 1,
                  cursor:     aiSuggest ? 'wait' : 'pointer',
                  transition:'opacity 0.2s ease',
                  fontFamily: F,
                }}
              >
                {aiSuggest ? '⟳ Generating…' : '🤖 AI Generate'}
              </button>
            </div>

            {/* Headline input */}
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor={`${id}-headline`} style={LABEL_STYLE}>
                Headline
              </label>
              <input
                id={`${id}-headline`}
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder={aiSuggest ? 'Generating...' : 'Enter your ad headline...'}
                aria-label="Ad headline"
                aria-describedby={`${id}-headline-hint`}
                style={INPUT_STYLE}
                onFocus={handleFocusHighlight}
                onBlur={handleBlurReset}
              />
              <span id={`${id}-headline-hint`} style={{ display: 'none' }}>
                Recommended 15–30 characters for Google Ads
              </span>
            </div>

            {/* Body textarea */}
            <div>
              <label htmlFor={`${id}-body`} style={LABEL_STYLE}>
                Body Text
              </label>
              <textarea
                id={`${id}-body`}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                placeholder={aiSuggest ? 'Generating...' : 'Enter your ad body text...'}
                aria-label="Ad body text"
                style={{
                  ...INPUT_STYLE,
                  resize:    'vertical',
                  minHeight: '80px',
                }}
                onFocus={handleFocusHighlight}
                onBlur={handleBlurReset}
              />
            </div>
          </div>

          {/* ── Card 3: Budget & Schedule ─────────────────── */}
          {/* LumindAd.jsx lines 962–977 */}
          <div style={CARD}>
            <div
              id={`${id}-budget-title`}
              style={{
                fontWeight:   700,
                fontSize:     '15px',
                color:        '#e8e8f8',
                marginBottom: '16px',
                fontFamily:    F,
              }}
            >
              Budget &amp; Schedule
            </div>

            <div
              role="group"
              aria-labelledby={`${id}-budget-title`}
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}
            >
              {/* Daily Budget */}
              <div>
                <label htmlFor={`${id}-budget`} style={LABEL_STYLE}>
                  Daily Budget ($)
                </label>
                <input
                  id={`${id}-budget`}
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  min={1}
                  step={1}
                  placeholder="e.g. 50"
                  aria-label="Daily budget in US dollars"
                  style={INPUT_STYLE}
                  onFocus={handleFocusHighlight}
                  onBlur={handleBlurReset}
                />
              </div>

              {/* Start Date */}
              <div>
                <label htmlFor={`${id}-start`} style={LABEL_STYLE}>
                  Start Date
                </label>
                <input
                  id={`${id}-start`}
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  aria-label="Campaign start date"
                  style={{
                    ...INPUT_STYLE,
                    colorScheme: 'dark',
                  }}
                  onFocus={handleFocusHighlight}
                  onBlur={handleBlurReset}
                />
              </div>

              {/* End Date */}
              <div>
                <label htmlFor={`${id}-end`} style={LABEL_STYLE}>
                  End Date
                </label>
                <input
                  id={`${id}-end`}
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  aria-label="Campaign end date"
                  min={startDate || undefined}
                  style={{
                    ...INPUT_STYLE,
                    colorScheme: 'dark',
                  }}
                  onFocus={handleFocusHighlight}
                  onBlur={handleBlurReset}
                />
              </div>
            </div>
          </div>

          {/* ── Launch Campaign button ────────────────────── */}
          {/* LumindAd.jsx lines 979–981: btn-primary padding 14 fontSize 14 fw 700 */}
          <button
            type="submit"
            className="btn-primary"
            aria-label={`Launch ${objective} campaign on ${platform}`}
            style={{
              padding:    '14px',
              fontSize:   '14px',
              fontWeight:  700,
              fontFamily:  F,
            }}
          >
            🚀 Launch Campaign
          </button>
        </div>

        {/* ════════════════════════════════════════════════
            RIGHT COLUMN — preview + score
            ════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '88px' }}>

          {/* Ad Preview */}
          <AdPreview
            headline={headline}
            body={body}
            platform={platform}
          />

          {/* AI Optimization Score */}
          <AIOptimizationScore
            headline={headline}
            body={body}
          />
        </div>
      </div>
    </div>
  );
}

CreateAdPage.displayName = 'CreateAdPage';
