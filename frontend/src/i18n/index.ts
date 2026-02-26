/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · i18n · index.ts
 *  src/i18n/index.ts
 *
 *  Purpose
 *   Configures i18next with all 11 languages declared in the
 *   LumindAd footer: "i18n 11 langs" (LumindAd.jsx line 1054).
 *   Handles language detection, RTL layout switching, lazy loading
 *   of locale bundles, and interpolation helpers used across the UI.
 *
 *  Supported languages
 *   Code   Language        Script   Dir   Region
 *   ──────────────────────────────────────────────
 *   en     English         Latin    LTR   Global
 *   es     Español         Latin    LTR   ES/LATAM
 *   pt     Português       Latin    LTR   BR/PT
 *   fr     Français        Latin    LTR   FR/CA
 *   ar     العربية         Arabic   RTL   MENA
 *   he     עברית           Hebrew   RTL   IL
 *   zh     中文            CJK      LTR   CN/TW
 *   ru     Русский         Cyrillic LTR   RU/CIS
 *   tr     Türkçe          Latin    LTR   TR
 *   ko     한국어          Hangul   LTR   KR
 *   ja     日本語          CJK      LTR   JP
 *
 *  RTL support
 *   applyRTL() / applyLTR() mutate document.dir and add/remove the
 *   'rtl' class on <html>. Call after every language change.
 *   RTL_LANGS = ['ar', 'he']
 *
 *  Namespace structure
 *   Each locale JSON is a flat-ish object with section prefixes:
 *   nav.*         — sidebar navigation labels
 *   sidebar.*     — AI badge, user panel, version
 *   pages.*       — page titles and subtitles
 *   common.*      — shared UI labels, buttons, status words
 *   metrics.*     — KPI card titles
 *   dashboard.*   — dashboard-specific strings
 *   budget.*      — budget page strings
 *   analytics.*   — analytics & ML panel strings
 *   upload.*      — upload page strings
 *   createAd.*    — create ad form strings
 *   footer.*      — footer links and badges
 *
 *  Interpolation examples
 *   t('upload.filesCount', { count: 3 })
 *     en → "3 files processed successfully"
 *     es → "3 archivos procesados con éxito"
 *   t('upload.rowsTotal', { count: 531200 })
 *     en → "531,200 total rows"
 *   t('common.statusLabel', { status: 'active' })
 *     → translated status word
 *
 *  Usage
 *   import i18n, { changeLanguage, isRTL, SUPPORTED_LANGS } from '@/i18n';
 *   import { useTranslation } from 'react-i18next';
 *   const { t, i18n } = useTranslation();
 *   t('pages.dashboard.title')   → "Performance Dashboard"
 *   t('metrics.totalSpend')      → "Total Spend"
 *
 *  Language switcher
 *   await changeLanguage('ar');   // switches + applies RTL
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// ─── Locale imports ───────────────────────────────────────────────────────────

import en from './locales/en.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import fr from './locales/fr.json';
import ar from './locales/ar.json';
import he from './locales/he.json';
import zh from './locales/zh.json';
import ru from './locales/ru.json';
import tr from './locales/tr.json';
import ko from './locales/ko.json';
import ja from './locales/ja.json';

// ─── Language metadata ────────────────────────────────────────────────────────

export interface LangMeta {
  code:        string;
  label:       string;   // native name
  labelEn:     string;   // English name
  dir:         'ltr' | 'rtl';
  flag:        string;   // emoji flag
  /** BCP-47 locale for Intl.NumberFormat / Intl.DateTimeFormat */
  locale:      string;
}

