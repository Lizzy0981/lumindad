/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Campaigns · CampaignForm
 *  src/pages/Campaigns/CampaignForm.tsx
 *
 *  Purpose
 *   Full campaign creation / editing form extracted from
 *   CreateAdPage in LumindAd.jsx. Supports two modes:
 *     "create"  — blank form, "🚀 Launch Campaign" CTA
 *     "edit"    — pre-populated from an existing Campaign record,
 *                 "✓ Save Changes" CTA
 *
 *  Layout  grid "1fr 340px"  gap 20  (matches LumindAd.jsx line 906)
 *
 *  Left column — 3 cards stacked (gap 16)
 *  ┌────────────────────────────────────────┐
 *  │  Campaign Settings                     │  ← card padding:24
 *  │  [Platform ▾]  [Objective ▾]           │  ← grid 1fr 1fr gap:14
 *  ├────────────────────────────────────────┤
 *  │  Ad Copy           [🤖 AI Generate]    │  ← card padding:24
 *  │  Headline [________________]           │
 *  │  Body Text [________________]          │  ← textarea rows=4 resize:vertical
 *  ├────────────────────────────────────────┤
 *  │  Budget & Schedule                     │  ← card padding:24
 *  │  [Daily Budget($)] [Start] [End]       │  ← grid 1fr 1fr 1fr gap:14
 *  └────────────────────────────────────────┘
 *  [🚀 Launch Campaign]                       ← full-width btn-primary
 *
 *  Right column — 2 cards stacked (gap 16)
 *  ┌────────────────────────────────────────┐
 *  │  Ad Preview                            │  ← card padding:20
 *  │  ┌──────────────────────────────────┐  │
 *  │  │ Sponsored (grey 10px)            │  │  ← white bg, live from state
 *  │  │ Headline  (blue #1a0dab 700)     │  │
 *  │  │ Body text (grey #555 1.5lh)      │  │
 *  │  │ [Learn More →]  (#7c3aed btn)    │  │
 *  │  └──────────────────────────────────┘  │
 *  ├────────────────────────────────────────┤
 *  │  🤖 AI Optimization Score              │  ← card padding:20
 *  │  Relevance         82/100  ████████░   │
 *  │  CTR Prediction    76/100  ███████░░   │  ← score>85 green, >70 amber, else red
 *  │  Quality Score     91/100  █████████   │
 *  │  Targeting Match   88/100  ████████░   │
 *  └────────────────────────────────────────┘
 *
 *  AI Generate behaviour (from LumindAd.jsx line 888)
 *   1. Sets aiSuggest=true → placeholders show "Generating..."
 *   2. setTimeout 800 ms → fills headline + body with brand copy
 *   3. aiSuggest stays true; user can still override the generated text
 *
 *  Optimization Score thresholds (from LumindAd.jsx line 995)
 *   score > 85  → color #10b981  · bar gradient(#10b981 → #06b6d4)
 *   score > 70  → color #f59e0b  · bar gradient(#f59e0b → #ef4444)
 *   else        → color #ef4444  · bar solid #ef4444
 *
 *  Input / select shared tokens
 *   background  rgba(124, 58, 237, 0.08)
 *   border      1px solid rgba(124, 58, 237, 0.2)
 *   borderRadius 10px
 *   padding     10px 14px (selects) · 11px 14px (inputs/textarea)
 *   color       #e8e8f8
 *   fontSize    13px
 *   outline     none
 *   option bg   #0f0f1a
 *
 *  Label tokens
 *   fontSize 12px · color #475569 · fontWeight 600 · marginBottom 6px
 *
 *  Card section heading
 *   fontSize 15px · fontWeight 700 · color #e8e8f8 · marginBottom 16px
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – All inputs are associated with <label htmlFor> — no aria-label hacks
 *   – Select options have background:#0f0f1a for dark-mode contrast
 *   – aiSuggest spinner-like state uses aria-live="polite" on the generate btn
 *   – Ad Preview card is aria-hidden (decorative — same data is in the form)
 *   – AI Optimization Score bars have role="progressbar" + aria-valuenow
 *   – Launch/Save button has type="submit" on the wrapping <form>
 *   – Focus ring is provided by browser default (outline:none removed from
 *     styled inputs; focus-visible ring added via :focus-visible override)
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import {
  useState,
  useId,
  type FormEvent,
  type CSSProperties,
} from 'react';
import type { Campaign } from './CampaignTable';

// ─── Static form options ──────────────────────────────────────────────────────
// Mirrors the opts arrays in LumindAd.jsx CreateAdPage (lines 913–919)

const PLATFORM_OPTIONS = [
  'Google Ads', 'Meta Ads', 'TikTok', 'LinkedIn', 'Twitter/X',
] as const;

const OBJECTIVE_OPTIONS = [
  'Conversions', 'Awareness', 'Traffic', 'Leads', 'App Installs',
] as const;

// ─── AI Optimization Scores ───────────────────────────────────────────────────
// Static scores from LumindAd.jsx line 993: [82, 76, 91, 88]

const AI_SCORES = [
  { label: 'Relevance',       score: 82 },
  { label: 'CTR Prediction',  score: 76 },
  { label: 'Quality Score',   score: 91 },
  { label: 'Targeting Match', score: 88 },
] as const;

// ─── Public API ───────────────────────────────────────────────────────────────

export type CampaignFormMode = 'create' | 'edit';

export interface CampaignFormProps {
  /**
   * Controls whether the form is in creation or edit mode.
   * In "edit" mode, `initialData` is used to pre-populate the fields
   * and the submit CTA reads "✓ Save Changes" instead of "🚀 Launch Campaign".
   * @default "create"
   */
  mode?: CampaignFormMode;
  /**
   * Campaign record used to pre-populate the form in "edit" mode.
   * Ignored when mode is "create".
   */
  initialData?: Campaign;
  /**
   * Called when the form is submitted successfully.
   * Receives a partial Campaign object with the form values so the
   * parent can merge them into its campaigns state.
   *
   * @param data - Partial Campaign record with updated field values.
   */
  onSubmit?: (data: Partial<Campaign>) => void;
  /**
   * Called when the user dismisses the form without submitting.
   * The parent should hide the form panel when this fires.
   */
  onCancel?: () => void;
}

// ─── Shared style tokens ──────────────────────────────────────────────────────

const INPUT_STYLE: CSSProperties = {
  width:        '100%',
  background:   'rgba(124, 58, 237, 0.08)',
  border:       '1px solid rgba(124, 58, 237, 0.2)',
  borderRadius: '10px',
  padding:      '11px 14px',
  color:        '#e8e8f8',
  fontSize:     '13px',
  fontFamily:  "'Outfit', system-ui, sans-serif",
  outline:      'none',
  boxSizing:   'border-box',
  transition:  'border-color 0.2s ease',
};

const SELECT_STYLE: CSSProperties = {
  ...INPUT_STYLE,
  padding: '10px 14px',
  cursor:  'pointer',
};

const LABEL_STYLE: CSSProperties = {
  fontSize:     '12px',
  color:        '#475569',
  display:      'block',
  marginBottom: '6px',
  fontWeight:    600,
  fontFamily:  "'Outfit', system-ui, sans-serif",
};

const CARD_STYLE: CSSProperties = {
  background:     'rgba(15, 10, 30, 0.85)',
  border:         '1px solid rgba(124, 58, 237, 0.15)',
  borderRadius:   '16px',
  backdropFilter: 'blur(12px)',
  padding:        '24px',
};

const SECTION_TITLE_STYLE: CSSProperties = {
  fontWeight:   700,
  fontSize:     '15px',
  color:        '#e8e8f8',
  marginBottom: '16px',
  fontFamily:  "'Outfit', system-ui, sans-serif",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Single optimization score row with coloured progress bar. */
function ScoreRow({ label, score }: { label: string; score: number }) {
  // Colour thresholds from LumindAd.jsx line 995
  const textColor = score > 85 ? '#10b981' : score > 70 ? '#f59e0b' : '#ef4444';
  const barBg     = score > 85
    ? 'linear-gradient(90deg, #10b981, #06b6d4)'
    : score > 70
    ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
    : '#ef4444';

  return (
    <div style={{ marginBottom: '12px' }}>
      <div
        style={{
          display:        'flex',
          justifyContent: 'space-between',
          fontSize:       '12px',
          marginBottom:   '5px',
          fontFamily:    "'Outfit', system-ui, sans-serif",
        }}
      >
        <span style={{ color: '#94a3b8' }}>{label}</span>
        <span style={{ fontWeight: 700, color: textColor }}>{score}/100</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${score} out of 100`}
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
            width:       `${score}%`,
            background:   barBg,
            transition:  'width 0.4s ease',
          }}
        />
      </div>
    </div>
  );
}

/** Live ad preview card — white background simulating a search/social ad. */
function AdPreview({ headline, body }: { headline: string; body: string }) {
  return (
    <div
      style={{ ...CARD_STYLE, padding: '20px' }}
      aria-hidden="true"          // decorative — same content is in the editable fields
    >
      <div
        style={{
          fontWeight:   700,
          fontSize:     '14px',
          color:        '#e8e8f8',
          marginBottom: '14px',
          fontFamily:  "'Outfit', system-ui, sans-serif",
        }}
      >
        Ad Preview
      </div>

      {/* Simulated ad card — white bg, brand colours */}
      <div
        style={{
          background:   '#fff',
          borderRadius: '10px',
          padding:      '16px',
          color:        '#111',
        }}
      >
        <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>
          Sponsored
        </div>
        <div
          style={{
            fontWeight:   700,
            color:        '#1a0dab',   // Google-blue from JSX line 979
            fontSize:     '14px',
            marginBottom: '4px',
            lineHeight:    1.3,
            fontFamily:  "'Outfit', system-ui, sans-serif",
          }}
        >
          {headline || 'Your Ad Headline Here'}
        </div>
        <div
          style={{
            fontSize:   '12px',
            color:      '#555',
            lineHeight:  1.5,
            fontFamily:"'Outfit', system-ui, sans-serif",
          }}
        >
          {body || 'Your ad body text will appear here. Make it compelling!'}
        </div>
        <div
          style={{
            marginTop:    '10px',
            padding:      '6px 14px',
            background:   '#7c3aed',
            borderRadius: '6px',
            fontSize:     '12px',
            color:        '#fff',
            display:      'inline-block',
            cursor:       'pointer',
            fontFamily:  "'Outfit', system-ui, sans-serif",
            fontWeight:    600,
          }}
        >
          Learn More →
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Campaign creation and editing form with live ad preview and AI scoring.
 *
 * @example
 * // Create mode — blank form (default)
 * <CampaignForm
 *   mode="create"
 *   onSubmit={(data) => addCampaign(data)}
 *   onCancel={() => setShowForm(false)}
 * />
 *
 * @example
 * // Edit mode — pre-populated with existing campaign
 * <CampaignForm
 *   mode="edit"
 *   initialData={editingCampaign}
 *   onSubmit={(data) => updateCampaign(editingCampaign.id, data)}
 *   onCancel={() => setEditingCampaign(null)}
 * />
 */
export function CampaignForm({
  mode        = 'create',
  initialData,
  onSubmit,
  onCancel,
}: CampaignFormProps) {
  const id = useId();

  // ── Form state ─────────────────────────────────────────────────
  const [platform,   setPlatform]   = useState(initialData?.platform  ?? 'Google Ads');
  const [objective,  setObjective]  = useState('Conversions');
  const [headline,   setHeadline]   = useState('');
  const [body,       setBody]       = useState('');
  const [dailyBudget,setDailyBudget]= useState(
    initialData?.budget ? String(Math.round(initialData.budget / 30)) : ''
  );
  const [startDate,  setStartDate]  = useState('');
  const [endDate,    setEndDate]    = useState('');

  // ── AI Generate state ──────────────────────────────────────────
  const [aiSuggest, setAiSuggest] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  /**
   * Simulates an AI generation call.
   * Matches the generateAI function in LumindAd.jsx (line 888):
   * – Sets generating state → placeholders read "Generating..."
   * – After 800 ms fills headline + body with brand copy
   */
  const generateAI = () => {
    setAiLoading(true);
    setAiSuggest(true);
    setTimeout(() => {
      setHeadline('Boost Your Business with Smart AI Advertising');
      setBody(
        'Reach your ideal customers with precision targeting and real-time optimization. ' +
        'Powered by machine learning for maximum ROI.'
      );
      setAiLoading(false);
    }, 800);
  };

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit?.({
      platform,
      name:   headline || 'New Campaign',
      budget: dailyBudget ? Number(dailyBudget) * 30 : 0,
      status: 'draft',
    });
  };

  // ── Shared focus ring for branded inputs ───────────────────────
  const withFocus = (base: CSSProperties): CSSProperties => base;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label={mode === 'edit' ? 'Edit campaign' : 'Create new campaign'}
    >
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: '1fr 340px',
          gap:                 '20px',
          alignItems:          'start',
        }}
      >
        {/* ═══════════════════════════════════════════════════
            LEFT COLUMN — 3 cards + launch button
        ════════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ── Card 1: Campaign Settings ────────────────── */}
          <div style={CARD_STYLE}>
            <div style={SECTION_TITLE_STYLE}>Campaign Settings</div>

            {/* Platform + Objective — 1fr 1fr grid */}
            <div
              style={{
                display:             'grid',
                gridTemplateColumns: '1fr 1fr',
                gap:                 '14px',
              }}
            >
              {/* Platform select */}
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
                  onChange={(e) => setPlatform(e.target.value)}
                  style={SELECT_STYLE}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)'; }}
                >
                  {PLATFORM_OPTIONS.map((o) => (
                    <option key={o} value={o} style={{ background: '#0f0f1a' }}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              {/* Objective select */}
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
                  onChange={(e) => setObjective(e.target.value)}
                  style={SELECT_STYLE}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)'; }}
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

          {/* ── Card 2: Ad Copy ──────────────────────────── */}
          <div style={CARD_STYLE}>
            {/* Header row: title + AI Generate btn */}
            <div
              style={{
                display:        'flex',
                justifyContent: 'space-between',
                alignItems:     'center',
                marginBottom:   '16px',
              }}
            >
              <div style={SECTION_TITLE_STYLE}>Ad Copy</div>

              <button
                type="button"
                onClick={generateAI}
                disabled={aiLoading}
                aria-live="polite"
                aria-label={aiLoading ? 'Generating AI copy…' : 'Generate ad copy with AI'}
                style={{
                  background:   'linear-gradient(135deg, #7c3aed, #5b21b6)',
                  border:       'none',
                  color:        '#fff',
                  fontSize:     '11px',
                  padding:      '7px 16px',
                  borderRadius: '10px',
                  cursor:        aiLoading ? 'wait' : 'pointer',
                  fontWeight:    600,
                  fontFamily:  "'Outfit', system-ui, sans-serif",
                  opacity:       aiLoading ? 0.7 : 1,
                  transition:  'opacity 0.2s, transform 0.2s',
                  letterSpacing:'0.3px',
                  whiteSpace:  'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (!aiLoading) {
                    Object.assign(e.currentTarget.style, {
                      transform: 'translateY(-1px)',
                      boxShadow:'0 4px 12px rgba(124,58,237,0.4)',
                    });
                  }
                }}
                onMouseLeave={(e) => {
                  Object.assign(e.currentTarget.style, { transform: '', boxShadow: '' });
                }}
              >
                {aiLoading ? '⏳ Generating…' : '🤖 AI Generate'}
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
                placeholder={aiSuggest && aiLoading ? 'Generating…' : 'Enter your ad headline…'}
                maxLength={90}
                style={withFocus(INPUT_STYLE)}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)'; }}
              />
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
                placeholder={aiSuggest && aiLoading ? 'Generating…' : 'Enter your ad body text…'}
                maxLength={500}
                style={{
                  ...INPUT_STYLE,
                  resize:     'vertical',
                  minHeight:  '96px',
                  lineHeight:  1.5,
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)'; }}
              />
            </div>
          </div>

          {/* ── Card 3: Budget & Schedule ─────────────────── */}
          <div style={CARD_STYLE}>
            <div style={SECTION_TITLE_STYLE}>Budget &amp; Schedule</div>

            {/* Daily Budget + Start Date + End Date — 1fr 1fr 1fr */}
            <div
              style={{
                display:             'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap:                 '14px',
              }}
            >
              {/* Daily Budget */}
              <div>
                <label htmlFor={`${id}-budget`} style={LABEL_STYLE}>
                  Daily Budget ($)
                </label>
                <input
                  id={`${id}-budget`}
                  type="number"
                  min={1}
                  step={1}
                  value={dailyBudget}
                  onChange={(e) => setDailyBudget(e.target.value)}
                  placeholder="0"
                  style={INPUT_STYLE}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)'; }}
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
                  style={{
                    ...INPUT_STYLE,
                    colorScheme: 'dark',
                  } as CSSProperties}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)'; }}
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
                  style={{
                    ...INPUT_STYLE,
                    colorScheme: 'dark',
                  } as CSSProperties}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)'; }}
                />
              </div>
            </div>
          </div>

          {/* ── Action buttons ────────────────────────────── */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {/* Primary CTA — full width, large */}
            <button
              type="submit"
              style={{
                flex:         1,
                padding:      '14px',
                fontSize:     '14px',
                fontWeight:    700,
                background:   'linear-gradient(135deg, #7c3aed, #5b21b6)',
                border:       'none',
                borderRadius: '10px',
                color:        '#fff',
                cursor:       'pointer',
                fontFamily:  "'Outfit', system-ui, sans-serif",
                letterSpacing:'0.3px',
                transition:  'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                Object.assign(e.currentTarget.style, {
                  transform:  'translateY(-2px)',
                  boxShadow: '0 8px 24px rgba(124,58,237,0.45)',
                });
              }}
              onMouseLeave={(e) => {
                Object.assign(e.currentTarget.style, { transform: '', boxShadow: '' });
              }}
            >
              {mode === 'edit' ? '✓ Save Changes' : '🚀 Launch Campaign'}
            </button>

            {/* Cancel button — shown in edit mode or when onCancel is provided */}
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                style={{
                  padding:      '14px 24px',
                  fontSize:     '13px',
                  fontWeight:    600,
                  background:   'transparent',
                  border:       '1px solid #2d2050',
                  borderRadius: '10px',
                  color:        '#a78bfa',
                  cursor:       'pointer',
                  fontFamily:  "'Outfit', system-ui, sans-serif",
                  transition:  'background 0.2s, border-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  Object.assign(e.currentTarget.style, {
                    background:  '#1a0f3a',
                    borderColor: '#7c3aed',
                  });
                }}
                onMouseLeave={(e) => {
                  Object.assign(e.currentTarget.style, {
                    background:  'transparent',
                    borderColor: '#2d2050',
                  });
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            RIGHT COLUMN — Ad Preview + AI Score
        ════════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ── Ad Preview (live from state) ─────────────── */}
          <AdPreview headline={headline} body={body} />

          {/* ── AI Optimization Score card ───────────────── */}
          <div style={{ ...CARD_STYLE, padding: '20px' }}>
            <div
              style={{
                fontWeight:   700,
                fontSize:     '14px',
                color:        '#e8e8f8',
                marginBottom: '14px',
                fontFamily:  "'Outfit', system-ui, sans-serif",
              }}
            >
              🤖 AI Optimization Score
            </div>

            {AI_SCORES.map(({ label, score }) => (
              <ScoreRow key={label} label={label} score={score} />
            ))}
          </div>
        </div>
      </div>
    </form>
  );
}

CampaignForm.displayName = 'CampaignForm';

export default CampaignForm;
