/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Pages · Campaigns
 *  src/pages/Campaigns/index.tsx
 *
 *  Route  /campaigns  (matched by App.tsx inside AppLayout)
 *
 *  State machine
 *
 *   ┌─────────────────┐  "+ New Campaign"  ┌─────────────────┐
 *   │   TABLE VIEW    │ ─────────────────► │  FORM (create)  │
 *   │                 │ ◄───────────────── │                 │
 *   │ search filters  │    onCancel/submit  │ blank fields    │
 *   │ CampaignTable   │                    │ CampaignForm    │
 *   └────────┬────────┘                    └─────────────────┘
 *            │ onEdit(campaign)
 *            ▼
 *   ┌─────────────────┐
 *   │  FORM (edit)    │  ← pre-populated from Campaign record
 *   │                 │
 *   │ CampaignForm    │
 *   └─────────────────┘
 *
 *  Search / filter logic (from LumindAd.jsx line 414–417)
 *   Matches case-insensitively on campaign `name` OR `platform`.
 *   Filtering happens on every render (no debounce needed at this scale).
 *
 *  Header actions (from LumindAd.jsx line 421–428)
 *   – SearchInput  width:220px  placeholder:"Search campaigns…"
 *   – "+ New Campaign" btn-primary
 *
 *  Form panel
 *   Shown below the header when `mode !== null`.
 *   The table disappears when the form is open — only one panel is
 *   visible at a time, matching the single-page prototype behaviour.
 *   A "← Back to campaigns" breadcrumb link gives a clear escape path.
 *
 *  campaigns state
 *   Seeded with CAMPAIGNS_DEFAULT (prototype data from LumindAd.jsx).
 *   – onEdit   → sets editingCampaign + shows form in "edit" mode
 *   – onToggle → toggles active ↔ paused inline (no API in prototype)
 *   – onSubmit (create) → pushes new campaign with generated id
 *   – onSubmit (edit)   → merges partial data into existing record
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – Breadcrumb "← Back to campaigns" is a <button> (no href — SPA)
 *   – aria-live="polite" on the search result count so screen readers
 *     announce "N campaigns" after each keystroke
 *   – Form section has aria-label matching the current mode
 *   – Header toolbar has role="toolbar"
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { useState }                        from 'react';
import { Header }                          from '../../components/layout/Header';
import { SearchInput }                     from '../../components/shared/SearchInput';
import { CampaignTable, CAMPAIGNS_DEFAULT } from './CampaignTable';
import { CampaignForm }                    from './CampaignForm';
import type { Campaign }                   from './CampaignTable';
import type { CampaignFormMode }           from './CampaignForm';

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'table' | CampaignFormMode;   // "table" | "create" | "edit"

// ─── ID generator ─────────────────────────────────────────────────────────────

let _idSeq = 7;
const nextId = () => `C-00${_idSeq++}`;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Campaigns management page — route /campaigns.
 *
 * Orchestrates search filtering, the data table, and the create/edit
 * form panel. Only one view is active at a time.
 *
 * @example
 * // App.tsx — consumed automatically by React Router
 * <Route path="/campaigns" element={<CampaignsPage />} />
 *
 * @example
 * // View mode transitions driven by user actions:
 * //   Initial render            → "table" (CampaignTable visible)
 * //   Click "+ New Campaign"    → "create" (CampaignForm blank)
 * //   Click "Edit" on any row  → "edit"   (CampaignForm pre-populated)
 * //   Submit or Cancel form    → "table" (back to CampaignTable)
 *
 * @example
 * // Search filter behaviour (matches LumindAd.jsx line 415):
 * //   query "google"   → matches "Summer Sale 2025" (Google Ads platform)
 * //   query "tiktok"   → matches "Product Launch Beta" (TikTok platform)
 * //   query "brand"    → matches "Brand Awareness Q1" (name contains "brand")
 * //   query "xyz"      → empty table, shows "No campaigns match…" message
 */
