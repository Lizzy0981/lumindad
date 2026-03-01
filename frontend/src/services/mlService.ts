/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Services · mlService
 *  src/services/mlService.ts
 *
 *  Purpose
 *   API client for all ML model operations:
 *   – Churn prediction (XGBoost, 87.3%)
 *   – Anomaly detection (Isolation Forest, 94.1%)
 *   – Click prediction (Neural Network, 82.7%)
 *   – ROAS optimization (AutoML, 91.2%)
 *   – SHAP explainability for any prediction
 *
 *  ML models (LumindAd.jsx lines 630–635)
 *   Churn Predictor    XGBoost          87.3%  active   #7c3aed
 *   Anomaly Detector   Isolation Forest 94.1%  active   #06b6d4
 *   Click Predictor    Neural Network   82.7%  active   #10b981
 *   ROAS Optimizer     AutoML           91.2%  training #f59e0b
 *
 *  Endpoints
 *   GET  /ml/models                       → MLModel[]
 *   GET  /ml/models/:name/status          → MLModelStatus
 *   POST /ml/predict/churn                → ChurnPrediction
 *   POST /ml/predict/clicks               → ClickPrediction
 *   POST /ml/predict/roas                 → ROASPrediction
 *   POST /ml/anomaly/detect               → AnomalyResult[]
 *   POST /ml/shap                         → SHAPExplanation
 *   GET  /ml/anomaly/feed?since=...       → AnomalyAlert[]
 *   GET  /ml/models/:name/metrics         → ModelMetrics
 *
 *  SHAP Explainability
 *   The Analytics page subtitle reads "SHAP · Anomaly Detection"
 *   (LumindAd.jsx line 567). SHAP values explain WHY the model
 *   produced a given prediction — which features contributed most.
 *   getSHAP(predictionId) returns top-N feature importance values
 *   that can be rendered as a horizontal bar chart.
 *
 *  Telecom X ML Pipeline compatibility
 *   The BenchmarkTable footer reads "📡 Compatible: Telecom X ML Pipeline"
 *   (LumindAd.jsx line 872). mlService uses the same feature schema
 *   as the TelecomX notebook: customerID, tenure, monthlyCharges,
 *   totalCharges, contract, internetService, etc.
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { api } from './api';
import type { MLModel, MLModelStatus } from '../store/analyticsStore';
import { SEED_ML_MODELS } from '../store/analyticsStore';

// ─── Config ───────────────────────────────────────────────────────────────────

const USE_SEED = import.meta.env.VITE_USE_SEED_DATA === 'true';
const simDelay = (ms = 500) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Domain types ─────────────────────────────────────────────────────────────

/** Telecom X / LumindAd customer feature vector (shared by churn + SHAP) */
export interface CustomerFeatures {
  customerId:       string;
  tenure:           number;   // months
  monthlyCharges:   number;   // USD
  totalCharges:     number;   // USD
  contract:         'Month-to-month' | 'One year' | 'Two year';
  internetService:  'DSL' | 'Fiber optic' | 'No';
  onlineSecurity:   boolean;
  techSupport:      boolean;
  streamingTV:      boolean;
  paymentMethod:    string;
  numSupportCalls:  number;
}

/** Ad-level features for click and ROAS prediction */
export interface AdFeatures {
  campaignId:    string;
  platform:      string;
  objective:     string;
  dailyBudget:   number;
  bidStrategy:   string;
  audienceSize:  number;
  creativeScore: number;   // AIOptimizationScore overall (0–100)
  headline?:     string;
  body?:         string;
}

// ─── Prediction types ─────────────────────────────────────────────────────────

export interface ChurnPrediction {
  customerId:      string;
  churnProbability: number;   // 0–1
  riskLevel:       'low' | 'medium' | 'high' | 'critical';
  /** Days until predicted churn (null if riskLevel is 'low') */
  daysToChurn:     number | null;
  predictionId:    string;    // use for SHAP lookup
  modelVersion:    string;
  confidence:      number;    // 0–1
}

export interface ClickPrediction {
  campaignId:   string;
  predictedCTR: number;   // e.g. 0.0716 = 7.16%
  predictedCPC: number;   // USD
  confidence:   number;
  predictionId: string;
}

