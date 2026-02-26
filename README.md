# ✦ LumindAd — Enterprise Advertising Intelligence Platform

> *"Transformando datos publicitarios globales en decisiones estratégicas inteligentes"* 🚀

[![Version](https://img.shields.io/badge/version-v1.0.0-7c3aed?style=for-the-badge&logo=github)](https://github.com/Lizzy0981/lumindad)
[![Deploy Status](https://img.shields.io/badge/deploy-active-10b981?style=for-the-badge&logo=kubernetes)](https://lumindad.ai)
[![React](https://img.shields.io/badge/React-18-06b6d4?style=for-the-badge&logo=react)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python%203.11-10b981?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![TensorFlow](https://img.shields.io/badge/TensorFlow-2.x-f59e0b?style=for-the-badge&logo=tensorflow)](https://tensorflow.org)
[![ML Models](https://img.shields.io/badge/ML%20Models-8%20%284%20Classical%20%2B%204%20Deep%20Learning%29-7c3aed?style=for-the-badge&logo=tensorflow)](https://github.com/Lizzy0981/lumindad)
[![Green AI](https://img.shields.io/badge/Green%20AI-GHG%20Scope%202-10b981?style=for-the-badge&logo=leaf)](https://ghgprotocol.org)
[![License](https://img.shields.io/badge/license-MIT-a78bfa?style=for-the-badge)](./LICENSE)

```
🌌 ╔══════════════════════════════════════════════════════════════════════════╗ 🌌
⭐ ║  ✦ LUMINDAD  —  AI-POWERED GLOBAL ADVERTISING INTELLIGENCE  v1.0.0     ║ ⭐
🌟 ║                                                                          ║ 🌟
⚡ ║  React 18 · FastAPI · TensorFlow · XGBoost · SHAP · Folium · Green AI  ║ ⚡
🎯 ║  54 Countries · 11 Languages · 10M Rows · Offline Mode · GHG Scope 2  ║ 🎯
🔮 ║  8 Modelos IA: LR · RF · XGBoost · KNN · MLP · LSTM · CNN-1D · AE    ║ 🔮
💎 ║                                                                          ║ 💎
🌈 ╚══════════════════════════════════════════════════════════════════════════╝ 🌈
```

---
[🌐 Demo en Vivo](https://lizzy0981.github.io/lumindad/)
---

---

## 📋 Tabla de Contenidos

1. [Project Overview](#1-project-overview)
2. [Vista Previa](#2-vista-previa)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Características Principales](#4-características-principales)
5. [Machine Learning & Green AI](#5-machine-learning--green-ai)
6. [Estructura del Proyecto](#6-estructura-del-proyecto)
7. [Instalación Rápida](#7-instalación-rápida)
8. [API Reference](#8-api-reference)
9. [Despliegue](#9-despliegue)
10. [Cobertura Global](#10-cobertura-global)
11. [Desarrollado por](#11-desarrollado-por)

---

## 1. Project Overview

**LumindAd** (*"Lumin"* = iluminar + *"Ad"* = publicidad) es una plataforma enterprise de Advertising Intelligence con IA real, construida para el **Alura LATAM · Oracle AdTech Challenge**. Combina un pipeline de Machine Learning completo con una interfaz React de nivel producción y un backend FastAPI robusto.

| Atributo | Valor |
|---|---|
| **Proyecto** | LumindAd — Enterprise Advertising Intelligence Platform |
| **Versión** | v1.0.0 · Enterprise Edition |
| **Autora** | Elizabeth Díaz Familia · AI Data Scientist · Sustainable Intelligence & BI |
| **Challenge** | Alura LATAM · Oracle AdTech Challenge |
| **Frontend** | React 18 + TypeScript + Vite + Recharts + Zustand |
| **Backend** | Python 3.11 + FastAPI + PostgreSQL + Redis + Celery |
| **ML Engine** | TensorFlow 2.x · XGBoost · SHAP · 4 Classical ML + 4 Deep Learning (MLP · LSTM · CNN-1D · Autoencoder) |
| **Países** | 54 países · 7 regiones · LATAM · NA · EU · MENA · Africa · APAC · CIS |
| **Idiomas** | EN · ES · PT · FR · AR · HE · ZH · RU · TR · KO · JA |
| **Green AI** | GHG Protocol Scope 2 · 5.94 gCO₂ total · Rating YELLOW |

---

## 2. Vista Previa

```
🌟 ┌──────────────────────────────────────────────────────────────────────┐ 🌟
✦  │                   ✦ LUMINDAD DASHBOARD v1.0.0                       │  ✦
⚡ │                                                                      │ ⚡
🎯 │   📊 KPIs en Tiempo Real      🤖 ML Predictions    🌍 Global Map    │ 🎯
💜 │   💰 $1.2M Ad Spend           📈 8 Modelos IA          54 Countries    │ 💜
🔮 │   🎯 5 Campañas Activas       🌱 Green AI YELLOW    11 Languages    │ 🔮
⭐ │   ⚡ 10M Rows Processing       📄 PDF + BI Export    Offline Mode    │ ⭐
🌈 └──────────────────────────────────────────────────────────────────────┘ 🌈
```

---

## 3. Stack Tecnológico

### 🎨 Frontend Moderno
```typescript
⚡ React 18 + TypeScript       // Componentes tipados con estricto --noEmit
🚀 Vite 5                      // Build < 2s · HMR instantáneo
📊 Recharts 2.x                // AreaChart · BarChart · LineChart · PieChart
🗃️  Zustand                    // Estado global liviano y reactivo
🌐 i18next × 11 idiomas        // EN ES PT FR AR HE ZH RU TR KO JA (LTR + RTL)
📴 IndexedDB OfflineCache      // TTL 6h · fallback automático sin red
🎨 CSS Luxury Dark Theme       // Paleta violeta #7c3aed · Outfit font
📱 PWA Ready                   // Service Worker · manifest.json
```

### 🔧 Backend & Infraestructura
```python
🐍 FastAPI + Python 3.11       // Async · OpenAPI auto-docs · JWT Auth
🐘 PostgreSQL 15               // ORM SQLAlchemy async · Alembic migrations
⚡ Redis 7.2                   // Cache TTL · Celery broker · WebSocket pub/sub
📨 Celery Workers              // Upload tasks · ML batch · Report generation
🐳 Docker multi-stage          // Node 20-alpine → nginx · Python 3.11-slim
☸️  Kubernetes                 // 6 deployments · HPA · PVC · Ingress TLS
🔄 GitHub Actions CI/CD        // lint + pytest 252 + Trivy + deploy staging/prod
```

### 🤖 Motor de IA — 8 Modelos
```python
# ── 4 Classical ML ───────────────────────────────────────────────────
📐 Logistic Regression         // Baseline · LR coefficients para XAI
🌲 Random Forest               // Gini importance · robusto a outliers
🏆 XGBoost 2.x                 // Best model: F1=0.6171 · AUC=0.8252
📍 K-Nearest Neighbors         // Baseline no-paramétrico
# ── 4 Deep Learning · Redes Neuronales (TensorFlow 2.x + Keras) ─────
🧠 MLP                         // Feed-Forward NN: 256→128→64→32→1
🔄 LSTM                        // Recurrent NN: LSTM(64)→LSTM(32)
🔷 CNN-1D                      // Convolucional: Conv1D(64,3)→GAP
🔍 Autoencoder                 // Anomaly NN: 128→64→32→16→128
# ── Anomaly Detection adicional ──────────────────────────────────────
🚨 Isolation Forest            // contamination=0.265 · tree-based
📊 Local Outlier Factor        // Density-based anomaly scoring
⭕ One-Class SVM               // Novelty detection boundary
# ── Explainability (XAI) ─────────────────────────────────────────────
🔍 SHAP TreeExplainer          // Feature importance + beeswarm plots
⚖️  imbalanced-learn            // SMOTE k=5 · balanceo clase minoritaria
📏 RobustScaler                // Resistente a outliers en MonthlyCharges
🎯 ROC F1-maximisation         // Calibración de thresholds por modelo
🌐 TensorFlow.js               // Las mismas redes neuronales en el browser
🌱 GHG Protocol Scope 2        // CO₂ tracking por inferencia · 5.94 gCO₂ total
```

---

## 4. Características Principales

### 📊 Dashboard de Rendimiento
- 🎯 **KPIs animados** — CTR, CPC, ROAS, conversiones con contadores suaves
- 📈 **Gráficos interactivos** — Weekly trends, platform split, budget breakdown
- ⚡ **Tiempo real** — WebSocket KPI stream + polling fallback
- 📴 **Offline Mode** — IndexedDB TTL cache · funciona sin internet

### 🤖 Motor de IA
- 🧠 **8 modelos de IA** — 4 Classical ML (LR · RF · XGBoost · KNN) + 4 Deep Learning (MLP · LSTM · CNN-1D · Autoencoder)
- 🔍 **SHAP explainability** — Top drivers de churn con beeswarm plot
- 🚨 **Anomaly detection** — Autoencoder entrenado en muestras normales
- 🌱 **Green AI** — CO₂ tracking en tiempo real por inferencia

### 📁 Centro de Uploads
- 📂 **10 formatos** — CSV · XLSX · XLS · JSON · TSV · TXT · Parquet · Avro · PDF · XML
- ⚡ **Chunked processing** — 50K filas/chunk · hasta 10M filas
- 🔄 **SSE progress** — Barra de progreso en tiempo real (Server-Sent Events)
- 🧵 **Web Workers** — UI nunca se bloquea durante el procesamiento

### 🌍 Cobertura Global
- 🗺️ **Folium Map** — Mapa mundial interactivo · 54 países · puntos por churn
- 🌐 **11 idiomas** — LTR + RTL (árabe, hebreo) · i18next
- 🏳️ **7 regiones** — NA · LATAM · EU · APAC · MENA · Africa · CIS

### 📊 BI & Exports
- 📄 **PDF ejecutivo** — Reporte FPDF2 · 7 páginas · gráficos + métricas
- 📊 **Power BI** — CSV enriquecido + JSON schema + DAX measures
- 📈 **Tableau** — CSV + TDS data source file
- 📑 **Excel** — .xlsx multi-hoja (6 sheets)

---

## 5. Machine Learning & Green AI

### 🤖 8 Modelos de IA — 4 Classical ML + 4 Deep Learning (Redes Neuronales)

```
╔══════════════════════════════════════════════════════════════════════╗
║          ✦ LUMINDAD AI ENGINE — 8 MODELOS COMPLETOS                 ║
╠══════════════════════╦═══════════════════════════════════════════════╣
║  🔬 CLASSICAL ML (4) ║  🧠 DEEP LEARNING · Redes Neuronales (4)    ║
╠══════════════════════╬═══════════════════════════════════════════════╣
║  Logistic Regression ║  MLP   — 256→128→64→32→1  (Feed-Forward NN) ║
║  Random Forest       ║  LSTM  — LSTM(64)→LSTM(32) (Secuencial RNN) ║
║  🏆 XGBoost          ║  CNN-1D — Conv1D(64,3)→GAP (Convolucional)  ║
║  K-Nearest Neighbors ║  Autoencoder — 128→16→128  (Anomaly NN)     ║
╚══════════════════════╩═══════════════════════════════════════════════╝
     + TensorFlow.js — Inferencia de redes neuronales en el browser
```

### 📊 Classical ML — Resultados (TelecomX · 7,267 clientes · 54 países)

| Modelo | Librería | Propósito | Est. F1 |
|---|---|---|---|
| **Logistic Regression** | Scikit-learn 1.5 | Baseline · LR coefficients para XAI | ~0.72 |
| **Random Forest** | Scikit-learn 1.5 | Gini importance · robusto a outliers | ~0.81 |
| 🏆 **XGBoost** | XGBoost 2.x | **Mejor modelo** · SHAP explainability | **0.6171** |
| **K-Nearest Neighbors** | Scikit-learn 1.5 | Baseline no-paramétrico | ~0.74 |

### 🧠 Deep Learning — Redes Neuronales (TensorFlow 2.x + Keras)

| Red Neuronal | Arquitectura | F1 | AUC | Threshold |
|---|---|---|---|---|
| **MLP** | Dense 256→128→64→32→1 · BatchNorm · Dropout | 0.6067 | 0.8215 | 0.3637 |
| **LSTM** | LSTM(64)→LSTM(32)→Dense · Recurrent Dropout | 0.5596 | 0.7321 | 0.4435 |
| **CNN-1D** | Conv1D(64,3)→Conv1D(32,3)→GAP→Dense | 0.5519 | 0.7758 | 0.4950 |
| **Autoencoder** | Encoder 128→64→32→16 · Decoder 16→128 | 0.4338 | 0.5228 | 0.1852 |

> 🌐 **TensorFlow.js** — Las mismas redes neuronales corren en el browser para predicciones offline sin llamar al backend.

### 🚨 Anomaly Detection — Modelos adicionales

| Modelo | Tipo | Método |
|---|---|---|
| **Isolation Forest** | Unsupervised ML | `contamination=0.265` · tree-based isolation |
| **Local Outlier Factor** | Unsupervised ML | Density-based local anomaly scoring |
| **One-Class SVM** | Unsupervised ML | Novelty detection boundary |
| **Autoencoder** | Red Neuronal | Reconstruction error > 90th percentile |

### 🔍 Explainability (XAI)

| Método | Aplicado a | Output |
|---|---|---|
| **SHAP TreeExplainer** | XGBoost | Beeswarm · Bar · Mean \|SHAP\| |
| **Feature Importance (Gini)** | Random Forest | Top-15 por importancia |
| **LR Coefficients** | Logistic Regression | Bar chart firmado |

### 🔝 Top Drivers de Churn (SHAP · XGBoost)
```
1. tenure           ↓ Mayor antigüedad → menor churn
2. Contract_enc     ↓ Contratos anuales reducen churn vs month-to-month
3. MonthlyCharges   ↑ Facturas > $70/mes aumentan riesgo
4. InternetService  ↑ Fiber optic: mayor gasto pero más churn
5. churn_risk_score ↑ Señal compuesta no-lineal
```

### 🌱 Green AI — GHG Protocol Scope 2

```python
🌱 Total CO₂        : 5.94 gCO₂  (pipeline completo — 8 modelos)
⚡ Total energía     : 0.01250 kWh
⏱️  Tiempo total      : 84.6 segundos
📊 Rating           : YELLOW  (1–10 gCO₂)
🏆 Más eficiente    : XGBoost  (0.039 gCO₂ · eficiencia F1/gCO₂ = 15.68×)
📏 Estándar         : GHG Protocol Scope 2 · PUE=1.57 · CI=0.475 kgCO₂/kWh
```

---

## 6. Estructura del Proyecto

```
✦ lumindad/
│
├── 🎨 frontend/                  # React 18 + TypeScript + Vite
│   ├── src/
│   │   ├── components/           # UI primitives · charts · layout · shared
│   │   ├── pages/                # Dashboard · Campaigns · Budget · Analytics · Upload · CreateAd
│   │   ├── hooks/                # useAnimatedValue · useOfflineCache · useChunkedUpload
│   │   ├── store/                # Zustand stores (campaigns · budget · analytics · upload)
│   │   ├── services/             # Axios + JWT · API clients
│   │   ├── i18n/locales/         # EN ES PT FR AR HE ZH RU TR KO JA
│   │   └── workers/              # csvParser · xlsxParser · chunkProcessor
│   └── public/                   # favicon · manifest.json · PWA icons
│
├── 🔧 backend/                   # FastAPI + Python 3.11
│   ├── app/
│   │   ├── api/v1/               # campaigns · budget · analytics · upload · ml · auth
│   │   ├── models/               # SQLAlchemy ORM
│   │   ├── services/             # Business logic + green_ai_service
│   │   ├── workers/              # Celery: upload_tasks · ml_tasks · report_tasks
│   │   └── core/                 # JWT · Redis cache · DB engine · events
│   ├── migrations/               # Alembic migrations
│   └── tests/                    # Pytest 252 tests (unit + integration)
│
├── 🤖 ml/                        # Machine Learning Pipeline
│   ├── notebooks/                # TelecomX_Parte2_Global_v3.ipynb · LumindAd_AdPerformance_ML.ipynb
│   ├── data/raw/ processed/ cache/
│   ├── models/                   # LumindAd_MLP · LSTM · CNN1D · Autoencoder · XGBoost · scaler
│   └── reports/                  # PDF report · Folium map · Green AI JSON
│
├── 🏗️  infrastructure/
│   ├── docker/                   # Dockerfile.frontend · backend · ml
│   ├── kubernetes/               # deployment · service · ingress · configmap
│   └── nginx/nginx.conf          # SPA routing · rate limit · SSE · WebSocket
│
├── 📚 docs/
│   ├── LumindAd_Documentation.md
│   └── prototype/LumindAd.jsx
│
├── ⚙️  .github/workflows/
│   ├── ci.yml                    # Tests + lint on PR
│   ├── deploy-staging.yml        # Auto-deploy → develop
│   └── deploy-prod.yml           # Manual deploy → production
│
├── 🐳 docker-compose.yml         # Local dev stack
├── 🐳 docker-compose.prod.yml    # Production stack
├── 🔐 .env.example               # Variables de entorno
├── 🛠️  Makefile                   # Developer shortcuts
└── 📖 README.md
```

---

## 7. Instalación Rápida

### ⚡ Setup Automático (Recomendado)
```bash
# 1️⃣ Clonar el repositorio
git clone https://github.com/Lizzy0981/lumindad.git
cd lumindad

# 2️⃣ Setup completo con un comando
make setup
# → Copia .env.example → .env
# → Instala dependencias (npm + pip)
# → Levanta Docker stack
# → Ejecuta migraciones Alembic
```

### 🔧 Setup Manual
```bash
# 1️⃣ Variables de entorno
cp .env.example .env
# → Editar .env con tus credenciales

# 2️⃣ Levantar servicios
docker-compose up --build

# 3️⃣ Migraciones (primera vez)
make migrate

# 4️⃣ Verificar servicios
curl http://localhost:8000/health    # Backend API
curl http://localhost:8001/health    # ML Inference
```

### 🌐 URLs Locales
```
🎨 Frontend    : http://localhost:5173   (Vite HMR)
🔧 Backend API : http://localhost:8000   (FastAPI)
📖 API Docs    : http://localhost:8000/docs (Swagger)
🤖 ML Service  : http://localhost:8001
🌸 Flower      : http://localhost:5555   (Celery monitor)
🐘 PostgreSQL  : localhost:5432
⚡ Redis       : localhost:6379
```

### 🛠️ Comandos Útiles
```bash
make test           # 🧪 Ejecutar todos los tests (Vitest + Pytest 252)
make lint           # 🔍 ESLint + Ruff + Black
make logs           # 📋 Tail logs de todos los contenedores
make db-shell       # 🐘 psql shell en DB de desarrollo
make flower         # 🌸 Abrir Celery monitor
make clean          # 🧹 Eliminar containers + volumes
```

---

## 8. API Reference

### 🔐 Autenticación
```
POST /api/v1/auth/login
     Body:    { email, password }
     Returns: { access_token, refresh_token, expires_in }
```

### 📋 Endpoints Principales

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/v1/campaigns` | Listar campañas (paginado + filtros) |
| `POST` | `/api/v1/campaigns` | Crear campaña |
| `GET` | `/api/v1/analytics` | Métricas de rendimiento |
| `POST` | `/api/v1/upload` | Upload de archivos (multipart · hasta 10) |
| `GET` | `/api/v1/upload/{job_id}` | Estado del job + progreso % |
| `POST` | `/api/v1/ml/predict` | Predicción de churn |
| `GET` | `/api/v1/ml/shap/{model}` | Valores SHAP de explicabilidad |
| `GET` | `/api/v1/green-ai` | Reporte CO₂ sesión actual |
| `WS` | `/ws/kpi` | Stream KPI en tiempo real |

---

## 9. Despliegue

### 🏗️ Arquitectura Recomendada

| Capa | Servicio | Tecnología |
|---|---|---|
| 🌐 Frontend CDN | `lumindad.ai` | Vercel (React SPA + Edge) |
| 🔧 API Server | `api.lumindad.ai` | AWS EC2 t3.medium + Nginx |
| 🐘 Database | Managed PostgreSQL | AWS RDS 16 (Multi-AZ) |
| ⚡ Cache | Managed Redis | AWS ElastiCache 7.2 |
| 📁 File Storage | Object storage | AWS S3 + presigned URLs |
| 🤖 ML Inference | Dedicated worker | AWS EC2 c5.xlarge |
| 📦 Registry | Docker images | AWS ECR |
| 🔄 CI/CD | Automated | GitHub Actions |

### 🚀 Deploy a Producción
```bash
# Build + push imágenes a AWS ECR
make push IMAGE_TAG=v1.0.0

# Deploy staging (automático en push a develop)
# Deploy producción (manual con aprobación en GitHub)
# Ver .github/workflows/deploy-prod.yml
```

---

## 10. Cobertura Global

### 🌍 7 Regiones · 54 Países · 11 Idiomas

```
🌎 LATAM   ·  🇲🇽 🇧🇷 🇨🇴 🇦🇷 🇨🇱 🇵🇪 🇻🇪 🇪🇨 🇬🇹 🇩🇴
🌎 NA      ·  🇺🇸 🇨🇦 🇦🇺 🇳🇿
🌍 EU      ·  🇩🇪 🇫🇷 🇬🇧 🇪🇸 🇮🇹 🇳🇱 🇵🇹 🇸🇪 🇨🇭 🇵🇱
🌏 APAC    ·  🇯🇵 🇰🇷 🇨🇳 🇮🇳 🇸🇬 🇹🇭 🇮🇩 🇵🇭 🇻🇳 🇲🇾
🌍 MENA    ·  🇸🇦 🇦🇪 🇮🇱 🇹🇷 🇪🇬 🇲🇦 🇶🇦 🇰🇼 🇯🇴 🇱🇧
🌍 Africa  ·  🇳🇬 🇿🇦 🇰🇪 🇬🇭 🇪🇹
🌏 CIS     ·  🇷🇺 🇺🇦 🇰🇿 🇧🇾 🇺🇿
```

### 🗺️ Mapa Interactivo (Folium)
- 📍 Marcadores por tasa de churn (🔴>30% · 🟡24-30% · 🟢<24%)
- 📊 Popup por país: churn rate · clientes · tenure · charges · risk score
- 🎨 Color por región · tamaño por volumen de clientes

---

## 11. Desarrollado por

**✦ Elizabeth Díaz Familia** — *AI Data Scientist · Sustainable Intelligence & BI*

### 🔗 Conecta Conmigo
- 🌐 **Portfolio**: [lizzy0981.github.io](https://lizzy0981.github.io)
- 💼 **LinkedIn**: [linkedin.com/in/eli-familia/](https://linkedin.com/in/eli-familia/)
- 🐱 **GitHub**: [github.com/Lizzy0981](https://github.com/Lizzy0981)
- 🐦 **Twitter**: [twitter.com/Lizzyfamilia](https://twitter.com/Lizzyfamilia)
- 📧 **Email**: lizzyfamilia@gmail.com

### 💼 Especialidades
```python
🤖 Machine Learning & Deep Learning   # TensorFlow · XGBoost · SHAP · LSTM · CNN-1D
📊 Data Science & BI                  # Python · Pandas · NumPy · Power BI · Tableau
🌐 Full-Stack Development             # React 18 · FastAPI · PostgreSQL · Redis
🌱 Sustainable AI (Green Computing)   # GHG Protocol Scope 2 · CO₂ tracking
☁️  DevOps & Cloud                    # Docker · Kubernetes · AWS · GitHub Actions
🌍 Internationalization               # i18n × 11 idiomas · LTR + RTL
🗺️  Geospatial Analytics              # Folium · GeoJSON · 54 países
```

### 🙏 Agradecimientos
- 🚀 **Oracle Next Education** — Programa educativo de calidad mundial
- 🌟 **Alura LATAM** — Desafíos técnicos y metodología excelente
- 🌍 **Open Source Community** — TensorFlow · FastAPI · React · XGBoost · SHAP
- 💜 **Comunidad Tech Latina** — Por el apoyo y la inspiración constante

---

## 🚀 Call to Action

```
✦  ┌──────────────────────────────────────────────────────────────────┐  ✦
🌟 │                                                                    │ 🌟
💜 │   ⭐ Dale Star si te gustó el proyecto                            │ 💜
🚀 │   🍴 Fork y personaliza para tu empresa                           │ 🚀
🐛 │   🐛 Reporta Issues para mejorar la plataforma                   │ 🐛
📢 │   📢 Comparte con tu network profesional                         │ 📢
🌱 │   🌱 Contribuye al desarrollo sostenible de la IA                │ 🌱
🌟 │                                                                    │ 🌟
✦  └──────────────────────────────────────────────────────────────────┘  ✦
```

> ### 💎 *"El futuro pertenece a quienes pueden convertir datos en sabiduría, con responsabilidad ambiental y alcance verdaderamente global"*
> **— Elizabeth Díaz Familia, Creator**

**✦ Made with 💜, ☕, and a lot of 🤖 AI Magic for the Global AdTech community** 🌟

---

```
🌌 ╔══════════════════════════════════════════════════════════════════════════╗ 🌌
⭐ ║                     ✦ LUMINDAD v1.0.0 ✦                                ║ ⭐
🌟 ║                  🤖 AI-POWERED  ADVERTISING  🤖                         ║ 🌟
⚡ ║              🌍 54 COUNTRIES · 11 LANGUAGES  🌍                         ║ ⚡
🎯 ║           🌱 SUSTAINABLE · GHG SCOPE 2 · GREEN AI  🌱                  ║ 🎯
🔮 ║        💜 BUILT WITH LOVE FOR THE GLOBAL ADTECH COMMUNITY 💜            ║ 🔮
🌈 ╚══════════════════════════════════════════════════════════════════════════╝ 🌈
```

*© 2025 Elizabeth Díaz Familia · AI Data Scientist · Sustainable Intelligence & BI*
*LumindAd v1.0.0 · React · FastAPI · TensorFlow · XGBoost · SHAP · Folium · Green AI · i18n × 11*
