import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";

/* ═══════════════════════════════════════════════════════════════════
   LUMINDAD — ENTERPRISE ADVERTISING INTELLIGENCE PLATFORM
   Elizabeth Díaz Familia · Sustainable AI Scientist
   i18n: 11 idiomas integrados · RTL: AR, HE
═══════════════════════════════════════════════════════════════════ */

// ── TRANSLATIONS ────────────────────────────────────────────────────
const TRANSLATIONS = {
  en: {
    nav: { dashboard:'Dashboard', createAd:'Create Ad', campaigns:'Campaigns', budget:'Budget', analytics:'Analytics', uploadData:'Upload Data', section:'NAVIGATION', newBadge:'NEW' },
    sidebar: { version:'v1.0.0 · ENTERPRISE', aiEngine:'AI Engine', aiOnline:'AI Online', greenAI:'Green AI', greenBadge:'0.003 gCO₂ · GHG Scope 2', userName:'Elizabeth D.F.', userRole:'Sustainable AI' },
    topbar: { live:'Live' },
    metrics: { totalSpend:'Total Spend', impressions:'Impressions', clicks:'Clicks', conversions:'Conversions', totalBudget:'Total Budget', totalSpent:'Total Spent', remaining:'Remaining', budgetUsed:'Budget Used' },
    dashboard: {
      title:'Performance Dashboard', subtitle:'Monitor your advertising performance in real-time — AI-powered insights',
      weeklyPerformance:'Weekly Performance', weeklySubtitle:'Impressions & clicks over 7 days',
      platformSplit:'Platform Split', platformSubtitle:'Ad spend distribution',
      aiInsights:'AI-Generated Insights',
      insights: {
        peakTitle:'Peak Performance', peakDesc:'Friday ads convert 34% better. Increase budget by $200 for next Friday.',
        anomalyTitle:'Anomaly Detected', anomalyDesc:'TikTok campaign CTR dropped 18% vs last week. Isolation Forest flagged this.',
        growthTitle:'Growth Opportunity', growthDesc:'LinkedIn B2B segment shows 5.1x ROAS. Recommend scaling budget +40%.',
      }
    },
    campaigns: { title:'Campaigns', subtitle:'Manage and track all your advertising campaigns', searchPlaceholder:'Search campaigns...', cols:['Campaign','Platform','Status','Budget','Spent','Impressions','CTR','ROAS',''] },
    budget: { title:'Budget Management', subtitle:'Track and optimize your advertising spend with AI recommendations', dailySpend:'Daily Spend vs Budget', dailySubtitle:'Actual spend compared to daily budget target', actualSpend:'Actual Spend', budgetTarget:'Budget Target', byPlatform:'By Platform', aiRecommendation:'🤖 AI Recommendation', aiText:'Reallocate', aiStrong1:'$1,200', aiFrom:' from Meta to Google Ads. Predictive model (XGBoost) estimates ', aiStrong2:'+23% ROAS', aiEnd:' improvement.' },
    analytics: { title:'Analytics', subtitle:'Deep-dive into your performance data with ML-powered analysis', impressions:'Impressions Over Time', conversionsClicks:'Conversions & Clicks', convSubtitle:'Engagement funnel over time', mlPanel:'ML Models Active — TensorFlow · XGBoost · SHAP Explainability', accuracy:'Accuracy:', models:{ churnPredictor:'Churn Predictor', anomalyDetector:'Anomaly Detector', clickPredictor:'Click Predictor', roasOptimizer:'ROAS Optimizer' }, modelTypes:{ xgboost:'XGBoost', isolationForest:'Isolation Forest', neuralNetwork:'Neural Network', automl:'AutoML' } },
    upload: { title:'Upload Data', subtitle:'Process up to 10M rows · Chunked parallel processing · Web Workers', capacity:'⚡ 10 files · 10M rows max', idle:'Drag & drop your files here', active:'Drop your files here!', browse:'browse files', limits:'Max 10 files · Up to 2GB · Chunked processing (50K rows/chunk)', fileListTitle:'Uploaded Files', processing:'⟳ Processing...', processBtn:'▶ Process Data', clearBtn:'🗑 Clear Data', exportBtn:'↓ Export Results', doneTitle:'Processing Complete!', benchTitle:'⚡ Processing Engine — Performance Benchmarks', ready:'Ready', rowsProcessed:'rows processed', processingChunk:'Processing chunk...' },
    createAd: { title:'Create New Ad', subtitle:'AI-powered ad creation with automatic optimization', campaignSettings:'Campaign Settings', adCopy:'Ad Copy', budgetSchedule:'Budget & Schedule', platform:'Platform', objective:'Objective', headline:'Headline', bodyText:'Body Text', dailyBudget:'Daily Budget ($)', startDate:'Start Date', endDate:'End Date', headlinePlaceholder:'Enter your ad headline...', bodyPlaceholder:'Enter your ad body text...', generating:'Generating...', sponsored:'Sponsored', headlineFallback:'Your Ad Headline Here', bodyFallback:'Your ad body text will appear here. Make it compelling!', relevance:'Relevance', ctrPred:'CTR Prediction', qualityScore:'Quality Score', targetingMatch:'Targeting Match', aiScore:'🤖 AI Optimization Score', sampleHeadline:'Boost Your Business with Smart AI Advertising', sampleBody:'Reach your ideal customers with precision targeting and real-time optimization. Powered by machine learning for maximum ROI.' },
    buttons: { refresh:'⟳ Refresh', createNewAd:'✦ Create New Ad', newCampaign:'+ New Campaign', edit:'Edit', setBudget:'+ Set Budget', applySuggestion:'Apply Suggestion', preview:'Preview', saveDraft:'✓ Save Draft', aiGenerate:'🤖 AI Generate', launchCampaign:'🚀 Launch Campaign', exportResults:'↓ Export Results' },
    footer: { findMe:'FIND ME:', greenAI:'🌱 Green AI', i18n:'i18n 11 langs', version:'v1.0.0 Enterprise', tagline:'LumindAd Enterprise · Python · TensorFlow · React · Green AI' },
  },
  es: {
    nav: { dashboard:'Inicio', createAd:'Crear Anuncio', campaigns:'Campañas', budget:'Presupuesto', analytics:'Analítica', uploadData:'Subir Datos', section:'NAVEGACIÓN', newBadge:'NUEVO' },
    sidebar: { version:'v1.0.0 · ENTERPRISE', aiEngine:'Motor IA', aiOnline:'IA en Línea', greenAI:'IA Verde', greenBadge:'0.003 gCO₂ · GHG Alcance 2', userName:'Elizabeth D.F.', userRole:'IA Sostenible' },
    topbar: { live:'En vivo' },
    metrics: { totalSpend:'Gasto Total', impressions:'Impresiones', clicks:'Clics', conversions:'Conversiones', totalBudget:'Presupuesto Total', totalSpent:'Total Gastado', remaining:'Restante', budgetUsed:'Presupuesto Usado' },
    dashboard: { title:'Panel de Rendimiento', subtitle:'Monitorea tu rendimiento publicitario en tiempo real — insights potenciados por IA', weeklyPerformance:'Rendimiento Semanal', weeklySubtitle:'Impresiones y clics en 7 días', platformSplit:'División por Plataforma', platformSubtitle:'Distribución del gasto en anuncios', aiInsights:'Insights Generados por IA', insights:{ peakTitle:'Rendimiento Pico', peakDesc:'Los anuncios del viernes convierten 34% mejor. Aumenta el presupuesto en $200 para el próximo viernes.', anomalyTitle:'Anomalía Detectada', anomalyDesc:'El CTR de la campaña de TikTok cayó 18% vs. la semana pasada. Isolation Forest lo detectó.', growthTitle:'Oportunidad de Crecimiento', growthDesc:'El segmento B2B de LinkedIn muestra 5.1x ROAS. Se recomienda escalar el presupuesto +40%.' } },
    campaigns: { title:'Campañas', subtitle:'Gestiona y monitorea todas tus campañas publicitarias', searchPlaceholder:'Buscar campañas...', cols:['Campaña','Plataforma','Estado','Presupuesto','Gastado','Impresiones','CTR','ROAS',''] },
    budget: { title:'Gestión de Presupuesto', subtitle:'Controla y optimiza tu gasto publicitario con recomendaciones de IA', dailySpend:'Gasto Diario vs Presupuesto', dailySubtitle:'Gasto real comparado con el objetivo diario', actualSpend:'Gasto Real', budgetTarget:'Objetivo de Presupuesto', byPlatform:'Por Plataforma', aiRecommendation:'🤖 Recomendación IA', aiText:'Reasigna', aiStrong1:'$1,200', aiFrom:' de Meta a Google Ads. El modelo predictivo (XGBoost) estima ', aiStrong2:'+23% ROAS', aiEnd:' de mejora.' },
    analytics: { title:'Analítica', subtitle:'Análisis profundo de tus datos con inteligencia artificial', impressions:'Impresiones en el Tiempo', conversionsClicks:'Conversiones y Clics', convSubtitle:'Embudo de engagement en el tiempo', mlPanel:'Modelos ML Activos — TensorFlow · XGBoost · SHAP', accuracy:'Precisión:', models:{ churnPredictor:'Predictor de Abandono', anomalyDetector:'Detector de Anomalías', clickPredictor:'Predictor de Clics', roasOptimizer:'Optimizador ROAS' }, modelTypes:{ xgboost:'XGBoost', isolationForest:'Isolation Forest', neuralNetwork:'Red Neuronal', automl:'AutoML' } },
    upload: { title:'Subir Datos', subtitle:'Procesa hasta 10M filas · Procesamiento paralelo · Web Workers', capacity:'⚡ 10 archivos · máx 10M filas', idle:'Arrastra y suelta tus archivos aquí', active:'¡Suelta tus archivos aquí!', browse:'explorar archivos', limits:'Máx 10 archivos · Hasta 2GB · Procesamiento en bloques (50K filas/bloque)', fileListTitle:'Archivos Subidos', processing:'⟳ Procesando...', processBtn:'▶ Procesar Datos', clearBtn:'🗑 Limpiar Datos', exportBtn:'↓ Exportar Resultados', doneTitle:'¡Procesamiento Completo!', benchTitle:'⚡ Motor de Procesamiento — Benchmarks', ready:'Listo', rowsProcessed:'filas procesadas', processingChunk:'Procesando bloque...' },
    createAd: { title:'Crear Nuevo Anuncio', subtitle:'Creación de anuncios con IA y optimización automática', campaignSettings:'Configuración de Campaña', adCopy:'Texto del Anuncio', budgetSchedule:'Presupuesto y Fechas', platform:'Plataforma', objective:'Objetivo', headline:'Título', bodyText:'Cuerpo del Texto', dailyBudget:'Presupuesto Diario ($)', startDate:'Fecha Inicio', endDate:'Fecha Fin', headlinePlaceholder:'Ingresa el título de tu anuncio...', bodyPlaceholder:'Ingresa el cuerpo del texto...', generating:'Generando...', sponsored:'Patrocinado', headlineFallback:'Título de tu Anuncio', bodyFallback:'El texto de tu anuncio aparecerá aquí. ¡Hazlo convincente!', relevance:'Relevancia', ctrPred:'Predicción CTR', qualityScore:'Puntuación de Calidad', targetingMatch:'Coincidencia de Segmentación', aiScore:'🤖 Puntuación de Optimización IA', sampleHeadline:'Impulsa tu Negocio con Publicidad Inteligente', sampleBody:'Llega a tus clientes ideales con segmentación precisa y optimización en tiempo real. Impulsado por machine learning para máximo ROI.' },
    buttons: { refresh:'⟳ Actualizar', createNewAd:'✦ Crear Anuncio', newCampaign:'+ Nueva Campaña', edit:'Editar', setBudget:'+ Fijar Presupuesto', applySuggestion:'Aplicar Sugerencia', preview:'Vista Previa', saveDraft:'✓ Guardar Borrador', aiGenerate:'🤖 Generar con IA', launchCampaign:'🚀 Lanzar Campaña', exportResults:'↓ Exportar' },
    footer: { findMe:'ENCUÉNTRAME:', greenAI:'🌱 IA Verde', i18n:'i18n 11 idiomas', version:'v1.0.0 Enterprise', tagline:'LumindAd Enterprise · Python · TensorFlow · React · IA Verde' },
  },
  pt: {
    nav: { dashboard:'Painel', createAd:'Criar Anúncio', campaigns:'Campanhas', budget:'Orçamento', analytics:'Analítica', uploadData:'Enviar Dados', section:'NAVEGAÇÃO', newBadge:'NOVO' },
    sidebar: { version:'v1.0.0 · ENTERPRISE', aiEngine:'Motor IA', aiOnline:'IA Online', greenAI:'IA Verde', greenBadge:'0.003 gCO₂ · GHG Escopo 2', userName:'Elizabeth D.F.', userRole:'IA Sustentável' },
    topbar: { live:'Ao Vivo' },
    metrics: { totalSpend:'Gasto Total', impressions:'Impressões', clicks:'Cliques', conversions:'Conversões', totalBudget:'Orçamento Total', totalSpent:'Total Gasto', remaining:'Restante', budgetUsed:'Orçamento Usado' },
    dashboard: { title:'Painel de Desempenho', subtitle:'Monitore seu desempenho publicitário em tempo real — insights com IA', weeklyPerformance:'Desempenho Semanal', weeklySubtitle:'Impressões e cliques em 7 dias', platformSplit:'Divisão por Plataforma', platformSubtitle:'Distribuição do gasto em anúncios', aiInsights:'Insights Gerados por IA', insights:{ peakTitle:'Pico de Desempenho', peakDesc:'Anúncios de sexta convertem 34% melhor. Aumente o orçamento em $200 para a próxima sexta.', anomalyTitle:'Anomalia Detectada', anomalyDesc:'CTR da campanha TikTok caiu 18% vs semana passada. Isolation Forest detectou isso.', growthTitle:'Oportunidade de Crescimento', growthDesc:'Segmento B2B do LinkedIn mostra ROAS 5.1x. Recomenda-se escalar orçamento +40%.' } },
    campaigns: { title:'Campanhas', subtitle:'Gerencie e acompanhe todas as suas campanhas publicitárias', searchPlaceholder:'Buscar campanhas...', cols:['Campanha','Plataforma','Status','Orçamento','Gasto','Impressões','CTR','ROAS',''] },
    budget: { title:'Gestão de Orçamento', subtitle:'Controle e otimize seus gastos com recomendações de IA', dailySpend:'Gasto Diário vs Orçamento', dailySubtitle:'Gasto real comparado ao objetivo diário', actualSpend:'Gasto Real', budgetTarget:'Meta de Orçamento', byPlatform:'Por Plataforma', aiRecommendation:'🤖 Recomendação IA', aiText:'Realoque', aiStrong1:'$1.200', aiFrom:' do Meta para Google Ads. O modelo preditivo (XGBoost) estima ', aiStrong2:'+23% ROAS', aiEnd:' de melhoria.' },
    analytics: { title:'Analítica', subtitle:'Análise profunda dos dados com inteligência artificial', impressions:'Impressões ao Longo do Tempo', conversionsClicks:'Conversões e Cliques', convSubtitle:'Funil de engajamento ao longo do tempo', mlPanel:'Modelos ML Ativos — TensorFlow · XGBoost · SHAP', accuracy:'Precisão:', models:{ churnPredictor:'Preditor de Churn', anomalyDetector:'Detector de Anomalias', clickPredictor:'Preditor de Cliques', roasOptimizer:'Otimizador ROAS' }, modelTypes:{ xgboost:'XGBoost', isolationForest:'Isolation Forest', neuralNetwork:'Rede Neural', automl:'AutoML' } },
    upload: { title:'Enviar Dados', subtitle:'Processe até 10M linhas · Processamento paralelo · Web Workers', capacity:'⚡ 10 arquivos · máx 10M linhas', idle:'Arraste e solte seus arquivos aqui', active:'Solte seus arquivos aqui!', browse:'procurar arquivos', limits:'Máx 10 arquivos · Até 2GB · Processamento em blocos (50K linhas/bloco)', fileListTitle:'Arquivos Enviados', processing:'⟳ Processando...', processBtn:'▶ Processar Dados', clearBtn:'🗑 Limpar Dados', exportBtn:'↓ Exportar Resultados', doneTitle:'Processamento Concluído!', benchTitle:'⚡ Motor de Processamento — Benchmarks', ready:'Pronto', rowsProcessed:'linhas processadas', processingChunk:'Processando bloco...' },
    createAd: { title:'Criar Novo Anúncio', subtitle:'Criação de anúncios com IA e otimização automática', campaignSettings:'Configurações da Campanha', adCopy:'Texto do Anúncio', budgetSchedule:'Orçamento e Agenda', platform:'Plataforma', objective:'Objetivo', headline:'Título', bodyText:'Corpo do Texto', dailyBudget:'Orçamento Diário ($)', startDate:'Data de Início', endDate:'Data de Fim', headlinePlaceholder:'Digite o título do seu anúncio...', bodyPlaceholder:'Digite o corpo do texto...', generating:'Gerando...', sponsored:'Patrocinado', headlineFallback:'Título do Seu Anúncio', bodyFallback:'O texto do seu anúncio aparecerá aqui.', relevance:'Relevância', ctrPred:'Previsão de CTR', qualityScore:'Pontuação de Qualidade', targetingMatch:'Correspondência de Segmentação', aiScore:'🤖 Pontuação de Otimização IA', sampleHeadline:'Impulsione Seu Negócio com Publicidade Inteligente', sampleBody:'Alcance seus clientes ideais com segmentação precisa e otimização em tempo real. Impulsionado por machine learning.' },
    buttons: { refresh:'⟳ Atualizar', createNewAd:'✦ Criar Anúncio', newCampaign:'+ Nova Campanha', edit:'Editar', setBudget:'+ Definir Orçamento', applySuggestion:'Aplicar Sugestão', preview:'Visualizar', saveDraft:'✓ Salvar Rascunho', aiGenerate:'🤖 Gerar com IA', launchCampaign:'🚀 Lançar Campanha', exportResults:'↓ Exportar' },
    footer: { findMe:'ME ENCONTRE:', greenAI:'🌱 IA Verde', i18n:'i18n 11 idiomas', version:'v1.0.0 Enterprise', tagline:'LumindAd Enterprise · Python · TensorFlow · React · IA Verde' },
  },
  fr: {
    nav: { dashboard:'Tableau de Bord', createAd:'Créer une Pub', campaigns:'Campagnes', budget:'Budget', analytics:'Analytique', uploadData:'Charger Données', section:'NAVIGATION', newBadge:'NOUVEAU' },
    sidebar: { version:'v1.0.0 · ENTERPRISE', aiEngine:'Moteur IA', aiOnline:'IA en Ligne', greenAI:'IA Verte', greenBadge:'0.003 gCO₂ · GHG Portée 2', userName:'Elizabeth D.F.', userRole:'IA Durable' },
    topbar: { live:'En Direct' },
    metrics: { totalSpend:'Dépense Totale', impressions:'Impressions', clicks:'Clics', conversions:'Conversions', totalBudget:'Budget Total', totalSpent:'Total Dépensé', remaining:'Restant', budgetUsed:'Budget Utilisé' },
    dashboard: { title:'Tableau de Bord Performance', subtitle:'Surveillez vos performances publicitaires en temps réel — insights IA', weeklyPerformance:'Performance Hebdomadaire', weeklySubtitle:'Impressions et clics sur 7 jours', platformSplit:'Répartition par Plateforme', platformSubtitle:'Distribution des dépenses publicitaires', aiInsights:'Insights Générés par IA', insights:{ peakTitle:'Performance de Pointe', peakDesc:'Les pubs du vendredi convertissent 34% mieux. Augmentez le budget de $200 le prochain vendredi.', anomalyTitle:'Anomalie Détectée', anomalyDesc:'Le CTR de la campagne TikTok a chuté de 18% par rapport à la semaine dernière.', growthTitle:'Opportunité de Croissance', growthDesc:'Le segment B2B de LinkedIn affiche un ROAS de 5.1x. Recommande d\'augmenter le budget de +40%.' } },
    campaigns: { title:'Campagnes', subtitle:'Gérez et suivez toutes vos campagnes publicitaires', searchPlaceholder:'Rechercher des campagnes...', cols:['Campagne','Plateforme','Statut','Budget','Dépensé','Impressions','CTR','ROAS',''] },
    budget: { title:'Gestion du Budget', subtitle:'Suivez et optimisez vos dépenses publicitaires avec des recommandations IA', dailySpend:'Dépenses Quotidiennes vs Budget', dailySubtitle:'Dépenses réelles par rapport à l\'objectif quotidien', actualSpend:'Dépenses Réelles', budgetTarget:'Objectif Budget', byPlatform:'Par Plateforme', aiRecommendation:'🤖 Recommandation IA', aiText:'Réallouez', aiStrong1:'1 200 $', aiFrom:' de Meta vers Google Ads. Le modèle prédictif (XGBoost) estime ', aiStrong2:'+23% ROAS', aiEnd:' d\'amélioration.' },
    analytics: { title:'Analytique', subtitle:'Analyse approfondie avec intelligence artificielle', impressions:'Impressions dans le Temps', conversionsClicks:'Conversions et Clics', convSubtitle:'Entonnoir d\'engagement dans le temps', mlPanel:'Modèles ML Actifs — TensorFlow · XGBoost · SHAP', accuracy:'Précision:', models:{ churnPredictor:'Prédicteur d\'Attrition', anomalyDetector:'Détecteur d\'Anomalies', clickPredictor:'Prédicteur de Clics', roasOptimizer:'Optimiseur ROAS' }, modelTypes:{ xgboost:'XGBoost', isolationForest:'Isolation Forest', neuralNetwork:'Réseau de Neurones', automl:'AutoML' } },
    upload: { title:'Charger Données', subtitle:'Traitez jusqu\'à 10M lignes · Traitement parallèle · Web Workers', capacity:'⚡ 10 fichiers · max 10M lignes', idle:'Glissez-déposez vos fichiers ici', active:'Déposez vos fichiers ici!', browse:'parcourir les fichiers', limits:'Max 10 fichiers · Jusqu\'à 2Go · Traitement par blocs (50K lignes/bloc)', fileListTitle:'Fichiers Chargés', processing:'⟳ Traitement...', processBtn:'▶ Traiter les Données', clearBtn:'🗑 Effacer', exportBtn:'↓ Exporter', doneTitle:'Traitement Terminé!', benchTitle:'⚡ Moteur de Traitement — Benchmarks', ready:'Prêt', rowsProcessed:'lignes traitées', processingChunk:'Traitement du bloc...' },
    createAd: { title:'Créer une Nouvelle Pub', subtitle:'Création de publicités avec IA et optimisation automatique', campaignSettings:'Paramètres de Campagne', adCopy:'Texte Publicitaire', budgetSchedule:'Budget et Planning', platform:'Plateforme', objective:'Objectif', headline:'Titre', bodyText:'Corps du Texte', dailyBudget:'Budget Quotidien ($)', startDate:'Date de Début', endDate:'Date de Fin', headlinePlaceholder:'Entrez le titre de votre pub...', bodyPlaceholder:'Entrez le corps du texte...', generating:'Génération...', sponsored:'Sponsorisé', headlineFallback:'Titre de Votre Pub', bodyFallback:'Le texte de votre pub apparaîtra ici.', relevance:'Pertinence', ctrPred:'Prédiction CTR', qualityScore:'Score de Qualité', targetingMatch:'Correspondance Ciblage', aiScore:'🤖 Score d\'Optimisation IA', sampleHeadline:'Boostez Votre Entreprise avec la Pub Intelligente', sampleBody:'Atteignez vos clients idéaux avec un ciblage précis et une optimisation en temps réel. Propulsé par le machine learning.' },
    buttons: { refresh:'⟳ Actualiser', createNewAd:'✦ Créer une Pub', newCampaign:'+ Nouvelle Campagne', edit:'Modifier', setBudget:'+ Définir Budget', applySuggestion:'Appliquer Suggestion', preview:'Aperçu', saveDraft:'✓ Sauvegarder', aiGenerate:'🤖 Générer avec IA', launchCampaign:'🚀 Lancer la Campagne', exportResults:'↓ Exporter' },
    footer: { findMe:'ME TROUVER:', greenAI:'🌱 IA Verte', i18n:'i18n 11 langues', version:'v1.0.0 Enterprise', tagline:'LumindAd Enterprise · Python · TensorFlow · React · IA Verte' },
  },
  ar: {
    rtl: true,
    nav: { dashboard:'لوحة القيادة', createAd:'إنشاء إعلان', campaigns:'الحملات', budget:'الميزانية', analytics:'التحليلات', uploadData:'رفع البيانات', section:'التنقل', newBadge:'جديد' },
    sidebar: { version:'v1.0.0 · إنتربرايز', aiEngine:'محرك الذكاء الاصطناعي', aiOnline:'الذكاء الاصطناعي متصل', greenAI:'ذكاء اصطناعي أخضر', greenBadge:'0.003 جم CO₂ · النطاق 2', userName:'إليزابيث د.ف.', userRole:'ذكاء اصطناعي مستدام' },
    topbar: { live:'مباشر' },
    metrics: { totalSpend:'إجمالي الإنفاق', impressions:'مرات الظهور', clicks:'النقرات', conversions:'التحويلات', totalBudget:'الميزانية الإجمالية', totalSpent:'الإجمالي المُنفق', remaining:'المتبقي', budgetUsed:'الميزانية المستخدمة' },
    dashboard: { title:'لوحة الأداء', subtitle:'راقب أداء إعلاناتك في الوقت الفعلي — رؤى مدعومة بالذكاء الاصطناعي', weeklyPerformance:'الأداء الأسبوعي', weeklySubtitle:'مرات الظهور والنقرات خلال 7 أيام', platformSplit:'توزيع المنصات', platformSubtitle:'توزيع الإنفاق الإعلاني', aiInsights:'رؤى مولدة بالذكاء الاصطناعي', insights:{ peakTitle:'ذروة الأداء', peakDesc:'إعلانات الجمعة تحقق تحويلات أفضل بنسبة 34%. زد الميزانية بمقدار $200 للجمعة القادمة.', anomalyTitle:'تم اكتشاف شذوذ', anomalyDesc:'انخفض معدل CTR لحملة TikTok بنسبة 18% مقارنة بالأسبوع الماضي.', growthTitle:'فرصة نمو', growthDesc:'يُظهر قطاع B2B في LinkedIn معدل ROAS بمقدار 5.1x. يُنصح بتوسيع الميزانية +40%.' } },
    campaigns: { title:'الحملات', subtitle:'إدارة ومتابعة جميع حملاتك الإعلانية', searchPlaceholder:'البحث في الحملات...', cols:['الحملة','المنصة','الحالة','الميزانية','المُنفق','مرات الظهور','CTR','ROAS',''] },
    budget: { title:'إدارة الميزانية', subtitle:'تتبع وتحسين إنفاقك الإعلاني بتوصيات الذكاء الاصطناعي', dailySpend:'الإنفاق اليومي مقابل الميزانية', dailySubtitle:'الإنفاق الفعلي مقارنة بالهدف اليومي', actualSpend:'الإنفاق الفعلي', budgetTarget:'هدف الميزانية', byPlatform:'حسب المنصة', aiRecommendation:'🤖 توصية الذكاء الاصطناعي', aiText:'أعد توزيع', aiStrong1:'$1,200', aiFrom:' من Meta إلى Google Ads. يُقدر النموذج التنبؤي (XGBoost) ', aiStrong2:'تحسين +23% ROAS', aiEnd:'.' },
    analytics: { title:'التحليلات', subtitle:'تحليل عميق للبيانات بالذكاء الاصطناعي', impressions:'مرات الظهور عبر الزمن', conversionsClicks:'التحويلات والنقرات', convSubtitle:'مسار التفاعل عبر الزمن', mlPanel:'نماذج ML النشطة — TensorFlow · XGBoost · SHAP', accuracy:'الدقة:', models:{ churnPredictor:'متنبئ الإلغاء', anomalyDetector:'كاشف الشذوذ', clickPredictor:'متنبئ النقرات', roasOptimizer:'مُحسِّن ROAS' }, modelTypes:{ xgboost:'XGBoost', isolationForest:'Isolation Forest', neuralNetwork:'شبكة عصبية', automl:'AutoML' } },
    upload: { title:'رفع البيانات', subtitle:'معالجة حتى 10 مليون صف · معالجة متوازية · Web Workers', capacity:'⚡ 10 ملفات · حد أقصى 10M صف', idle:'اسحب وأفلت ملفاتك هنا', active:'أفلت ملفاتك هنا!', browse:'تصفح الملفات', limits:'حد أقصى 10 ملفات · حتى 2 جيجابايت · معالجة مجمّعة', fileListTitle:'الملفات المرفوعة', processing:'⟳ جاري المعالجة...', processBtn:'▶ معالجة البيانات', clearBtn:'🗑 مسح البيانات', exportBtn:'↓ تصدير النتائج', doneTitle:'اكتملت المعالجة!', benchTitle:'⚡ محرك المعالجة — المعايير', ready:'جاهز', rowsProcessed:'صف تمت معالجته', processingChunk:'جاري معالجة المجموعة...' },
    createAd: { title:'إنشاء إعلان جديد', subtitle:'إنشاء إعلانات بالذكاء الاصطناعي مع تحسين تلقائي', campaignSettings:'إعدادات الحملة', adCopy:'نص الإعلان', budgetSchedule:'الميزانية والجدول', platform:'المنصة', objective:'الهدف', headline:'العنوان', bodyText:'نص الجسم', dailyBudget:'الميزانية اليومية ($)', startDate:'تاريخ البداية', endDate:'تاريخ النهاية', headlinePlaceholder:'أدخل عنوان إعلانك...', bodyPlaceholder:'أدخل نص الجسم...', generating:'جاري الإنشاء...', sponsored:'ممول', headlineFallback:'عنوان إعلانك هنا', bodyFallback:'سيظهر نص إعلانك هنا.', relevance:'الصلة', ctrPred:'توقع CTR', qualityScore:'درجة الجودة', targetingMatch:'تطابق الاستهداف', aiScore:'🤖 درجة تحسين الذكاء الاصطناعي', sampleHeadline:'عزز أعمالك بالإعلان الذكي', sampleBody:'تواصل مع عملائك المثاليين بدقة واحترافية مدعومة بالذكاء الاصطناعي.' },
    buttons: { refresh:'⟳ تحديث', createNewAd:'✦ إنشاء إعلان', newCampaign:'+ حملة جديدة', edit:'تعديل', setBudget:'+ تحديد الميزانية', applySuggestion:'تطبيق الاقتراح', preview:'معاينة', saveDraft:'✓ حفظ مسودة', aiGenerate:'🤖 توليد بالذكاء الاصطناعي', launchCampaign:'🚀 إطلاق الحملة', exportResults:'↓ تصدير' },
    footer: { findMe:'جدني:', greenAI:'🌱 ذكاء اصطناعي أخضر', i18n:'i18n 11 لغة', version:'v1.0.0 Enterprise', tagline:'LumindAd Enterprise · Python · TensorFlow · React · ذكاء اصطناعي أخضر' },
  },
  he: {
    rtl: true,
    nav: { dashboard:'לוח בקרה', createAd:'צור מודעה', campaigns:'קמפיינים', budget:'תקציב', analytics:'אנליטיקה', uploadData:'העלה נתונים', section:'ניווט', newBadge:'חדש' },
    sidebar: { version:'v1.0.0 · ENTERPRISE', aiEngine:'מנוע בינה מלאכותית', aiOnline:'בינה מלאכותית מחובר', greenAI:'בינה מלאכותית ירוקה', greenBadge:'0.003 gCO₂ · GHG היקף 2', userName:'אליזבת ד.פ.', userRole:'מדענית בינה מלאכותית' },
    topbar: { live:'חי' },
    metrics: { totalSpend:'סך הוצאה', impressions:'חשיפות', clicks:'קליקים', conversions:'המרות', totalBudget:'תקציב כולל', totalSpent:'סה"כ הוצא', remaining:'נותר', budgetUsed:'תקציב בשימוש' },
    dashboard: { title:'לוח ביצועים', subtitle:'עקוב אחר ביצועי הפרסום שלך בזמן אמת — תובנות מבינה מלאכותית', weeklyPerformance:'ביצועים שבועיים', weeklySubtitle:'חשיפות וקליקים ב-7 ימים', platformSplit:'פיצול פלטפורמות', platformSubtitle:'חלוקת הוצאות פרסום', aiInsights:'תובנות שנוצרו על ידי בינה מלאכותית', insights:{ peakTitle:'ביצועי שיא', peakDesc:'מודעות ביום שישי ממירות ב-34% טוב יותר. הגדל תקציב ב-$200 ליום שישי הבא.', anomalyTitle:'זוהתה חריגה', anomalyDesc:'ה-CTR של קמפיין TikTok ירד ב-18% לעומת השבוע שעבר.', growthTitle:'הזדמנות צמיחה', growthDesc:'מגזר B2B של LinkedIn מציג ROAS של 5.1x. מומלץ להגדיל תקציב +40%.' } },
    campaigns: { title:'קמפיינים', subtitle:'נהל ועקוב אחר כל הקמפיינים הפרסומיים שלך', searchPlaceholder:'חפש קמפיינים...', cols:['קמפיין','פלטפורמה','סטטוס','תקציב','הוצא','חשיפות','CTR','ROAS',''] },
    budget: { title:'ניהול תקציב', subtitle:'עקוב וייעל את הוצאות הפרסום שלך עם המלצות בינה מלאכותית', dailySpend:'הוצאה יומית לעומת תקציב', dailySubtitle:'הוצאה בפועל לעומת היעד היומי', actualSpend:'הוצאה בפועל', budgetTarget:'יעד תקציב', byPlatform:'לפי פלטפורמה', aiRecommendation:'🤖 המלצת בינה מלאכותית', aiText:'הקצה מחדש', aiStrong1:'$1,200', aiFrom:' ממטא לגוגל אדס. המודל החיזוי (XGBoost) מעריך ', aiStrong2:'+23% ROAS', aiEnd:' שיפור.' },
    analytics: { title:'אנליטיקה', subtitle:'ניתוח מעמיק של הנתונים עם בינה מלאכותית', impressions:'חשיפות לאורך זמן', conversionsClicks:'המרות וקליקים', convSubtitle:'משפך מעורבות לאורך זמן', mlPanel:'מודלי ML פעילים — TensorFlow · XGBoost · SHAP', accuracy:'דיוק:', models:{ churnPredictor:'מנבא נטישה', anomalyDetector:'גלאי חריגות', clickPredictor:'מנבא קליקים', roasOptimizer:'מייעל ROAS' }, modelTypes:{ xgboost:'XGBoost', isolationForest:'Isolation Forest', neuralNetwork:'רשת עצבית', automl:'AutoML' } },
    upload: { title:'העלה נתונים', subtitle:'עבד עד 10 מיליון שורות · עיבוד מקבילי · Web Workers', capacity:'⚡ 10 קבצים · מקסימום 10M שורות', idle:'גרור ושחרר קבצים כאן', active:'שחרר את הקבצים כאן!', browse:'עיין בקבצים', limits:'מקסימום 10 קבצים · עד 2GB · עיבוד גושים', fileListTitle:'קבצים שהועלו', processing:'⟳ מעבד...', processBtn:'▶ עבד נתונים', clearBtn:'🗑 נקה', exportBtn:'↓ יצוא', doneTitle:'העיבוד הושלם!', benchTitle:'⚡ מנוע עיבוד — ביצועי ייחוס', ready:'מוכן', rowsProcessed:'שורות עובדו', processingChunk:'מעבד גוש...' },
    createAd: { title:'צור מודעה חדשה', subtitle:'יצירת מודעות עם בינה מלאכותית ואופטימיזציה אוטומטית', campaignSettings:'הגדרות קמפיין', adCopy:'טקסט מודעה', budgetSchedule:'תקציב ולוח זמנים', platform:'פלטפורמה', objective:'מטרה', headline:'כותרת', bodyText:'גוף הטקסט', dailyBudget:'תקציב יומי ($)', startDate:'תאריך התחלה', endDate:'תאריך סיום', headlinePlaceholder:'הכנס את כותרת המודעה שלך...', bodyPlaceholder:'הכנס את גוף הטקסט...', generating:'מייצר...', sponsored:'ממומן', headlineFallback:'כותרת המודעה שלך כאן', bodyFallback:'טקסט המודעה שלך יופיע כאן.', relevance:'רלוונטיות', ctrPred:'תחזית CTR', qualityScore:'ציון איכות', targetingMatch:'התאמת מיקוד', aiScore:'🤖 ציון אופטימיזציה בינה מלאכותית', sampleHeadline:'קדם את העסק שלך עם פרסום חכם', sampleBody:'הגע ללקוחות האידיאליים שלך עם מיקוד מדויק ואופטימיזציה בזמן אמת.' },
    buttons: { refresh:'⟳ רענן', createNewAd:'✦ צור מודעה', newCampaign:'+ קמפיין חדש', edit:'ערוך', setBudget:'+ קבע תקציב', applySuggestion:'החל הצעה', preview:'תצוגה מקדימה', saveDraft:'✓ שמור טיוטה', aiGenerate:'🤖 צור עם IA', launchCampaign:'🚀 השק קמפיין', exportResults:'↓ יצוא' },
    footer: { findMe:'מצא אותי:', greenAI:'🌱 בינה מלאכותית ירוקה', i18n:'i18n 11 שפות', version:'v1.0.0 Enterprise', tagline:'LumindAd Enterprise · Python · TensorFlow · React · IA ירוק' },
  },
  zh: {
    nav: { dashboard:'仪表盘', createAd:'创建广告', campaigns:'广告系列', budget:'预算', analytics:'分析', uploadData:'上传数据', section:'导航', newBadge:'新' },
    sidebar: { version:'v1.0.0 · 企业版', aiEngine:'AI 引擎', aiOnline:'AI 在线', greenAI:'绿色 AI', greenBadge:'0.003 gCO₂ · 温室气体范围 2', userName:'Elizabeth D.F.', userRole:'可持续 AI 科学家' },
    topbar: { live:'实时' },
    metrics: { totalSpend:'总支出', impressions:'曝光次数', clicks:'点击次数', conversions:'转化次数', totalBudget:'总预算', totalSpent:'总花费', remaining:'剩余', budgetUsed:'预算使用率' },
    dashboard: { title:'绩效仪表盘', subtitle:'实时监控您的广告绩效 — AI 驱动的洞察', weeklyPerformance:'每周绩效', weeklySubtitle:'7天曝光量和点击量', platformSplit:'平台分布', platformSubtitle:'广告支出分布', aiInsights:'AI 生成的洞察', insights:{ peakTitle:'峰值表现', peakDesc:'周五广告转化率提高34%。为下周五增加$200预算。', anomalyTitle:'检测到异常', anomalyDesc:'TikTok广告系列CTR与上周相比下降18%。Isolation Forest已标记此问题。', growthTitle:'增长机会', growthDesc:'LinkedIn B2B 细分市场显示ROAS为5.1x。建议将预算扩大+40%。' } },
    campaigns: { title:'广告系列', subtitle:'管理和跟踪所有广告系列', searchPlaceholder:'搜索广告系列...', cols:['广告系列','平台','状态','预算','已花费','曝光次数','CTR','ROAS',''] },
    budget: { title:'预算管理', subtitle:'通过AI建议跟踪和优化广告支出', dailySpend:'每日支出 vs 预算', dailySubtitle:'实际支出与每日预算目标的比较', actualSpend:'实际支出', budgetTarget:'预算目标', byPlatform:'按平台', aiRecommendation:'🤖 AI 建议', aiText:'将', aiStrong1:'$1,200', aiFrom:'从 Meta 重新分配到 Google Ads。预测模型 (XGBoost) 估计', aiStrong2:'+23% ROAS', aiEnd:'的改善。' },
    analytics: { title:'分析', subtitle:'AI驱动的深度数据分析', impressions:'随时间变化的曝光量', conversionsClicks:'转化和点击', convSubtitle:'随时间变化的参与漏斗', mlPanel:'活跃 ML 模型 — TensorFlow · XGBoost · SHAP', accuracy:'准确率:', models:{ churnPredictor:'流失预测器', anomalyDetector:'异常检测器', clickPredictor:'点击预测器', roasOptimizer:'ROAS 优化器' }, modelTypes:{ xgboost:'XGBoost', isolationForest:'Isolation Forest', neuralNetwork:'神经网络', automl:'AutoML' } },
    upload: { title:'上传数据', subtitle:'处理多达1000万行 · 分块并行处理 · Web Workers', capacity:'⚡ 10个文件 · 最多1000万行', idle:'将文件拖放到此处', active:'将文件放在这里！', browse:'浏览文件', limits:'最多10个文件 · 支持2GB · 分块处理', fileListTitle:'已上传文件', processing:'⟳ 处理中...', processBtn:'▶ 处理数据', clearBtn:'🗑 清除数据', exportBtn:'↓ 导出结果', doneTitle:'处理完成！', benchTitle:'⚡ 处理引擎 — 性能基准', ready:'就绪', rowsProcessed:'行已处理', processingChunk:'处理块中...' },
    createAd: { title:'创建新广告', subtitle:'AI 驱动的广告创建与自动优化', campaignSettings:'广告系列设置', adCopy:'广告文案', budgetSchedule:'预算和排期', platform:'平台', objective:'目标', headline:'标题', bodyText:'正文', dailyBudget:'每日预算 ($)', startDate:'开始日期', endDate:'结束日期', headlinePlaceholder:'输入广告标题...', bodyPlaceholder:'输入广告正文...', generating:'生成中...', sponsored:'赞助', headlineFallback:'您的广告标题', bodyFallback:'您的广告文案将显示在这里。', relevance:'相关性', ctrPred:'CTR 预测', qualityScore:'质量分数', targetingMatch:'定向匹配', aiScore:'🤖 AI 优化评分', sampleHeadline:'用智能广告助力您的业务增长', sampleBody:'通过精准定向和实时优化触达理想客户。由机器学习驱动，实现最大ROI。' },
    buttons: { refresh:'⟳ 刷新', createNewAd:'✦ 创建广告', newCampaign:'+ 新建系列', edit:'编辑', setBudget:'+ 设置预算', applySuggestion:'应用建议', preview:'预览', saveDraft:'✓ 保存草稿', aiGenerate:'🤖 AI 生成', launchCampaign:'🚀 启动广告系列', exportResults:'↓ 导出' },
    footer: { findMe:'联系我:', greenAI:'🌱 绿色 AI', i18n:'i18n 11 种语言', version:'v1.0.0 企业版', tagline:'LumindAd 企业版 · Python · TensorFlow · React · 绿色 AI' },
  },
  ru: {
    nav: { dashboard:'Панель управления', createAd:'Создать объявление', campaigns:'Кампании', budget:'Бюджет', analytics:'Аналитика', uploadData:'Загрузить данные', section:'НАВИГАЦИЯ', newBadge:'НОВОЕ' },
    sidebar: { version:'v1.0.0 · ENTERPRISE', aiEngine:'ИИ Движок', aiOnline:'ИИ Онлайн', greenAI:'Зелёный ИИ', greenBadge:'0.003 г CO₂ · ПГ Охват 2', userName:'Элизабет Д.Ф.', userRole:'Устойчивый ИИ' },
    topbar: { live:'В эфире' },
    metrics: { totalSpend:'Общие расходы', impressions:'Показы', clicks:'Клики', conversions:'Конверсии', totalBudget:'Общий бюджет', totalSpent:'Итого потрачено', remaining:'Остаток', budgetUsed:'Использовано бюджета' },
    dashboard: { title:'Панель эффективности', subtitle:'Отслеживайте эффективность рекламы в реальном времени — аналитика на базе ИИ', weeklyPerformance:'Недельная эффективность', weeklySubtitle:'Показы и клики за 7 дней', platformSplit:'Распределение по платформам', platformSubtitle:'Распределение рекламных расходов', aiInsights:'Аналитика на основе ИИ', insights:{ peakTitle:'Пиковая эффективность', peakDesc:'Пятничные объявления конвертируют на 34% лучше. Увеличьте бюджет на $200 в следующую пятницу.', anomalyTitle:'Обнаружена аномалия', anomalyDesc:'CTR кампании TikTok снизился на 18% по сравнению с прошлой неделей.', growthTitle:'Возможность роста', growthDesc:'B2B сегмент LinkedIn показывает ROAS 5.1x. Рекомендуется увеличить бюджет на +40%.' } },
    campaigns: { title:'Кампании', subtitle:'Управляйте и отслеживайте все свои рекламные кампании', searchPlaceholder:'Поиск кампаний...', cols:['Кампания','Платформа','Статус','Бюджет','Потрачено','Показы','CTR','ROAS',''] },
    budget: { title:'Управление бюджетом', subtitle:'Отслеживайте и оптимизируйте рекламные расходы с рекомендациями ИИ', dailySpend:'Ежедневные расходы vs Бюджет', dailySubtitle:'Фактические расходы по сравнению с дневным целевым показателем', actualSpend:'Фактические расходы', budgetTarget:'Целевой бюджет', byPlatform:'По платформам', aiRecommendation:'🤖 Рекомендация ИИ', aiText:'Перераспределите', aiStrong1:'$1 200', aiFrom:' из Meta в Google Ads. Прогнозная модель (XGBoost) оценивает ', aiStrong2:'+23% ROAS', aiEnd:' улучшения.' },
    analytics: { title:'Аналитика', subtitle:'Глубокий анализ данных с использованием искусственного интеллекта', impressions:'Показы за период', conversionsClicks:'Конверсии и клики', convSubtitle:'Воронка вовлечённости во времени', mlPanel:'Активные ML модели — TensorFlow · XGBoost · SHAP', accuracy:'Точность:', models:{ churnPredictor:'Предиктор оттока', anomalyDetector:'Детектор аномалий', clickPredictor:'Предиктор кликов', roasOptimizer:'Оптимизатор ROAS' }, modelTypes:{ xgboost:'XGBoost', isolationForest:'Isolation Forest', neuralNetwork:'Нейронная сеть', automl:'AutoML' } },
    upload: { title:'Загрузить данные', subtitle:'Обработка до 10 млн строк · Параллельная обработка · Web Workers', capacity:'⚡ 10 файлов · макс. 10M строк', idle:'Перетащите файлы сюда', active:'Бросьте файлы здесь!', browse:'выбрать файлы', limits:'Макс. 10 файлов · До 2 ГБ · Блочная обработка', fileListTitle:'Загруженные файлы', processing:'⟳ Обработка...', processBtn:'▶ Обработать данные', clearBtn:'🗑 Очистить', exportBtn:'↓ Экспорт', doneTitle:'Обработка завершена!', benchTitle:'⚡ Движок обработки — Бенчмарки', ready:'Готово', rowsProcessed:'строк обработано', processingChunk:'Обработка блока...' },
    createAd: { title:'Создать новое объявление', subtitle:'Создание объявлений с ИИ и автоматической оптимизацией', campaignSettings:'Настройки кампании', adCopy:'Текст объявления', budgetSchedule:'Бюджет и расписание', platform:'Платформа', objective:'Цель', headline:'Заголовок', bodyText:'Текст', dailyBudget:'Дневной бюджет ($)', startDate:'Дата начала', endDate:'Дата окончания', headlinePlaceholder:'Введите заголовок объявления...', bodyPlaceholder:'Введите текст объявления...', generating:'Генерация...', sponsored:'Спонсорский', headlineFallback:'Заголовок вашего объявления', bodyFallback:'Текст вашего объявления появится здесь.', relevance:'Релевантность', ctrPred:'Прогноз CTR', qualityScore:'Оценка качества', targetingMatch:'Соответствие таргетинга', aiScore:'🤖 Оценка оптимизации ИИ', sampleHeadline:'Развивайте бизнес с умной рекламой', sampleBody:'Достигайте идеальных клиентов с точным таргетингом и оптимизацией в реальном времени.' },
    buttons: { refresh:'⟳ Обновить', createNewAd:'✦ Создать объявление', newCampaign:'+ Новая кампания', edit:'Редактировать', setBudget:'+ Установить бюджет', applySuggestion:'Применить', preview:'Предпросмотр', saveDraft:'✓ Сохранить черновик', aiGenerate:'🤖 Генерировать с ИИ', launchCampaign:'🚀 Запустить кампанию', exportResults:'↓ Экспорт' },
    footer: { findMe:'НАЙДИ МЕНЯ:', greenAI:'🌱 Зелёный ИИ', i18n:'i18n 11 языков', version:'v1.0.0 Enterprise', tagline:'LumindAd Enterprise · Python · TensorFlow · React · Зелёный ИИ' },
  },
  tr: {
    nav: { dashboard:'Gösterge Paneli', createAd:'Reklam Oluştur', campaigns:'Kampanyalar', budget:'Bütçe', analytics:'Analitik', uploadData:'Veri Yükle', section:'NAVİGASYON', newBadge:'YENİ' },
    sidebar: { version:'v1.0.0 · KURUMSAL', aiEngine:'Yapay Zeka Motoru', aiOnline:'Yapay Zeka Çevrimiçi', greenAI:'Yeşil Yapay Zeka', greenBadge:'0.003 gCO₂ · GHG Kapsam 2', userName:'Elizabeth D.F.', userRole:'Sürdürülebilir Yapay Zeka' },
    topbar: { live:'Canlı' },
    metrics: { totalSpend:'Toplam Harcama', impressions:'Gösterimler', clicks:'Tıklamalar', conversions:'Dönüşümler', totalBudget:'Toplam Bütçe', totalSpent:'Toplam Harcanan', remaining:'Kalan', budgetUsed:'Kullanılan Bütçe' },
    dashboard: { title:'Performans Gösterge Paneli', subtitle:'Reklam performansınızı gerçek zamanlı izleyin — Yapay zeka destekli içgörüler', weeklyPerformance:'Haftalık Performans', weeklySubtitle:'7 günlük gösterimler ve tıklamalar', platformSplit:'Platform Dağılımı', platformSubtitle:'Reklam harcaması dağılımı', aiInsights:'Yapay Zeka Tarafından Oluşturulan İçgörüler', insights:{ peakTitle:'Zirve Performansı', peakDesc:'Cuma reklamları %34 daha iyi dönüştürüyor. Gelecek Cuma için $200 bütçe artışı yapın.', anomalyTitle:'Anomali Tespit Edildi', anomalyDesc:'TikTok kampanyası CTR\'ı geçen haftaya göre %18 düştü.', growthTitle:'Büyüme Fırsatı', growthDesc:'LinkedIn B2B segmenti 5.1x ROAS gösteriyor. Bütçeyi +%40 artırmanız önerilir.' } },
    campaigns: { title:'Kampanyalar', subtitle:'Tüm reklam kampanyalarınızı yönetin ve takip edin', searchPlaceholder:'Kampanya ara...', cols:['Kampanya','Platform','Durum','Bütçe','Harcanan','Gösterimler','CTR','ROAS',''] },
    budget: { title:'Bütçe Yönetimi', subtitle:'Yapay zeka önerileriyle reklam harcamalarınızı takip edin ve optimize edin', dailySpend:'Günlük Harcama vs Bütçe', dailySubtitle:'Günlük bütçe hedefiyle karşılaştırılan gerçek harcama', actualSpend:'Gerçek Harcama', budgetTarget:'Bütçe Hedefi', byPlatform:'Platforma Göre', aiRecommendation:'🤖 Yapay Zeka Önerisi', aiText:'', aiStrong1:'$1.200\'ü', aiFrom:' Meta\'dan Google Ads\'e yeniden dağıtın. Tahmine dayalı model (XGBoost) ', aiStrong2:'+%23 ROAS', aiEnd:' iyileştirmesi öngörüyor.' },
    analytics: { title:'Analitik', subtitle:'Yapay zeka destekli derin veri analizi', impressions:'Zaman İçindeki Gösterimler', conversionsClicks:'Dönüşümler ve Tıklamalar', convSubtitle:'Zaman içindeki etkileşim hunisi', mlPanel:'Aktif ML Modelleri — TensorFlow · XGBoost · SHAP', accuracy:'Doğruluk:', models:{ churnPredictor:'Churn Tahmincisi', anomalyDetector:'Anomali Dedektörü', clickPredictor:'Tıklama Tahmincisi', roasOptimizer:'ROAS Optimize Edici' }, modelTypes:{ xgboost:'XGBoost', isolationForest:'Isolation Forest', neuralNetwork:'Sinir Ağı', automl:'AutoML' } },
    upload: { title:'Veri Yükle', subtitle:'10M satıra kadar işleyin · Paralel işleme · Web Workers', capacity:'⚡ 10 dosya · maks 10M satır', idle:'Dosyalarınızı buraya sürükleyip bırakın', active:'Dosyalarınızı buraya bırakın!', browse:'dosyalara göz at', limits:'Maks 10 dosya · 2GB\'a kadar · Blok işleme', fileListTitle:'Yüklenen Dosyalar', processing:'⟳ İşleniyor...', processBtn:'▶ Verileri İşle', clearBtn:'🗑 Temizle', exportBtn:'↓ Dışa Aktar', doneTitle:'İşlem Tamamlandı!', benchTitle:'⚡ İşleme Motoru — Performans Kıyaslamaları', ready:'Hazır', rowsProcessed:'satır işlendi', processingChunk:'Blok işleniyor...' },
    createAd: { title:'Yeni Reklam Oluştur', subtitle:'Yapay zeka destekli reklam oluşturma ve otomatik optimizasyon', campaignSettings:'Kampanya Ayarları', adCopy:'Reklam Metni', budgetSchedule:'Bütçe ve Program', platform:'Platform', objective:'Hedef', headline:'Başlık', bodyText:'Gövde Metni', dailyBudget:'Günlük Bütçe ($)', startDate:'Başlangıç Tarihi', endDate:'Bitiş Tarihi', headlinePlaceholder:'Reklam başlığınızı girin...', bodyPlaceholder:'Gövde metnini girin...', generating:'Oluşturuluyor...', sponsored:'Sponsorlu', headlineFallback:'Reklam Başlığınız', bodyFallback:'Reklam metniniz burada görünecek.', relevance:'Alaka Düzeyi', ctrPred:'CTR Tahmini', qualityScore:'Kalite Puanı', targetingMatch:'Hedefleme Eşleşmesi', aiScore:'🤖 Yapay Zeka Optimizasyon Puanı', sampleHeadline:'Akıllı Reklamcılıkla İşinizi Büyütün', sampleBody:'Hassas hedefleme ve gerçek zamanlı optimizasyon ile ideal müşterilerinize ulaşın.' },
    buttons: { refresh:'⟳ Yenile', createNewAd:'✦ Reklam Oluştur', newCampaign:'+ Yeni Kampanya', edit:'Düzenle', setBudget:'+ Bütçe Belirle', applySuggestion:'Öneriyi Uygula', preview:'Önizleme', saveDraft:'✓ Taslak Kaydet', aiGenerate:'🤖 Yapay Zeka ile Oluştur', launchCampaign:'🚀 Kampanyayı Başlat', exportResults:'↓ Dışa Aktar' },
    footer: { findMe:'BENİ BUL:', greenAI:'🌱 Yeşil Yapay Zeka', i18n:'i18n 11 dil', version:'v1.0.0 Kurumsal', tagline:'LumindAd Kurumsal · Python · TensorFlow · React · Yeşil Yapay Zeka' },
  },
  ko: {
    nav: { dashboard:'대시보드', createAd:'광고 만들기', campaigns:'캠페인', budget:'예산', analytics:'분석', uploadData:'데이터 업로드', section:'내비게이션', newBadge:'새로운' },
    sidebar: { version:'v1.0.0 · 엔터프라이즈', aiEngine:'AI 엔진', aiOnline:'AI 온라인', greenAI:'그린 AI', greenBadge:'0.003 gCO₂ · GHG 범위 2', userName:'엘리자베스 D.F.', userRole:'지속 가능한 AI' },
    topbar: { live:'실시간' },
    metrics: { totalSpend:'총 지출', impressions:'노출수', clicks:'클릭수', conversions:'전환수', totalBudget:'총 예산', totalSpent:'총 사용', remaining:'남은 금액', budgetUsed:'예산 사용률' },
    dashboard: { title:'성과 대시보드', subtitle:'실시간으로 광고 성과를 모니터링하세요 — AI 기반 인사이트', weeklyPerformance:'주간 성과', weeklySubtitle:'7일간 노출수 및 클릭수', platformSplit:'플랫폼별 분포', platformSubtitle:'광고 지출 분포', aiInsights:'AI 생성 인사이트', insights:{ peakTitle:'최고 성과', peakDesc:'금요일 광고가 34% 더 좋은 전환율을 보입니다. 다음 금요일 예산을 $200 늘리세요.', anomalyTitle:'이상 감지됨', anomalyDesc:'TikTok 캠페인 CTR이 지난주 대비 18% 하락했습니다.', growthTitle:'성장 기회', growthDesc:'LinkedIn B2B 세그먼트가 5.1x ROAS를 보입니다. 예산 +40% 확대를 권장합니다.' } },
    campaigns: { title:'캠페인', subtitle:'모든 광고 캠페인을 관리하고 추적하세요', searchPlaceholder:'캠페인 검색...', cols:['캠페인','플랫폼','상태','예산','사용','노출수','CTR','ROAS',''] },
    budget: { title:'예산 관리', subtitle:'AI 권장 사항으로 광고 지출을 추적하고 최적화하세요', dailySpend:'일일 지출 vs 예산', dailySubtitle:'일일 예산 목표와 비교한 실제 지출', actualSpend:'실제 지출', budgetTarget:'예산 목표', byPlatform:'플랫폼별', aiRecommendation:'🤖 AI 권장 사항', aiText:'Meta에서 Google Ads로', aiStrong1:'$1,200', aiFrom:'을 재배분하세요. 예측 모델(XGBoost)은 ', aiStrong2:'+23% ROAS', aiEnd:' 향상을 예상합니다.' },
    analytics: { title:'분석', subtitle:'AI 기반 심층 데이터 분석', impressions:'시간별 노출수', conversionsClicks:'전환 및 클릭', convSubtitle:'시간별 참여 퍼널', mlPanel:'활성 ML 모델 — TensorFlow · XGBoost · SHAP', accuracy:'정확도:', models:{ churnPredictor:'이탈 예측기', anomalyDetector:'이상 탐지기', clickPredictor:'클릭 예측기', roasOptimizer:'ROAS 최적화기' }, modelTypes:{ xgboost:'XGBoost', isolationForest:'Isolation Forest', neuralNetwork:'신경망', automl:'AutoML' } },
    upload: { title:'데이터 업로드', subtitle:'최대 1천만 행 처리 · 청크 병렬 처리 · Web Workers', capacity:'⚡ 파일 10개 · 최대 1천만 행', idle:'파일을 여기에 드래그 앤 드롭하세요', active:'파일을 여기에 놓으세요!', browse:'파일 찾아보기', limits:'최대 10개 파일 · 2GB까지 · 청크 처리', fileListTitle:'업로드된 파일', processing:'⟳ 처리 중...', processBtn:'▶ 데이터 처리', clearBtn:'🗑 데이터 지우기', exportBtn:'↓ 결과 내보내기', doneTitle:'처리 완료!', benchTitle:'⚡ 처리 엔진 — 성능 벤치마크', ready:'준비됨', rowsProcessed:'행 처리됨', processingChunk:'청크 처리 중...' },
    createAd: { title:'새 광고 만들기', subtitle:'AI 기반 광고 제작 및 자동 최적화', campaignSettings:'캠페인 설정', adCopy:'광고 카피', budgetSchedule:'예산 및 일정', platform:'플랫폼', objective:'목표', headline:'제목', bodyText:'본문', dailyBudget:'일일 예산 ($)', startDate:'시작일', endDate:'종료일', headlinePlaceholder:'광고 제목을 입력하세요...', bodyPlaceholder:'광고 본문을 입력하세요...', generating:'생성 중...', sponsored:'스폰서', headlineFallback:'광고 제목', bodyFallback:'광고 본문이 여기에 표시됩니다.', relevance:'관련성', ctrPred:'CTR 예측', qualityScore:'품질 점수', targetingMatch:'타겟팅 일치', aiScore:'🤖 AI 최적화 점수', sampleHeadline:'스마트 광고로 비즈니스를 성장시키세요', sampleBody:'정밀 타겟팅과 실시간 최적화로 이상적인 고객에게 도달하세요.' },
    buttons: { refresh:'⟳ 새로고침', createNewAd:'✦ 광고 만들기', newCampaign:'+ 새 캠페인', edit:'편집', setBudget:'+ 예산 설정', applySuggestion:'제안 적용', preview:'미리보기', saveDraft:'✓ 초안 저장', aiGenerate:'🤖 AI 생성', launchCampaign:'🚀 캠페인 시작', exportResults:'↓ 내보내기' },
    footer: { findMe:'찾아보세요:', greenAI:'🌱 그린 AI', i18n:'i18n 11개 언어', version:'v1.0.0 엔터프라이즈', tagline:'LumindAd 엔터프라이즈 · Python · TensorFlow · React · 그린 AI' },
  },
  ja: {
    nav: { dashboard:'ダッシュボード', createAd:'広告を作成', campaigns:'キャンペーン', budget:'予算', analytics:'分析', uploadData:'データをアップロード', section:'ナビゲーション', newBadge:'新機能' },
    sidebar: { version:'v1.0.0 · エンタープライズ', aiEngine:'AIエンジン', aiOnline:'AIオンライン', greenAI:'グリーンAI', greenBadge:'0.003 gCO₂ · GHG スコープ2', userName:'エリザベス D.F.', userRole:'持続可能なAI' },
    topbar: { live:'ライブ' },
    metrics: { totalSpend:'総支出', impressions:'インプレッション', clicks:'クリック', conversions:'コンバージョン', totalBudget:'総予算', totalSpent:'総支出額', remaining:'残額', budgetUsed:'予算使用率' },
    dashboard: { title:'パフォーマンスダッシュボード', subtitle:'広告パフォーマンスをリアルタイムで監視 — AIが生成するインサイト', weeklyPerformance:'週間パフォーマンス', weeklySubtitle:'7日間のインプレッションとクリック', platformSplit:'プラットフォーム別分布', platformSubtitle:'広告費の分布', aiInsights:'AI生成インサイト', insights:{ peakTitle:'ピークパフォーマンス', peakDesc:'金曜日の広告は34%高いコンバージョン率。来週金曜日に予算を$200増やしてください。', anomalyTitle:'異常が検出されました', anomalyDesc:'TikTokキャンペーンのCTRが先週比18%低下。Isolation Forestが検出しました。', growthTitle:'成長機会', growthDesc:'LinkedInのB2BセグメントはROAS 5.1xを示しています。予算を+40%拡大することを推奨します。' } },
    campaigns: { title:'キャンペーン', subtitle:'すべての広告キャンペーンを管理・追跡', searchPlaceholder:'キャンペーンを検索...', cols:['キャンペーン','プラットフォーム','ステータス','予算','支出','インプレッション','CTR','ROAS',''] },
    budget: { title:'予算管理', subtitle:'AIの推奨事項で広告費を追跡・最適化', dailySpend:'日別支出 vs 予算', dailySubtitle:'日次予算目標と比較した実際の支出', actualSpend:'実際の支出', budgetTarget:'予算目標', byPlatform:'プラットフォーム別', aiRecommendation:'🤖 AIの推奨事項', aiText:'MetaからGoogle Adsへ', aiStrong1:'$1,200', aiFrom:'を再配分してください。予測モデル（XGBoost）は', aiStrong2:'+23% ROAS', aiEnd:'の改善を見込んでいます。' },
    analytics: { title:'分析', subtitle:'AIを活用した深層データ分析', impressions:'時系列インプレッション', conversionsClicks:'コンバージョンとクリック', convSubtitle:'時系列エンゲージメントファネル', mlPanel:'アクティブMLモデル — TensorFlow · XGBoost · SHAP', accuracy:'精度:', models:{ churnPredictor:'チャーン予測器', anomalyDetector:'異常検出器', clickPredictor:'クリック予測器', roasOptimizer:'ROAS最適化器' }, modelTypes:{ xgboost:'XGBoost', isolationForest:'Isolation Forest', neuralNetwork:'ニューラルネットワーク', automl:'AutoML' } },
    upload: { title:'データをアップロード', subtitle:'最大1000万行を処理 · チャンク並列処理 · Web Workers', capacity:'⚡ ファイル10個 · 最大1000万行', idle:'ここにファイルをドラッグ＆ドロップ', active:'ここにファイルをドロップ！', browse:'ファイルを参照', limits:'最大10ファイル · 2GBまで · チャンク処理', fileListTitle:'アップロード済みファイル', processing:'⟳ 処理中...', processBtn:'▶ データを処理', clearBtn:'🗑 データを消去', exportBtn:'↓ 結果をエクスポート', doneTitle:'処理完了！', benchTitle:'⚡ 処理エンジン — パフォーマンスベンチマーク', ready:'準備完了', rowsProcessed:'行処理済み', processingChunk:'チャンク処理中...' },
    createAd: { title:'新しい広告を作成', subtitle:'AIを活用した広告作成と自動最適化', campaignSettings:'キャンペーン設定', adCopy:'広告コピー', budgetSchedule:'予算とスケジュール', platform:'プラットフォーム', objective:'目標', headline:'見出し', bodyText:'本文', dailyBudget:'日予算 ($)', startDate:'開始日', endDate:'終了日', headlinePlaceholder:'広告の見出しを入力...', bodyPlaceholder:'広告の本文を入力...', generating:'生成中...', sponsored:'スポンサー', headlineFallback:'広告の見出し', bodyFallback:'広告のテキストがここに表示されます。', relevance:'関連性', ctrPred:'CTR予測', qualityScore:'品質スコア', targetingMatch:'ターゲティング一致', aiScore:'🤖 AI最適化スコア', sampleHeadline:'スマート広告でビジネスを成長させよう', sampleBody:'精密なターゲティングとリアルタイム最適化で理想の顧客にリーチしましょう。' },
    buttons: { refresh:'⟳ 更新', createNewAd:'✦ 広告を作成', newCampaign:'+ 新しいキャンペーン', edit:'編集', setBudget:'+ 予算を設定', applySuggestion:'提案を適用', preview:'プレビュー', saveDraft:'✓ 下書きを保存', aiGenerate:'🤖 AIで生成', launchCampaign:'🚀 キャンペーンを開始', exportResults:'↓ エクスポート' },
    footer: { findMe:'見つけてください:', greenAI:'🌱 グリーンAI', i18n:'i18n 11言語', version:'v1.0.0 エンタープライズ', tagline:'LumindAd エンタープライズ · Python · TensorFlow · React · グリーンAI' },
  },
};