export interface ROASPrediction {
  campaignId:    string;
  predictedROAS: number;   // e.g. 3.8
  roasRange:     { low: number; high: number };
  confidence:    number;
  predictionId:  string;
  suggestion?:   string;   // e.g. "Increase budget by 15% for +0.4 ROAS"
}

// ─── Anomaly types ────────────────────────────────────────────────────────────

export interface AnomalyInput {
  metric:      string;   // e.g. 'ctr', 'impressions', 'spend'
  values:      number[];
  timestamps:  string[];
  campaignId?: string;
}

export interface AnomalyResult {
  metric:     string;
  isAnomaly:  boolean;
  score:      number;    // Isolation Forest anomaly score
  anomalyIdx: number[];  // indices of anomalous points
  severity:   'low' | 'medium' | 'high' | 'critical';
  detectedAt: string;
}

export interface AnomalyAlert {
  id:        string;
  severity:  'low' | 'medium' | 'high' | 'critical';
  message:   string;
  metric:    string;
  value:     number;
  threshold: number;
  campaignId?: string;
  detectedAt:  string;
}

// ─── SHAP types ───────────────────────────────────────────────────────────────

export interface SHAPFeatureValue {
  feature:      string;
  value:        number;    // actual feature value
  shapValue:    number;    // contribution to prediction (+ pushes higher, - lower)
  displayName:  string;    // human-readable label
}

export interface SHAPExplanation {
  predictionId:  string;
  baseValue:     number;    // model's mean prediction
  output:        number;    // final prediction value
  features:      SHAPFeatureValue[];  // sorted by |shapValue| desc
}

// ─── Model metrics ────────────────────────────────────────────────────────────

export interface ModelMetrics {
  name:        string;
  accuracy:    number;
  precision:   number;
  recall:      number;
  f1Score:     number;
  auc:         number;
  lastTrained: string;    // ISO date
  dataPoints:  number;
  version:     string;
}

// ─── Seed mock helpers ────────────────────────────────────────────────────────

function mockChurnPrediction(input: CustomerFeatures): ChurnPrediction {
  // Simple heuristic: short tenure + high charges → higher churn risk
  const score = Math.min(
    0.95,
    0.1 +
      (input.monthlyCharges / 120) * 0.3 +
      (1 / (input.tenure + 1)) * 0.4 +
      (input.contract === 'Month-to-month' ? 0.2 : 0),
  );
  const riskLevel =
    score > 0.75 ? 'critical' :
    score > 0.5  ? 'high' :
    score > 0.25 ? 'medium' : 'low';
  return {
    customerId:       input.customerId,
    churnProbability: Math.round(score * 1000) / 1000,
    riskLevel,
    daysToChurn:      riskLevel === 'low' ? null : Math.round((1 - score) * 90),
    predictionId:     `pred_${Date.now().toString(36)}`,
    modelVersion:     'xgboost-v2.3.1',
    confidence:       0.873,
  };
}

function mockSHAP(predictionId: string): SHAPExplanation {
  return {
    predictionId,
    baseValue: 0.28,
    output:    0.67,
    features: [
      { feature: 'contract',        value: 0,    shapValue:  0.21, displayName: 'Contract Type' },
      { feature: 'tenure',          value: 8,    shapValue:  0.14, displayName: 'Tenure (months)' },
      { feature: 'monthlyCharges',  value: 85.4, shapValue:  0.09, displayName: 'Monthly Charges' },
      { feature: 'internetService', value: 1,    shapValue:  0.07, displayName: 'Internet Service' },
      { feature: 'numSupportCalls', value: 3,    shapValue:  0.06, displayName: 'Support Calls' },
      { feature: 'onlineSecurity',  value: 0,    shapValue: -0.04, displayName: 'Online Security' },
      { feature: 'techSupport',     value: 0,    shapValue: -0.03, displayName: 'Tech Support' },
    ].sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue)),
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

