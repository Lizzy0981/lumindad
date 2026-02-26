/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · tailwind.config.ts
 *  frontend/tailwind.config.ts
 *
 *  Theme: "dark luxury" — extracted from LumindAd.jsx GLOBAL_CSS
 *
 *  Token origins
 *  ─────────────
 *  All colour values are sourced directly from LumindAd.jsx lines
 *  15–115 (GLOBAL_CSS constant). Every hex used ≥ 5 times in the
 *  JSX file has a named token here for consistency.
 *
 *  Design primitives
 *  ─────────────────
 *  Primary accent   : violet-700   #7c3aed  (buttons, active nav, glow)
 *  Primary light    : violet-400   #a78bfa  (text, borders, secondary btn)
 *  Primary pale     : violet-300   #c4b5fd  (active nav text)
 *  Secondary        : cyan-500     #06b6d4  (gradient accents, badges)
 *  Success          : emerald-500  #10b981  (ROAS >4, Green AI, change ▲)
 *  Warning          : amber-500    #f59e0b  (ROAS >3, paused status)
 *  Danger           : red-500      #ef4444  (ROAS <3, active status ▼)
 *  Background body  : #060610      (LumindAd.jsx line 19)
 *  Background card  : rgba(15,10,30,.85)
 *  Background aside : rgba(6,4,18,.97)
 *  Text primary     : #e8e8f8      (LumindAd.jsx line 19)
 *  Text secondary   : #94a3b8      (slate-400)
 *  Text muted       : #475569      (slate-600)
 *  Border default   : rgba(124,58,237,.15) (violet/15%)
 *
 *  Custom utilities added
 *  ──────────────────────
 *  .gradient-text    — LumindAd.jsx .gradient-text
 *  .glow             — LumindAd.jsx .glow
 *  .card             — LumindAd.jsx .card
 *  .tag-up/down/neutral — LumindAd.jsx .tag-*
 *  .page-enter       — float-in animation
 *  .social-icon .s1–.s5 — bounce-social with staggered delays
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

