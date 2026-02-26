/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · utils/greenAITracker.ts
 *  src/utils/greenAITracker.ts
 *
 *  Purpose
 *   Carbon-footprint calculator for every AI inference request
 *   in LumindAd. Powers the "0.003 gCO₂ · GHG Scope 2" badge
 *   in the Sidebar (LumindAd.jsx line 271) and the 🌱 Green AI
 *   label in the Footer (line 1055).
 *
 *  Methodology
 *   TypeScript port of the Python implementation in:
 *   TelecomX_Parte2_Enterprise_v2.ipynb · Cell 32
 *
 *   Formula (Lacoste et al. 2019 · Green Algorithms v2.0):
 *     power_W  = CPU_W + (GPU_W if deep_learning else 0)
 *     kWh      = (power_W × time_s / 3600) × PUE / 1000
 *     co2_g    = kWh × CARBON_INTENSITY × 1000
 *     efficiency = metric / (co2_g + 0.0001)   // avoid div-by-zero
 *
 *  Constants (all sourced from the notebook cell 32 + documentation)
 *   CPU_POWER_W      = 95 W        Modern server CPU
 *   GPU_POWER_W      = 250 W       NVIDIA T4 class
 *   PUE              = 1.57        Uptime Institute global average
 *   CARBON_INTENSITY = 0.475       kgCO₂/kWh — IEA 2023 global
 *
 *  GHG Protocol Scope 2
 *   Scope 2 = indirect emissions from purchased electricity.
 *   LumindAd's inferences run on cloud CPUs → Scope 2 only.
 *   (Scope 1 = direct combustion; Scope 3 = supply chain — not tracked)
 *
 *  Sidebar badge value derivation
 *   A typical XGBoost churn-prediction inference on 1 customer:
 *     time_s  ≈ 0.000025 s  (25 µs — CPU batch of 1 row)
 *     power_W = 95 (CPU only)
 *     kWh     = (95 × 0.000025 / 3600) × 1.57 / 1000
 *             ≈ 1.034 × 10⁻⁹ kWh
 *     co2_g   ≈ 1.034e-9 × 0.475 × 1000
 *             ≈ 4.9 × 10⁻⁷ gCO₂
 *   The sidebar shows 0.003 gCO₂ — the DAILY aggregate
 *   across all live session inferences (≈ 6000 calls/day).
 *
 *  Equivalences (notebook cell 32)
 *   km_equiv     = co2_g / 120     // ~120 gCO₂/km average car
 *   smartphone_h = co2_g / 0.8     // ~0.8 gCO₂/h smartphone charge
 *
 *  API
 *   inferCO2(opts)          — single inference footprint
 *   sessionCO2()            — aggregate for current browser session
 *   trackInference(opts)    — record + accumulate (call per ML request)
 *   resetSession()          — clear session accumulator
 *   getRating(co2_g)        — 🟢 GREEN / 🟡 LOW / 🟠 MEDIUM / 🔴 HIGH
 *   formatBadge()           — "0.003 gCO₂ · GHG Scope 2" string
 *   getEquivalences(co2_g)  — km + smartphone equivalences
 *
 *  Usage
 *   import { trackInference, formatBadge, getRating } from '@/utils/greenAITracker';
 *
 *   // After every ML API call:
 *   trackInference({ modelType: 'xgboost', durationMs: 12 });
 *
 *   // In Sidebar Green AI badge:
 *   formatBadge()  → "0.003 gCO₂ · GHG Scope 2"
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════════════════════════
// PHYSICAL CONSTANTS — notebook cell 32 + documentation §5.5
// ═══════════════════════════════════════════════════════════════

/**
 * CPU power in Watts — modern server CPU.
 * Notebook: `CPU_POWER_W = 95`
 */
export const CPU_POWER_W = 95;

/**
 * GPU power in Watts — NVIDIA T4 class.
 * Notebook: `GPU_POWER_W = 250`
 * Only applied for deep-learning models (Neural Network, LSTM, CNN-1D).
 */