const SUPPORTED_LANGS = [
  { code:'en', label:'English',    labelNative:'English',    flag:'🇺🇸' },
  { code:'es', label:'Español',    labelNative:'Español',    flag:'🇪🇸' },
  { code:'pt', label:'Português',  labelNative:'Português',  flag:'🇧🇷' },
  { code:'fr', label:'Français',   labelNative:'Français',   flag:'🇫🇷' },
  { code:'ar', label:'العربية',    labelNative:'Arabic',     flag:'🇸🇦' },
  { code:'he', label:'עברית',      labelNative:'Hebrew',     flag:'🇮🇱' },
  { code:'zh', label:'中文',       labelNative:'Chinese',    flag:'🇨🇳' },
  { code:'ru', label:'Русский',    labelNative:'Russian',    flag:'🇷🇺' },
  { code:'tr', label:'Türkçe',     labelNative:'Turkish',    flag:'🇹🇷' },
  { code:'ko', label:'한국어',     labelNative:'Korean',     flag:'🇰🇷' },
  { code:'ja', label:'日本語',     labelNative:'Japanese',   flag:'🇯🇵' },
];

// ── i18n HOOK ─────────────────────────────────────────────────────────
function useLang() {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('lumindad_lang') || 'en'; } catch { return 'en'; }
  });

  const changeLang = (code) => {
    setLang(code);
    try { localStorage.setItem('lumindad_lang', code); } catch {}
    const isRTL = TRANSLATIONS[code]?.rtl;
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = code;
  };

  const t = (keyPath) => {
    const keys = keyPath.split('.');
    let val = TRANSLATIONS[lang] || TRANSLATIONS.en;
    for (const k of keys) {
      val = val?.[k];
      if (val === undefined) {
        // fallback to en
        let fb = TRANSLATIONS.en;
        for (const k2 of keys) { fb = fb?.[k2]; }
        return fb || keyPath;
      }
    }
    return val || keyPath;
  };

  return { lang, changeLang, t };
}

