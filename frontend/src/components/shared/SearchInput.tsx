/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Shared · SearchInput
 *  src/components/shared/SearchInput.tsx
 *
 *  Purpose
 *   Branded search / filter input used in the Campaigns and Analytics
 *   pages. Applies the exact visual style from LumindAd.jsx with a
 *   search icon prefix, focus ring, clear button, and optional debounce.
 *
 *  Used in
 *   CampaignsPage — "Search campaigns…" (width 220px, in Header actions slot)
 *   AnalyticsPage — platform filter select (different component, not this one)
 *
 *  Visual tokens (sourced from LumindAd.jsx CampaignsPage input, line 423)
 *   background    rgba(124, 58, 237, 0.08)
 *   border        1px solid rgba(124, 58, 237, 0.2)
 *   borderRadius  10px
 *   padding       9px 16px
 *   color         #e8e8f8
 *   fontSize      13px
 *   width         220px  (default — overridable)
 *
 *  Focus state
 *   The outline is removed (outline:none in prototype) and replaced
 *   with a border-color elevation to rgba(124,58,237,0.5) — a WCAG
 *   compliant focus indicator that matches the brand colour.
 *
 *  Search icon
 *   Rendered as an inline SVG path (magnifier) in the left gutter.
 *   Using SVG instead of an emoji ensures pixel-perfect sizing and
 *   consistent rendering across all operating systems.
 *
 *  Clear button
 *   Appears when the input has a value. Clicking it fires onChange('')
 *   and refocuses the input — standard search UX pattern.
 *   Has aria-label="Clear search" for screen reader users.
 *
 *  Debounce
 *   When `debounceMs` > 0, the `onChange` callback is delayed by that
 *   many milliseconds. This prevents a re-filter on every keystroke in
 *   large datasets and reduces unnecessary renders.
 *   The internal display value updates immediately (controlled); only
 *   the consumer callback is debounced.
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – Native <input type="search"> role is "searchbox" for screen readers
 *   – aria-label is required when no visible <label> is present
 *   – The search icon is aria-hidden (decorative)
 *   – Clear button has aria-label="Clear search"
 *   – Focus is returned to the input after clearing
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SearchInputProps {
  /**
   * Current search string (controlled component).
   * The parent manages state; this component displays and emits changes.
   */
  value: string;
  /**
   * Fired when the value changes. Receives the new string.
   * If `debounceMs` > 0, this callback is debounced.
   *
   * @param value - The updated search string (empty string on clear).
   */
  onChange: (value: string) => void;
  /**
   * Placeholder text shown when the input is empty.
   * @default "Search…"
   */
  placeholder?: string;
  /**
   * Accessible label for screen readers.
   * Required when no visible <label> is associated with this input.
   * @default "Search"
   */
  ariaLabel?: string;
  /**
   * Input width. Accepts any valid CSS width string.
   * Matches the 220px used in LumindAd.jsx CampaignsPage by default.
   * @default "220px"
   */
  width?: string;
  /**
   * When > 0, debounces the `onChange` callback by this many milliseconds.
   * The displayed value still updates on every keystroke.
   * @default 0  (no debounce)
   *
   * @example
   * // Debounce to avoid re-filtering on every keystroke in large tables
   * <SearchInput debounceMs={300} value={search} onChange={setSearch} />
   */
  debounceMs?: number;
  /**
   * When true, the input is disabled and non-interactive.
   * @default false
   */
  disabled?: boolean;
  /**
   * Fired when the user presses Escape with the input focused.
   * Typically used to clear the search and return focus to the table.
   */
  onEscape?: () => void;
}

