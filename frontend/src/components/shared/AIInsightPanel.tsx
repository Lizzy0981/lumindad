/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Shared · AIInsightPanel
 *  src/components/shared/AIInsightPanel.tsx
 *
 *  Purpose
 *   Branded panel for surfacing AI-generated insights, budget
 *   recommendations, and ML model status cards. Supports two visual
 *   variants extracted directly from LumindAd.jsx:
 *
 *   variant="recommendation"  (BudgetPage — line 546)
 *   ┌──────────────────────────────────────────────────┐
 *   │  🤖 AI Recommendation                            │
 *   │  Reallocate $1,200 from Meta to Google Ads.      │
 *   │  XGBoost estimates +23% ROAS improvement.        │
 *   │  [Apply Suggestion]                              │
 *   └──────────────────────────────────────────────────┘
 *   bg: linear-gradient(135deg, rgba(124,58,237,.1), rgba(16,185,129,.05))
 *   border: 1px solid rgba(124,58,237,.2)
 *
 *   variant="models"  (AnalyticsPage — line 622)
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  🧠 ML Models Active — TensorFlow · XGBoost · SHAP          │
 *   │  ┌───────────┐ ┌────────────────┐ ┌──────────┐ ┌────────┐  │
 *   │  │ XGBOOST ● │ │ ISOLATION FOR. │ │ NEURAL N │ │ AUTOML │  │
 *   │  │ Churn     │ │ Anomaly Detect │ │ Click    │ │ ROAS   │  │
 *   │  │ 87.3%     │ │ 94.1%          │ │ 82.7%    │ │ 91.2%  │  │
 *   │  └───────────┘ └────────────────┘ └──────────┘ └────────┘  │
 *   └──────────────────────────────────────────────────────────────┘
 *
 *  Recommendation variant props
 *   title     : "🤖 AI Recommendation" (overridable)
 *   message   : ReactNode — supports <strong> highlights for values
 *   ctaLabel  : Button text (default: "Apply Suggestion")
 *   onApply   : Callback fired when the CTA is clicked
 *   applied   : When true, shows a green "✓ Applied" confirmation state
 *
 *  Models variant props
 *   models    : MLModel[] — each card in the 4-column grid
 *   MLModel fields: name · type (algorithm) · accuracy · status ('active'|'training')
 *                   color (accent)
 *
 *  Model status colours
 *   active   → #10b981  (green — live status dot)
 *   training → #f59e0b  (amber — pulsing dot)
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – role="region" + aria-label names both panel variants
 *   – "Apply Suggestion" button is a native <button> — no role override
 *   – Model status dots have aria-label ("Active" / "Training")
 *   – Accuracy values are presented as readable text, not just colour
 *   – applied state change is announced via aria-live="polite"
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { useState, type ReactNode, type CSSProperties } from 'react';

// ─── Public API ───────────────────────────────────────────────────────────────

export type AIInsightVariant = 'recommendation' | 'models';

/** A single ML model card in the `models` variant. */
export interface MLModel {
  /**
   * Human-readable model name shown as the card title.
   * @example "Churn Predictor" | "Anomaly Detector"
   */
  name: string;
  /**
   * Algorithm / framework label shown as the small uppercase chip.
   * @example "XGBoost" | "Isolation Forest" | "Neural Network" | "AutoML"
   */
  type: string;
  /**
   * Model accuracy displayed at the bottom of the card.
   * @example "87.3%" | "94.1%"
   */
  accuracy: string;
  /**
   * Current operational status. Drives the indicator dot colour.
   * @default "active"
   */
  status?: 'active' | 'training';
  /**
   * Accent colour for the card background tint and the type chip.
   * @example "#7c3aed" | "#06b6d4" | "#10b981" | "#f59e0b"
   */
  color: string;
}

// ── Recommendation variant props ──

export interface RecommendationPanelProps {
  variant: 'recommendation';
  /**
   * Panel heading. Supports emoji prefix.
   * @default "🤖 AI Recommendation"
   */
  title?: string;
  /**
   * Insight body. May include JSX for <strong>-highlighted values.
   *
   * @example
   * message={<>
   *   Reallocate <strong style={{ color:'#10b981' }}>$1,200</strong> from Meta to Google Ads.
   *   XGBoost estimates <strong style={{ color:'#f59e0b' }}>+23% ROAS</strong> improvement.
   * </>}
   */
  message: ReactNode;
  /**
   * CTA button label.
   * @default "Apply Suggestion"
   */
  ctaLabel?: string;
  /**
   * Fired when the user clicks the CTA button.
   * If omitted, no CTA button is rendered.
   */
  onApply?: () => void;
  /**
   * When true, the CTA transitions to a green "✓ Applied" state.
   * Useful for indicating the suggestion has been acted upon.
   * @default false
   */
  applied?: boolean;
}