// ── GLOBAL LANG CONTEXT ───────────────────────────────────────────────
const LangContext = createContext(null);
const useTr = () => useContext(LangContext);


// ── GLOBAL STYLES ─────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=DM+Mono:wght@300;400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Outfit',sans-serif;background:#060610;color:#e8e8f8;overflow:hidden;}
  ::-webkit-scrollbar{width:4px;height:4px;}
  ::-webkit-scrollbar-track{background:#0c0c1a;}
  ::-webkit-scrollbar-thumb{background:#4c1d95;border-radius:2px;}
  @keyframes bounce-social{0%,100%{transform:translateY(0);}50%{transform:translateY(-10px);}}
  @keyframes glow-pulse{0%,100%{box-shadow:0 0 8px rgba(124,58,237,.4);}50%{box-shadow:0 0 24px rgba(124,58,237,.8);}}
  @keyframes float-in{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
  @keyframes counter-up{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
  @keyframes shimmer{0%{background-position:-200% 0;}100%{background-position:200% 0;}}
  @keyframes spin-slow{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
  .page-enter{animation:float-in .35s ease forwards;}
  .kpi-val{animation:counter-up .4s ease forwards;}
  .social-icon{display:inline-flex;animation:bounce-social 1.4s ease-in-out infinite;cursor:pointer;}
  .s1{animation-delay:0s;} .s2{animation-delay:.18s;} .s3{animation-delay:.36s;}
  .s4{animation-delay:.54s;} .s5{animation-delay:.72s;}
  .btn-primary{background:linear-gradient(135deg,#7c3aed,#5b21b6);border:none;color:#fff;
    padding:10px 22px;border-radius:10px;font-family:'Outfit',sans-serif;font-weight:600;
    font-size:13px;cursor:pointer;transition:all .2s;letter-spacing:.3px;}
  .btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(124,58,237,.45);}
  .btn-secondary{background:transparent;border:1px solid #2d2050;color:#a78bfa;
    padding:10px 22px;border-radius:10px;font-family:'Outfit',sans-serif;font-weight:600;
    font-size:13px;cursor:pointer;transition:all .2s;}
  .btn-secondary:hover{background:#1a0f3a;border-color:#7c3aed;}
  .btn-danger{background:linear-gradient(135deg,#dc2626,#991b1b);border:none;color:#fff;
    padding:10px 22px;border-radius:10px;font-family:'Outfit',sans-serif;font-weight:600;
    font-size:13px;cursor:pointer;transition:all .2s;}
  .btn-danger:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(220,38,38,.4);}
  .btn-success{background:linear-gradient(135deg,#059669,#065f46);border:none;color:#fff;
    padding:10px 22px;border-radius:10px;font-family:'Outfit',sans-serif;font-weight:600;
    font-size:13px;cursor:pointer;transition:all .2s;}
  .btn-success:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(5,150,105,.4);}
  .card{background:rgba(15,10,30,.85);border:1px solid rgba(124,58,237,.15);
    border-radius:16px;backdrop-filter:blur(12px);transition:all .25s;}
  .card:hover{border-color:rgba(124,58,237,.4);transform:translateY(-2px);}
  .nav-item{display:flex;align-items:center;gap:10px;padding:11px 16px;border-radius:10px;
    cursor:pointer;transition:all .2s;font-size:14px;font-weight:500;color:#94a3b8;}
  .nav-item:hover{background:rgba(124,58,237,.12);color:#a78bfa;}
  .nav-item.active{background:linear-gradient(135deg,rgba(124,58,237,.25),rgba(91,33,182,.15));
    color:#c4b5fd;border:1px solid rgba(124,58,237,.3);}
  .tag{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;
    font-size:11px;font-weight:600;letter-spacing:.4px;}
  .tag-up{background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.25);}
  .tag-down{background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.25);}
  .tag-neutral{background:rgba(245,158,11,.12);color:#f59e0b;border:1px solid rgba(245,158,11,.25);}
  input,select,textarea{font-family:'Outfit',sans-serif;}
  .drop-zone{border:2px dashed rgba(124,58,237,.35);border-radius:16px;transition:all .25s;
    background:rgba(124,58,237,.04);}
  .drop-zone.dragging{border-color:#7c3aed;background:rgba(124,58,237,.1);transform:scale(1.01);}
  .progress-bar{height:4px;border-radius:2px;background:#1e1e35;overflow:hidden;position:relative;}
  .progress-fill{height:100%;border-radius:2px;transition:width .3s ease;
    background:linear-gradient(90deg,#7c3aed,#06b6d4);}
  .table-row{border-bottom:1px solid rgba(124,58,237,.08);transition:background .15s;}
  .table-row:hover{background:rgba(124,58,237,.06);}
  .status-dot{width:7px;height:7px;border-radius:50%;display:inline-block;}
  .badge{padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.5px;}
`;

// ── SAMPLE DATA ───────────────────────────────────────────────────────
const weeklyPerf = [
  {day:'Mon',impressions:12400,clicks:890,spend:1240,conversions:47},
  {day:'Tue',impressions:18100,clicks:1340,spend:1820,conversions:89},
  {day:'Wed',impressions:14600,clicks:1050,spend:1470,conversions:63},
  {day:'Thu',impressions:22300,clicks:1780,spend:2250,conversions:124},
  {day:'Fri',impressions:25800,clicks:2100,spend:2480,conversions:158},
  {day:'Sat',impressions:19200,clicks:1420,spend:1840,conversions:97},
  {day:'Sun',impressions:13500,clicks:980,spend:1350,conversions:52},
];
const platformData = [
  {name:'Google Ads',value:38,color:'#4285f4'},
  {name:'Meta Ads',value:29,color:'#1877f2'},
  {name:'TikTok',value:18,color:'#ff0050'},
  {name:'LinkedIn',value:10,color:'#0077b5'},
  {name:'Twitter/X',value:5,color:'#1da1f2'},
];
const campaigns = [
  {id:'C-001',name:'Summer Sale 2025',platform:'Google Ads',status:'active',budget:5000,spent:3240,impressions:124500,clicks:8920,ctr:'7.16%',conv:342,roas:3.8},
  {id:'C-002',name:'Brand Awareness Q1',platform:'Meta Ads',status:'active',budget:8000,spent:5180,impressions:287000,clicks:12400,ctr:'4.32%',conv:520,roas:2.9},
  {id:'C-003',name:'Product Launch Beta',platform:'TikTok',status:'paused',budget:3500,spent:1890,impressions:98200,clicks:5430,ctr:'5.53%',conv:187,roas:4.2},
  {id:'C-004',name:'Retargeting Dec',platform:'Google Ads',status:'active',budget:2000,spent:1740,impressions:43100,clicks:3280,ctr:'7.61%',conv:245,roas:5.1},
  {id:'C-005',name:'LinkedIn B2B Push',platform:'LinkedIn',status:'draft',budget:6000,spent:0,impressions:0,clicks:0,ctr:'—',conv:0,roas:0},
  {id:'C-006',name:'Holiday Promos',platform:'Meta Ads',status:'completed',budget:4200,spent:4198,impressions:178000,clicks:9870,ctr:'5.54%',conv:430,roas:3.5},
];
const analyticsData = [
  {date:'Jan 1',impressions:11000,clicks:780,conversions:38},{date:'Jan 8',impressions:15200,clicks:1120,conversions:67},
  {date:'Jan 15',impressions:18700,clicks:1480,conversions:89},{date:'Jan 22',impressions:22100,clicks:1830,conversions:118},
  {date:'Jan 29',impressions:24800,clicks:2150,conversions:142},{date:'Feb 5',impressions:27300,clicks:2480,conversions:168},
  {date:'Feb 12',impressions:30100,clicks:2820,conversions:198},
];
const budgetData = [
  {day:'Mon',budget:1500,spend:1240},{day:'Tue',budget:1500,spend:1820},
  {day:'Wed',budget:1500,spend:1470},{day:'Thu',budget:1500,spend:2250},
  {day:'Fri',budget:1500,spend:2480},{day:'Sat',budget:1500,spend:1840},
  {day:'Sun',budget:1500,spend:1350},
];
// ext = label shown in UI | aliases = real file extensions that map to it
const ACCEPTED_FORMATS = [
  {ext:'CSV',    aliases:['CSV'],              icon:'📊',color:'#10b981'},
  {ext:'Excel',  aliases:['XLSX','XLS'],       icon:'📗',color:'#22c55e'},
  {ext:'JSON',   aliases:['JSON'],             icon:'🔵',color:'#3b82f6'},
  {ext:'PDF',    aliases:['PDF'],              icon:'🔴',color:'#ef4444'},
  {ext:'XML',    aliases:['XML'],              icon:'🟠',color:'#f97316'},
  {ext:'TSV',    aliases:['TSV'],              icon:'🟣',color:'#a855f7'},
  {ext:'TXT',    aliases:['TXT'],              icon:'⬜',color:'#94a3b8'},
  {ext:'Parquet',aliases:['PARQUET'],          icon:'🟡',color:'#eab308'},
  {ext:'Avro',   aliases:['AVRO'],             icon:'🩵',color:'#06b6d4'},
  {ext:'JSONL',  aliases:['JSONL','NDJSON'],   icon:'💙',color:'#60a5fa'},
  {ext:'IPYNB',  aliases:['IPYNB'],            icon:'📓',color:'#f97316'},
];

// ── HELPERS ───────────────────────────────────────────────────────────
const fmt = (n) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : String(n);
const fmtMoney = (n) => `$${n.toLocaleString()}`;
const statusColor = (s) => ({active:'#10b981',paused:'#f59e0b',draft:'#94a3b8',completed:'#7c3aed'}[s]||'#94a3b8');
const statusBg   = (s) => ({active:'rgba(16,185,129,.12)',paused:'rgba(245,158,11,.12)',draft:'rgba(148,163,184,.12)',completed:'rgba(124,58,237,.12)'}[s]||'rgba(148,163,184,.12)');

function useAnimatedValue(target, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(target * ease));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target]);
  return val;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:'rgba(10,8,20,.95)',border:'1px solid rgba(124,58,237,.3)',
      borderRadius:10,padding:'10px 14px',fontSize:12,backdropFilter:'blur(12px)'}}>
      <div style={{color:'#a78bfa',fontWeight:700,marginBottom:6}}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{color:p.color||'#e8e8f8',display:'flex',gap:8,alignItems:'center'}}>
          <span style={{width:8,height:8,borderRadius:'50%',background:p.color,display:'inline-block'}}/>
          <span style={{color:'#94a3b8'}}>{p.name}:</span>
          <span style={{fontWeight:600}}>{typeof p.value==='number'?p.value.toLocaleString():p.value}</span>
        </div>
      ))}
    </div>
  );
}

function KPICard({ title, value, prefix='', suffix='', change, icon, color, delay=0 }) {
  const animated = useAnimatedValue(typeof value==='number'?value:0);
  const isPositive = change >= 0;
  return (
    <div className="card" style={{padding:'22px',animation:`float-in .5s ease ${delay}ms both`,
      borderTop:`2px solid ${color}22`,position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:-20,right:-20,width:80,height:80,borderRadius:'50%',background:`${color}0d`}}/>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
        <div style={{width:44,height:44,borderRadius:12,background:`${color}20`,
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{icon}</div>
        {change !== undefined && (
          <div className={isPositive?'tag tag-up':'tag tag-down'}>
            {isPositive?'↑':'↓'} {Math.abs(change)}%
          </div>
        )}
      </div>
      <div style={{color:'#64748b',fontSize:12,fontWeight:500,letterSpacing:'.5px',
        textTransform:'uppercase',marginBottom:6}}>{title}</div>
      <div className="kpi-val" style={{fontSize:28,fontWeight:800,color:'#f0f0ff',letterSpacing:'-0.5px',lineHeight:1}}>
        {prefix}{typeof value==='number'?animated.toLocaleString():value}{suffix}
      </div>
    </div>
  );
}

// ── LANGUAGE SELECTOR ─────────────────────────────────────────────────
function LanguageSelector() {
  const { lang, changeLang } = useTr();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = SUPPORTED_LANGS.find(l => l.code === lang) || SUPPORTED_LANGS[0];

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} style={{position:'relative'}}>
      <button onClick={() => setOpen(o => !o)}
        style={{background:'rgba(124,58,237,.08)',border:'1px solid rgba(124,58,237,.2)',
          borderRadius:8,padding:'5px 12px',cursor:'pointer',
          display:'flex',alignItems:'center',gap:6,
          fontSize:12,color:'#a78bfa',fontFamily:"'Outfit',sans-serif",fontWeight:600}}>
        <span style={{fontSize:16}}>{current.flag}</span>
        <span>{current.code.toUpperCase()}</span>
        <span style={{fontSize:9,opacity:.6}}>{open?'▲':'▼'}</span>
      </button>
      {open && (
        <div style={{position:'absolute',right:0,top:'calc(100% + 6px)',
          background:'rgba(8,6,18,.98)',border:'1px solid rgba(124,58,237,.3)',
          borderRadius:14,padding:'8px',zIndex:9999,
          display:'grid',gridTemplateColumns:'1fr 1fr',gap:3,
          minWidth:230,backdropFilter:'blur(20px)',
          boxShadow:'0 24px 48px rgba(0,0,0,.7)'}}>
          {SUPPORTED_LANGS.map(l => (
            <button key={l.code} onClick={() => { changeLang(l.code); setOpen(false); }}
              style={{background:lang===l.code?'rgba(124,58,237,.2)':'transparent',
                border:lang===l.code?'1px solid rgba(124,58,237,.5)':'1px solid transparent',
                borderRadius:9,padding:'8px 10px',cursor:'pointer',
                display:'flex',alignItems:'center',gap:8,
                fontFamily:"'Outfit',sans-serif",transition:'all .15s',textAlign:'left'}}>
              <span style={{fontSize:18}}>{l.flag}</span>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:lang===l.code?'#a78bfa':'#e8e8f8'}}>{l.label}</div>
                <div style={{fontSize:10,color:'#475569'}}>{l.labelNative}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SIDEBAR ───────────────────────────────────────────────────────────
function Sidebar({ page, setPage }) {
  const { t } = useTr();
  const nav = [
    {id:'dashboard', icon:'⊞'},
    {id:'create',    icon:'✦'},
    {id:'campaigns', icon:'◎'},
    {id:'budget',    icon:'◈'},
    {id:'analytics', icon:'◫'},
    {id:'upload',    icon:'⤒'},
  ];
  const labels = {
    dashboard: t('nav.dashboard'), create: t('nav.createAd'),
    campaigns: t('nav.campaigns'), budget: t('nav.budget'),
    analytics: t('nav.analytics'), upload: t('nav.uploadData'),
  };
  return (
    <aside style={{width:230,height:'100vh',background:'rgba(6,4,18,.97)',
      borderRight:'1px solid rgba(124,58,237,.12)',display:'flex',flexDirection:'column',
      padding:'20px 12px',position:'fixed',left:0,top:0,zIndex:100}}>
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'8px 10px',marginBottom:28}}>
        <div style={{width:38,height:38,borderRadius:11,
          background:'linear-gradient(135deg,#7c3aed,#5b21b6)',
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,
          boxShadow:'0 4px 16px rgba(124,58,237,.5)'}}>✦</div>
        <div>
          <div style={{fontWeight:800,fontSize:16,
            background:'linear-gradient(135deg,#c4b5fd,#7c3aed)',
            WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>LumindAd</div>
          <div style={{fontSize:10,color:'#4c1d95',fontWeight:500}}>{t('sidebar.version')}</div>
        </div>
      </div>
      <div style={{fontSize:10,color:'#3d3d60',fontWeight:700,letterSpacing:1.5,
        padding:'0 10px',marginBottom:10}}>{t('nav.section')}</div>
      <nav style={{display:'flex',flexDirection:'column',gap:3}}>
        {nav.map(item => (
          <div key={item.id} className={`nav-item ${page===item.id?'active':''}`}
            onClick={() => setPage(item.id)}>
            <span style={{fontSize:16,width:20,textAlign:'center'}}>{item.icon}</span>
            <span>{labels[item.id]}</span>
            {item.id==='upload' && (
              <span style={{marginLeft:'auto',background:'rgba(6,182,212,.15)',
                color:'#06b6d4',padding:'2px 7px',borderRadius:10,fontSize:10,fontWeight:700}}>
                {t('nav.newBadge')}
              </span>
            )}
          </div>
        ))}
      </nav>
      <div style={{margin:'20px 4px',padding:'14px',borderRadius:12,
        background:'linear-gradient(135deg,rgba(124,58,237,.12),rgba(6,182,212,.08))',
        border:'1px solid rgba(124,58,237,.2)'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <span style={{fontSize:16}}>🤖</span>
          <span style={{fontSize:12,fontWeight:700,color:'#a78bfa'}}>{t('sidebar.aiEngine')}</span>
          <span style={{marginLeft:'auto',width:7,height:7,borderRadius:'50%',
            background:'#10b981',animation:'glow-pulse 2s infinite'}}/>
        </div>
        <div style={{fontSize:10,color:'#64748b',lineHeight:1.5}}>
          TensorFlow · XGBoost<br/>SHAP · Anomaly Detection
        </div>
      </div>
      <div style={{margin:'0 4px 16px',padding:'12px',borderRadius:12,
        background:'rgba(16,185,129,.06)',border:'1px solid rgba(16,185,129,.15)'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:14}}>🌱</span>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:'#10b981'}}>{t('sidebar.greenAI')}</div>
            <div style={{fontSize:9,color:'#047857'}}>{t('sidebar.greenBadge')}</div>
          </div>
        </div>
      </div>
      <div style={{marginTop:'auto',display:'flex',alignItems:'center',gap:10,
        padding:'12px',borderRadius:12,border:'1px solid rgba(124,58,237,.1)',
        cursor:'pointer',background:'rgba(124,58,237,.05)'}}>
        <div style={{width:34,height:34,borderRadius:10,
          background:'linear-gradient(135deg,#7c3aed,#5b21b6)',
          display:'flex',alignItems:'center',justifyContent:'center',
          fontWeight:800,fontSize:13,color:'#fff'}}>E</div>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:'#c4b5fd'}}>{t('sidebar.userName')}</div>
          <div style={{fontSize:10,color:'#4c1d95'}}>{t('sidebar.userRole')}</div>
        </div>
        <span style={{marginLeft:'auto',color:'#4c1d95',fontSize:12}}>⌄</span>
      </div>
    </aside>
  );
}

function Header({ title, subtitle, actions }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:28}}>
      <div>
        <h1 style={{fontSize:30,fontWeight:900,letterSpacing:'-0.5px',lineHeight:1.1,
          background:'linear-gradient(135deg,#f0f0ff,#a78bfa)',
          WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{title}</h1>
        <p style={{color:'#475569',fontSize:14,marginTop:4}}>{subtitle}</p>
      </div>
      <div style={{display:'flex',gap:10,alignItems:'center'}}>{actions}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════
function DashboardPage() {
  const { t } = useTr();
  return (
    <div className="page-enter">
      <Header title={t('dashboard.title')} subtitle={t('dashboard.subtitle')}
        actions={[
          <button key="a" className="btn-secondary" style={{fontSize:12}}>{t('buttons.refresh')}</button>,
          <button key="b" className="btn-primary">{t('buttons.createNewAd')}</button>
        ]}
      />
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:24}}>
        <KPICard title={t('metrics.totalSpend')} value={48290} prefix="$" change={12.5} icon="💰" color="#7c3aed" delay={0}/>
        <KPICard title={t('metrics.impressions')} value={531200} change={8.3} icon="👁" color="#06b6d4" delay={80}/>
        <KPICard title={t('metrics.clicks')} value={38940} change={15.2} icon="⚡" color="#a855f7" delay={160}/>
        <KPICard title={t('metrics.conversions')} value={2847} change={22.1} icon="🎯" color="#f59e0b" delay={240}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:16,marginBottom:24}}>
        <div className="card" style={{padding:'24px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
            <div>
              <div style={{fontWeight:700,fontSize:16,color:'#e8e8f8'}}>{t('dashboard.weeklyPerformance')}</div>
              <div style={{fontSize:12,color:'#475569'}}>{t('dashboard.weeklySubtitle')}</div>
            </div>
            <div style={{display:'flex',gap:16,fontSize:12}}>
              <span style={{color:'#7c3aed'}}>● {t('metrics.impressions')}</span>
              <span style={{color:'#06b6d4'}}>● {t('metrics.clicks')}</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={weeklyPerf}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,.08)"/>
              <XAxis dataKey="day" stroke="#334155" tick={{fill:'#64748b',fontSize:11}}/>
              <YAxis stroke="#334155" tick={{fill:'#64748b',fontSize:11}}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Line type="monotone" dataKey="impressions" stroke="#7c3aed" strokeWidth={2.5} dot={{fill:'#7c3aed',r:4}} activeDot={{r:6,fill:'#a78bfa'}}/>
              <Line type="monotone" dataKey="clicks" stroke="#06b6d4" strokeWidth={2.5} dot={{fill:'#06b6d4',r:4}} activeDot={{r:6}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card" style={{padding:'24px'}}>
          <div style={{fontWeight:700,fontSize:16,color:'#e8e8f8',marginBottom:4}}>{t('dashboard.platformSplit')}</div>
          <div style={{fontSize:12,color:'#475569',marginBottom:16}}>{t('dashboard.platformSubtitle')}</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={platformData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                {platformData.map((entry,i) => <Cell key={i} fill={entry.color} opacity={.9}/>)}
              </Pie>
              <Tooltip content={<CustomTooltip/>}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {platformData.map((p,i) => (
              <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:12}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{width:8,height:8,borderRadius:2,background:p.color,display:'inline-block'}}/>
                  <span style={{color:'#94a3b8'}}>{p.name}</span>
                </div>
                <span style={{fontWeight:700,color:'#e8e8f8'}}>{p.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card" style={{padding:'20px'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
          <span style={{fontSize:18}}>🧠</span>
          <span style={{fontWeight:700,color:'#e8e8f8'}}>{t('dashboard.aiInsights')}</span>
          <span className="tag tag-up" style={{marginLeft:'auto'}}>{t('topbar.live')}</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
          {[
            {icon:'🎯',tkey:'insights.peakTitle',dkey:'insights.peakDesc',color:'#7c3aed'},
            {icon:'⚠️',tkey:'insights.anomalyTitle',dkey:'insights.anomalyDesc',color:'#f59e0b'},
            {icon:'📈',tkey:'insights.growthTitle',dkey:'insights.growthDesc',color:'#10b981'},
          ].map((ins,i) => (
            <div key={i} style={{padding:'14px',borderRadius:12,background:`${ins.color}0a`,border:`1px solid ${ins.color}20`}}>
              <div style={{fontSize:20,marginBottom:8}}>{ins.icon}</div>
              <div style={{fontSize:13,fontWeight:700,color:'#e8e8f8',marginBottom:4}}>{t(`dashboard.${ins.tkey}`)}</div>
              <div style={{fontSize:11,color:'#64748b',lineHeight:1.5}}>{t(`dashboard.${ins.dkey}`)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CAMPAIGNS
// ═══════════════════════════════════════════════════════
function CampaignsPage() {
  const { t } = useTr();
  const [search, setSearch] = useState('');
  const filtered = campaigns.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.platform.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="page-enter">
      <Header title={t('campaigns.title')} subtitle={t('campaigns.subtitle')}
        actions={[
          <input key="s" placeholder={t('campaigns.searchPlaceholder')} value={search}
            onChange={e => setSearch(e.target.value)}
            style={{background:'rgba(124,58,237,.08)',border:'1px solid rgba(124,58,237,.2)',
              borderRadius:10,padding:'9px 16px',color:'#e8e8f8',fontSize:13,width:220,outline:'none'}}/>,
          <button key="b" className="btn-primary">{t('buttons.newCampaign')}</button>
        ]}
      />
      <div className="card" style={{overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{borderBottom:'1px solid rgba(124,58,237,.15)'}}>
                {t('campaigns.cols').map((h,i) => (
                  <th key={i} style={{padding:'14px 18px',textAlign:'left',fontSize:11,
                    fontWeight:700,color:'#475569',letterSpacing:.8,textTransform:'uppercase',
                    whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="table-row">
                  <td style={{padding:'14px 18px'}}>
                    <div style={{fontWeight:600,color:'#e8e8f8'}}>{c.name}</div>
                    <div style={{fontSize:11,color:'#475569'}}>{c.id}</div>
                  </td>
                  <td style={{padding:'14px 18px',color:'#94a3b8'}}>{c.platform}</td>
                  <td style={{padding:'14px 18px'}}>
                    <span className="badge" style={{background:statusBg(c.status),color:statusColor(c.status)}}>
                      <span className="status-dot" style={{background:statusColor(c.status),marginRight:6}}/>
                      {c.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{padding:'14px 18px',color:'#94a3b8'}}>{fmtMoney(c.budget)}</td>
                  <td style={{padding:'14px 18px'}}>
                    <div style={{color:'#e8e8f8',fontWeight:600}}>{fmtMoney(c.spent)}</div>
                    <div className="progress-bar" style={{width:80,marginTop:4}}>
                      <div className="progress-fill" style={{width:`${c.budget>0?Math.round(c.spent/c.budget*100):0}%`}}/>
                    </div>
                  </td>
                  <td style={{padding:'14px 18px',color:'#94a3b8'}}>{fmt(c.impressions)}</td>
                  <td style={{padding:'14px 18px',color:'#94a3b8'}}>{c.ctr}</td>
                  <td style={{padding:'14px 18px'}}>
                    {c.roas>0?<span style={{color:c.roas>=4?'#10b981':c.roas>=3?'#f59e0b':'#ef4444',fontWeight:700}}>{c.roas}x</span>:'—'}
                  </td>
                  <td style={{padding:'14px 18px'}}>
                    <div style={{display:'flex',gap:8}}>
                      <button style={{background:'rgba(124,58,237,.12)',border:'none',color:'#a78bfa',padding:'5px 10px',borderRadius:7,cursor:'pointer',fontSize:11}}>{t('buttons.edit')}</button>
                      <button style={{background:'rgba(239,68,68,.08)',border:'none',color:'#ef4444',padding:'5px 10px',borderRadius:7,cursor:'pointer',fontSize:11}}>⏸</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// BUDGET
// ═══════════════════════════════════════════════════════
function BudgetPage() {
  const { t } = useTr();
  return (
    <div className="page-enter">
      <Header title={t('budget.title')} subtitle={t('budget.subtitle')}
        actions={[
          <div key="m" style={{background:'rgba(124,58,237,.1)',border:'1px solid rgba(124,58,237,.2)',
            borderRadius:10,padding:'9px 16px',fontSize:13,color:'#a78bfa',display:'flex',alignItems:'center',gap:8}}>
            📅 November 2025 ⌄
          </div>,
          <button key="b" className="btn-primary">{t('buttons.setBudget')}</button>
        ]}
      />
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:24}}>
        <KPICard title={t('metrics.totalBudget')} value={28500} prefix="$" icon="💎" color="#7c3aed" delay={0}/>
        <KPICard title={t('metrics.totalSpent')} value={18347} prefix="$" change={18.2} icon="📊" color="#10b981" delay={80}/>
        <KPICard title={t('metrics.remaining')} value={10153} prefix="$" icon="🏦" color="#06b6d4" delay={160}/>
        <KPICard title={t('metrics.budgetUsed')} value={64} suffix="%" icon="⚠️" color="#f59e0b" delay={240}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:16}}>
        <div className="card" style={{padding:'24px'}}>
          <div style={{fontWeight:700,fontSize:16,marginBottom:4,color:'#e8e8f8'}}>{t('budget.dailySpend')}</div>
          <div style={{fontSize:12,color:'#475569',marginBottom:20}}>{t('budget.dailySubtitle')}</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={budgetData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,.08)"/>
              <XAxis dataKey="day" stroke="#334155" tick={{fill:'#64748b',fontSize:11}}/>
              <YAxis stroke="#334155" tick={{fill:'#64748b',fontSize:11}}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="spend" name={t('budget.actualSpend')} fill="#7c3aed" radius={[4,4,0,0]} opacity={.85}/>
              <Bar dataKey="budget" name={t('budget.budgetTarget')} fill="#1e1e35" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div className="card" style={{padding:'20px'}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:16,color:'#e8e8f8'}}>{t('budget.byPlatform')}</div>
            {platformData.slice(0,4).map((p,i) => (
              <div key={i} style={{marginBottom:14}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:5,fontSize:12}}>
                  <span style={{color:'#94a3b8'}}>{p.name}</span>
                  <span style={{fontWeight:700,color:'#e8e8f8'}}>${Math.round(18347*p.value/100)}</span>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{width:`${p.value}%`,background:p.color}}/></div>
              </div>
            ))}
          </div>
          <div className="card" style={{padding:'20px',background:'linear-gradient(135deg,rgba(124,58,237,.1),rgba(16,185,129,.05))'}}>
            <div style={{fontSize:14,fontWeight:700,color:'#a78bfa',marginBottom:10}}>{t('budget.aiRecommendation')}</div>
            <p style={{fontSize:12,color:'#64748b',lineHeight:1.6}}>
              {t('budget.aiText')} <strong style={{color:'#10b981'}}>{t('budget.aiStrong1')}</strong>
              {t('budget.aiFrom')}<strong style={{color:'#f59e0b'}}>{t('budget.aiStrong2')}</strong>{t('budget.aiEnd')}
            </p>
            <button className="btn-primary" style={{marginTop:14,width:'100%',fontSize:12}}>{t('buttons.applySuggestion')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════
function AnalyticsPage() {
  const { t } = useTr();
  return (
    <div className="page-enter">
      <Header title={t('analytics.title')} subtitle={t('analytics.subtitle')} actions={[]}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:24}}>
        <div className="card" style={{padding:'24px'}}>
          <div style={{fontWeight:700,fontSize:16,marginBottom:4,color:'#e8e8f8'}}>{t('analytics.impressions')}</div>
          <div style={{fontSize:12,color:'#475569',marginBottom:20}}>{t('analytics.convSubtitle')}</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={analyticsData}>
              <defs>
                <linearGradient id="gradA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,.08)"/>
              <XAxis dataKey="date" stroke="#334155" tick={{fill:'#64748b',fontSize:10}}/>
              <YAxis stroke="#334155" tick={{fill:'#64748b',fontSize:10}}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Area type="monotone" dataKey="impressions" stroke="#7c3aed" strokeWidth={2.5} fill="url(#gradA)" activeDot={{r:6}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card" style={{padding:'24px'}}>
          <div style={{fontWeight:700,fontSize:16,marginBottom:4,color:'#e8e8f8'}}>{t('analytics.conversionsClicks')}</div>
          <div style={{fontSize:12,color:'#475569',marginBottom:20}}>{t('analytics.convSubtitle')}</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={analyticsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,.08)"/>
              <XAxis dataKey="date" stroke="#334155" tick={{fill:'#64748b',fontSize:10}}/>
              <YAxis stroke="#334155" tick={{fill:'#64748b',fontSize:10}}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Line type="monotone" dataKey="clicks" stroke="#06b6d4" strokeWidth={2.5} dot={{r:3}}/>
              <Line type="monotone" dataKey="conversions" stroke="#10b981" strokeWidth={2.5} dot={{r:3}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card" style={{padding:'24px'}}>
        <div style={{fontWeight:700,fontSize:16,marginBottom:16,color:'#e8e8f8',display:'flex',alignItems:'center',gap:10}}>
          <span>🧠</span> {t('analytics.mlPanel')}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
          {[
            {nameKey:'models.churnPredictor',typeKey:'modelTypes.xgboost',acc:'87.3%',status:'active',color:'#7c3aed'},
            {nameKey:'models.anomalyDetector',typeKey:'modelTypes.isolationForest',acc:'94.1%',status:'active',color:'#06b6d4'},
            {nameKey:'models.clickPredictor',typeKey:'modelTypes.neuralNetwork',acc:'82.7%',status:'active',color:'#10b981'},
            {nameKey:'models.roasOptimizer',typeKey:'modelTypes.automl',acc:'91.2%',status:'training',color:'#f59e0b'},
          ].map((m,i) => (
            <div key={i} style={{padding:'14px',borderRadius:12,background:`${m.color}09`,border:`1px solid ${m.color}20`}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:10,fontWeight:700,color:m.color,textTransform:'uppercase',letterSpacing:.5}}>{t(`analytics.${m.typeKey}`)}</span>
                <span style={{width:7,height:7,borderRadius:'50%',background:m.status==='active'?'#10b981':'#f59e0b',display:'inline-block',marginTop:2}}/>
              </div>
              <div style={{fontWeight:600,fontSize:13,color:'#e8e8f8',marginBottom:4}}>{t(`analytics.${m.nameKey}`)}</div>
              <div style={{fontSize:12,color:'#64748b'}}>{t('analytics.accuracy')} <strong style={{color:m.color}}>{m.acc}</strong></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// UPLOAD
// ═══════════════════════════════════════════════════════
function UploadPage() {
  const { t } = useTr();
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef();
  const MAX_FILES = 10;

  const addFiles = useCallback((newFiles) => {
    const toAdd = [...newFiles].slice(0, MAX_FILES - files.length);
    const fileObjs = toAdd.map(f => ({
      id: Math.random().toString(36).slice(2),
      file:f, name:f.name, size:f.size,
      type:f.name.split('.').pop().toUpperCase(),
      status:'ready', progress:0, rows:null,
    }));
    setFiles(prev => [...prev, ...fileObjs].slice(0, MAX_FILES));
    setDone(false);
  }, [files.length]);

  const onDrop = useCallback(e => {
    e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeFile = id => setFiles(prev => prev.filter(f => f.id !== id));
  const clearAll = () => { setFiles([]); setDone(false); };

  const processData = () => {
    if (!files.length) return;
    setProcessing(true); setDone(false);
    files.forEach((file, fi) => {
      const totalRows = Math.floor(Math.random() * 900000) + 50000;
      let processed = 0;
      const interval = setInterval(() => {
        processed = Math.min(processed + 50000, totalRows);
        const progress = Math.round((processed / totalRows) * 100);
        setFiles(prev => prev.map(f =>
          f.id === file.id ? {...f, status:progress<100?'processing':'done', progress, rows:progress>=100?totalRows:processed} : f
        ));
        if (progress >= 100) clearInterval(interval);
      }, 200 + fi * 120);
    });
    setTimeout(() => { setProcessing(false); setDone(true); }, files.length * 800 + 1200);
  };

  const fmtSize = b => b > 1e6 ? `${(b/1e6).toFixed(1)} MB` : `${(b/1e3).toFixed(0)} KB`;
  const typeColor = tp => ACCEPTED_FORMATS.find(f => f.aliases.includes(tp))?.color || '#94a3b8';
  const typeLabel = tp => ACCEPTED_FORMATS.find(f => f.aliases.includes(tp))?.ext || tp;

  return (
    <div className="page-enter">
      <Header title={t('upload.title')} subtitle={t('upload.subtitle')}
        actions={[
          <div key="info" style={{background:'rgba(6,182,212,.08)',border:'1px solid rgba(6,182,212,.2)',
            borderRadius:10,padding:'9px 16px',fontSize:12,color:'#06b6d4',display:'flex',alignItems:'center',gap:8}}>
            {t('upload.capacity')}
          </div>
        ]}
      />
      <div className={`drop-zone ${dragging?'dragging':''}`}
        style={{padding:'40px',textAlign:'center',marginBottom:20,cursor:'pointer',position:'relative'}}
        onDragOver={e=>{e.preventDefault();setDragging(true);}}
        onDragLeave={()=>setDragging(false)}
        onDrop={onDrop}>
        <input ref={inputRef} type="file" multiple
          accept=".csv,.xlsx,.xls,.json,.pdf,.xml,.tsv,.txt,.parquet,.avro,.jsonl,.ndjson,.ipynb,.nb"
          style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:0,cursor:'pointer',zIndex:2}}
          onChange={e=>{if(e.target.files?.length) addFiles(e.target.files); e.target.value='';}}
        />
        <div style={{fontSize:40,marginBottom:12}}>⤒</div>
        <div style={{fontWeight:700,fontSize:18,color:'#e8e8f8',marginBottom:6}}>
          {dragging ? t('upload.active') : t('upload.idle')}
        </div>
        <div style={{color:'#475569',fontSize:13,marginBottom:16}}>
          or <span style={{color:'#7c3aed',cursor:'pointer'}}>{t('upload.browse')}</span>
        </div>
        <div style={{display:'flex',flexWrap:'wrap',justifyContent:'center',gap:8}}>
          {ACCEPTED_FORMATS.map(f => (
            <span key={f.ext} style={{background:`${f.color}15`,border:`1px solid ${f.color}30`,
              color:f.color,padding:'4px 10px',borderRadius:8,fontSize:11,fontWeight:700}}>
              {f.icon} {f.ext}
            </span>
          ))}
        </div>
        <div style={{marginTop:12,fontSize:11,color:'#3d3d60'}}>{t('upload.limits')}</div>
      </div>

      {files.length > 0 && (
        <div className="card" style={{padding:'20px',marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <div style={{fontWeight:700,fontSize:15,color:'#e8e8f8'}}>{t('upload.fileListTitle')} ({files.length}/{MAX_FILES})</div>
            <div style={{fontSize:11,color:'#475569'}}>
              {files.filter(f=>f.status==='done').length} processed · {files.filter(f=>f.status==='ready').length} ready
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {files.map(f => (
              <div key={f.id} style={{padding:'14px',borderRadius:12,background:'rgba(124,58,237,.04)',
                border:'1px solid rgba(124,58,237,.1)',display:'flex',alignItems:'center',gap:14}}>
                <div style={{width:40,height:40,borderRadius:10,background:`${typeColor(f.type)}15`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  color:typeColor(f.type),fontWeight:800,fontSize:12,flexShrink:0}}>{typeLabel(f.type)}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13,color:'#e8e8f8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</div>
                  <div style={{fontSize:11,color:'#475569',marginTop:2}}>
                    {fmtSize(f.size)}
                    {f.rows && ` · ${f.rows.toLocaleString()} ${t('upload.rowsProcessed')}`}
                    {f.status==='processing' && ` · ${t('upload.processingChunk')}`}
                  </div>
                  {(f.status==='processing'||f.status==='done') && (
                    <div className="progress-bar" style={{marginTop:8}}>
                      <div className="progress-fill" style={{width:`${f.progress}%`,
                        background:f.status==='done'?'linear-gradient(90deg,#10b981,#06b6d4)':'linear-gradient(90deg,#7c3aed,#06b6d4)'}}/>
                    </div>
                  )}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
                  {f.status==='done' && <span style={{color:'#10b981',fontSize:18}}>✓</span>}
                  {f.status==='processing' && <span style={{color:'#f59e0b',fontSize:11,fontWeight:700}}>{f.progress}%</span>}
                  {f.status==='ready' && <span style={{color:'#475569',fontSize:11}}>{t('upload.ready')}</span>}
                  <button onClick={()=>removeFile(f.id)}
                    style={{background:'rgba(239,68,68,.08)',border:'none',color:'#ef4444',
                      width:28,height:28,borderRadius:7,cursor:'pointer',fontSize:14,
                      display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{display:'flex',gap:12,marginBottom:24}}>
        <button className="btn-success" onClick={processData} disabled={!files.length||processing}
          style={{opacity:!files.length||processing?.6:1,flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          {processing ? t('upload.processing') : t('upload.processBtn')}
        </button>
        <button className="btn-danger" onClick={clearAll} disabled={!files.length||processing}
          style={{opacity:!files.length||processing?.6:1,flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          {t('upload.clearBtn')}
        </button>
        {done && <button className="btn-secondary" style={{display:'flex',alignItems:'center',gap:8}}>{t('upload.exportBtn')}</button>}
      </div>

      {done && (
        <div style={{padding:'16px',borderRadius:12,background:'rgba(16,185,129,.08)',
          border:'1px solid rgba(16,185,129,.25)',display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:24}}>✅</span>
          <div>
            <div style={{fontWeight:700,color:'#10b981'}}>{t('upload.doneTitle')}</div>
            <div style={{fontSize:12,color:'#065f46',marginTop:2}}>
              {files.length} files · {files.reduce((s,f)=>s+(f.rows||0),0).toLocaleString()} rows · Ready for ML pipeline
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{padding:'20px',marginTop:16}}>
        <div style={{fontWeight:700,fontSize:15,color:'#e8e8f8',marginBottom:14}}>{t('upload.benchTitle')}</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
          {[{size:'10K rows',time:'0.5s',mem:'20 MB'},{size:'100K rows',time:'3s',mem:'80 MB'},
            {size:'1M rows',time:'18s',mem:'180 MB'},{size:'10M rows',time:'3 min',mem:'1.5 GB'}].map((b,i) => (
            <div key={i} style={{padding:'12px',borderRadius:10,background:'rgba(124,58,237,.05)',border:'1px solid rgba(124,58,237,.1)'}}>
              <div style={{fontWeight:700,color:'#a78bfa',fontSize:13,marginBottom:8}}>{b.size}</div>
              <div style={{fontSize:11,color:'#64748b',lineHeight:1.8}}>⏱ {b.time}<br/>💾 {b.mem}<br/>🖥 UI ✅</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CREATE AD
// ═══════════════════════════════════════════════════════
function CreateAdPage() {
  const { t } = useTr();
  const [platform, setPlatform] = useState('Google Ads');
  const [objective, setObjective] = useState('Conversions');
  const [aiSuggest, setAiSuggest] = useState(false);
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');

  const generateAI = () => {
    setAiSuggest(true);
    setTimeout(() => {
      setHeadline(t('createAd.sampleHeadline'));
      setBody(t('createAd.sampleBody'));
      setAiSuggest(false);
    }, 800);
  };

  return (
    <div className="page-enter">
      <Header title={t('createAd.title')} subtitle={t('createAd.subtitle')}
        actions={[
          <button key="p" className="btn-secondary">{t('buttons.preview')}</button>,
          <button key="s" className="btn-primary">{t('buttons.saveDraft')}</button>,
        ]}
      />
      <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:20}}>
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div className="card" style={{padding:'24px'}}>
            <div style={{fontWeight:700,fontSize:15,color:'#e8e8f8',marginBottom:16}}>{t('createAd.campaignSettings')}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              {[
                {label:t('createAd.platform'),value:platform,setter:setPlatform,opts:['Google Ads','Meta Ads','TikTok','LinkedIn','Twitter/X']},
                {label:t('createAd.objective'),value:objective,setter:setObjective,opts:['Conversions','Awareness','Traffic','Leads','App Installs']},
              ].map((f,i) => (
                <div key={i}>
                  <label style={{fontSize:12,color:'#475569',display:'block',marginBottom:6,fontWeight:600}}>{f.label}</label>
                  <select value={f.value} onChange={e=>f.setter(e.target.value)}
                    style={{width:'100%',background:'rgba(124,58,237,.08)',border:'1px solid rgba(124,58,237,.2)',
                      borderRadius:10,padding:'10px 14px',color:'#e8e8f8',fontSize:13,outline:'none'}}>
                    {f.opts.map(o=><option key={o} style={{background:'#0f0f1a'}}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{padding:'24px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontWeight:700,fontSize:15,color:'#e8e8f8'}}>{t('createAd.adCopy')}</div>
              <button className="btn-primary" style={{fontSize:11,padding:'7px 16px'}} onClick={generateAI}>
                {aiSuggest ? t('createAd.generating') : t('buttons.aiGenerate')}
              </button>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,color:'#475569',display:'block',marginBottom:6,fontWeight:600}}>{t('createAd.headline')}</label>
              <input value={headline} onChange={e=>setHeadline(e.target.value)}
                placeholder={aiSuggest?t('createAd.generating'):t('createAd.headlinePlaceholder')}
                style={{width:'100%',background:'rgba(124,58,237,.08)',border:'1px solid rgba(124,58,237,.2)',
                  borderRadius:10,padding:'11px 14px',color:'#e8e8f8',fontSize:13,outline:'none'}}/>
            </div>
            <div>
              <label style={{fontSize:12,color:'#475569',display:'block',marginBottom:6,fontWeight:600}}>{t('createAd.bodyText')}</label>
              <textarea value={body} onChange={e=>setBody(e.target.value)} rows={4}
                placeholder={aiSuggest?t('createAd.generating'):t('createAd.bodyPlaceholder')}
                style={{width:'100%',background:'rgba(124,58,237,.08)',border:'1px solid rgba(124,58,237,.2)',
                  borderRadius:10,padding:'11px 14px',color:'#e8e8f8',fontSize:13,outline:'none',resize:'vertical'}}/>
            </div>
          </div>
          <div className="card" style={{padding:'24px'}}>
            <div style={{fontWeight:700,fontSize:15,color:'#e8e8f8',marginBottom:16}}>{t('createAd.budgetSchedule')}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14}}>
              {[t('createAd.dailyBudget'),t('createAd.startDate'),t('createAd.endDate')].map((label,i)=>(
                <div key={i}>
                  <label style={{fontSize:12,color:'#475569',display:'block',marginBottom:6,fontWeight:600}}>{label}</label>
                  <input type={i===0?'number':'date'}
                    style={{width:'100%',background:'rgba(124,58,237,.08)',border:'1px solid rgba(124,58,237,.2)',
                      borderRadius:10,padding:'10px 14px',color:'#e8e8f8',fontSize:13,outline:'none'}}/>
                </div>
              ))}
            </div>
          </div>
          <button className="btn-primary" style={{padding:'14px',fontSize:14,fontWeight:700}}>
            {t('buttons.launchCampaign')}
          </button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div className="card" style={{padding:'20px'}}>
            <div style={{fontWeight:700,fontSize:14,color:'#e8e8f8',marginBottom:14}}>{t('createAd.title')} Preview</div>
            <div style={{background:'#fff',borderRadius:10,padding:'16px',color:'#111'}}>
              <div style={{fontSize:10,color:'#666',marginBottom:4}}>{t('createAd.sponsored')}</div>
              <div style={{fontWeight:700,color:'#1a0dab',fontSize:14,marginBottom:4}}>
                {headline || t('createAd.headlinePlaceholder')}
              </div>
              <div style={{fontSize:12,color:'#555',lineHeight:1.5}}>
                {body || t('createAd.bodyPlaceholder')}
              </div>
            </div>
          </div>
          <div className="card" style={{padding:'20px'}}>
            <div style={{fontWeight:700,fontSize:14,color:'#e8e8f8',marginBottom:14}}>{t('createAd.aiScore')}</div>
            {[
              {label:t('createAd.relevance'),score:82},
              {label:t('createAd.ctrPred'),score:76},
              {label:t('createAd.qualityScore'),score:91},
              {label:t('createAd.targetingMatch'),score:88},
            ].map((item,i)=>{
              const {score} = item;
              return (
                <div key={i} style={{marginBottom:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:5}}>
                    <span style={{color:'#94a3b8'}}>{item.label}</span>
                    <span style={{fontWeight:700,color:score>85?'#10b981':score>70?'#f59e0b':'#ef4444'}}>{score}/100</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{width:`${score}%`,
                      background:score>85?'linear-gradient(90deg,#10b981,#06b6d4)':score>70?'linear-gradient(90deg,#f59e0b,#ef4444)':'#ef4444'}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════
function Footer() {
  const { t } = useTr();
  const socials = [
    {icon:'in',label:'LinkedIn',color:'#0077b5',cls:'s1'},
    {icon:'⌥',label:'GitHub',color:'#a78bfa',cls:'s2'},
    {icon:'𝕏',label:'Twitter/X',color:'#94a3b8',cls:'s3'},
    {icon:'📷',label:'Instagram',color:'#e1306c',cls:'s4'},
    {icon:'🌐',label:'Portfolio',color:'#06b6d4',cls:'s5'},
  ];
  return (
    <footer style={{borderTop:'1px solid rgba(124,58,237,.1)',
      padding:'16px 24px',display:'flex',alignItems:'center',
      justifyContent:'space-between',background:'rgba(6,4,18,.97)',flexShrink:0}}>
      <div style={{fontSize:11,color:'#2d2050'}}>
        © 2025 <span style={{color:'#7c3aed',fontWeight:600}}>Elizabeth Díaz Familia</span>
        {' '}· {t('footer.tagline')}
      </div>
      <div style={{display:'flex',gap:10,alignItems:'center'}}>
        <span style={{fontSize:10,color:'#2d2050',marginRight:4}}>{t('footer.findMe')}</span>
        {socials.map((s,i) => (
          <div key={i} className={`social-icon ${s.cls}`} title={s.label}
            style={{width:30,height:30,borderRadius:8,background:`${s.color}15`,border:`1px solid ${s.color}30`,
              display:'flex',alignItems:'center',justifyContent:'center',color:s.color,fontSize:13,fontWeight:800}}>
            {s.icon}
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:16,fontSize:10,color:'#2d2050',alignItems:'center'}}>
        <span style={{color:'#10b981'}}>{t('footer.greenAI')}</span>
        <span>{t('footer.i18n')}</span>
        <span>{t('footer.version')}</span>
      </div>
    </footer>
  );
}

// ═══════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════
export default function LumindAd() {
  const langState = useLang();
  const { t, lang } = langState;
  const [page, setPage] = useState('dashboard');

  const renderPage = () => ({
    dashboard: <DashboardPage/>,
    create:    <CreateAdPage/>,
    campaigns: <CampaignsPage/>,
    budget:    <BudgetPage/>,
    analytics: <AnalyticsPage/>,
    upload:    <UploadPage/>,
  }[page] || <DashboardPage/>);

  const topLabels = [
    {id:'dashboard',label:t('nav.dashboard')},
    {id:'create',   label:t('nav.createAd')},
    {id:'campaigns',label:t('nav.campaigns')},
    {id:'budget',   label:t('nav.budget')},
    {id:'analytics',label:t('nav.analytics')},
    {id:'upload',   label:t('nav.uploadData')},
  ];

  return (
    <LangContext.Provider value={langState}>
      <div style={{display:'flex',height:'100vh',background:'#060610',
        fontFamily:"'Outfit',sans-serif",overflow:'hidden'}}>
        <style dangerouslySetInnerHTML={{__html:GLOBAL_CSS}}/>
        <Sidebar page={page} setPage={setPage}/>
        <div style={{marginLeft:230,flex:1,display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden'}}>
          {/* Topbar */}
          <div style={{height:52,borderBottom:'1px solid rgba(124,58,237,.1)',
            background:'rgba(6,4,18,.97)',display:'flex',alignItems:'center',
            padding:'0 28px',gap:12,flexShrink:0}}>
            <div style={{flex:1,display:'flex',gap:10}}>
              {topLabels.map(({id,label}) => (
                <button key={id} onClick={()=>setPage(id)}
                  style={{background:'none',border:'none',
                    color:page===id?'#a78bfa':'#334155',
                    cursor:'pointer',fontSize:13,fontWeight:600,
                    padding:'4px 10px',borderRadius:6,
                    borderBottom:page===id?'2px solid #7c3aed':'2px solid transparent',
                    fontFamily:"'Outfit',sans-serif"}}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <div style={{fontSize:11,color:'#10b981',display:'flex',alignItems:'center',gap:5}}>
                <span style={{width:6,height:6,borderRadius:'50%',background:'#10b981',display:'inline-block'}}/>
                {t('sidebar.aiOnline')}
              </div>
              <div style={{width:1,height:16,background:'rgba(124,58,237,.2)'}}/>
              <LanguageSelector/>
            </div>
          </div>
          {/* Main */}
          <main style={{flex:1,overflowY:'auto',padding:'28px',
            background:'radial-gradient(ellipse at 20% 0%,rgba(124,58,237,.06) 0%,transparent 60%)'}}>
            {renderPage()}
          </main>
          <Footer/>
        </div>
      </div>
    </LangContext.Provider>
  );
}