const config: Config = {
  // ── Content paths for PurgeCSS ────────────────────────────────────────────
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],

  // ── Dark mode — class-based (html[data-theme="dark"]) ────────────────────
  darkMode: ['class', '[data-theme="dark"]'],

  theme: {
    extend: {
      // ── Colour palette ─────────────────────────────────────────────────
      colors: {
        // ── Violet — primary brand (LumindAd.jsx #7c3aed family) ───────
        violet: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',   // active nav text
          400: '#a78bfa',   // secondary button text, borders
          500: '#8b5cf6',
          600: '#7c3aed',   // PRIMARY — buttons, active state
          700: '#6d28d9',
          800: '#5b21b6',   // button gradient end
          900: '#4c1d95',   // scrollbar thumb, deep bg
          950: '#2e1065',
        },
        // ── Cyan — secondary accent ──────────────────────────────────
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',   // SECONDARY — gradient, badges, links
          600: '#0891b2',
        },
        // ── Emerald — success / Green AI ────────────────────────────
        emerald: {
          400: '#34d399',
          500: '#10b981',   // SUCCESS — ROAS >4, Green AI, change ▲
          600: '#059669',   // success btn gradient start
          700: '#047857',   // Green AI subtitle text
          800: '#065f46',   // success btn gradient end
        },
        // ── Amber — warning / paused ────────────────────────────────
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',   // WARNING — ROAS >3, paused badge
          600: '#d97706',
        },
        // ── Red — danger ─────────────────────────────────────────────
        red: {
          400: '#f87171',
          500: '#ef4444',   // DANGER — ROAS <3, change ▼
          600: '#dc2626',   // danger btn gradient start
          700: '#b91c1c',
          800: '#991b1b',   // danger btn gradient end
        },
        // ── Orange (XML format chip) ─────────────────────────────────
        orange: {
          500: '#f97316',
        },
        // ── Blue (JSON format chip) ──────────────────────────────────
        blue: {
          400: '#60a5fa',
          500: '#3b82f6',
        },
        // ── Purple (TSV format chip) ─────────────────────────────────
        purple: {
          500: '#a855f7',
        },
        // ── Green (CSV format chip) ──────────────────────────────────
        green: {
          400: '#4ade80',
          500: '#22c55e',
        },
        // ── Yellow (Parquet chip) ────────────────────────────────────
        yellow: {
          500: '#eab308',
        },
        // ── Slate — neutral text / borders ──────────────────────────
        slate: {
          400: '#94a3b8',   // nav inactive text, muted labels
          500: '#64748b',
          600: '#475569',   // subtitle text
          700: '#334155',
          800: '#1e293b',
        },
        // ── LumindAd custom dark surfaces ────────────────────────────
        surface: {
          body:   '#060610',            // body background
          card:   'rgba(15,10,30,.85)', // card background
          aside:  'rgba(6,4,18,.97)',   // sidebar/footer
          overlay:'rgba(0,0,0,.6)',     // modal backdrop
          // Scrollbar colours
          scrollTrack: '#0c0c1a',
          scrollThumb: '#4c1d95',
        },
        // ── Platform brand colours ───────────────────────────────────
        platform: {
          google:   '#4285f4',
          meta:     '#1877f2',
          tiktok:   '#ff0050',
          linkedin: '#0077b5',
          twitter:  '#1da1f2',
        },
      },

      // ── Typography ──────────────────────────────────────────────────────
      fontFamily: {
        // LumindAd.jsx line 17: Outfit (primary UI) + DM Mono (data values)
        sans:  ['Outfit', 'system-ui', '-apple-system', 'sans-serif'],
        mono:  ['DM Mono', 'ui-monospace', 'monospace'],
        // Kept as fallback
        ui:    ['Outfit', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],    // 10px — micro labels
        xs:    ['0.6875rem', { lineHeight: '1rem' }],   // 11px — badge text
        sm:    ['0.8125rem', { lineHeight: '1.25rem' }],// 13px — button/nav
        base:  ['0.875rem', { lineHeight: '1.5rem' }],  // 14px — body
        lg:    ['1rem',    { lineHeight: '1.75rem' }],  // 16px
        xl:    ['1.125rem', { lineHeight: '1.75rem' }], // 18px
        '2xl': ['1.25rem',  { lineHeight: '1.75rem' }], // 20px
        '3xl': ['1.5rem',   { lineHeight: '2rem' }],    // 24px
        '4xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px — page title
      },
      letterSpacing: {
        tighter: '-0.05em',
        tight:   '-0.025em',
        normal:  '0em',
        wide:    '0.025em',
        wider:   '0.05em',    // badge text
        widest:  '0.1em',
      },

      // ── Border radius ────────────────────────────────────────────────────
      borderRadius: {
        none: '0',
        sm:   '4px',
        DEFAULT: '8px',
        md:   '10px',   // buttons, nav items — LumindAd.jsx btn border-radius
        lg:   '12px',   // Green AI card
        xl:   '16px',   // cards — LumindAd.jsx .card border-radius
        '2xl':'20px',   // large modals
        full: '9999px', // tags, badges
      },

      // ── Spacing ──────────────────────────────────────────────────────────
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '58': '14.5rem',  // sidebar width approximation
        '72': '18rem',
        '88': '22rem',
      },

      // ── Box shadows ──────────────────────────────────────────────────────
      boxShadow: {
        // LumindAd.jsx .btn-primary:hover
        'glow-violet': '0 8px 24px rgba(124,58,237,.45)',
        'glow-violet-sm': '0 0 24px rgba(124,58,237,.3)',
        'glow-violet-pulse': '0 0 24px rgba(124,58,237,.8)',
        'glow-cyan':   '0 8px 24px rgba(6,182,212,.35)',
        'glow-emerald':'0 8px 24px rgba(5,150,105,.4)',
        'glow-red':    '0 8px 24px rgba(220,38,38,.4)',
        'card':        '0 4px 32px rgba(0,0,0,.4)',
        'card-hover':  '0 8px 48px rgba(0,0,0,.5)',
      },

      // ── Backdrop blur ────────────────────────────────────────────────────
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '12px',   // LumindAd.jsx .card backdrop-filter
        lg: '24px',
        xl: '40px',
      },

      // ── Keyframe animations — exact copies from LumindAd.jsx GLOBAL_CSS ─
      keyframes: {
        'bounce-social': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':       { transform: 'translateY(-10px)' },
        },
        'pulse-ring': {
          '0%':   { transform: 'scale(1)',   opacity: '0.8' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        'gradient-shift': {
          '0%':   { backgroundPosition: '0% 50%' },
          '50%':  { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'float-in': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'counter-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
        'bar-fill': {
          from: { transform: 'scaleY(0)' },
          to:   { transform: 'scaleY(1)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(124,58,237,.4)' },
          '50%':       { boxShadow: '0 0 24px rgba(124,58,237,.8)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to:   { transform: 'translateX(0)',    opacity: '1' },
        },
        'slide-in-bottom': {
          from: { transform: 'translateY(100%)', opacity: '0' },
          to:   { transform: 'translateY(0)',    opacity: '1' },
        },
      },

      // ── Animation utilities ───────────────────────────────────────────────
      animation: {
        // Social icon bounce — LumindAd.jsx .social-icon
        'bounce-social':   'bounce-social 1.4s ease-in-out infinite',
        // Page enter — LumindAd.jsx .page-enter
        'float-in':        'float-in .35s ease forwards',
        // KPI card value counter
        'counter-up':      'counter-up .4s ease forwards',
        // Shimmer loading skeleton
        'shimmer':         'shimmer 1.8s linear infinite',
        // Background gradient animation
        'gradient-shift':  'gradient-shift 6s ease infinite',
        // Slow spinner
        'spin-slow':       'spin-slow 3s linear infinite',
        // Glow pulse
        'glow-pulse':      'glow-pulse 2s ease-in-out infinite',
        // Bar chart fill
        'bar-fill':        'bar-fill .5s ease forwards',
        // Generic transitions
        'fade-in':         'fade-in .2s ease forwards',
        'slide-in-right':  'slide-in-right .25s ease forwards',
        'slide-in-bottom': 'slide-in-bottom .3s ease forwards',
        // Pulse ring (notification indicator)
        'pulse-ring':      'pulse-ring 1.5s ease-out infinite',
      },

      // ── Transition durations ──────────────────────────────────────────────
      transitionDuration: {
        '0':   '0ms',
        '150': '150ms',
        '200': '200ms',  // LumindAd.jsx: all .2s
        '250': '250ms',  // card hover
        '350': '350ms',  // page enter
        '400': '400ms',  // counter up
      },

      // ── Z-index scale ─────────────────────────────────────────────────────
      zIndex: {
        sidebar:  '40',
        header:   '50',
        dropdown: '60',
        modal:    '70',
        toast:    '80',
        tooltip:  '90',
      },
    },
  },

  // ── Safelist — dynamic classes that must never be purged ─────────────────
  // These are built at runtime from data (e.g. platform colours, status).
  safelist: [
    // Social icon stagger classes — LumindAd.jsx .s1–.s5
    's1', 's2', 's3', 's4', 's5',
    // Status badge colours
    { pattern: /^(bg|text|border)-(emerald|amber|red|slate|violet)-(400|500|600|700)$/ },
    // Platform colours
    { pattern: /^(bg|text|border)-platform-(google|meta|tiktok|linkedin|twitter)$/ },
    // Animation delay utilities
    { pattern: /^animation-delay-\d+$/ },
    // Page enter
    'page-enter', 'kpi-val',
    // Tag utilities
    'tag-up', 'tag-down', 'tag-neutral',
    // Progress bar
    'progress-bar', 'progress-fill',
    // Drop zone states
    'drop-zone', 'drop-zone-dragging',
  ],

  // ── Plugins ───────────────────────────────────────────────────────────────
  plugins: [
    // ── Custom utility classes — exact mirrors of LumindAd.jsx GLOBAL_CSS ──
    plugin(function ({ addUtilities, addComponents, theme }) {
      // ── Component classes ─────────────────────────────────────────────
      addComponents({
        // .gradient-text — LumindAd.jsx line 59
        '.gradient-text': {
          background: 'linear-gradient(135deg, #a78bfa, #7c3aed, #06b6d4)',
          '-webkit-background-clip': 'text',
          '-webkit-text-fill-color': 'transparent',
          'background-clip': 'text',
        },
        // .glow — LumindAd.jsx line 62
        '.glow': {
          'box-shadow': '0 0 24px rgba(124,58,237,.3)',
        },
        // .card — LumindAd.jsx line 55–57
        '.card': {
          background:       'rgba(15,10,30,.85)',
          border:           '1px solid rgba(124,58,237,.15)',
          'border-radius':  '16px',
          'backdrop-filter':'blur(12px)',
          transition:       'all .25s',
        },
        '.card:hover': {
          'border-color': 'rgba(124,58,237,.4)',
          transform:      'translateY(-2px)',
        },
        // .nav-item — LumindAd.jsx line 63
        '.nav-item': {
          display:        'flex',
          'align-items':  'center',
          gap:            '10px',
          padding:        '11px 16px',
          'border-radius':'10px',
          cursor:         'pointer',
          transition:     'all .2s',
          'font-size':    '14px',
          'font-weight':  '500',
          color:          '#94a3b8',
        },
        '.nav-item:hover': {
          background: 'rgba(124,58,237,.12)',
          color:      '#a78bfa',
        },
        '.nav-item.active': {
          background: 'linear-gradient(135deg,rgba(124,58,237,.25),rgba(91,33,182,.15))',
          color:      '#c4b5fd',
          border:     '1px solid rgba(124,58,237,.3)',
        },
        // Tag variants — LumindAd.jsx line 70–74
        '.tag': {
          display:       'inline-flex',
          'align-items': 'center',
          gap:           '4px',
          padding:       '3px 10px',
          'border-radius':'20px',
          'font-size':   '11px',
          'font-weight': '600',
          'letter-spacing':'.4px',
        },
        '.tag-up': {
          background: 'rgba(16,185,129,.12)',
          color:      '#10b981',
          border:     '1px solid rgba(16,185,129,.25)',
        },
        '.tag-down': {
          background: 'rgba(239,68,68,.12)',
          color:      '#ef4444',
          border:     '1px solid rgba(239,68,68,.25)',
        },
        '.tag-neutral': {
          background: 'rgba(245,158,11,.12)',
          color:      '#f59e0b',
          border:     '1px solid rgba(245,158,11,.25)',
        },
        // Progress bar — LumindAd.jsx line 75–78
        '.progress-bar': {
          height:         '4px',
          'border-radius':'2px',
          background:     '#1e1e35',
          overflow:       'hidden',
          position:       'relative',
        },
        '.progress-fill': {
          height:         '100%',
          'border-radius':'2px',
          transition:     'width .3s ease',
          background:     'linear-gradient(90deg,#7c3aed,#06b6d4)',
        },
        // Drop zone — LumindAd.jsx line 82–86
        '.drop-zone': {
          border:         '2px dashed rgba(124,58,237,.35)',
          'border-radius':'16px',
          transition:     'all .25s',
          background:     'rgba(124,58,237,.04)',
        },
        '.drop-zone.dragging': {
          'border-color': '#7c3aed',
          background:     'rgba(124,58,237,.1)',
          transform:      'scale(1.01)',
        },
        // Badge — LumindAd.jsx line 90
        '.badge': {
          padding:          '4px 12px',
          'border-radius':  '20px',
          'font-size':      '11px',
          'font-weight':    '700',
          'letter-spacing': '.5px',
        },
        // Table row — LumindAd.jsx line 87
        '.table-row': {
          'border-bottom': '1px solid rgba(124,58,237,.08)',
          transition:      'background .15s',
        },
        '.table-row:hover': {
          background: 'rgba(124,58,237,.06)',
        },
        // Status dot — LumindAd.jsx line 89
        '.status-dot': {
          width:         '7px',
          height:        '7px',
          'border-radius':'50%',
          display:       'inline-block',
        },
        // Page transitions
        '.page-enter': {
          animation: 'float-in .35s ease forwards',
        },
        '.kpi-val': {
          animation: 'counter-up .4s ease forwards',
        },
        // Social icon — LumindAd.jsx line 36
        '.social-icon': {
          display:   'inline-flex',
          animation: 'bounce-social 1.4s ease-in-out infinite',
          cursor:    'pointer',
        },
      });

      // ── Stagger delay utilities — .s1 through .s5 ─────────────────────
      // LumindAd.jsx line 37: .s1{0s} .s2{.18s} .s3{.36s} .s4{.54s} .s5{.72s}
      addUtilities({
        '.s1': { 'animation-delay': '0s' },
        '.s2': { 'animation-delay': '.18s' },
        '.s3': { 'animation-delay': '.36s' },
        '.s4': { 'animation-delay': '.54s' },
        '.s5': { 'animation-delay': '.72s' },
      });
    }),
  ],
};

export default config;