// ── Models variant props ──

export interface ModelsPanelProps {
  variant: 'models';
  /**
   * Panel heading.
   * @default "🧠 ML Models Active"
   */
  title?: string;
  /**
   * Array of ML model cards to render in the 4-column grid.
   * Matches the AnalyticsPage ML models data in LumindAd.jsx.
   */
  models: MLModel[];
}

export type AIInsightPanelProps = RecommendationPanelProps | ModelsPanelProps;

// ─── Design tokens ────────────────────────────────────────────────────────────

const GLOW_PULSE_KF = `
  @keyframes lad-glow-pulse {
    0%, 100% { box-shadow: 0 0 4px rgba(124,58,237,.4); }
    50%       { box-shadow: 0 0 12px rgba(124,58,237,.8); }
  }
  @keyframes lad-amber-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }
`;

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Recommendation panel: gradient bg, message, CTA button. */
function RecommendationPanel({
  title    = '🤖 AI Recommendation',
  message,
  ctaLabel = 'Apply Suggestion',
  onApply,
  applied  = false,
}: Omit<RecommendationPanelProps, 'variant'>) {
  const [isApplied, setIsApplied] = useState(applied);

  const handleApply = () => {
    setIsApplied(true);
    onApply?.();
  };

  return (
    <div
      role="region"
      aria-label="AI Recommendation"
      style={{
        padding:      '20px',
        borderRadius: '12px',
        background:   'linear-gradient(135deg, rgba(124,58,237,0.10), rgba(16,185,129,0.05))',
        border:       '1px solid rgba(124, 58, 237, 0.2)',
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize:     '14px',
          fontWeight:    700,
          color:        '#a78bfa',
          marginBottom: '10px',
          fontFamily:  "'Outfit', system-ui, sans-serif",
        }}
      >
        {title}
      </div>

      {/* Message */}
      <p
        style={{
          fontSize:   '12px',
          color:      '#64748b',
          lineHeight:  1.6,
          margin:      0,
          fontFamily:"'Outfit', system-ui, sans-serif",
        }}
      >
        {message}
      </p>

      {/* CTA button */}
      {onApply && (
        <div aria-live="polite" aria-atomic="true">
          <button
            onClick={isApplied ? undefined : handleApply}
            disabled={isApplied}
            style={{
              marginTop:    '14px',
              width:        '100%',
              padding:      '10px 22px',
              borderRadius: '10px',
              border:       'none',
              fontSize:     '12px',
              fontWeight:    600,
              fontFamily:  "'Outfit', system-ui, sans-serif",
              cursor:        isApplied ? 'default' : 'pointer',
              transition:   'all 0.2s ease',
              background:    isApplied
                ? 'linear-gradient(135deg, #059669, #065f46)'
                : 'linear-gradient(135deg, #7c3aed, #5b21b6)',
              color:        '#fff',
              letterSpacing:'0.3px',
            }}
            onMouseEnter={(e) => {
              if (!isApplied) {
                Object.assign(e.currentTarget.style, {
                  transform:  'translateY(-2px)',
                  boxShadow: '0 8px 24px rgba(124,58,237,0.45)',
                });
              }
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, {
                transform: '',
                boxShadow: '',
              });
            }}
          >
            {isApplied ? '✓ Applied' : ctaLabel}
          </button>
        </div>
      )}
    </div>
  );
}