const mlService = {
  /**
   * Get all ML model metadata.
   * Matches the 4 models displayed in MLModelsPanel (LumindAd.jsx lines 630–635).
   *
   * @example
   * const models = await mlService.getModels();
   * // models[0] → { name:'Churn Predictor', type:'XGBoost', acc:'87.3%', status:'active', color:'#7c3aed' }
   * useAnalyticsStore.getState().setMLModels(models);
   */
  async getModels(): Promise<MLModel[]> {
    if (USE_SEED) {
      await simDelay(300);
      return SEED_ML_MODELS;
    }
    const { data } = await api.get<MLModel[]>('/ml/models');
    return data;
  },

  /**
   * Poll the status of a specific model (e.g. ROAS Optimizer while training).
   *
   * @example
   * // Poll ROAS Optimizer every 10s while status is 'training'
   * const status = await mlService.getModelStatus('ROAS Optimizer');
   * if (status === 'active') useAnalyticsStore.getState().upsertMLModel({...model, status:'active'});
   */
  async getModelStatus(modelName: string): Promise<MLModelStatus> {
    if (USE_SEED) {
      await simDelay(100);
      const m = SEED_ML_MODELS.find((m) => m.name === modelName);
      return m?.status ?? 'idle';
    }
    const { data } = await api.get<{ status: MLModelStatus }>(
      `/ml/models/${encodeURIComponent(modelName)}/status`,
    );
    return data.status;
  },

  /**
   * Predict customer churn probability using XGBoost (87.3% accuracy).
   * Feature schema compatible with Telecom X ML pipeline.
   *
   * @example
   * const result = await mlService.predictChurn({
   *   customerId:      'CUST-001',
   *   tenure:           8,
   *   monthlyCharges:   85.4,
   *   totalCharges:    683.2,
   *   contract:        'Month-to-month',
   *   internetService: 'Fiber optic',
   *   onlineSecurity:   false,
   *   techSupport:      false,
   *   streamingTV:      true,
   *   paymentMethod:   'Electronic check',
   *   numSupportCalls:  3,
   * });
   * // result.churnProbability → 0.67
   * // result.riskLevel        → 'high'
   */
  async predictChurn(input: CustomerFeatures): Promise<ChurnPrediction> {
    if (USE_SEED) {
      await simDelay(600);
      return mockChurnPrediction(input);
    }
    const { data } = await api.post<ChurnPrediction>('/ml/predict/churn', input);
    return data;
  },

  /**
   * Predict CTR and CPC for a given ad creative + targeting config.
   * Uses Neural Network model (82.7% accuracy).
   *
   * @example
   * const prediction = await mlService.predictClicks({
   *   campaignId:    'C-001',
   *   platform:      'Google Ads',
   *   objective:     'Conversions',
   *   dailyBudget:   50,
   *   bidStrategy:   'Target CPA',
   *   audienceSize:  500000,
   *   creativeScore: 84,   // from AIOptimizationScore component
   * });
   * // prediction.predictedCTR → 0.0716 (7.16%)
   */
  async predictClicks(input: AdFeatures): Promise<ClickPrediction> {
    if (USE_SEED) {
      await simDelay(500);
      return {
        campaignId:   input.campaignId,
        predictedCTR: 0.0716,
        predictedCPC: 1.24,
        confidence:   0.827,
        predictionId: `pred_${Date.now().toString(36)}`,
      };
    }
    const { data } = await api.post<ClickPrediction>('/ml/predict/clicks', input);
    return data;
  },

  /**
   * Predict ROAS for a campaign config using AutoML (91.2% accuracy).
   *
   * @example
   * const roas = await mlService.predictROAS({
   *   campaignId:    'C-001',
   *   platform:      'Google Ads',
   *   objective:     'Conversions',
   *   dailyBudget:   150,
   *   bidStrategy:   'Maximize conversions',
   *   audienceSize:  200000,
   *   creativeScore: 91,
   * });
   * // roas.predictedROAS → 4.2
   * // roas.suggestion    → "Increase budget by 15% for +0.4 ROAS"
   */
  async predictROAS(input: AdFeatures): Promise<ROASPrediction> {
    if (USE_SEED) {
      await simDelay(700);
      return {
        campaignId:    input.campaignId,
        predictedROAS: 4.2,
        roasRange:     { low: 3.6, high: 5.1 },
        confidence:    0.912,
        predictionId:  `pred_${Date.now().toString(36)}`,
        suggestion:    'Increase budget by 15% for +0.4 ROAS',
      };
    }
    const { data } = await api.post<ROASPrediction>('/ml/predict/roas', input);
    return data;
  },

  /**
   * Run Isolation Forest anomaly detection on a metric time-series.
   * Accuracy 94.1% — used by Analytics page subtitle "Anomaly Detection".
   *
   * @example
   * const results = await mlService.detectAnomalies({
   *   metric:     'ctr',
   *   values:     [0.071, 0.073, 0.069, 0.12, 0.071, 0.070],
   *   timestamps: ['Jan 1','Jan 8','Jan 15','Jan 22','Jan 29','Feb 5'],
   *   campaignId: 'C-001',
   * });
   * // results[0].isAnomaly  → true  (index 3: CTR spike to 12%)
   * // results[0].severity   → 'high'
   */
  async detectAnomalies(input: AnomalyInput): Promise<AnomalyResult[]> {
    if (USE_SEED) {
      await simDelay(800);
      // Simulate: values > mean + 2σ are anomalous
      const mean = input.values.reduce((s, v) => s + v, 0) / input.values.length;
      const stdDev = Math.sqrt(
        input.values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / input.values.length,
      );
      const threshold = mean + 2 * stdDev;
      const anomalyIdx = input.values
        .map((v, i) => (v > threshold ? i : -1))
        .filter((i) => i >= 0);
      return [{
        metric:     input.metric,
        isAnomaly:  anomalyIdx.length > 0,
        score:      anomalyIdx.length > 0 ? 0.87 : 0.12,
        anomalyIdx,
        severity:   anomalyIdx.length > 0 ? 'medium' : 'low',
        detectedAt: new Date().toISOString(),
      }];
    }
    const { data } = await api.post<AnomalyResult[]>('/ml/anomaly/detect', input);
    return data;
  },

  /**
   * Get live anomaly alerts feed (for useRealTimeAPI polling fallback).
   *
   * @example
   * const alerts = await mlService.getAnomalyFeed();
   * alerts.forEach(a => if (a.severity === 'critical') showBanner(a.message));
   */
  async getAnomalyFeed(since?: string): Promise<AnomalyAlert[]> {
    if (USE_SEED) {
      await simDelay(300);
      return [];   // no anomalies in seed state
    }
    const { data } = await api.get<AnomalyAlert[]>('/ml/anomaly/feed', {
      params: since ? { since } : undefined,
    });
    return data;
  },

  /**
   * Get SHAP feature importance explanation for a prediction.
   * Links the black-box model output to interpretable feature contributions.
   *
   * @example
   * const shap = await mlService.getSHAP('pred_k5j2x8');
   * // shap.features[0] → { feature:'contract', shapValue:0.21, displayName:'Contract Type' }
   * // Render as: "Contract Type contributed +21% to churn risk"
   *
   * @example
   * // After predictChurn:
   * const pred = await mlService.predictChurn(customer);
   * const shap = await mlService.getSHAP(pred.predictionId);
   * renderSHAPWaterfallChart(shap);
   */
  async getSHAP(predictionId: string): Promise<SHAPExplanation> {
    if (USE_SEED) {
      await simDelay(400);
      return mockSHAP(predictionId);
    }
    const { data } = await api.post<SHAPExplanation>('/ml/shap', { predictionId });
    return data;
  },

  /**
   * Fetch detailed training/evaluation metrics for a model.
   *
   * @example
   * const metrics = await mlService.getModelMetrics('Churn Predictor');
   * // metrics.accuracy  → 0.873
   * // metrics.auc       → 0.921
   * // metrics.f1Score   → 0.848
   */
  async getModelMetrics(modelName: string): Promise<ModelMetrics> {
    if (USE_SEED) {
      await simDelay(400);
      const accuracyMap: Record<string, number> = {
        'Churn Predictor':  0.873,
        'Anomaly Detector': 0.941,
        'Click Predictor':  0.827,
        'ROAS Optimizer':   0.912,
      };
      const acc = accuracyMap[modelName] ?? 0.85;
      return {
        name:        modelName,
        accuracy:    acc,
        precision:   acc - 0.02,
        recall:      acc - 0.03,
        f1Score:     acc - 0.025,
        auc:         acc + 0.04,
        lastTrained: '2025-11-01T08:00:00Z',
        dataPoints:  125_000,
        version:     'v2.3.1',
      };
    }
    const { data } = await api.get<ModelMetrics>(
      `/ml/models/${encodeURIComponent(modelName)}/metrics`,
    );
    return data;
  },
};

export default mlService;