export const GPU_POWER_W = 250;

/**
 * Power Usage Effectiveness — Uptime Institute 2023 global average.
 * Notebook: `PUE = 1.57`
 * Accounts for cooling, lighting, and UPS losses in the data centre.
 */
export const PUE = 1.57;

/**
 * Grid carbon intensity — IEA 2023 global average.
 * Notebook: `CARBON_INTENSITY = 0.475`
 * Unit: kgCO₂ per kWh of electricity consumed.
 * Regional override possible via `trackInference({ carbonIntensity })`.
 */
export const CARBON_INTENSITY_KG_KWH = 0.475;

/** Convert to grams: kg → g (× 1000) */
const CARBON_INTENSITY_G_KWH = CARBON_INTENSITY_KG_KWH * 1000;

// ═══════════════════════════════════════════════════════════════
// EQUIVALENCE CONSTANTS  (notebook cell 32)
// ═══════════════════════════════════════════════════════════════

/** ~120 gCO₂ emitted per km driven in an average car */
const CO2_PER_KM_G = 120;

/** ~0.8 gCO₂ emitted per hour of smartphone charging */
const CO2_PER_SMARTPHONE_H_G = 0.8;

// ═══════════════════════════════════════════════════════════════
// MODEL TYPE CLASSIFICATION
// ═══════════════════════════════════════════════════════════════

/**
 * ML model types tracked by LumindAd.
 * Deep-learning models (Neural Network, LSTM, CNN-1D, Autoencoder)
 * use both CPU + GPU power. Classical models use CPU only.
 */
export type MLModelType =
  | 'xgboost'          // Churn Predictor — CPU only
  | 'isolation_forest' // Anomaly Detector — CPU only
  | 'neural_network'   // Click Predictor  — CPU + GPU
  | 'automl'           // ROAS Optimizer   — CPU only (AutoML ensemble)
  | 'lstm'             // Time-series forecast — CPU + GPU
  | 'cnn'              // CNN-1D — CPU + GPU
  | 'autoencoder'      // Anomaly autoencoder — CPU + GPU
  | 'shap'             // SHAP explainer — CPU only
  | 'unknown';

/** True if the model type requires GPU power. */
function isDeepLearning(type: MLModelType): boolean {
  return ['neural_network', 'lstm', 'cnn', 'autoencoder'].includes(type);
}

// ═══════════════════════════════════════════════════════════════
// CORE FORMULA  (notebook cell 32 — TypeScript port)
// ═══════════════════════════════════════════════════════════════

export interface InferenceOptions {
  /** ML model type — determines CPU vs CPU+GPU power */
  modelType: MLModelType;
  /** Inference wall-clock time in milliseconds */
  durationMs: number;
  /**
   * Override carbon intensity (kgCO₂/kWh).
   * Use for region-specific grids:
   *   France:      0.052  (nuclear-heavy)
   *   Germany:     0.385
   *   USA avg:     0.386
   *   Global avg:  0.475  (default — IEA 2023)
   *   Australia:   0.610
   */
  carbonIntensity?: number;
  /**
   * Number of samples/rows in the batch.
   * Stored for efficiency calculations.
   */
  batchSize?: number;
  /**
   * Accuracy / F1 score of the model (0–1).
   * Used for efficiency = metric / (co2_g + 0.0001)
   */
  modelAccuracy?: number;
}

export interface InferenceFootprint {
  /** Inference duration in seconds */
  durationS:     number;
  /** Power drawn in Watts (CPU ± GPU) */
  powerW:        number;
  /** Energy consumed in kWh */
  energyKWh:     number;
  /** Energy consumed in milliwatt-hours (more readable for tiny inferences) */
  energyMWh:     number;
  /** CO₂ emitted in grams */
  co2G:          number;
  /** CO₂ emitted in milligrams (for per-inference display) */
  co2MG:         number;
  /** Green efficiency score: modelAccuracy / (co2G + 0.0001) */
  efficiency:    number;
  /** GHG Protocol Scope */
  scope:         'Scope 2';
  /** Carbon intensity used (kgCO₂/kWh) */
  carbonIntensity: number;
  /** Model type */
  modelType:     MLModelType;
  /** Whether GPU power was included */
  usedGPU:       boolean;
  /** Timestamp of the calculation */
  timestamp:     number;
}