/** Single ML model card used inside the models grid. */
function ModelCard({ model }: { model: MLModel }) {
  const isActive    = (model.status ?? 'active') === 'active';
  const dotColor    = isActive ? '#10b981' : '#f59e0b';
  const dotAnim     = isActive ? 'lad-glow-pulse 2s ease-in-out infinite' : 'lad-amber-pulse 1.2s ease-in-out infinite';
  const dotLabel    = isActive ? 'Active' : 'Training';

  return (
    <div
      style={{
        padding:      '14px',
        borderRadius: '12px',
        background:   `${model.color}09`,    // color at ~3.5% opacity
        border:       `1px solid ${model.color}20`,  // color at ~12.5% opacity
      }}
    >
      {/* Algorithm chip + status dot */}
      <div
        style={{
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
          marginBottom:   '8px',
        }}
      >
        <span
          style={{
            fontSize:      '10px',
            fontWeight:     700,
            color:          model.color,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontFamily:   "'Outfit', system-ui, sans-serif",
          }}
        >
          {model.type}
        </span>
        <span
          aria-label={dotLabel}
          style={{
            width:        '7px',
            height:       '7px',
            borderRadius: '50%',
            background:    dotColor,
            display:      'inline-block',
            animation:     dotAnim,
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
          fontFamily:  "'Outfit', system-ui, sans-serif",
        }}
      >
        {model.name}
      </div>

      {/* Accuracy */}
      <div
        style={{
          fontSize:   '12px',
          color:      '#64748b',
          fontFamily:"'Outfit', system-ui, sans-serif",
        }}
      >
        Accuracy:{' '}
        <strong style={{ color: model.color }}>{model.accuracy}</strong>
      </div>
    </div>
  );
}

/** ML models grid panel. */
function ModelsPanel({
  title  = '🧠 ML Models Active',
  models,
}: Omit<ModelsPanelProps, 'variant'>) {
  return (
    <div
      role="region"
      aria-label="ML Models Status"
      style={{
        background:     'rgba(15, 10, 30, 0.85)',
        border:         '1px solid rgba(124, 58, 237, 0.15)',
        borderRadius:   '16px',
        backdropFilter: 'blur(12px)',
        padding:        '24px',
      }}
    >
      {/* Title */}
      <div
        style={{
          fontWeight:    700,
          fontSize:     '16px',
          marginBottom: '16px',
          color:        '#e8e8f8',
          display:      'flex',
          alignItems:   'center',
          gap:          '10px',
          fontFamily:  "'Outfit', system-ui, sans-serif",
        }}
      >
        {title}
        <span
          style={{
            fontSize:      '11px',
            color:         '#64748b',
            fontWeight:     400,
            letterSpacing: '0.3px',
          }}
        >
          TensorFlow · XGBoost · SHAP Explainability
        </span>
      </div>

      {/* Model cards grid */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: `repeat(${Math.min(models.length, 4)}, 1fr)`,
          gap:                 '12px',
        }}
      >
        {models.map((model) => (
          <ModelCard key={model.name} model={model} />
        ))}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Polymorphic AI insight panel — renders either a recommendation card
 * or an ML models status grid depending on the `variant` prop.
 *
 * @example
 * // BudgetPage — recommendation panel (matches LumindAd.jsx exactly)
 * <AIInsightPanel
 *   variant="recommendation"
 *   message={<>
 *     Reallocate <strong style={{ color: '#10b981' }}>$1,200</strong> from Meta to Google Ads.
 *     Predictive model (XGBoost) estimates <strong style={{ color: '#f59e0b' }}>+23% ROAS</strong> improvement.
 *   </>}
 *   onApply={() => console.log('Suggestion applied')}
 * />
 *
 * @example
 * // AnalyticsPage — ML models grid (matches LumindAd.jsx exactly)
 * <AIInsightPanel
 *   variant="models"
 *   models={[
 *     { name: 'Churn Predictor',  type: 'XGBoost',          accuracy: '87.3%', status: 'active',   color: '#7c3aed' },
 *     { name: 'Anomaly Detector', type: 'Isolation Forest', accuracy: '94.1%', status: 'active',   color: '#06b6d4' },
 *     { name: 'Click Predictor',  type: 'Neural Network',   accuracy: '82.7%', status: 'active',   color: '#10b981' },
 *     { name: 'ROAS Optimizer',   type: 'AutoML',           accuracy: '91.2%', status: 'training', color: '#f59e0b' },
 *   ]}
 * />
 *
 * @example
 * // Custom recommendation without CTA
 * <AIInsightPanel
 *   variant="recommendation"
 *   title="🔍 Anomaly Detected"
 *   message="CTR dropped 40% on Friday. Possible ad fatigue on Meta campaigns."
 * />
 */
export function AIInsightPanel(props: AIInsightPanelProps) {
  return (
    <>
      <style>{GLOW_PULSE_KF}</style>

      {props.variant === 'recommendation' ? (
        <RecommendationPanel
          title={props.title}
          message={props.message}
          ctaLabel={props.ctaLabel}
          onApply={props.onApply}
          applied={props.applied}
        />
      ) : (
        <ModelsPanel
          title={props.title}
          models={props.models}
        />
      )}
    </>
  );
}

AIInsightPanel.displayName = 'AIInsightPanel';

export default AIInsightPanel;
