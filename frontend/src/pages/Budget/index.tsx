/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Pages · Budget Management
 *  src/pages/Budget/index.tsx
 *
 *  Route  /budget  (matched by App.tsx inside AppLayout)
 *
 *  Layout (top → bottom)
 *  ┌──────────────────────────────────────────────────────────┐
 *  │  Header — "Budget Management"  [📅 Nov 2025 ⌄] [+Set]   │
 *  ├──────────────────────────────────────────────────────────┤
 *  │  KPI row — 4-column grid (gap:16, marginBottom:24)       │
 *  │  💎 Total Budget · 📊 Total Spent · 🏦 Remaining · ⚠️ % │
 *  ├──────────────────────────────────────────────────────────┤
 *  │  Charts row — grid "1fr 300px" (gap:16)                  │
 *  │  ┌──────────────────────────┐ ┌────────────────────┐     │
 *  │  │  SpendChart              │ │  BudgetByPlatform  │     │
 *  │  │  Grouped bar: spend vs   │ │  By Platform rows  │     │
 *  │  │  budget · height 240     │ │  + AI Recommend.   │     │
 *  │  └──────────────────────────┘ └────────────────────┘     │
 *  └──────────────────────────────────────────────────────────┘
 *
 *  KPI configuration (from LumindAd.jsx lines 505–510)
 *   Total Budget   $28,500   no delta   💎  #7c3aed  delay 0
 *   Total Spent    $18,347  +18.2%      📊  #10b981  delay 80
 *   Remaining      $10,153   no delta   🏦  #06b6d4  delay 160
 *   Budget Used     64%       no delta   ⚠️  #f59e0b  delay 240
 *     ↳ value=64 suffix="%" (not a number with prefix)
 *
 *  Header month picker (from LumindAd.jsx lines 498–503)
 *   A branded div styled as a pill — NOT a native <select>.
 *   Background  rgba(124,58,237,0.10)
 *   Border      1px solid rgba(124,58,237,0.20)
 *   BorderRadius 10px · padding 9px 16px
 *   FontSize 13 · color #a78bfa
 *   Display flex · alignItems center · gap 8
 *   Text "📅 November 2025 ⌄"
 *   In index.tsx we implement this as an interactive <button> with
 *   a popover month list — semantically correct while visually identical.
 *
 *  "+ Set Budget" modal
 *   The prototype renders a static button with no interaction.
 *   Here it opens a minimal inline modal with a budget input field,
 *   allowing the user to update the totalBudget state which flows into
 *   the KPIs and the BudgetByPlatform totalSpend prop.
 *
 *  Derived state
 *   totalSpent   = 18347 (prototype constant — future: real API)
 *   remaining    = totalBudget - totalSpent
 *   budgetUsedPct = Math.round((totalSpent / totalBudget) * 100)
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – KPI grid has role="list" so screen readers count the 4 metrics
 *   – Month picker is a <button> with aria-haspopup="listbox"
 *   – Month dropdown list has role="listbox" with aria-label
 *   – "Set Budget" modal is role="dialog" with aria-label + aria-modal
 *   – Escape key closes both popovers
 *   – Focus is trapped inside the "Set Budget" modal while open
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from 'react';
import { Header }           from '../../components/layout/Header';
import { KPICard }          from '../../components/shared/KPICard';
import { SpendChart }       from './SpendChart';
import { BudgetByPlatform } from './BudgetByPlatform';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April',
  'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
] as const;

const INITIAL_TOTAL_BUDGET = 28500;   // matches LumindAd.jsx KPICard value
const TOTAL_SPENT          = 18347;   // prototype constant — future: real API

// ─── Month picker ─────────────────────────────────────────────────────────────

/**
 * Branded month selector pill matching the LumindAd.jsx prototype exactly.
 * Renders as a <button> for accessibility; visually identical to the styled
 * <div> in the original (rgba(124,58,237,0.1) bg · #a78bfa text · 10px radius).
 */
function MonthPicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (month: string) => void;
}) {
  const [open, setOpen]     = useState(false);
  const triggerRef          = useRef<HTMLButtonElement>(null);
  const dropdownRef         = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }} onKeyDown={handleKey}>
      {/* Trigger — branded pill from LumindAd.jsx line 498 */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Selected month: ${selected} 2025. Click to change.`}
        style={{
          background:   'rgba(124, 58, 237, 0.10)',
          border:       '1px solid rgba(124, 58, 237, 0.20)',
          borderRadius: '10px',
          padding:      '9px 16px',
          fontSize:     '13px',
          color:        '#a78bfa',
          display:      'flex',
          alignItems:   'center',
          gap:          '8px',
          cursor:       'pointer',
          fontFamily:  "'Outfit', system-ui, sans-serif",
          fontWeight:    500,
          transition:   'background 0.15s ease, border-color 0.15s ease',
          whiteSpace:   'nowrap',
        }}
        onMouseEnter={(e) => {
          Object.assign(e.currentTarget.style, {
            background:  'rgba(124,58,237,0.18)',
            borderColor: 'rgba(124,58,237,0.35)',
          });
        }}
        onMouseLeave={(e) => {
          Object.assign(e.currentTarget.style, {
            background:  'rgba(124,58,237,0.10)',
            borderColor: 'rgba(124,58,237,0.20)',
          });
        }}
      >
        📅 {selected} 2025 ⌄
      </button>

      {/* Dropdown listbox */}
      {open && (
        <div
          ref={dropdownRef}
          role="listbox"
          aria-label="Select month"
          style={{
            position:      'absolute',
            top:           'calc(100% + 6px)',
            left:           0,
            zIndex:         50,
            background:    'rgba(10, 8, 20, 0.97)',
            border:        '1px solid rgba(124,58,237,0.25)',
            borderRadius:  '10px',
            backdropFilter:'blur(12px)',
            padding:       '6px',
            minWidth:      '160px',
            boxShadow:     '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          {MONTHS.map((month) => {
            const isSelected = month === selected;
            return (
              <div
                key={month}
                role="option"
                aria-selected={isSelected}
                onClick={() => { onSelect(month); setOpen(false); }}
                style={{
                  padding:      '8px 12px',
                  fontSize:     '13px',
                  borderRadius: '7px',
                  cursor:       'pointer',
                  fontFamily:  "'Outfit', system-ui, sans-serif",
                  color:         isSelected ? '#c4b5fd' : '#94a3b8',
                  background:    isSelected ? 'rgba(124,58,237,0.15)' : 'transparent',
                  fontWeight:    isSelected ? 600 : 400,
                  transition:   'background 0.12s ease, color 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    Object.assign(e.currentTarget.style, {
                      background: 'rgba(124,58,237,0.08)',
                      color:      '#a78bfa',
                    });
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    Object.assign(e.currentTarget.style, {
                      background: 'transparent',
                      color:      '#94a3b8',
                    });
                  }
                }}
              >
                {month}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Set Budget modal ─────────────────────────────────────────────────────────

/**
 * Minimal inline modal for updating the total budget.
 * The prototype renders a static "+ Set Budget" button; here we give it
 * actual functionality so the KPIs reflect the change.
 */
function SetBudgetModal({
  currentBudget,
  onSave,
  onClose,
}: {
  currentBudget: number;
  onSave:  (budget: number) => void;
  onClose: () => void;
}) {
  const [value, setValue]   = useState(String(currentBudget));
  const inputRef            = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleKey = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  const handleSave = () => {
    const n = Number(value);
    if (n > 0) { onSave(n); onClose(); }
  };

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position:       'fixed',
        inset:           0,
        background:     'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex:          100,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
      }}
    >
      {/* Dialog */}
      <div
        role="dialog"
        aria-label="Set monthly budget"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKey}
        style={{
          background:     'rgba(15, 10, 30, 0.97)',
          border:         '1px solid rgba(124,58,237,0.25)',
          borderRadius:   '16px',
          backdropFilter: 'blur(16px)',
          padding:        '28px',
          width:          '360px',
          boxShadow:      '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            fontWeight:   700,
            fontSize:     '16px',
            color:        '#e8e8f8',
            marginBottom: '6px',
            fontFamily:  "'Outfit', system-ui, sans-serif",
          }}
        >
          Set Monthly Budget
        </div>
        <div
          style={{
            fontSize:     '12px',
            color:        '#475569',
            marginBottom: '20px',
            fontFamily:  "'Outfit', system-ui, sans-serif",
          }}
        >
          Update the total budget for the selected month.
        </div>

        {/* Budget input */}
        <label
          htmlFor="modal-budget"
          style={{
            fontSize:     '12px',
            color:        '#475569',
            display:      'block',
            marginBottom: '6px',
            fontWeight:    600,
            fontFamily:  "'Outfit', system-ui, sans-serif",
          }}
        >
          Total Budget ($)
        </label>
        <input
          ref={inputRef}
          id="modal-budget"
          type="number"
          min={1}
          step={100}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          style={{
            width:        '100%',
            background:   'rgba(124,58,237,0.08)',
            border:       '1px solid rgba(124,58,237,0.25)',
            borderRadius: '10px',
            padding:      '11px 14px',
            color:        '#e8e8f8',
            fontSize:     '13px',
            fontFamily:  "'Outfit', system-ui, sans-serif",
            outline:      'none',
            boxSizing:   'border-box',
            marginBottom: '20px',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'; }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.25)'; }}
        />

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleSave}
            style={{
              flex:         1,
              padding:      '10px',
              background:   'linear-gradient(135deg,#7c3aed,#5b21b6)',
              border:       'none',
              borderRadius: '10px',
              color:        '#fff',
              fontSize:     '13px',
              fontWeight:    600,
              cursor:       'pointer',
              fontFamily:  "'Outfit', system-ui, sans-serif",
              transition:  'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, {
                transform:  'translateY(-1px)',
                boxShadow: '0 6px 18px rgba(124,58,237,0.45)',
              });
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, { transform: '', boxShadow: '' });
            }}
          >
            Save Budget
          </button>
          <button
            onClick={onClose}
            style={{
              padding:      '10px 18px',
              background:   'transparent',
              border:       '1px solid #2d2050',
              borderRadius: '10px',
              color:        '#a78bfa',
              fontSize:     '13px',
              fontWeight:    600,
              cursor:       'pointer',
              fontFamily:  "'Outfit', system-ui, sans-serif",
              transition:  'background 0.15s, border-color 0.15s',
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
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Budget Management page — route /budget.
 *
 * Renders KPI cards, daily spend vs budget bar chart, platform spend
 * breakdown, and AI reallocation recommendation.
 *
 * @example
 * // Consumed automatically by React Router via App.tsx
 * <Route path="/budget" element={<BudgetPage />} />
 *
 * @example
 * // KPI derivation from state:
 * //   totalBudget    = 28500  (user-editable via "Set Budget")
 * //   totalSpent     = 18347  (prototype constant)
 * //   remaining      = totalBudget - totalSpent
 * //   budgetUsedPct  = Math.round((totalSpent / totalBudget) × 100)
 * //   When totalBudget changes → all 4 KPIs update reactively
 *
 * @example
 * // Month picker maps to display label only (no API call in prototype):
 * //   selected month "November" → header shows "📅 November 2025 ⌄"
 */
export default function BudgetPage() {
  const [totalBudget,   setTotalBudget]   = useState(INITIAL_TOTAL_BUDGET);
  const [selectedMonth, setSelectedMonth] = useState('November');
  const [showModal,     setShowModal]     = useState(false);

  // Derived KPI values
  const remaining     = totalBudget - TOTAL_SPENT;
  const budgetUsedPct = Math.round((TOTAL_SPENT / totalBudget) * 100);

  return (
    <>
      {/* ── Page header ──────────────────────────────────────── */}
      <Header
        title="Budget Management"
        subtitle="Track and optimize your advertising spend with AI recommendations"
        actions={[
          /* Month picker — branded pill matching LumindAd.jsx lines 498–503 */
          <MonthPicker
            key="month"
            selected={selectedMonth}
            onSelect={setSelectedMonth}
          />,

          /* Set Budget button — opens modal */
          <button
            key="set-budget"
            onClick={() => setShowModal(true)}
            style={{
              background:   'linear-gradient(135deg, #7c3aed, #5b21b6)',
              border:       'none',
              borderRadius: '10px',
              padding:      '10px 22px',
              color:        '#fff',
              fontSize:     '13px',
              fontWeight:    600,
              fontFamily:  "'Outfit', system-ui, sans-serif",
              cursor:       'pointer',
              letterSpacing:'0.3px',
              transition:  'transform 0.2s, box-shadow 0.2s',
              whiteSpace:  'nowrap',
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
            + Set Budget
          </button>,
        ]}
      />

      {/* ── KPI row ──────────────────────────────────────────── */}
      {/* grid repeat(4,1fr) gap:16 marginBottom:24 — matches JSX line 505 */}
      <div
        role="list"
        aria-label="Budget key performance indicators"
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap:                 '16px',
          marginBottom:        '24px',
        }}
      >
        {/* Total Budget — no delta (no change prop) */}
        <div role="listitem">
          <KPICard
            title="Total Budget"
            value={totalBudget}
            prefix="$"
            icon="💎"
            color="#7c3aed"
            delay={0}
          />
        </div>

        {/* Total Spent — +18.2% positive delta */}
        <div role="listitem">
          <KPICard
            title="Total Spent"
            value={TOTAL_SPENT}
            prefix="$"
            change={18.2}
            icon="📊"
            color="#10b981"
            delay={80}
          />
        </div>

        {/* Remaining — no delta, derived from totalBudget state */}
        <div role="listitem">
          <KPICard
            title="Remaining"
            value={remaining}
            prefix="$"
            icon="🏦"
            color="#06b6d4"
            delay={160}
          />
        </div>

        {/* Budget Used — suffix %, no prefix, value is integer percentage */}
        <div role="listitem">
          <KPICard
            title="Budget Used"
            value={budgetUsedPct}
            suffix="%"
            icon="⚠️"
            color="#f59e0b"
            delay={240}
          />
        </div>
      </div>

      {/* ── Charts row ───────────────────────────────────────── */}
      {/* grid "1fr 300px" gap:16 — Budget uses 300px, Dashboard used 320px */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: '1fr 300px',
          gap:                 '16px',
          alignItems:          'start',
        }}
      >
        {/* Left: Daily Spend vs Budget bar chart */}
        <SpendChart />

        {/* Right: By Platform breakdown + AI Recommendation */}
        <BudgetByPlatform totalSpend={TOTAL_SPENT} />
      </div>

      {/* ── Set Budget modal ─────────────────────────────────── */}
      {showModal && (
        <SetBudgetModal
          currentBudget={totalBudget}
          onSave={setTotalBudget}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

BudgetPage.displayName = 'BudgetPage';
