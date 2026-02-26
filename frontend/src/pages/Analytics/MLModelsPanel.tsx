/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Analytics · MLModelsPanel
 *  src/pages/Analytics/MLModelsPanel.tsx
 *
 *  Purpose
 *   Full-width card displaying the 4 active ML models from the
 *   LumindAd.jsx AnalyticsPage (lines 621–645). Each model appears
 *   as a coloured mini-card in a 4-column grid.
 *
 *  Anatomy
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  🧠  ML Models Active — TensorFlow · XGBoost · SHAP     │
 *   │                                                          │
 *   │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
 *   │  │ XGBOOST●  │ │ISO FOR.●  │ │NEURAL N.●  │ │AUTOML ○  │   │
 *   │  │ Churn     │ │ Anomaly   │ │ Click     │ │ ROAS     │   │
 *   │  │ Predictor │ │ Detector  │ │ Predictor │ │ Optimizer│   │
 *   │  │ Acc:87.3% │ │ Acc:94.1% │ │ Acc:82.7% │ │ Acc:91.2%│   │
 *   │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
 *   └──────────────────────────────────────────────────────────┘
 *
 *  Model card tokens (from LumindAd.jsx line 629–644)
 *   Outer card   padding 14   borderRadius 12
 *                background ${color}09  (hex opacity ~3.5%)
 *                border      1px solid ${color}20  (~12.5% opacity)
 *   Type label   fontSize 10  fontWeight 700  color m.color
 *                textTransform uppercase  letterSpacing 0.5
 *   Status dot   width/height 7  borderRadius 50%
 *                #10b981 when status="active"
 *                #f59e0b when status="training" (or any other)
 *                marginTop 2  display inline-block
 *   Model name   fontWeight 600  fontSize 13  color #e8e8f8  marginBottom 4
 *   Accuracy row fontSize 12  color #64748b
 *                "Accuracy: " + <strong color=m.color>{m.acc}</strong>
 *
 *  Panel header (from LumindAd.jsx line 623)
 *   🧠 icon + "ML Models Active — TensorFlow · XGBoost · SHAP Explainability"
 *   fontWeight 700  fontSize 16  color #e8e8f8  marginBottom 16
 *   display flex  alignItems center  gap 10
 *
 *  Model data (from LumindAd.jsx line 630)
 *   Churn Predictor   XGBoost          87.3%  active    #7c3aed
 *   Anomaly Detector  Isolation Forest 94.1%  active    #06b6d4
 *   Click Predictor   Neural Network   82.7%  active    #10b981
 *   ROAS Optimizer    AutoML           91.2%  training  #f59e0b
 *
 *  Status dot colour rule
 *   status === 'active'  → #10b981  (green)
 *   status !== 'active'  → #f59e0b  (amber — "training" in prototype)
 *   This matches the exact ternary in LumindAd.jsx line 641:
 *     background: m.status==='active' ? '#10b981' : '#f59e0b'
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – Outer card: role="region" aria-label="Active ML Models"
 *   – Model grid: role="list"
 *   – Each model card: role="listitem" aria-label describing model + status
 *   – Status dot: aria-hidden="true" (status conveyed by text in aria-label)
 *   – Colour is NOT the sole indicator: "ACTIVE" / "TRAINING" text also present
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ─── Data ─────────────────────────────────────────────────────────────────────

export interface MLModel {
  name:   string;
  type:   string;
  acc:    string;
  status: 'active' | 'training';
  color:  string;
}

/** Mirrors the inline array in LumindAd.jsx lines 630–634 exactly. */
export const ML_MODELS_DEFAULT: MLModel[] = [
  { name: 'Churn Predictor',  type: 'XGBoost',          acc: '87.3%', status: 'active',   color: '#7c3aed' },
  { name: 'Anomaly Detector', type: 'Isolation Forest', acc: '94.1%', status: 'active',   color: '#06b6d4' },
  { name: 'Click Predictor',  type: 'Neural Network',   acc: '82.7%', status: 'active',   color: '#10b981' },
  { name: 'ROAS Optimizer',   type: 'AutoML',           acc: '91.2%', status: 'training', color: '#f59e0b' },
];

// ─── Public API ───────────────────────────────────────────────────────────────