// ─── SVG icons ────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <circle cx="6.5" cy="6.5" r="5" stroke="#64748b" strokeWidth="1.5" />
      <path   d="M10.5 10.5L14 14"  stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Branded search input for filtering tables and lists in LumindAd.
 *
 * @example
 * // CampaignsPage — matches LumindAd.jsx usage exactly
 * const [search, setSearch] = useState('');
 *
 * <SearchInput
 *   value={search}
 *   onChange={setSearch}
 *   placeholder="Search campaigns…"
 *   ariaLabel="Search campaigns by name or platform"
 *   width="220px"
 * />
 *
 * @example
 * // With debounce for large datasets
 * <SearchInput
 *   value={query}
 *   onChange={setQuery}
 *   placeholder="Search 10M+ rows…"
 *   debounceMs={300}
 *   width="280px"
 * />
 *
 * @example
 * // With Escape-to-clear
 * <SearchInput
 *   value={search}
 *   onChange={setSearch}
 *   onEscape={() => { setSearch(''); tableRef.current?.focus(); }}
 *   placeholder="Search…"
 * />
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  ariaLabel   = 'Search',
  width       = '220px',
  debounceMs  = 0,
  disabled    = false,
  onEscape,
}: SearchInputProps) {
  // Internal display value — always reflects what the user typed
  const [display, setDisplay] = useState(value);
  const inputRef              = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  // Sync display when parent resets value (e.g. "clear all filters")
  useEffect(() => { setDisplay(value); }, [value]);

  // ── Debounced onChange ───────────────────────────────────────────
  const debounced = useCallback(
    (() => {
      let timer: ReturnType<typeof setTimeout>;
      return (val: string) => {
        clearTimeout(timer);
        if (debounceMs > 0) {
          timer = setTimeout(() => onChange(val), debounceMs);
        } else {
          onChange(val);
        }
      };
    })(),
    [onChange, debounceMs],
  );

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setDisplay(next);
    debounced(next);
  };

  const handleClear = () => {
    setDisplay('');
    onChange('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (display) {
        handleClear();
      } else {
        onEscape?.();
      }
    }
  };

  // ── Styles ───────────────────────────────────────────────────────
  const wrapperStyle: CSSProperties = {
    position:   'relative',
    display:    'flex',
    alignItems: 'center',
    width,
    flexShrink:  0,
  };

  const inputStyle: CSSProperties = {
    width:           '100%',
    background:      'rgba(124, 58, 237, 0.08)',
    border:          `1px solid ${focused ? 'rgba(124,58,237,0.5)' : 'rgba(124,58,237,0.2)'}`,
    borderRadius:    '10px',
    padding:         '9px 36px 9px 36px',    // left: icon · right: clear btn
    color:           disabled ? '#475569' : '#e8e8f8',
    fontSize:        '13px',
    fontFamily:     "'Outfit', system-ui, sans-serif",
    outline:         'none',
    transition:      'border-color 0.2s ease',
    cursor:          disabled ? 'not-allowed' : 'text',
    opacity:         disabled ? 0.5 : 1,
  };

  const iconWrapStyle: CSSProperties = {
    position:       'absolute',
    left:           '12px',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    pointerEvents:  'none',
  };

  const clearBtnStyle: CSSProperties = {
    position:       'absolute',
    right:          '10px',
    display:        display ? 'flex' : 'none',
    alignItems:     'center',
    justifyContent: 'center',
    width:          '18px',
    height:         '18px',
    borderRadius:   '50%',
    background:     'rgba(124,58,237,0.15)',
    border:         'none',
    color:          '#94a3b8',
    cursor:         'pointer',
    padding:         0,
    transition:     'background 0.15s ease, color 0.15s ease',
  };

  return (
    <div style={wrapperStyle}>
      {/* Search icon — left gutter */}
      <span style={iconWrapStyle}>
        <SearchIcon />
      </span>

      {/* Input */}
      <input
        ref={inputRef}
        type="search"
        value={display}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        style={inputStyle}
      />

      {/* Clear button — right gutter */}
      <button
        type="button"
        onClick={handleClear}
        aria-label="Clear search"
        style={clearBtnStyle}
        onMouseEnter={(e) => {
          Object.assign(e.currentTarget.style, {
            background: 'rgba(124,58,237,0.3)',
            color:      '#c4b5fd',
          });
        }}
        onMouseLeave={(e) => {
          Object.assign(e.currentTarget.style, {
            background: 'rgba(124,58,237,0.15)',
            color:      '#94a3b8',
          });
        }}
      >
        <ClearIcon />
      </button>
    </div>
  );
}

SearchInput.displayName = 'SearchInput';

export default SearchInput;