export const SUPPORTED_LANGS: LangMeta[] = [
  { code: 'en', label: 'English',    labelEn: 'English',    dir: 'ltr', flag: '🇺🇸', locale: 'en-US' },
  { code: 'es', label: 'Español',    labelEn: 'Spanish',    dir: 'ltr', flag: '🇪🇸', locale: 'es-ES' },
  { code: 'pt', label: 'Português',  labelEn: 'Portuguese', dir: 'ltr', flag: '🇧🇷', locale: 'pt-BR' },
  { code: 'fr', label: 'Français',   labelEn: 'French',     dir: 'ltr', flag: '🇫🇷', locale: 'fr-FR' },
  { code: 'ar', label: 'العربية',    labelEn: 'Arabic',     dir: 'rtl', flag: '🇸🇦', locale: 'ar-SA' },
  { code: 'he', label: 'עברית',      labelEn: 'Hebrew',     dir: 'rtl', flag: '🇮🇱', locale: 'he-IL' },
  { code: 'zh', label: '中文',       labelEn: 'Chinese',    dir: 'ltr', flag: '🇨🇳', locale: 'zh-CN' },
  { code: 'ru', label: 'Русский',    labelEn: 'Russian',    dir: 'ltr', flag: '🇷🇺', locale: 'ru-RU' },
  { code: 'tr', label: 'Türkçe',     labelEn: 'Turkish',    dir: 'ltr', flag: '🇹🇷', locale: 'tr-TR' },
  { code: 'ko', label: '한국어',     labelEn: 'Korean',     dir: 'ltr', flag: '🇰🇷', locale: 'ko-KR' },
  { code: 'ja', label: '日本語',     labelEn: 'Japanese',   dir: 'ltr', flag: '🇯🇵', locale: 'ja-JP' },
];

/** Language codes that use right-to-left text direction */
export const RTL_LANGS = new Set(['ar', 'he']);

/** Lookup by code → LangMeta */
export const LANG_MAP: Record<string, LangMeta> = Object.fromEntries(
  SUPPORTED_LANGS.map((l) => [l.code, l]),
);

// ─── RTL helpers ──────────────────────────────────────────────────────────────

/**
 * Returns true if `code` is a right-to-left language.
 * @example isRTL('ar') → true
 * @example isRTL('en') → false
 */
export function isRTL(code: string): boolean {
  return RTL_LANGS.has(code);
}

/**
 * Apply RTL layout to the document.
 * Sets `document.dir = 'rtl'` and adds class 'rtl' to `<html>`.
 * Called automatically by `changeLanguage()` for ar/he.
 */
export function applyRTL(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dir = 'rtl';
  document.documentElement.classList.add('rtl');
  document.documentElement.classList.remove('ltr');
}

/**
 * Apply LTR layout to the document.
 * Called automatically by `changeLanguage()` for all non-RTL languages.
 */
export function applyLTR(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dir = 'ltr';
  document.documentElement.classList.add('ltr');
  document.documentElement.classList.remove('rtl');
}

/**
 * Apply the correct text direction for a language code.
 * @param code — BCP-47 language code e.g. 'ar', 'en'
 */
export function applyDirection(code: string): void {
  isRTL(code) ? applyRTL() : applyLTR();
}

// ─── Language switcher ────────────────────────────────────────────────────────

/**
 * Switch the active language and apply the corresponding text direction.
 * Persists the selection to localStorage via i18next-browser-languagedetector.
 *
 * @param code — one of the 11 supported language codes
 *
 * @example
 * await changeLanguage('ar');   // Arabic + RTL
 * await changeLanguage('en');   // English + LTR
 *
 * @example
 * // Language selector component
 * const handleChange = async (code: string) => {
 *   await changeLanguage(code);
 *   // UI re-renders automatically via react-i18next
 * };
 */
export async function changeLanguage(code: string): Promise<void> {
  if (!LANG_MAP[code]) {
    console.warn(`[i18n] Unsupported language: "${code}". Falling back to "en".`);
    code = 'en';
  }
  await i18n.changeLanguage(code);
  applyDirection(code);
}

// ─── Number / currency formatter ─────────────────────────────────────────────

/**
 * Format a number using the current locale's conventions.
 * Used by KPI cards to localise thousands separators.
 *
 * @example
 * // With locale 'en-US':  fmtNumber(531200) → "531,200"
 * // With locale 'de-DE':  fmtNumber(531200) → "531.200"
 * // With locale 'ar-SA':  fmtNumber(531200) → "٥٣١٬٢٠٠"
 */
export function fmtNumber(value: number): string {
  const meta = LANG_MAP[i18n.language] ?? LANG_MAP['en'];
  try {
    return new Intl.NumberFormat(meta.locale).format(value);
  } catch {
    return value.toLocaleString();
  }
}