export interface MLModelsPanelProps {
  /**
   * Array of ML models to display. Must not exceed 4 — grid is fixed at
   * `repeat(4, 1fr)` to match the LumindAd.jsx layout.
   * @default ML_MODELS_DEFAULT
   */
  models?: MLModel[];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const F = "'Outfit', system-ui, sans-serif";

/**
 * Individual model mini-card.
 * Tokens from LumindAd.jsx lines 636–644 applied 1:1.
 */
function ModelCard({ model }: { model: MLModel }) {
  // Status dot: #10b981 when active, #f59e0b otherwise
  // Matches JSX: background: m.status==='active' ? '#10b981' : '#f59e0b'
  const dotColor = model.status === 'active' ? '#10b981' : '#f59e0b';

  return (
    <div
      role="listitem"
      aria-label={`${model.name}: ${model.type}, accuracy ${model.acc}, status ${model.status}`}
      style={{
        padding:      '14px',
        borderRadius: '12px',
        // ${color}09 = hex opacity 9/255 ≈ 3.5%  (from LumindAd.jsx line 638)
        background:    `${model.color}09`,
        border:        `1px solid ${model.color}20`,
        transition:    'transform 0.2s ease, border-color 0.2s ease',
      }}
      onMouseEnter={(e) => {
        Object.assign(e.currentTarget.style, {
          transform:   'translateY(-2px)',
          borderColor: `${model.color}45`,
        });
      }}
      onMouseLeave={(e) => {
        Object.assign(e.currentTarget.style, {
          transform:   '',
          borderColor: `${model.color}20`,
        });
      }}
    >
      {/* Type label row + status dot */}
      <div
        style={{
          display:        'flex',
          justifyContent: 'space-between',
          marginBottom:   '8px',
          alignItems:     'flex-start',
        }}
      >
        <span
          style={{
            fontSize:      '10px',
            fontWeight:     700,
            color:          model.color,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontFamily:     F,
            lineHeight:     1.2,
          }}
        >
          {model.type}
        </span>

        {/* Status dot — aria-hidden, status in listitem aria-label */}
        <span
          aria-hidden="true"
          style={{
            width:        '7px',
            height:       '7px',
            borderRadius: '50%',
            background:    dotColor,
            display:      'inline-block',
            marginTop:    '2px',
            flexShrink:    0,
          }}
        />
      </div>

      {/* Model name */}
      <div
        style={{
          fontWeight:   600,
          fontSize:     '13px',
          color:        '#e8e8f8',
          marginBottom: '4px',
          fontFamily:    F,
          lineHeight:    1.3,
        }}
      >
        {model.name}
      </div>

      {/* Accuracy row */}
      <div
        style={{
          fontSize:  '12px',
          color:     '#64748b',
          fontFamily: F,
        }}
      >
        Accuracy:{' '}
        <strong style={{ color: model.color, fontWeight: 700 }}>
          {model.acc}
        </strong>
      </div>

      {/* Status text (visible, not just the dot) */}
      <div
        style={{
          marginTop:     '8px',
          fontSize:      '10px',
          fontWeight:     600,
          color:          dotColor,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontFamily:     F,
        }}
      >
        ● {model.status}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Full-width ML Models panel showing 4 model cards in a grid.
 *
 * @example
 * // Analytics/index.tsx — default prototype data
 * <MLModelsPanel />
 *
 * @example
 * // With real model registry data
 * <MLModelsPanel models={apiResponse.mlModels} />
 */
export function MLModelsPanel({ models = ML_MODELS_DEFAULT }: MLModelsPanelProps) {
  const activeCount   = models.filter((m) => m.status === 'active').length;
  const trainingCount = models.filter((m) => m.status !== 'active').length;

  return (
    <section
      role="region"
      aria-label={`Active ML Models: ${activeCount} active, ${trainingCount} training`}
      style={{
        background:     'rgba(15, 10, 30, 0.85)',
        border:         '1px solid rgba(124, 58, 237, 0.15)',
        borderRadius:   '16px',
        backdropFilter: 'blur(12px)',
        padding:        '24px',
      }}
    >
      {/* Panel header — matches LumindAd.jsx line 623 */}
      <div
        style={{
          fontWeight:   700,
          fontSize:     '16px',
          marginBottom: '16px',
          color:        '#e8e8f8',
          display:      'flex',
          alignItems:   'center',
          gap:          '10px',
          fontFamily:    F,
        }}
      >
        <span aria-hidden="true">🧠</span>
        ML Models Active — TensorFlow · XGBoost · SHAP Explainability
      </div>

      {/* Model grid — repeat(4,1fr) gap 12 */}
      <div
        role="list"
        aria-label="ML model cards"
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap:                 '12px',
        }}
      >
        {models.map((m) => (
          <ModelCard key={m.name} model={m} />
        ))}
      </div>
    </section>
  );
}

MLModelsPanel.displayName = 'MLModelsPanel';
export default MLModelsPanel;