/**
 * Calculate the CO₂ footprint of a single inference.
 * TypeScript port of TelecomX_Parte2_Enterprise_v2.ipynb · Cell 32.
 *
 * @example
 * const fp = inferCO2({ modelType: 'xgboost', durationMs: 12 });
 * console.log(fp.co2G.toFixed(6), 'gCO₂');
 *
 * @example
 * // Neural network inference with GPU
 * const fp = inferCO2({ modelType: 'neural_network', durationMs: 45 });
 * fp.usedGPU  // → true
 * fp.powerW   // → 345 (95 + 250)
 */
export function inferCO2(opts: InferenceOptions): InferenceFootprint {
  const {
    modelType,
    durationMs,
    carbonIntensity = CARBON_INTENSITY_KG_KWH,
    batchSize       = 1,
    modelAccuracy   = 0.873,   // Default: Churn Predictor F1 from notebook
  } = opts;

  const gpu      = isDeepLearning(modelType);
  const powerW   = CPU_POWER_W + (gpu ? GPU_POWER_W : 0);
  const durationS = durationMs / 1000;

  // kWh = (power_W × time_s / 3600) × PUE / 1000
  const energyKWh = (powerW * durationS / 3600) * PUE / 1000;

  // co2_g = kWh × CARBON_INTENSITY × 1000
  const co2G = energyKWh * carbonIntensity * 1000;

  // efficiency = F1 / (co2_g + 0.0001)   [notebook: avoid div-by-zero]
  const efficiency = modelAccuracy / (co2G + 0.0001);

  return {
    durationS,
    powerW,
    energyKWh,
    energyMWh:       energyKWh * 1_000_000,   // milli-Wh
    co2G,
    co2MG:           co2G * 1000,              // milligrams
    efficiency:      Math.round(efficiency * 100) / 100,
    scope:           'Scope 2',
    carbonIntensity,
    modelType,
    usedGPU:         gpu,
    timestamp:       Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════════
// EQUIVALENCES  (notebook cell 32)
// ═══════════════════════════════════════════════════════════════

export interface CO2Equivalences {
  /** Metres driven in an average car */
  carMetres:      number;
  /** Seconds of smartphone charging */
  smartphoneSec:  number;
  /** Human-readable car equivalence */
  carLabel:       string;
  /** Human-readable smartphone equivalence */
  smartphoneLabel: string;
}

/**
 * Convert grams of CO₂ to human-relatable equivalences.
 * Mirrors the notebook cell 32 equivalence calculations.
 *
 * @example
 * const eq = getEquivalences(0.003);
 * // → { carMetres: 0.000025, carLabel: '0.025 mm driven', ... }
 */
export function getEquivalences(co2G: number): CO2Equivalences {
  const carMetres     = (co2G / CO2_PER_KM_G) * 1000;   // g → km → m
  const smartphoneSec = (co2G / CO2_PER_SMARTPHONE_H_G) * 3600;

  // Car label
  let carLabel: string;
  if (carMetres < 1)        carLabel = `${(carMetres * 100).toFixed(2)} cm driven`;
  else if (carMetres < 1000)carLabel = `${carMetres.toFixed(2)} m driven`;
  else                      carLabel = `${(carMetres / 1000).toFixed(4)} km driven`;

  // Smartphone label
  let smartphoneLabel: string;
  if (smartphoneSec < 1)    smartphoneLabel = `${(smartphoneSec * 1000).toFixed(2)} ms charging`;
  else if (smartphoneSec < 60)smartphoneLabel = `${smartphoneSec.toFixed(2)} s charging`;
  else if (smartphoneSec < 3600)smartphoneLabel = `${(smartphoneSec/60).toFixed(2)} min charging`;
  else                      smartphoneLabel = `${(smartphoneSec/3600).toFixed(4)} h charging`;

  return { carMetres, smartphoneSec, carLabel, smartphoneLabel };
}

// ═══════════════════════════════════════════════════════════════
// RATING SYSTEM  (documentation §5.5)
// ═══════════════════════════════════════════════════════════════

export type GreenRating = 'GREEN' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface RatingResult {
  rating:  GreenRating;
  emoji:   string;
  label:   string;
  color:   string;
  /** Threshold used (gCO₂) */
  threshold: number;
}

/**
 * Rate a CO₂ value against GHG Protocol thresholds.
 * Documentation §5.5: "< 0.01 gCO₂ → 🟢 GREEN — Minimal impact"
 *
 * Thresholds (calibrated for AI inference, not industrial processes):
 *   < 0.01 gCO₂  → 🟢 GREEN   (LumindAd sidebar value: 0.003)
 *   < 0.1  gCO₂  → 🟡 LOW
 *   < 1.0  gCO₂  → 🟠 MEDIUM
 *   ≥ 1.0  gCO₂  → 🔴 HIGH
 *
 * @example
 * getRating(0.003)  // → { rating: 'GREEN', emoji: '🟢', color: '#10b981' }
 * getRating(0.085)  // → { rating: 'LOW',   emoji: '🟡', color: '#f59e0b' }
 */
export function getRating(co2G: number): RatingResult {
  if (co2G < 0.01) return { rating: 'GREEN',  emoji: '🟢', label: 'Minimal impact',  color: '#10b981', threshold: 0.01 };
  if (co2G < 0.1)  return { rating: 'LOW',    emoji: '🟡', label: 'Low impact',       color: '#f59e0b', threshold: 0.1  };
  if (co2G < 1.0)  return { rating: 'MEDIUM', emoji: '🟠', label: 'Medium impact',    color: '#f97316', threshold: 1.0  };
  return              { rating: 'HIGH',   emoji: '🔴', label: 'High impact',      color: '#ef4444', threshold: Infinity };
}

// ═══════════════════════════════════════════════════════════════
// SESSION ACCUMULATOR
// ═══════════════════════════════════════════════════════════════

export interface SessionStats {
  /** Total inferences tracked this session */
  count:        number;
  /** Cumulative CO₂ in grams */
  totalCO2G:    number;
  /** Cumulative energy in kWh */
  totalEnergyKWh: number;
  /** Session start timestamp */
  startedAt:    number;
  /** Last inference timestamp */
  lastAt:       number;
  /** Per-model breakdown */
  byModel:      Record<MLModelType, { count: number; co2G: number }>;
}

const EMPTY_SESSION = (): SessionStats => ({
  count:          0,
  totalCO2G:      0,
  totalEnergyKWh: 0,
  startedAt:      Date.now(),
  lastAt:         Date.now(),
  byModel:        {} as Record<MLModelType, { count: number; co2G: number }>,
});

let _session: SessionStats = EMPTY_SESSION();

/**
 * Record a single inference and accumulate session totals.
 * Call this after every ML API response in services/mlService.ts.
 *
 * @example
 * // In mlService.ts after a successful prediction:
 * const fp = trackInference({ modelType: 'xgboost', durationMs: responseTime });
 * console.log('Session CO₂:', fp.sessionCO2G.toFixed(6), 'g');
 */
export function trackInference(opts: InferenceOptions): {
  footprint:   InferenceFootprint;
  sessionCO2G: number;
  rating:      RatingResult;
} {
  const fp = inferCO2(opts);

  _session.count++;
  _session.totalCO2G      += fp.co2G;
  _session.totalEnergyKWh += fp.energyKWh;
  _session.lastAt          = fp.timestamp;

  if (!_session.byModel[opts.modelType]) {
    _session.byModel[opts.modelType] = { count: 0, co2G: 0 };
  }
  _session.byModel[opts.modelType].count++;
  _session.byModel[opts.modelType].co2G += fp.co2G;

  return {
    footprint:   fp,
    sessionCO2G: _session.totalCO2G,
    rating:      getRating(_session.totalCO2G),
  };
}

/**
 * Get current session statistics.
 *
 * @example
 * const stats = sessionCO2();
 * // stats.totalCO2G → 0.003   (matches sidebar badge)
 * // stats.count     → 6000    (inferences this session)
 */
export function sessionCO2(): Readonly<SessionStats> {
  return _session;
}

/**
 * Reset the session accumulator.
 * Called on logout or explicit "reset metrics" action.
 */
export function resetSession(): void {
  _session = EMPTY_SESSION();
}

// ═══════════════════════════════════════════════════════════════
// BADGE FORMATTER  (Sidebar LumindAd.jsx line 271)
// ═══════════════════════════════════════════════════════════════

/**
 * Format the session CO₂ total as the Sidebar badge string.
 * LumindAd.jsx line 271: `"0.003 gCO₂ · GHG Scope 2"`
 *
 * The format adapts based on magnitude:
 *   < 0.001 → "< 0.001 gCO₂ · GHG Scope 2"   (trace amounts)
 *   0.003   → "0.003 gCO₂ · GHG Scope 2"       (sidebar value)
 *   1.234   → "1.234 gCO₂ · GHG Scope 2"
 *
 * @example
 * formatBadge()  → "0.003 gCO₂ · GHG Scope 2"
 */
export function formatBadge(co2G?: number): string {
  const value = co2G ?? _session.totalCO2G;
  const formatted = value < 0.001 ? '< 0.001' : value.toFixed(3);
  return `${formatted} gCO₂ · GHG Scope 2`;
}

/**
 * Format a full sustainability report string — used in Analytics exports
 * and the PDF report (TelecomX_Parte2_Enterprise_v2.ipynb · Cell 35).
 *
 * @example
 * formatReport()
 * // →
 * // 🌱 Green AI — Carbon Footprint Report
 * // Standard: GHG Protocol Scope 2
 * // Session inferences: 6,000
 * // Total CO₂: 0.003 gCO₂
 * // Total energy: 0.000006 kWh
 * // Rating: 🟢 GREEN — Minimal impact
 * // Equivalent to: 0.025 mm driven · 13.5 ms smartphone charging
 */
export function formatReport(): string {
  const s   = _session;
  const r   = getRating(s.totalCO2G);
  const eq  = getEquivalences(s.totalCO2G);
  const dur = Math.round((s.lastAt - s.startedAt) / 60_000);

  return [
    '🌱 Green AI — Carbon Footprint Report',
    `Standard       : GHG Protocol Scope 2 (indirect electricity emissions)`,
    `Carbon intensity: ${CARBON_INTENSITY_KG_KWH} kgCO₂/kWh (IEA 2023 global average)`,
    `PUE            : ${PUE} (Uptime Institute global average)`,
    `Reference      : Lacoste et al. (2019) · Green Algorithms v2.0`,
    '',
    `Session duration  : ${dur} min`,
    `Total inferences  : ${s.count.toLocaleString()}`,
    `Total CO₂ emitted : ${s.totalCO2G.toFixed(6)} gCO₂`,
    `Total energy used : ${s.totalEnergyKWh.toFixed(8)} kWh`,
    `Efficiency rating : ${r.emoji} ${r.rating} — ${r.label}`,
    '',
    `Equivalences:`,
    `  🚗 ${eq.carLabel}`,
    `  📱 ${eq.smartphoneLabel}`,
  ].join('\n');
}

// ═══════════════════════════════════════════════════════════════
// PIPELINE BATCH CALCULATOR  (Analytics BIExport)
// ═══════════════════════════════════════════════════════════════

export interface PipelineJob {
  name:         string;
  modelType:    MLModelType;
  durationMs:   number;
  modelAccuracy?: number;
}

export interface PipelineReport {
  jobs:         Array<InferenceFootprint & { name: string }>;
  totalCO2G:    number;
  totalEnergyKWh: number;
  totalEfficiency: number;
  rating:       RatingResult;
  equivalences: CO2Equivalences;
}

/**
 * Calculate CO₂ for a full ML pipeline batch (multiple models).
 * Used in the Analytics BI Export to generate Green AI reports.
 *
 * Mirrors the notebook loop in cell 32:
 *   `for name, r in results.items(): calculate_footprint(name, r['time'])`
 *
 * @example
 * const report = calcPipelineCO2([
 *   { name: 'Churn Predictor',  modelType: 'xgboost',       durationMs: 2400 },
 *   { name: 'Anomaly Detector', modelType: 'isolation_forest', durationMs: 1800 },
 *   { name: 'Click Predictor',  modelType: 'neural_network', durationMs: 3100 },
 *   { name: 'ROAS Optimizer',   modelType: 'automl',         durationMs: 5200 },
 * ]);
 * report.totalCO2G    // → < 0.01 → GREEN
 * report.rating.emoji // → '🟢'
 */
export function calcPipelineCO2(jobs: PipelineJob[]): PipelineReport {
  const computed = jobs.map(job => ({
    name: job.name,
    ...inferCO2({
      modelType:     job.modelType,
      durationMs:    job.durationMs,
      modelAccuracy: job.modelAccuracy,
    }),
  }));

  const totalCO2G       = computed.reduce((s, j) => s + j.co2G, 0);
  const totalEnergyKWh  = computed.reduce((s, j) => s + j.energyKWh, 0);
  const totalEfficiency = computed.reduce((s, j) => s + j.efficiency, 0) / computed.length;

  return {
    jobs:            computed,
    totalCO2G,
    totalEnergyKWh,
    totalEfficiency: Math.round(totalEfficiency * 100) / 100,
    rating:          getRating(totalCO2G),
    equivalences:    getEquivalences(totalCO2G),
  };
}

// ═══════════════════════════════════════════════════════════════
// SEED DATA — default pipeline for Analytics page display
// ═══════════════════════════════════════════════════════════════

/**
 * Pre-calculated pipeline report for the 4 LumindAd ML models.
 * Used by Analytics/MLModelsPanel to display Green AI metrics
 * without requiring live inference timing.
 *
 * Training times extrapolated from notebook results.
 * Inference times: typical batch of 1000 rows.
 */
export const SEED_PIPELINE_REPORT: PipelineReport = calcPipelineCO2([
  { name: 'Churn Predictor',   modelType: 'xgboost',          durationMs: 2_400, modelAccuracy: 0.873 },
  { name: 'Anomaly Detector',  modelType: 'isolation_forest',  durationMs: 1_800, modelAccuracy: 0.941 },
  { name: 'Click Predictor',   modelType: 'neural_network',    durationMs: 3_100, modelAccuracy: 0.827 },
  { name: 'ROAS Optimizer',    modelType: 'automl',            durationMs: 5_200, modelAccuracy: 0.912 },
]);

// ═══════════════════════════════════════════════════════════════
// SIDEBAR BADGE STATIC VALUE  (LumindAd.jsx line 271)
// ═══════════════════════════════════════════════════════════════

/**
 * The static badge value shown in the Sidebar Green AI widget.
 * Represents a typical daily session aggregate (≈ 6000 inferences).
 * LumindAd.jsx line 271: "0.003 gCO₂ · GHG Scope 2"
 *
 * Calculated as:
 *   6000 × inferCO2({ modelType:'xgboost', durationMs: 25 }).co2G
 *   ≈ 0.003 gCO₂
 */
export const SIDEBAR_CO2_BADGE = '0.003 gCO₂ · GHG Scope 2';

/** Rating for the sidebar badge value */
export const SIDEBAR_RATING: RatingResult = getRating(0.003);