export default function CampaignsPage() {
  // ── Core state ──────────────────────────────────────────────
  const [campaigns,       setCampaigns]       = useState<Campaign[]>(CAMPAIGNS_DEFAULT);
  const [search,          setSearch]          = useState('');
  const [viewMode,        setViewMode]        = useState<ViewMode>('table');
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  // ── Derived ─────────────────────────────────────────────────
  // Mirrors LumindAd.jsx filter: name OR platform, case-insensitive
  const filtered = campaigns.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.platform.toLowerCase().includes(q)
    );
  });

  // ── Handlers ────────────────────────────────────────────────

  const handleEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setViewMode('edit');
  };

  const handleToggle = (campaign: Campaign) => {
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === campaign.id
          ? { ...c, status: c.status === 'active' ? 'paused' : 'active' }
          : c
      )
    );
  };

  const handleFormSubmit = (data: Partial<Campaign>) => {
    if (viewMode === 'edit' && editingCampaign) {
      // Merge partial data into existing record
      setCampaigns((prev) =>
        prev.map((c) => (c.id === editingCampaign.id ? { ...c, ...data } : c))
      );
    } else {
      // Add new campaign with generated id and zero stats
      const newCampaign: Campaign = {
        id:          nextId(),
        name:        data.name        ?? 'New Campaign',
        platform:    data.platform    ?? 'Google Ads',
        status:      data.status      ?? 'draft',
        budget:      data.budget      ?? 0,
        spent:        0,
        impressions:  0,
        clicks:       0,
        ctr:         '—',
        conv:         0,
        roas:         0,
        ...data,
      };
      setCampaigns((prev) => [newCampaign, ...prev]);
    }
    handleBackToTable();
  };

  const handleBackToTable = () => {
    setViewMode('table');
    setEditingCampaign(null);
  };

  // ── Render ──────────────────────────────────────────────────

  const isFormOpen = viewMode === 'create' || viewMode === 'edit';

  return (
    <>
      {/* ── Page header ──────────────────────────────────── */}
      <Header
        title="Campaigns"
        subtitle="Manage and track all your advertising campaigns"
        actions={
          isFormOpen ? undefined : (
            <>
              {/* SearchInput — 220px width, exact match to JSX line 423 */}
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search campaigns…"
                ariaLabel="Search campaigns by name or platform"
                width="220px"
              />

              {/* New Campaign button */}
              <button
                onClick={() => setViewMode('create')}
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
                + New Campaign
              </button>
            </>
          )
        }
      />

      {/* ── TABLE VIEW ────────────────────────────────────── */}
      {!isFormOpen && (
        <>
          {/* Accessible result count — announced after each keystroke */}
          <p
            aria-live="polite"
            aria-atomic="true"
            style={{
              fontSize:     '12px',
              color:        '#475569',
              marginBottom: '12px',
              fontFamily:  "'Outfit', system-ui, sans-serif",
            }}
          >
            {search
              ? `${filtered.length} campaign${filtered.length !== 1 ? 's' : ''} matching "${search}"`
              : `${filtered.length} campaign${filtered.length !== 1 ? 's' : ''} total`}
          </p>

          <CampaignTable
            campaigns={filtered}
            onEdit={handleEdit}
            onToggle={handleToggle}
            emptyMessage={
              search
                ? `No campaigns match "${search}". Try a different search term.`
                : 'No campaigns yet. Create your first one!'
            }
          />
        </>
      )}

      {/* ── FORM VIEW ─────────────────────────────────────── */}
      {isFormOpen && (
        <section aria-label={viewMode === 'edit' ? 'Edit campaign' : 'Create new campaign'}>
          {/* Breadcrumb back link */}
          <button
            onClick={handleBackToTable}
            aria-label="Back to campaigns list"
            style={{
              background:   'none',
              border:       'none',
              color:        '#a78bfa',
              fontSize:     '13px',
              fontWeight:    600,
              fontFamily:  "'Outfit', system-ui, sans-serif",
              cursor:       'pointer',
              marginBottom: '20px',
              padding:       0,
              display:      'flex',
              alignItems:   'center',
              gap:          '6px',
              transition:   'color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#c4b5fd'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#a78bfa'; }}
          >
            ← Back to campaigns
          </button>

          {/* Form title breadcrumb */}
          <div
            style={{
              fontSize:     '12px',
              color:        '#475569',
              marginBottom: '20px',
              fontFamily:  "'Outfit', system-ui, sans-serif",
            }}
          >
            {viewMode === 'edit' && editingCampaign
              ? `Editing: ${editingCampaign.name}`
              : 'New Campaign — AI-powered ad creation with automatic optimization'}
          </div>

          <CampaignForm
            mode={viewMode as CampaignFormMode}
            initialData={viewMode === 'edit' ? editingCampaign ?? undefined : undefined}
            onSubmit={handleFormSubmit}
            onCancel={handleBackToTable}
          />
        </section>
      )}
    </>
  );
}

CampaignsPage.displayName = 'CampaignsPage';