/**
 * Format a currency value using the current locale.
 *
 * @example
 * fmtCurrency(48290, 'USD')  →  "$48,290"  (en-US)
 * fmtCurrency(48290, 'USD')  →  "48 290 $" (fr-FR)
 * fmtCurrency(48290, 'USD')  →  "٤٨٬٢٩٠ US$" (ar-SA)
 */
export function fmtCurrency(value: number, currency = 'USD'): string {
  const meta = LANG_MAP[i18n.language] ?? LANG_MAP['en'];
  try {
    return new Intl.NumberFormat(meta.locale, {
      style:    'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${value.toLocaleString()}`;
  }
}

// ─── i18next init ─────────────────────────────────────────────────────────────

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // ── Resources ──────────────────────────────────────────────────
    resources: {
      en: { translation: en },
      es: { translation: es },
      pt: { translation: pt },
      fr: { translation: fr },
      ar: { translation: ar },
      he: { translation: he },
      zh: { translation: zh },
      ru: { translation: ru },
      tr: { translation: tr },
      ko: { translation: ko },
      ja: { translation: ja },
    },

    // ── Language detection order ────────────────────────────────────
    // 1. localStorage  (persisted user preference)
    // 2. navigator     (browser language)
    // 3. htmlTag       (document lang attribute)
    // 4. fallback      (en)
    detection: {
      order:          ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'lumindad_lang',
      caches:         ['localStorage'],
    },

    // ── Fallback chain ──────────────────────────────────────────────
    // pt → es → en  (Portuguese falls back to Spanish before English)
    // All other non-English fall back directly to en.
    fallbackLng: {
      pt:      ['es', 'en'],
      default: ['en'],
    },
    supportedLngs:  SUPPORTED_LANGS.map((l) => l.code),

    // ── Interpolation ───────────────────────────────────────────────
    interpolation: {
      escapeValue: false,   // React already escapes
    },

    // ── Pluralisation ───────────────────────────────────────────────
    // i18next uses standard CLDR plural rules per language.
    // Keys: file_one / file_other  (en, es, pt, fr, tr, ko, ja, zh)
    //       file_one / file_few / file_many / file_other  (ru, ar)
    //       file_one / file_two / file_many / file_other  (he)
    pluralSeparator: '_',

    // ── Debug & missing key logging ─────────────────────────────────
    debug: import.meta.env.DEV,
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: import.meta.env.DEV
      ? (_lngs: readonly string[], _ns: string, key: string) => {
          console.warn(`[i18n] Missing key: "${key}"`);
        }
      : undefined,

    // ── React options ───────────────────────────────────────────────
    react: {
      useSuspense: false,   // Avoid suspense boundary complexity
    },
  });

// ─── Event: languageChanged ───────────────────────────────────────────────────
// Fires on every i18n.changeLanguage() call and on initial detection.
// Keeps document direction in sync without requiring manual applyDirection()
// calls in every component.

i18n.on('languageChanged', (code: string) => {
  applyDirection(code);
});

// Apply direction for the initially detected language on load.
// Guard handles SSR environments where document is undefined.
if (typeof document !== 'undefined') {
  if (i18n.isInitialized && i18n.language) {
    applyDirection(i18n.language);
  }
}

// ─── t() for non-React consumers ─────────────────────────────────────────────

/**
 * Direct access to i18next translate function for use outside React components.
 * Inside React always prefer `useTranslation()` hook for reactivity.
 *
 * @example
 * import { t } from '@/i18n';
 * setError(t('common.status.error'));
 * const msg = t('upload.done.summary_other', { count: files.length });
 */
export const t = i18n.t.bind(i18n);

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/**
 * Returns full LangMeta for a language code, or undefined if unsupported.
 *
 * @example
 * getLangInfo('ar') → { code:'ar', label:'العربية', dir:'rtl', locale:'ar-SA', ... }
 */
export function getLangInfo(code: string): LangMeta | undefined {
  return LANG_MAP[code];
}

/**
 * Returns the currently active language code.
 *
 * @example
 * getCurrentLang() // → 'es'
 */
export function getCurrentLang(): string {
  return i18n.language ?? 'en';
}

/**
 * Returns true if the currently active language uses RTL script.
 *
 * @example
 * const flip = isCurrentRTL() ? 'scaleX(-1)' : 'none';
 */
export function isCurrentRTL(): boolean {
  return isRTL(getCurrentLang());
}

export default i18n;
