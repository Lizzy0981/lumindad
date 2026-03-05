import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const LANGS = {
  en: {
    nav:{dashboard:'Dashboard',createAd:'Create Ad',campaigns:'Campaigns',budget:'Budget',analytics:'Analytics',upload:'Upload Data'},
    metrics:{spend:'Total Spend',impressions:'Impressions',clicks:'Clicks',conversions:'Conversions',budget:'Total Budget',spent:'Total Spent',remaining:'Remaining',used:'Budget Used'},
    dashboard:{title:'Performance Dashboard',subtitle:'Monitor your advertising performance in real-time — AI-powered insights',weekly:'Weekly Performance',weeklySub:'Impressions & clicks over 7 days',platform:'Platform Split',platformSub:'Ad spend distribution',insights:'AI-Generated Insights',peakTitle:'Peak Performance',peakDesc:'Friday ads convert 34% better. Increase budget by $200 next Friday.',anomalyTitle:'Anomaly Detected',anomalyDesc:'TikTok campaign CTR dropped 18% vs last week. Isolation Forest flagged this.',growthTitle:'Growth Opportunity',growthDesc:'LinkedIn B2B shows 5.1x ROAS. Recommend scaling budget +40%.'},
    campaigns:{title:'Campaigns',subtitle:'Manage and track all your advertising campaigns',search:'Search campaigns...',cols:['Campaign','Platform','Status','Budget','Spent','Impressions','CTR','ROAS','']},
    budget:{title:'Budget Management',subtitle:'Track and optimize your ad spend with AI recommendations',daily:'Daily Spend vs Budget',dailySub:'Actual spend vs daily budget target',actual:'Actual Spend',target:'Budget Target',byPlatform:'By Platform',aiRec:'🤖 AI Recommendation',aiText:'Reallocate',aiStrong1:'$1,200',aiFrom:' from Meta to Google Ads. XGBoost estimates ',aiStrong2:'+23% ROAS',aiEnd:' improvement.'},
    analytics:{title:'Analytics',subtitle:'Deep-dive into performance data with ML-powered analysis',impressions:'Impressions Over Time',convClicks:'Conversions & Clicks',convSub:'Engagement funnel over time',ml:'ML Models Active — TensorFlow · XGBoost · SHAP',acc:'Accuracy:',churn:'Churn Predictor',anomaly:'Anomaly Detector',click:'Click Predictor',roas:'ROAS Optimizer'},
    upload:{title:'Upload Data',subtitle:'Process up to 10M rows · Parallel processing · Web Workers',capacity:'⚡ 10 files · 10M rows max',idle:'Drag & drop your files here',active:'Drop your files here!',browse:'browse files',limits:'Max 10 files · Up to 2GB · Chunked processing',list:'Uploaded Files',processing:'⟳ Processing...',process:'▶ Process Data',clear:'🗑 Clear Data',export:'↓ Export Results',done:'Processing Complete!',bench:'⚡ Processing Engine — Benchmarks',ready:'Ready',rows:'rows processed',chunk:'Processing chunk...'},
    create:{title:'Create New Ad',subtitle:'AI-powered ad creation with automatic optimization',settings:'Campaign Settings',copy:'Ad Copy',schedule:'Budget & Schedule',platform:'Platform',objective:'Objective',headline:'Headline',body:'Body Text',daily:'Daily Budget ($)',start:'Start Date',end:'End Date',headPH:'Enter your ad headline...',bodyPH:'Enter your ad body text...',generating:'Generating...',sponsored:'Sponsored',aiScore:'🤖 AI Optimization Score',relevance:'Relevance',ctr:'CTR Prediction',quality:'Quality Score',targeting:'Targeting Match',genBtn:'🤖 AI Generate',launch:'🚀 Launch Campaign',preview:'Preview',save:'✓ Save Draft'},
    sidebar:{ai:'AI Engine',online:'AI Online',green:'Green AI',co2:'0.003 gCO₂ · GHG Scope 2',user:'Elizabeth D.F.',role:'Sustainable AI'},
    footer:{tagline:'LumindAd Enterprise · Python · TensorFlow · React · Green AI',findMe:'FIND ME:',green:'🌱 Green AI',i18n:'i18n 11 langs',version:'v1.0.0 Enterprise'},
    buttons:{refresh:'⟳ Refresh',newAd:'✦ Create New Ad',newCampaign:'+ New Campaign',edit:'Edit',setBudget:'+ Set Budget',apply:'Apply Suggestion',newBadge:'NEW'},
    lang:'Language',
  },
  es: {
    nav:{dashboard:'Inicio',createAd:'Crear Anuncio',campaigns:'Campañas',budget:'Presupuesto',analytics:'Analítica',upload:'Subir Datos'},
    metrics:{spend:'Gasto Total',impressions:'Impresiones',clicks:'Clics',conversions:'Conversiones',budget:'Presupuesto Total',spent:'Total Gastado',remaining:'Restante',used:'Presupuesto Usado'},
    dashboard:{title:'Panel de Rendimiento',subtitle:'Monitorea tu rendimiento publicitario en tiempo real — insights con IA',weekly:'Rendimiento Semanal',weeklySub:'Impresiones y clics en 7 días',platform:'División por Plataforma',platformSub:'Distribución del gasto en anuncios',insights:'Insights Generados por IA',peakTitle:'Rendimiento Pico',peakDesc:'Los anuncios del viernes convierten 34% mejor. Aumenta el presupuesto en $200 el próximo viernes.',anomalyTitle:'Anomalía Detectada',anomalyDesc:'El CTR de TikTok cayó 18% vs. la semana pasada. Isolation Forest lo detectó.',growthTitle:'Oportunidad de Crecimiento',growthDesc:'LinkedIn B2B muestra 5.1x ROAS. Se recomienda escalar el presupuesto +40%.'},
    campaigns:{title:'Campañas',subtitle:'Gestiona y monitorea todas tus campañas publicitarias',search:'Buscar campañas...',cols:['Campaña','Plataforma','Estado','Presupuesto','Gastado','Impresiones','CTR','ROAS','']},
    budget:{title:'Gestión de Presupuesto',subtitle:'Controla y optimiza tu gasto publicitario con recomendaciones IA',daily:'Gasto Diario vs Presupuesto',dailySub:'Gasto real vs objetivo diario',actual:'Gasto Real',target:'Objetivo',byPlatform:'Por Plataforma',aiRec:'🤖 Recomendación IA',aiText:'Reasigna',aiStrong1:'$1,200',aiFrom:' de Meta a Google Ads. XGBoost estima ',aiStrong2:'+23% ROAS',aiEnd:' de mejora.'},
    analytics:{title:'Analítica',subtitle:'Análisis profundo con inteligencia artificial',impressions:'Impresiones en el Tiempo',convClicks:'Conversiones y Clics',convSub:'Embudo de engagement en el tiempo',ml:'Modelos ML Activos — TensorFlow · XGBoost · SHAP',acc:'Precisión:',churn:'Predictor de Abandono',anomaly:'Detector de Anomalías',click:'Predictor de Clics',roas:'Optimizador ROAS'},
    upload:{title:'Subir Datos',subtitle:'Procesa hasta 10M filas · Procesamiento paralelo · Web Workers',capacity:'⚡ 10 archivos · máx 10M filas',idle:'Arrastra y suelta tus archivos aquí',active:'¡Suelta tus archivos aquí!',browse:'explorar archivos',limits:'Máx 10 archivos · Hasta 2GB · Procesamiento en bloques',list:'Archivos Subidos',processing:'⟳ Procesando...',process:'▶ Procesar Datos',clear:'🗑 Limpiar Datos',export:'↓ Exportar Resultados',done:'¡Procesamiento Completo!',bench:'⚡ Motor de Procesamiento — Benchmarks',ready:'Listo',rows:'filas procesadas',chunk:'Procesando bloque...'},
    create:{title:'Crear Nuevo Anuncio',subtitle:'Creación de anuncios con IA y optimización automática',settings:'Configuración de Campaña',copy:'Texto del Anuncio',schedule:'Presupuesto y Fechas',platform:'Plataforma',objective:'Objetivo',headline:'Título',body:'Cuerpo del Texto',daily:'Presupuesto Diario ($)',start:'Fecha Inicio',end:'Fecha Fin',headPH:'Ingresa el título de tu anuncio...',bodyPH:'Ingresa el cuerpo del texto...',generating:'Generando...',sponsored:'Patrocinado',aiScore:'🤖 Puntuación de Optimización IA',relevance:'Relevancia',ctr:'Predicción CTR',quality:'Puntuación de Calidad',targeting:'Coincidencia de Segmentación',genBtn:'🤖 Generar con IA',launch:'🚀 Lanzar Campaña',preview:'Vista Previa',save:'✓ Guardar Borrador'},
    sidebar:{ai:'Motor IA',online:'IA en Línea',green:'IA Verde',co2:'0.003 gCO₂ · GHG Alcance 2',user:'Elizabeth D.F.',role:'IA Sostenible'},
    footer:{tagline:'LumindAd Enterprise · Python · TensorFlow · React · IA Verde',findMe:'ENCUÉNTRAME:',green:'🌱 IA Verde',i18n:'i18n 11 idiomas',version:'v1.0.0 Enterprise'},
    buttons:{refresh:'⟳ Actualizar',newAd:'✦ Crear Anuncio',newCampaign:'+ Nueva Campaña',edit:'Editar',setBudget:'+ Fijar Presupuesto',apply:'Aplicar Sugerencia',newBadge:'NUEVO'},
    lang:'Idioma',
  },
  pt: {
    nav:{dashboard:'Painel',createAd:'Criar Anúncio',campaigns:'Campanhas',budget:'Orçamento',analytics:'Analítica',upload:'Enviar Dados'},
    metrics:{spend:'Gasto Total',impressions:'Impressões',clicks:'Cliques',conversions:'Conversões',budget:'Orçamento Total',spent:'Total Gasto',remaining:'Restante',used:'Orçamento Usado'},
    dashboard:{title:'Painel de Desempenho',subtitle:'Monitore seu desempenho em tempo real — insights com IA',weekly:'Desempenho Semanal',weeklySub:'Impressões e cliques em 7 dias',platform:'Divisão por Plataforma',platformSub:'Distribuição do gasto',insights:'Insights Gerados por IA',peakTitle:'Pico de Desempenho',peakDesc:'Anúncios de sexta convertem 34% melhor. Aumente o orçamento em $200 na próxima sexta.',anomalyTitle:'Anomalia Detectada',anomalyDesc:'CTR do TikTok caiu 18% vs semana passada. Isolation Forest detectou.',growthTitle:'Oportunidade de Crescimento',growthDesc:'LinkedIn B2B mostra ROAS 5.1x. Escale orçamento +40%.'},
    campaigns:{title:'Campanhas',subtitle:'Gerencie e acompanhe todas as campanhas',search:'Buscar campanhas...',cols:['Campanha','Plataforma','Status','Orçamento','Gasto','Impressões','CTR','ROAS','']},
    budget:{title:'Gestão de Orçamento',subtitle:'Controle e otimize seus gastos com IA',daily:'Gasto Diário vs Orçamento',dailySub:'Gasto real vs meta diária',actual:'Gasto Real',target:'Meta',byPlatform:'Por Plataforma',aiRec:'🤖 Recomendação IA',aiText:'Realoque',aiStrong1:'$1.200',aiFrom:' do Meta para Google Ads. XGBoost estima ',aiStrong2:'+23% ROAS',aiEnd:' de melhoria.'},
    analytics:{title:'Analítica',subtitle:'Análise profunda com inteligência artificial',impressions:'Impressões ao Longo do Tempo',convClicks:'Conversões e Cliques',convSub:'Funil de engajamento',ml:'Modelos ML Ativos — TensorFlow · XGBoost · SHAP',acc:'Precisão:',churn:'Preditor de Churn',anomaly:'Detector de Anomalias',click:'Preditor de Cliques',roas:'Otimizador ROAS'},
    upload:{title:'Enviar Dados',subtitle:'Processe até 10M linhas · Processamento paralelo',capacity:'⚡ 10 arquivos · máx 10M linhas',idle:'Arraste e solte seus arquivos aqui',active:'Solte seus arquivos aqui!',browse:'procurar arquivos',limits:'Máx 10 arquivos · Até 2GB',list:'Arquivos Enviados',processing:'⟳ Processando...',process:'▶ Processar Dados',clear:'🗑 Limpar',export:'↓ Exportar',done:'Processamento Concluído!',bench:'⚡ Motor de Processamento',ready:'Pronto',rows:'linhas processadas',chunk:'Processando bloco...'},
    create:{title:'Criar Novo Anúncio',subtitle:'Criação com IA e otimização automática',settings:'Configurações da Campanha',copy:'Texto do Anúncio',schedule:'Orçamento e Agenda',platform:'Plataforma',objective:'Objetivo',headline:'Título',body:'Corpo do Texto',daily:'Orçamento Diário ($)',start:'Data de Início',end:'Data de Fim',headPH:'Digite o título...',bodyPH:'Digite o corpo do texto...',generating:'Gerando...',sponsored:'Patrocinado',aiScore:'🤖 Pontuação IA',relevance:'Relevância',ctr:'Previsão de CTR',quality:'Pontuação de Qualidade',targeting:'Correspondência',genBtn:'🤖 Gerar com IA',launch:'🚀 Lançar Campanha',preview:'Visualizar',save:'✓ Salvar Rascunho'},
    sidebar:{ai:'Motor IA',online:'IA Online',green:'IA Verde',co2:'0.003 gCO₂ · GHG Escopo 2',user:'Elizabeth D.F.',role:'IA Sustentável'},
    footer:{tagline:'LumindAd Enterprise · Python · TensorFlow · React · IA Verde',findMe:'ME ENCONTRE:',green:'🌱 IA Verde',i18n:'i18n 11 idiomas',version:'v1.0.0 Enterprise'},
    buttons:{refresh:'⟳ Atualizar',newAd:'✦ Criar Anúncio',newCampaign:'+ Nova Campanha',edit:'Editar',setBudget:'+ Definir Orçamento',apply:'Aplicar Sugestão',newBadge:'NOVO'},
    lang:'Idioma',
  },
  fr: {
    nav:{dashboard:'Tableau de Bord',createAd:'Créer une Pub',campaigns:'Campagnes',budget:'Budget',analytics:'Analytique',upload:'Charger Données'},
    metrics:{spend:'Dépense Totale',impressions:'Impressions',clicks:'Clics',conversions:'Conversions',budget:'Budget Total',spent:'Total Dépensé',remaining:'Restant',used:'Budget Utilisé'},
    dashboard:{title:'Tableau de Bord Performance',subtitle:'Surveillez vos performances en temps réel — insights IA',weekly:'Performance Hebdomadaire',weeklySub:'Impressions et clics sur 7 jours',platform:'Répartition Plateformes',platformSub:'Distribution des dépenses',insights:'Insights IA',peakTitle:'Performance de Pointe',peakDesc:'Les pubs du vendredi convertissent 34% mieux. Augmentez le budget de $200 vendredi prochain.',anomalyTitle:'Anomalie Détectée',anomalyDesc:'Le CTR TikTok a chuté de 18% vs la semaine dernière.',growthTitle:'Opportunité de Croissance',growthDesc:'LinkedIn B2B affiche ROAS 5.1x. Augmentez le budget +40%.'},
    campaigns:{title:'Campagnes',subtitle:'Gérez et suivez toutes vos campagnes',search:'Rechercher...',cols:['Campagne','Plateforme','Statut','Budget','Dépensé','Impressions','CTR','ROAS','']},
    budget:{title:'Gestion du Budget',subtitle:'Optimisez vos dépenses avec des recommandations IA',daily:'Dépenses Quotidiennes vs Budget',dailySub:'Dépenses réelles vs objectif',actual:'Dépenses Réelles',target:'Objectif',byPlatform:'Par Plateforme',aiRec:'🤖 Recommandation IA',aiText:'Réallouez',aiStrong1:'1 200 $',aiFrom:' de Meta vers Google Ads. XGBoost estime ',aiStrong2:'+23% ROAS',aiEnd:'.'},
    analytics:{title:'Analytique',subtitle:'Analyse approfondie avec IA',impressions:'Impressions dans le Temps',convClicks:'Conversions et Clics',convSub:'Entonnoir dans le temps',ml:'Modèles ML Actifs — TensorFlow · XGBoost · SHAP',acc:'Précision:',churn:'Prédicteur Attrition',anomaly:'Détecteur Anomalies',click:'Prédicteur Clics',roas:'Optimiseur ROAS'},
    upload:{title:'Charger Données',subtitle:'Traitez jusqu\'à 10M lignes · Traitement parallèle',capacity:'⚡ 10 fichiers · max 10M lignes',idle:'Glissez-déposez vos fichiers ici',active:'Déposez vos fichiers ici!',browse:'parcourir',limits:'Max 10 fichiers · Jusqu\'à 2Go',list:'Fichiers Chargés',processing:'⟳ Traitement...',process:'▶ Traiter',clear:'🗑 Effacer',export:'↓ Exporter',done:'Traitement Terminé!',bench:'⚡ Benchmarks',ready:'Prêt',rows:'lignes traitées',chunk:'Traitement bloc...'},
    create:{title:'Créer une Pub',subtitle:'Création avec IA et optimisation automatique',settings:'Paramètres',copy:'Texte Publicitaire',schedule:'Budget et Planning',platform:'Plateforme',objective:'Objectif',headline:'Titre',body:'Corps du Texte',daily:'Budget Quotidien ($)',start:'Date de Début',end:'Date de Fin',headPH:'Entrez le titre...',bodyPH:'Entrez le corps...',generating:'Génération...',sponsored:'Sponsorisé',aiScore:'🤖 Score IA',relevance:'Pertinence',ctr:'Prédiction CTR',quality:'Score Qualité',targeting:'Correspondance',genBtn:'🤖 Générer avec IA',launch:'🚀 Lancer',preview:'Aperçu',save:'✓ Sauvegarder'},
    sidebar:{ai:'Moteur IA',online:'IA en Ligne',green:'IA Verte',co2:'0.003 gCO₂ · GHG Portée 2',user:'Elizabeth D.F.',role:'IA Durable'},
    footer:{tagline:'LumindAd Enterprise · Python · TensorFlow · React · IA Verte',findMe:'ME TROUVER:',green:'🌱 IA Verte',i18n:'i18n 11 langues',version:'v1.0.0 Enterprise'},
    buttons:{refresh:'⟳ Actualiser',newAd:'✦ Créer Pub',newCampaign:'+ Nouvelle Campagne',edit:'Modifier',setBudget:'+ Définir Budget',apply:'Appliquer',newBadge:'NOUVEAU'},
    lang:'Langue',
  },
  ar: {
    rtl:true,
    nav:{dashboard:'لوحة القيادة',createAd:'إنشاء إعلان',campaigns:'الحملات',budget:'الميزانية',analytics:'التحليلات',upload:'رفع البيانات'},
    metrics:{spend:'إجمالي الإنفاق',impressions:'مرات الظهور',clicks:'النقرات',conversions:'التحويلات',budget:'الميزانية الإجمالية',spent:'الإجمالي المُنفق',remaining:'المتبقي',used:'الميزانية المستخدمة'},
    dashboard:{title:'لوحة الأداء',subtitle:'راقب أداء إعلاناتك في الوقت الفعلي',weekly:'الأداء الأسبوعي',weeklySub:'مرات الظهور والنقرات خلال 7 أيام',platform:'توزيع المنصات',platformSub:'توزيع الإنفاق الإعلاني',insights:'رؤى الذكاء الاصطناعي',peakTitle:'ذروة الأداء',peakDesc:'إعلانات الجمعة أفضل بنسبة 34٪. زد الميزانية $200 للجمعة القادمة.',anomalyTitle:'تم اكتشاف شذوذ',anomalyDesc:'انخفض CTR لـ TikTok بنسبة 18٪ مقارنة بالأسبوع الماضي.',growthTitle:'فرصة نمو',growthDesc:'LinkedIn B2B يُظهر ROAS 5.1x. وسّع الميزانية +40٪.'},
    campaigns:{title:'الحملات',subtitle:'إدارة ومتابعة جميع حملاتك الإعلانية',search:'البحث...',cols:['الحملة','المنصة','الحالة','الميزانية','المُنفق','مرات الظهور','CTR','ROAS','']},
    budget:{title:'إدارة الميزانية',subtitle:'تتبع وتحسين الإنفاق الإعلاني',daily:'الإنفاق اليومي مقابل الميزانية',dailySub:'الإنفاق الفعلي مقارنة بالهدف',actual:'الإنفاق الفعلي',target:'الهدف',byPlatform:'حسب المنصة',aiRec:'🤖 توصية الذكاء الاصطناعي',aiText:'أعد توزيع',aiStrong1:'$1,200',aiFrom:' من Meta إلى Google Ads. XGBoost يُقدر ',aiStrong2:'+23% ROAS',aiEnd:'.'},
    analytics:{title:'التحليلات',subtitle:'تحليل عميق بالذكاء الاصطناعي',impressions:'مرات الظهور عبر الزمن',convClicks:'التحويلات والنقرات',convSub:'مسار التفاعل',ml:'نماذج ML النشطة — TensorFlow · XGBoost · SHAP',acc:'الدقة:',churn:'متنبئ الإلغاء',anomaly:'كاشف الشذوذ',click:'متنبئ النقرات',roas:'مُحسِّن ROAS'},
    upload:{title:'رفع البيانات',subtitle:'معالجة حتى 10M صف · معالجة متوازية',capacity:'⚡ 10 ملفات · حد أقصى 10M صف',idle:'اسحب وأفلت ملفاتك هنا',active:'أفلت ملفاتك هنا!',browse:'تصفح الملفات',limits:'حد أقصى 10 ملفات · حتى 2 جيجابايت',list:'الملفات المرفوعة',processing:'⟳ جاري المعالجة...',process:'▶ معالجة البيانات',clear:'🗑 مسح البيانات',export:'↓ تصدير النتائج',done:'اكتملت المعالجة!',bench:'⚡ معايير المعالجة',ready:'جاهز',rows:'صف تمت معالجته',chunk:'جاري معالجة المجموعة...'},
    create:{title:'إنشاء إعلان جديد',subtitle:'إنشاء إعلانات بالذكاء الاصطناعي',settings:'إعدادات الحملة',copy:'نص الإعلان',schedule:'الميزانية والجدول',platform:'المنصة',objective:'الهدف',headline:'العنوان',body:'نص الجسم',daily:'الميزانية اليومية ($)',start:'تاريخ البداية',end:'تاريخ النهاية',headPH:'أدخل عنوان إعلانك...',bodyPH:'أدخل نص الجسم...',generating:'جاري الإنشاء...',sponsored:'ممول',aiScore:'🤖 درجة التحسين',relevance:'الصلة',ctr:'توقع CTR',quality:'درجة الجودة',targeting:'تطابق الاستهداف',genBtn:'🤖 توليد بالذكاء الاصطناعي',launch:'🚀 إطلاق الحملة',preview:'معاينة',save:'✓ حفظ مسودة'},
    sidebar:{ai:'محرك الذكاء الاصطناعي',online:'الذكاء الاصطناعي متصل',green:'ذكاء اصطناعي أخضر',co2:'0.003 جم CO₂ · النطاق 2',user:'إليزابيث د.ف.',role:'ذكاء اصطناعي مستدام'},
    footer:{tagline:'LumindAd Enterprise · Python · TensorFlow · React · ذكاء اصطناعي أخضر',findMe:'جدني:',green:'🌱 ذكاء اصطناعي أخضر',i18n:'i18n 11 لغة',version:'v1.0.0 Enterprise'},
    buttons:{refresh:'⟳ تحديث',newAd:'✦ إنشاء إعلان',newCampaign:'+ حملة جديدة',edit:'تعديل',setBudget:'+ تحديد الميزانية',apply:'تطبيق',newBadge:'جديد'},
    lang:'اللغة',
  },
  he: {
    rtl:true,
    nav:{dashboard:'לוח בקרה',createAd:'צור מודעה',campaigns:'קמפיינים',budget:'תקציב',analytics:'אנליטיקה',upload:'העלה נתונים'},
    metrics:{spend:'סך הוצאה',impressions:'חשיפות',clicks:'קליקים',conversions:'המרות',budget:'תקציב כולל',spent:'סה"כ הוצא',remaining:'נותר',used:'תקציב בשימוש'},
    dashboard:{title:'לוח ביצועים',subtitle:'עקוב אחר ביצועי הפרסום בזמן אמת',weekly:'ביצועים שבועיים',weeklySub:'חשיפות וקליקים ב-7 ימים',platform:'פיצול פלטפורמות',platformSub:'חלוקת הוצאות פרסום',insights:'תובנות AI',peakTitle:'ביצועי שיא',peakDesc:'מודעות ביום שישי ממירות 34% טוב יותר.',anomalyTitle:'זוהתה חריגה',anomalyDesc:'ה-CTR של TikTok ירד 18% לעומת השבוע שעבר.',growthTitle:'הזדמנות צמיחה',growthDesc:'LinkedIn B2B מציג ROAS 5.1x. הגדל תקציב +40%.'},
    campaigns:{title:'קמפיינים',subtitle:'נהל ועקוב אחר כל הקמפיינים',search:'חפש קמפיינים...',cols:['קמפיין','פלטפורמה','סטטוס','תקציב','הוצא','חשיפות','CTR','ROAS','']},
    budget:{title:'ניהול תקציב',subtitle:'עקוב וייעל את הוצאות הפרסום',daily:'הוצאה יומית לעומת תקציב',dailySub:'הוצאה בפועל לעומת היעד',actual:'הוצאה בפועל',target:'יעד',byPlatform:'לפי פלטפורמה',aiRec:'🤖 המלצת AI',aiText:'הקצה מחדש',aiStrong1:'$1,200',aiFrom:' ממטא לגוגל אדס. XGBoost מעריך ',aiStrong2:'+23% ROAS',aiEnd:' שיפור.'},
    analytics:{title:'אנליטיקה',subtitle:'ניתוח מעמיק עם בינה מלאכותית',impressions:'חשיפות לאורך זמן',convClicks:'המרות וקליקים',convSub:'משפך מעורבות',ml:'מודלי ML פעילים — TensorFlow · XGBoost · SHAP',acc:'דיוק:',churn:'מנבא נטישה',anomaly:'גלאי חריגות',click:'מנבא קליקים',roas:'מייעל ROAS'},
    upload:{title:'העלה נתונים',subtitle:'עבד עד 10M שורות · עיבוד מקבילי',capacity:'⚡ 10 קבצים · מקסימום 10M שורות',idle:'גרור ושחרר קבצים כאן',active:'שחרר את הקבצים כאן!',browse:'עיין בקבצים',limits:'מקסימום 10 קבצים · עד 2GB',list:'קבצים שהועלו',processing:'⟳ מעבד...',process:'▶ עבד נתונים',clear:'🗑 נקה',export:'↓ יצוא',done:'העיבוד הושלם!',bench:'⚡ ביצועי ייחוס',ready:'מוכן',rows:'שורות עובדו',chunk:'מעבד גוש...'},
    create:{title:'צור מודעה חדשה',subtitle:'יצירת מודעות עם AI',settings:'הגדרות קמפיין',copy:'טקסט מודעה',schedule:'תקציב ולוח זמנים',platform:'פלטפורמה',objective:'מטרה',headline:'כותרת',body:'גוף הטקסט',daily:'תקציב יומי ($)',start:'תאריך התחלה',end:'תאריך סיום',headPH:'הכנס כותרת...',bodyPH:'הכנס גוף טקסט...',generating:'מייצר...',sponsored:'ממומן',aiScore:'🤖 ציון AI',relevance:'רלוונטיות',ctr:'תחזית CTR',quality:'ציון איכות',targeting:'התאמת מיקוד',genBtn:'🤖 צור עם AI',launch:'🚀 השק קמפיין',preview:'תצוגה מקדימה',save:'✓ שמור טיוטה'},
    sidebar:{ai:'מנוע בינה מלאכותית',online:'AI מחובר',green:'AI ירוק',co2:'0.003 gCO₂ · GHG היקף 2',user:'אליזבת ד.פ.',role:'מדענית AI'},
    footer:{tagline:'LumindAd Enterprise · Python · TensorFlow · React · AI ירוק',findMe:'מצא אותי:',green:'🌱 AI ירוק',i18n:'i18n 11 שפות',version:'v1.0.0 Enterprise'},
    buttons:{refresh:'⟳ רענן',newAd:'✦ צור מודעה',newCampaign:'+ קמפיין חדש',edit:'ערוך',setBudget:'+ קבע תקציב',apply:'החל הצעה',newBadge:'חדש'},
    lang:'שפה',
  },
  zh: {
    nav:{dashboard:'仪表盘',createAd:'创建广告',campaigns:'广告系列',budget:'预算',analytics:'分析',upload:'上传数据'},
    metrics:{spend:'总支出',impressions:'曝光次数',clicks:'点击次数',conversions:'转化次数',budget:'总预算',spent:'总花费',remaining:'剩余',used:'预算使用率'},
    dashboard:{title:'绩效仪表盘',subtitle:'实时监控广告绩效 — AI驱动的洞察',weekly:'每周绩效',weeklySub:'7天曝光量和点击量',platform:'平台分布',platformSub:'广告支出分布',insights:'AI生成的洞察',peakTitle:'峰值表现',peakDesc:'周五广告转化率提高34%。为下周五增加$200预算。',anomalyTitle:'检测到异常',anomalyDesc:'TikTok CTR与上周相比下降18%。',growthTitle:'增长机会',growthDesc:'LinkedIn B2B显示ROAS 5.1x。扩大预算+40%。'},
    campaigns:{title:'广告系列',subtitle:'管理和跟踪所有广告系列',search:'搜索广告系列...',cols:['广告系列','平台','状态','预算','已花费','曝光次数','CTR','ROAS','']},
    budget:{title:'预算管理',subtitle:'通过AI建议优化广告支出',daily:'每日支出 vs 预算',dailySub:'实际支出与目标比较',actual:'实际支出',target:'预算目标',byPlatform:'按平台',aiRec:'🤖 AI 建议',aiText:'将',aiStrong1:'$1,200',aiFrom:'从Meta重新分配到Google Ads。XGBoost估计',aiStrong2:'+23% ROAS',aiEnd:'的改善。'},
    analytics:{title:'分析',subtitle:'AI驱动的深度数据分析',impressions:'随时间变化的曝光量',convClicks:'转化和点击',convSub:'参与漏斗',ml:'活跃ML模型 — TensorFlow · XGBoost · SHAP',acc:'准确率:',churn:'流失预测器',anomaly:'异常检测器',click:'点击预测器',roas:'ROAS优化器'},
    upload:{title:'上传数据',subtitle:'处理多达1000万行 · 分块并行处理',capacity:'⚡ 10个文件 · 最多1000万行',idle:'将文件拖放到此处',active:'将文件放在这里！',browse:'浏览文件',limits:'最多10个文件 · 支持2GB',list:'已上传文件',processing:'⟳ 处理中...',process:'▶ 处理数据',clear:'🗑 清除数据',export:'↓ 导出结果',done:'处理完成！',bench:'⚡ 性能基准',ready:'就绪',rows:'行已处理',chunk:'处理块中...'},
    create:{title:'创建新广告',subtitle:'AI驱动的广告创建',settings:'广告系列设置',copy:'广告文案',schedule:'预算和排期',platform:'平台',objective:'目标',headline:'标题',body:'正文',daily:'每日预算 ($)',start:'开始日期',end:'结束日期',headPH:'输入广告标题...',bodyPH:'输入广告正文...',generating:'生成中...',sponsored:'赞助',aiScore:'🤖 AI优化评分',relevance:'相关性',ctr:'CTR预测',quality:'质量分数',targeting:'定向匹配',genBtn:'🤖 AI生成',launch:'🚀 启动广告系列',preview:'预览',save:'✓ 保存草稿'},
    sidebar:{ai:'AI引擎',online:'AI在线',green:'绿色AI',co2:'0.003 gCO₂ · 温室气体范围2',user:'Elizabeth D.F.',role:'可持续AI科学家'},
    footer:{tagline:'LumindAd企业版 · Python · TensorFlow · React · 绿色AI',findMe:'联系我:',green:'🌱 绿色AI',i18n:'i18n 11种语言',version:'v1.0.0企业版'},
    buttons:{refresh:'⟳ 刷新',newAd:'✦ 创建广告',newCampaign:'+ 新建系列',edit:'编辑',setBudget:'+ 设置预算',apply:'应用建议',newBadge:'新'},
    lang:'语言',
  },
  ru: {
    nav:{dashboard:'Панель управления',createAd:'Создать объявление',campaigns:'Кампании',budget:'Бюджет',analytics:'Аналитика',upload:'Загрузить данные'},
    metrics:{spend:'Общие расходы',impressions:'Показы',clicks:'Клики',conversions:'Конверсии',budget:'Общий бюджет',spent:'Итого потрачено',remaining:'Остаток',used:'Использовано бюджета'},
    dashboard:{title:'Панель эффективности',subtitle:'Отслеживайте эффективность рекламы в реальном времени',weekly:'Недельная эффективность',weeklySub:'Показы и клики за 7 дней',platform:'Распределение по платформам',platformSub:'Распределение рекламных расходов',insights:'Аналитика ИИ',peakTitle:'Пиковая эффективность',peakDesc:'Пятничные объявления конвертируют на 34% лучше.',anomalyTitle:'Обнаружена аномалия',anomalyDesc:'CTR TikTok снизился на 18% по сравнению с прошлой неделей.',growthTitle:'Возможность роста',growthDesc:'LinkedIn B2B показывает ROAS 5.1x. Увеличьте бюджет на +40%.'},
    campaigns:{title:'Кампании',subtitle:'Управляйте и отслеживайте рекламные кампании',search:'Поиск кампаний...',cols:['Кампания','Платформа','Статус','Бюджет','Потрачено','Показы','CTR','ROAS','']},
    budget:{title:'Управление бюджетом',subtitle:'Оптимизируйте расходы с рекомендациями ИИ',daily:'Ежедневные расходы vs Бюджет',dailySub:'Фактические расходы vs цель',actual:'Фактические расходы',target:'Целевой бюджет',byPlatform:'По платформам',aiRec:'🤖 Рекомендация ИИ',aiText:'Перераспределите',aiStrong1:'$1 200',aiFrom:' из Meta в Google Ads. XGBoost оценивает ',aiStrong2:'+23% ROAS',aiEnd:' улучшения.'},
    analytics:{title:'Аналитика',subtitle:'Глубокий анализ данных с ИИ',impressions:'Показы за период',convClicks:'Конверсии и клики',convSub:'Воронка вовлечённости',ml:'Активные ML модели — TensorFlow · XGBoost · SHAP',acc:'Точность:',churn:'Предиктор оттока',anomaly:'Детектор аномалий',click:'Предиктор кликов',roas:'Оптимизатор ROAS'},
    upload:{title:'Загрузить данные',subtitle:'Обработка до 10 млн строк · Параллельная обработка',capacity:'⚡ 10 файлов · макс. 10M строк',idle:'Перетащите файлы сюда',active:'Бросьте файлы здесь!',browse:'выбрать файлы',limits:'Макс. 10 файлов · До 2 ГБ',list:'Загруженные файлы',processing:'⟳ Обработка...',process:'▶ Обработать данные',clear:'🗑 Очистить',export:'↓ Экспорт',done:'Обработка завершена!',bench:'⚡ Бенчмарки',ready:'Готово',rows:'строк обработано',chunk:'Обработка блока...'},
    create:{title:'Создать объявление',subtitle:'Создание с ИИ и автоматической оптимизацией',settings:'Настройки кампании',copy:'Текст объявления',schedule:'Бюджет и расписание',platform:'Платформа',objective:'Цель',headline:'Заголовок',body:'Текст',daily:'Дневной бюджет ($)',start:'Дата начала',end:'Дата окончания',headPH:'Введите заголовок...',bodyPH:'Введите текст...',generating:'Генерация...',sponsored:'Спонсорский',aiScore:'🤖 Оценка ИИ',relevance:'Релевантность',ctr:'Прогноз CTR',quality:'Оценка качества',targeting:'Соответствие таргетинга',genBtn:'🤖 Генерировать с ИИ',launch:'🚀 Запустить кампанию',preview:'Предпросмотр',save:'✓ Сохранить черновик'},
    sidebar:{ai:'ИИ Движок',online:'ИИ Онлайн',green:'Зелёный ИИ',co2:'0.003 г CO₂ · ПГ Охват 2',user:'Элизабет Д.Ф.',role:'Устойчивый ИИ'},
    footer:{tagline:'LumindAd Enterprise · Python · TensorFlow · React · Зелёный ИИ',findMe:'НАЙДИ МЕНЯ:',green:'🌱 Зелёный ИИ',i18n:'i18n 11 языков',version:'v1.0.0 Enterprise'},
    buttons:{refresh:'⟳ Обновить',newAd:'✦ Создать объявление',newCampaign:'+ Новая кампания',edit:'Редактировать',setBudget:'+ Установить бюджет',apply:'Применить',newBadge:'НОВОЕ'},
    lang:'Язык',
  },
  tr: {
    nav:{dashboard:'Gösterge Paneli',createAd:'Reklam Oluştur',campaigns:'Kampanyalar',budget:'Bütçe',analytics:'Analitik',upload:'Veri Yükle'},
    metrics:{spend:'Toplam Harcama',impressions:'Gösterimler',clicks:'Tıklamalar',conversions:'Dönüşümler',budget:'Toplam Bütçe',spent:'Toplam Harcanan',remaining:'Kalan',used:'Kullanılan Bütçe'},
    dashboard:{title:'Performans Gösterge Paneli',subtitle:'Reklam performansınızı gerçek zamanlı izleyin',weekly:'Haftalık Performans',weeklySub:'7 günlük gösterimler ve tıklamalar',platform:'Platform Dağılımı',platformSub:'Reklam harcaması dağılımı',insights:'Yapay Zeka İçgörüleri',peakTitle:'Zirve Performansı',peakDesc:'Cuma reklamları %34 daha iyi dönüştürüyor.',anomalyTitle:'Anomali Tespit Edildi',anomalyDesc:'TikTok CTR geçen haftaya göre %18 düştü.',growthTitle:'Büyüme Fırsatı',growthDesc:'LinkedIn B2B 5.1x ROAS gösteriyor. Bütçeyi +%40 artırın.'},
    campaigns:{title:'Kampanyalar',subtitle:'Tüm reklam kampanyalarınızı yönetin',search:'Kampanya ara...',cols:['Kampanya','Platform','Durum','Bütçe','Harcanan','Gösterimler','CTR','ROAS','']},
    budget:{title:'Bütçe Yönetimi',subtitle:'Yapay zeka önerileriyle harcamaları optimize edin',daily:'Günlük Harcama vs Bütçe',dailySub:'Gerçek harcama vs hedef',actual:'Gerçek Harcama',target:'Bütçe Hedefi',byPlatform:'Platforma Göre',aiRec:'🤖 Yapay Zeka Önerisi',aiText:'',aiStrong1:'$1.200',aiFrom:'\'yi Meta\'dan Google Ads\'e aktarın. XGBoost ',aiStrong2:'+%23 ROAS',aiEnd:' öngörüyor.'},
    analytics:{title:'Analitik',subtitle:'Yapay zeka destekli derin veri analizi',impressions:'Zaman İçindeki Gösterimler',convClicks:'Dönüşümler ve Tıklamalar',convSub:'Etkileşim hunisi',ml:'Aktif ML Modelleri — TensorFlow · XGBoost · SHAP',acc:'Doğruluk:',churn:'Churn Tahmincisi',anomaly:'Anomali Dedektörü',click:'Tıklama Tahmincisi',roas:'ROAS Optimize Edici'},
    upload:{title:'Veri Yükle',subtitle:'10M satıra kadar işleyin · Paralel işleme',capacity:'⚡ 10 dosya · maks 10M satır',idle:'Dosyalarınızı buraya sürükleyin',active:'Dosyalarınızı buraya bırakın!',browse:'dosyalara göz at',limits:'Maks 10 dosya · 2GB\'a kadar',list:'Yüklenen Dosyalar',processing:'⟳ İşleniyor...',process:'▶ Verileri İşle',clear:'🗑 Temizle',export:'↓ Dışa Aktar',done:'İşlem Tamamlandı!',bench:'⚡ Performans Kıyaslamaları',ready:'Hazır',rows:'satır işlendi',chunk:'Blok işleniyor...'},
    create:{title:'Yeni Reklam Oluştur',subtitle:'Yapay zeka destekli reklam oluşturma',settings:'Kampanya Ayarları',copy:'Reklam Metni',schedule:'Bütçe ve Program',platform:'Platform',objective:'Hedef',headline:'Başlık',body:'Gövde Metni',daily:'Günlük Bütçe ($)',start:'Başlangıç Tarihi',end:'Bitiş Tarihi',headPH:'Reklam başlığını girin...',bodyPH:'Gövde metnini girin...',generating:'Oluşturuluyor...',sponsored:'Sponsorlu',aiScore:'🤖 Yapay Zeka Puanı',relevance:'Alaka Düzeyi',ctr:'CTR Tahmini',quality:'Kalite Puanı',targeting:'Hedefleme Eşleşmesi',genBtn:'🤖 Yapay Zeka ile Oluştur',launch:'🚀 Kampanyayı Başlat',preview:'Önizleme',save:'✓ Taslak Kaydet'},
    sidebar:{ai:'Yapay Zeka Motoru',online:'Yapay Zeka Çevrimiçi',green:'Yeşil Yapay Zeka',co2:'0.003 gCO₂ · GHG Kapsam 2',user:'Elizabeth D.F.',role:'Sürdürülebilir YZ'},
    footer:{tagline:'LumindAd Kurumsal · Python · TensorFlow · React · Yeşil YZ',findMe:'BENİ BUL:',green:'🌱 Yeşil YZ',i18n:'i18n 11 dil',version:'v1.0.0 Kurumsal'},
    buttons:{refresh:'⟳ Yenile',newAd:'✦ Reklam Oluştur',newCampaign:'+ Yeni Kampanya',edit:'Düzenle',setBudget:'+ Bütçe Belirle',apply:'Öneriyi Uygula',newBadge:'YENİ'},
    lang:'Dil',
  },
  ko: {
    nav:{dashboard:'대시보드',createAd:'광고 만들기',campaigns:'캠페인',budget:'예산',analytics:'분석',upload:'데이터 업로드'},
    metrics:{spend:'총 지출',impressions:'노출수',clicks:'클릭수',conversions:'전환수',budget:'총 예산',spent:'총 사용',remaining:'남은 금액',used:'예산 사용률'},
    dashboard:{title:'성과 대시보드',subtitle:'실시간으로 광고 성과를 모니터링하세요',weekly:'주간 성과',weeklySub:'7일간 노출수 및 클릭수',platform:'플랫폼별 분포',platformSub:'광고 지출 분포',insights:'AI 생성 인사이트',peakTitle:'최고 성과',peakDesc:'금요일 광고가 34% 더 좋은 전환율을 보입니다.',anomalyTitle:'이상 감지됨',anomalyDesc:'TikTok CTR이 지난주 대비 18% 하락했습니다.',growthTitle:'성장 기회',growthDesc:'LinkedIn B2B가 5.1x ROAS를 보입니다. 예산 +40% 확대 권장.'},
    campaigns:{title:'캠페인',subtitle:'모든 광고 캠페인을 관리하고 추적하세요',search:'캠페인 검색...',cols:['캠페인','플랫폼','상태','예산','사용','노출수','CTR','ROAS','']},
    budget:{title:'예산 관리',subtitle:'AI 권장 사항으로 광고 지출을 최적화하세요',daily:'일일 지출 vs 예산',dailySub:'실제 지출 vs 일일 목표',actual:'실제 지출',target:'예산 목표',byPlatform:'플랫폼별',aiRec:'🤖 AI 권장 사항',aiText:'Meta에서 Google Ads로',aiStrong1:'$1,200',aiFrom:'을 재배분하세요. XGBoost는 ',aiStrong2:'+23% ROAS',aiEnd:' 향상을 예상합니다.'},
    analytics:{title:'분석',subtitle:'AI 기반 심층 데이터 분석',impressions:'시간별 노출수',convClicks:'전환 및 클릭',convSub:'시간별 참여 퍼널',ml:'활성 ML 모델 — TensorFlow · XGBoost · SHAP',acc:'정확도:',churn:'이탈 예측기',anomaly:'이상 탐지기',click:'클릭 예측기',roas:'ROAS 최적화기'},
    upload:{title:'데이터 업로드',subtitle:'최대 1천만 행 처리 · 청크 병렬 처리',capacity:'⚡ 파일 10개 · 최대 1천만 행',idle:'파일을 여기에 드래그 앤 드롭하세요',active:'파일을 여기에 놓으세요!',browse:'파일 찾아보기',limits:'최대 10개 파일 · 2GB까지',list:'업로드된 파일',processing:'⟳ 처리 중...',process:'▶ 데이터 처리',clear:'🗑 데이터 지우기',export:'↓ 결과 내보내기',done:'처리 완료!',bench:'⚡ 성능 벤치마크',ready:'준비됨',rows:'행 처리됨',chunk:'청크 처리 중...'},
    create:{title:'새 광고 만들기',subtitle:'AI 기반 광고 제작 및 자동 최적화',settings:'캠페인 설정',copy:'광고 카피',schedule:'예산 및 일정',platform:'플랫폼',objective:'목표',headline:'제목',body:'본문',daily:'일일 예산 ($)',start:'시작일',end:'종료일',headPH:'광고 제목을 입력하세요...',bodyPH:'광고 본문을 입력하세요...',generating:'생성 중...',sponsored:'스폰서',aiScore:'🤖 AI 최적화 점수',relevance:'관련성',ctr:'CTR 예측',quality:'품질 점수',targeting:'타겟팅 일치',genBtn:'🤖 AI 생성',launch:'🚀 캠페인 시작',preview:'미리보기',save:'✓ 초안 저장'},
    sidebar:{ai:'AI 엔진',online:'AI 온라인',green:'그린 AI',co2:'0.003 gCO₂ · GHG 범위 2',user:'엘리자베스 D.F.',role:'지속 가능한 AI'},
    footer:{tagline:'LumindAd 엔터프라이즈 · Python · TensorFlow · React · 그린 AI',findMe:'찾아보세요:',green:'🌱 그린 AI',i18n:'i18n 11개 언어',version:'v1.0.0 엔터프라이즈'},
    buttons:{refresh:'⟳ 새로고침',newAd:'✦ 광고 만들기',newCampaign:'+ 새 캠페인',edit:'편집',setBudget:'+ 예산 설정',apply:'제안 적용',newBadge:'새로운'},
    lang:'언어',
  },
  ja: {
    nav:{dashboard:'ダッシュボード',createAd:'広告を作成',campaigns:'キャンペーン',budget:'予算',analytics:'分析',upload:'データをアップロード'},
    metrics:{spend:'総支出',impressions:'インプレッション',clicks:'クリック',conversions:'コンバージョン',budget:'総予算',spent:'総支出額',remaining:'残額',used:'予算使用率'},
    dashboard:{title:'パフォーマンスダッシュボード',subtitle:'広告パフォーマンスをリアルタイムで監視',weekly:'週間パフォーマンス',weeklySub:'7日間のインプレッションとクリック',platform:'プラットフォーム別分布',platformSub:'広告費の分布',insights:'AI生成インサイト',peakTitle:'ピークパフォーマンス',peakDesc:'金曜日の広告は34%高いコンバージョン率を示しています。',anomalyTitle:'異常が検出されました',anomalyDesc:'TikTok CTRが先週比18%低下しました。',growthTitle:'成長機会',growthDesc:'LinkedIn B2BはROAS 5.1xを示しています。予算を+40%拡大することを推奨します。'},
    campaigns:{title:'キャンペーン',subtitle:'すべての広告キャンペーンを管理・追跡',search:'キャンペーンを検索...',cols:['キャンペーン','プラットフォーム','ステータス','予算','支出','インプレッション','CTR','ROAS','']},
    budget:{title:'予算管理',subtitle:'AIの推奨事項で広告費を最適化',daily:'日別支出 vs 予算',dailySub:'実際の支出 vs 日次目標',actual:'実際の支出',target:'予算目標',byPlatform:'プラットフォーム別',aiRec:'🤖 AIの推奨事項',aiText:'MetaからGoogle Adsへ',aiStrong1:'$1,200',aiFrom:'を再配分してください。XGBoostは',aiStrong2:'+23% ROAS',aiEnd:'の改善を見込んでいます。'},
    analytics:{title:'分析',subtitle:'AIを活用した深層データ分析',impressions:'時系列インプレッション',convClicks:'コンバージョンとクリック',convSub:'時系列エンゲージメントファネル',ml:'アクティブMLモデル — TensorFlow · XGBoost · SHAP',acc:'精度:',churn:'チャーン予測器',anomaly:'異常検出器',click:'クリック予測器',roas:'ROAS最適化器'},
    upload:{title:'データをアップロード',subtitle:'最大1000万行を処理 · チャンク並列処理',capacity:'⚡ ファイル10個 · 最大1000万行',idle:'ここにファイルをドラッグ＆ドロップ',active:'ここにファイルをドロップ！',browse:'ファイルを参照',limits:'最大10ファイル · 2GBまで',list:'アップロード済みファイル',processing:'⟳ 処理中...',process:'▶ データを処理',clear:'🗑 データを消去',export:'↓ 結果をエクスポート',done:'処理完了！',bench:'⚡ パフォーマンスベンチマーク',ready:'準備完了',rows:'行処理済み',chunk:'チャンク処理中...'},
    create:{title:'新しい広告を作成',subtitle:'AIを活用した広告作成と自動最適化',settings:'キャンペーン設定',copy:'広告コピー',schedule:'予算とスケジュール',platform:'プラットフォーム',objective:'目標',headline:'見出し',body:'本文',daily:'日予算 ($)',start:'開始日',end:'終了日',headPH:'広告の見出しを入力...',bodyPH:'広告の本文を入力...',generating:'生成中...',sponsored:'スポンサー',aiScore:'🤖 AI最適化スコア',relevance:'関連性',ctr:'CTR予測',quality:'品質スコア',targeting:'ターゲティング一致',genBtn:'🤖 AIで生成',launch:'🚀 キャンペーンを開始',preview:'プレビュー',save:'✓ 下書きを保存'},
    sidebar:{ai:'AIエンジン',online:'AIオンライン',green:'グリーンAI',co2:'0.003 gCO₂ · GHG スコープ2',user:'エリザベス D.F.',role:'持続可能なAI'},
    footer:{tagline:'LumindAd エンタープライズ · Python · TensorFlow · React · グリーンAI',findMe:'見つけてください:',green:'🌱 グリーンAI',i18n:'i18n 11言語',version:'v1.0.0 エンタープライズ'},
    buttons:{refresh:'⟳ 更新',newAd:'✦ 広告を作成',newCampaign:'+ 新しいキャンペーン',edit:'編集',setBudget:'+ 予算を設定',apply:'提案を適用',newBadge:'新機能'},
    lang:'言語',
  },
};
const SUPPORTED_LANGS = [
  {code:'en',flag:'🇺🇸',label:'English'},{code:'es',flag:'🇪🇸',label:'Español'},
  {code:'pt',flag:'🇧🇷',label:'Português'},{code:'fr',flag:'🇫🇷',label:'Français'},
  {code:'ar',flag:'🇸🇦',label:'العربية'},{code:'he',flag:'🇮🇱',label:'עברית'},
  {code:'zh',flag:'🇨🇳',label:'中文'},{code:'ru',flag:'🇷🇺',label:'Русский'},
  {code:'tr',flag:'🇹🇷',label:'Türkçe'},{code:'ko',flag:'🇰🇷',label:'한국어'},
  {code:'ja',flag:'🇯🇵',label:'日本語'},
];
const ACCEPTED_FORMATS = [
  {ext:'CSV',aliases:['CSV'],icon:'📊',color:'#10b981'},
  {ext:'Excel',aliases:['XLSX','XLS'],icon:'📗',color:'#22c55e'},
  {ext:'JSON',aliases:['JSON'],icon:'🔵',color:'#3b82f6'},
  {ext:'PDF',aliases:['PDF'],icon:'🔴',color:'#ef4444'},
  {ext:'XML',aliases:['XML'],icon:'🟠',color:'#f97316'},
  {ext:'TSV',aliases:['TSV'],icon:'🟣',color:'#a855f7'},
  {ext:'TXT',aliases:['TXT'],icon:'⬜',color:'#94a3b8'},
  {ext:'Parquet',aliases:['PARQUET'],icon:'🟡',color:'#eab308'},
  {ext:'Avro',aliases:['AVRO'],icon:'🩵',color:'#06b6d4'},
  {ext:'JSONL',aliases:['JSONL','NDJSON'],icon:'💙',color:'#60a5fa'},
  {ext:'IPYNB',aliases:['IPYNB'],icon:'📓',color:'#f97316'},
];

const LangCtx = createContext(null);
const useLangCtx = () => useContext(LangCtx);

const weeklyData = [
  {day:'Mon',impressions:12400,clicks:890},{day:'Tue',impressions:18100,clicks:1340},
  {day:'Wed',impressions:14600,clicks:1050},{day:'Thu',impressions:22300,clicks:1780},
  {day:'Fri',impressions:25800,clicks:2100},{day:'Sat',impressions:19200,clicks:1420},
  {day:'Sun',impressions:13500,clicks:980},
];
const platformData = [
  {name:'Google Ads',value:38,color:'#4285f4'},{name:'Meta Ads',value:29,color:'#1877f2'},
  {name:'TikTok',value:18,color:'#ff0050'},{name:'LinkedIn',value:10,color:'#0077b5'},
  {name:'Twitter/X',value:5,color:'#1da1f2'},
];
const campaigns = [
  {id:'C-001',name:'Summer Sale 2025',platform:'Google Ads',status:'active',budget:5000,spent:3240,impressions:124500,ctr:'7.16%',roas:3.8},
  {id:'C-002',name:'Brand Awareness Q1',platform:'Meta Ads',status:'active',budget:8000,spent:5180,impressions:287000,ctr:'4.32%',roas:2.9},
  {id:'C-003',name:'Product Launch Beta',platform:'TikTok',status:'paused',budget:3500,spent:1890,impressions:98200,ctr:'5.53%',roas:4.2},
  {id:'C-004',name:'Retargeting Dec',platform:'Google Ads',status:'active',budget:2000,spent:1740,impressions:43100,ctr:'7.61%',roas:5.1},
];
const budgetData = [
  {day:'Mon',budget:1500,spend:1240},{day:'Tue',budget:1500,spend:1820},
  {day:'Wed',budget:1500,spend:1470},{day:'Thu',budget:1500,spend:2250},
  {day:'Fri',budget:1500,spend:2480},{day:'Sat',budget:1500,spend:1840},
];
const analyticsData = [
  {date:'Jan 1',impressions:11000,clicks:780,conversions:38},{date:'Jan 8',impressions:15200,clicks:1120,conversions:67},
  {date:'Jan 15',impressions:18700,clicks:1480,conversions:89},{date:'Jan 22',impressions:22100,clicks:1830,conversions:118},
  {date:'Jan 29',impressions:24800,clicks:2150,conversions:142},{date:'Feb 5',impressions:27300,clicks:2480,conversions:168},
];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Outfit',sans-serif;background:#060610;color:#e8e8f8;}
::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-thumb{background:#4c1d95;border-radius:2px;}
@keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{box-shadow:0 0 6px rgba(124,58,237,.4)}50%{box-shadow:0 0 18px rgba(124,58,237,.8)}}
.page{animation:fadeIn .3s ease forwards;}
.card{background:rgba(15,10,30,.85);border:1px solid rgba(124,58,237,.15);border-radius:16px;transition:all .2s;}
.card:hover{border-color:rgba(124,58,237,.35);transform:translateY(-1px);}
.nav-item{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;cursor:pointer;font-size:13px;font-weight:500;color:#64748b;transition:all .15s;}
.nav-item:hover{background:rgba(124,58,237,.1);color:#a78bfa;}
.nav-item.active{background:linear-gradient(135deg,rgba(124,58,237,.22),rgba(91,33,182,.12));color:#c4b5fd;border:1px solid rgba(124,58,237,.25);}
.btn{border:none;padding:9px 20px;border-radius:10px;font-family:'Outfit',sans-serif;font-weight:600;font-size:13px;cursor:pointer;transition:all .2s;}
.btn-primary{background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(124,58,237,.4);}
.btn-secondary{background:transparent;border:1px solid rgba(124,58,237,.3);color:#a78bfa;}
.btn-danger{background:linear-gradient(135deg,#dc2626,#991b1b);color:#fff;}
.btn-danger:hover{transform:translateY(-2px);}
.btn-success{background:linear-gradient(135deg,#059669,#065f46);color:#fff;}
.btn-success:hover{transform:translateY(-2px);}
.btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important;}
.drop-zone{border:2px dashed rgba(124,58,237,.3);border-radius:16px;background:rgba(124,58,237,.03);transition:all .2s;position:relative;}
.drop-zone.drag{border-color:#7c3aed;background:rgba(124,58,237,.08);}
.progress{height:4px;background:#1e1e35;border-radius:2px;overflow:hidden;}
.progress-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,#7c3aed,#06b6d4);transition:width .3s;}
.table-row{border-bottom:1px solid rgba(124,58,237,.07);transition:background .1s;}
.table-row:hover{background:rgba(124,58,237,.05);}
.badge{padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.5px;}
.tag{padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;}
.tag-up{background:rgba(16,185,129,.12);color:#10b981;}
.tag-down{background:rgba(239,68,68,.12);color:#ef4444;}
input,select,textarea{font-family:'Outfit',sans-serif;}
`;

function CustomTooltip({active,payload,label}){
  if(!active||!payload?.length) return null;
  return <div style={{background:'rgba(10,8,20,.97)',border:'1px solid rgba(124,58,237,.3)',borderRadius:10,padding:'10px 14px',fontSize:12}}>
    <div style={{color:'#a78bfa',fontWeight:700,marginBottom:4}}>{label}</div>
    {payload.map((p,i)=><div key={i} style={{display:'flex',gap:8,alignItems:'center',marginTop:2}}>
      <span style={{width:7,height:7,borderRadius:'50%',background:p.color,display:'inline-block'}}/>
      <span style={{color:'#64748b'}}>{p.name}:</span>
      <span style={{fontWeight:600,color:'#e8e8f8'}}>{typeof p.value==='number'?p.value.toLocaleString():p.value}</span>
    </div>)}
  </div>;
}

function KPI({title,value,prefix='',suffix='',change,icon,color,delay=0}){
  const [v,setV]=useState(0);
  useEffect(()=>{let s=null;const step=ts=>{if(!s)s=ts;const p=Math.min((ts-s)/1000,1);setV(Math.round(value*(1-Math.pow(1-p,3))));if(p<1)requestAnimationFrame(step);};requestAnimationFrame(step);},[value]);
  return <div className="card" style={{padding:20,borderTop:`2px solid ${color}20`,animationDelay:`${delay}ms`}}>
    <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
      <div style={{width:40,height:40,borderRadius:10,background:`${color}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{icon}</div>
      {change!==undefined&&<span className={`tag ${change>=0?'tag-up':'tag-down'}`}>{change>=0?'↑':'↓'}{Math.abs(change)}%</span>}
    </div>
    <div style={{fontSize:11,color:'#475569',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{title}</div>
    <div style={{fontSize:26,fontWeight:800,color:'#f0f0ff'}}>{prefix}{v.toLocaleString()}{suffix}</div>
  </div>;
}

function LanguageSelector(){
  const {lang,setLang}=useLangCtx();
  const [open,setOpen]=useState(false);
  const ref=useRef();
  const cur=SUPPORTED_LANGS.find(l=>l.code===lang)||SUPPORTED_LANGS[0];
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener('mousedown',h);
    return()=>document.removeEventListener('mousedown',h);
  },[]);
  return <div ref={ref} style={{position:'relative',zIndex:1000}}>
    <button className="btn btn-secondary" onClick={()=>setOpen(o=>!o)}
      style={{display:'flex',alignItems:'center',gap:6,padding:'5px 12px',fontSize:12}}>
      <span style={{fontSize:15}}>{cur.flag}</span>
      <span>{cur.code.toUpperCase()}</span>
      <span style={{fontSize:9,opacity:.6}}>{open?'▲':'▼'}</span>
    </button>
    {open&&<div style={{position:'absolute',right:0,top:'calc(100% + 6px)',
      background:'rgba(8,6,18,.99)',border:'1px solid rgba(124,58,237,.3)',
      borderRadius:14,padding:8,display:'grid',gridTemplateColumns:'1fr 1fr',gap:2,
      minWidth:220,boxShadow:'0 20px 40px rgba(0,0,0,.8)'}}>
      {SUPPORTED_LANGS.map(l=><button key={l.code}
        onClick={()=>{setLang(l.code);setOpen(false);}}
        style={{background:lang===l.code?'rgba(124,58,237,.2)':'transparent',
          border:lang===l.code?'1px solid rgba(124,58,237,.45)':'1px solid transparent',
          borderRadius:8,padding:'7px 10px',cursor:'pointer',
          display:'flex',alignItems:'center',gap:8,fontFamily:'inherit',textAlign:'left'}}>
        <span style={{fontSize:17}}>{l.flag}</span>
        <span style={{fontSize:12,fontWeight:600,color:lang===l.code?'#a78bfa':'#e8e8f8'}}>{l.label}</span>
      </button>)}
    </div>}
  </div>;
}

function DashboardPage(){
  const {tr}=useLangCtx();
  return <div className="page">
    <h1 style={{fontSize:28,fontWeight:900,background:'linear-gradient(135deg,#f0f0ff,#a78bfa)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:4}}>
      Performance Dashboard
    </h1>
    <p style={{color:'#475569',fontSize:13,marginBottom:24}}>Real-time AI-powered advertising insights</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
      <KPI title="Total Spend" value={48290} prefix="$" change={12.5} icon="💰" color="#7c3aed"/>
      <KPI title="Impressions" value={531200} change={8.3} icon="👁" color="#06b6d4" delay={60}/>
      <KPI title="Clicks" value={38940} change={15.2} icon="⚡" color="#a855f7" delay={120}/>
      <KPI title="Conversions" value={2847} change={22.1} icon="🎯" color="#f59e0b" delay={180}/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:14,marginBottom:14}}>
      <div className="card" style={{padding:20}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>Weekly Performance</div>
        <div style={{fontSize:12,color:'#475569',marginBottom:16}}>Impressions & clicks over 7 days</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={weeklyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,.07)"/>
            <XAxis dataKey="day" stroke="#334155" tick={{fill:'#64748b',fontSize:10}}/>
            <YAxis stroke="#334155" tick={{fill:'#64748b',fontSize:10}}/>
            <Tooltip content={<CustomTooltip/>}/>
            <Line type="monotone" dataKey="impressions" stroke="#7c3aed" strokeWidth={2.5} dot={{r:3}}/>
            <Line type="monotone" dataKey="clicks" stroke="#06b6d4" strokeWidth={2.5} dot={{r:3}}/>
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="card" style={{padding:20}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>Platform Split</div>
        <div style={{fontSize:12,color:'#475569',marginBottom:12}}>Ad spend distribution</div>
        <ResponsiveContainer width="100%" height={140}>
          <PieChart>
            <Pie data={platformData} cx="50%" cy="50%" innerRadius={38} outerRadius={62} dataKey="value" paddingAngle={3}>
              {platformData.map((e,i)=><Cell key={i} fill={e.color} opacity={.9}/>)}
            </Pie>
            <Tooltip content={<CustomTooltip/>}/>
          </PieChart>
        </ResponsiveContainer>
        {platformData.map((p,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:11,marginTop:4}}>
          <span style={{display:'flex',alignItems:'center',gap:5}}>
            <span style={{width:7,height:7,borderRadius:2,background:p.color,display:'inline-block'}}/>
            <span style={{color:'#94a3b8'}}>{p.name}</span>
          </span>
          <span style={{fontWeight:700}}>{p.value}%</span>
        </div>)}
      </div>
    </div>
    <div className="card" style={{padding:18}}>
      <div style={{fontWeight:700,marginBottom:12}}>🧠 AI-Generated Insights</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
        {[
          {icon:'🎯',title:'Peak Performance',desc:'Friday ads convert 34% better. Increase budget by $200 next Friday.',color:'#7c3aed'},
          {icon:'⚠️',title:'Anomaly Detected',desc:'TikTok CTR dropped 18% vs last week. Isolation Forest flagged this.',color:'#f59e0b'},
          {icon:'📈',title:'Growth Opportunity',desc:'LinkedIn B2B shows 5.1x ROAS. Scale budget +40%.',color:'#10b981'},
        ].map((ins,i)=><div key={i} style={{padding:12,borderRadius:12,background:`${ins.color}09`,border:`1px solid ${ins.color}20`}}>
          <div style={{fontSize:18,marginBottom:6}}>{ins.icon}</div>
          <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>{ins.title}</div>
          <div style={{fontSize:11,color:'#64748b',lineHeight:1.5}}>{ins.desc}</div>
        </div>)}
      </div>
    </div>
  </div>;
}

function CampaignsPage(){
  const [search,setSearch]=useState('');
  const filtered=campaigns.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||c.platform.toLowerCase().includes(search.toLowerCase()));
  const sc=s=>({active:'#10b981',paused:'#f59e0b',draft:'#94a3b8',completed:'#7c3aed'}[s]||'#94a3b8');
  const sb=s=>({active:'rgba(16,185,129,.12)',paused:'rgba(245,158,11,.12)',draft:'rgba(148,163,184,.12)',completed:'rgba(124,58,237,.12)'}[s]);
  return <div className="page">
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
      <div>
        <h1 style={{fontSize:28,fontWeight:900,background:'linear-gradient(135deg,#f0f0ff,#a78bfa)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Campaigns</h1>
        <p style={{color:'#475569',fontSize:13}}>Manage and track all advertising campaigns</p>
      </div>
      <div style={{display:'flex',gap:10}}>
        <input placeholder="Search campaigns..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{background:'rgba(124,58,237,.08)',border:'1px solid rgba(124,58,237,.2)',borderRadius:10,padding:'8px 14px',color:'#e8e8f8',fontSize:13,outline:'none',width:200}}/>
        <button className="btn btn-primary">+ New Campaign</button>
      </div>
    </div>
    <div className="card" style={{overflow:'hidden'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead>
          <tr style={{borderBottom:'1px solid rgba(124,58,237,.15)'}}>
            {['Campaign','Platform','Status','Budget','Spent','Impressions','CTR','ROAS',''].map((h,i)=><th key={i} style={{padding:'12px 16px',textAlign:'left',fontSize:10,fontWeight:700,color:'#475569',letterSpacing:.8,textTransform:'uppercase'}}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {filtered.map(c=><tr key={c.id} className="table-row">
            <td style={{padding:'12px 16px'}}><div style={{fontWeight:600}}>{c.name}</div><div style={{fontSize:10,color:'#475569'}}>{c.id}</div></td>
            <td style={{padding:'12px 16px',color:'#94a3b8'}}>{c.platform}</td>
            <td style={{padding:'12px 16px'}}><span className="badge" style={{background:sb(c.status),color:sc(c.status)}}>{c.status.toUpperCase()}</span></td>
            <td style={{padding:'12px 16px',color:'#94a3b8'}}>${c.budget.toLocaleString()}</td>
            <td style={{padding:'12px 16px',fontWeight:600}}>${c.spent.toLocaleString()}</td>
            <td style={{padding:'12px 16px',color:'#94a3b8'}}>{(c.impressions/1000).toFixed(1)}K</td>
            <td style={{padding:'12px 16px',color:'#94a3b8'}}>{c.ctr}</td>
            <td style={{padding:'12px 16px'}}><span style={{color:c.roas>=4?'#10b981':c.roas>=3?'#f59e0b':'#ef4444',fontWeight:700}}>{c.roas}x</span></td>
            <td style={{padding:'12px 16px'}}><button className="btn btn-secondary" style={{padding:'4px 10px',fontSize:11}}>Edit</button></td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </div>;
}

function BudgetPage(){
  return <div className="page">
    <h1 style={{fontSize:28,fontWeight:900,background:'linear-gradient(135deg,#f0f0ff,#a78bfa)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:4}}>Budget Management</h1>
    <p style={{color:'#475569',fontSize:13,marginBottom:24}}>Track and optimize your advertising spend</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
      <KPI title="Total Budget" value={28500} prefix="$" icon="💎" color="#7c3aed"/>
      <KPI title="Total Spent" value={18347} prefix="$" change={18.2} icon="📊" color="#10b981" delay={60}/>
      <KPI title="Remaining" value={10153} prefix="$" icon="🏦" color="#06b6d4" delay={120}/>
      <KPI title="Budget Used" value={64} suffix="%" icon="⚠️" color="#f59e0b" delay={180}/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:14}}>
      <div className="card" style={{padding:20}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>Daily Spend vs Budget</div>
        <div style={{fontSize:12,color:'#475569',marginBottom:16}}>Actual spend vs daily target</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={budgetData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,.07)"/>
            <XAxis dataKey="day" stroke="#334155" tick={{fill:'#64748b',fontSize:10}}/>
            <YAxis stroke="#334155" tick={{fill:'#64748b',fontSize:10}}/>
            <Tooltip content={<CustomTooltip/>}/>
            <Bar dataKey="spend" name="Actual Spend" fill="#7c3aed" radius={[4,4,0,0]} opacity={.85}/>
            <Bar dataKey="budget" name="Budget Target" fill="#1e1e35" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div className="card" style={{padding:18}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>By Platform</div>
          {[{name:'Google Ads',v:38,c:'#4285f4'},{name:'Meta Ads',v:29,c:'#1877f2'},{name:'TikTok',v:18,c:'#ff0050'},{name:'LinkedIn',v:10,c:'#0077b5'}].map((p,i)=><div key={i} style={{marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
              <span style={{color:'#94a3b8'}}>{p.name}</span>
              <span style={{fontWeight:700}}>${Math.round(18347*p.v/100).toLocaleString()}</span>
            </div>
            <div className="progress"><div className="progress-fill" style={{width:`${p.v}%`,background:p.c}}/></div>
          </div>)}
        </div>
        <div className="card" style={{padding:18,background:'linear-gradient(135deg,rgba(124,58,237,.1),rgba(16,185,129,.05))'}}>
          <div style={{fontWeight:700,color:'#a78bfa',marginBottom:8}}>🤖 AI Recommendation</div>
          <p style={{fontSize:12,color:'#64748b',lineHeight:1.6}}>Reallocate <strong style={{color:'#10b981'}}>$1,200</strong> from Meta to Google Ads. XGBoost estimates <strong style={{color:'#f59e0b'}}>+23% ROAS</strong>.</p>
          <button className="btn btn-primary" style={{marginTop:12,width:'100%',fontSize:12}}>Apply Suggestion</button>
        </div>
      </div>
    </div>
  </div>;
}

function AnalyticsPage(){
  return <div className="page">
    <h1 style={{fontSize:28,fontWeight:900,background:'linear-gradient(135deg,#f0f0ff,#a78bfa)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:4}}>Analytics</h1>
    <p style={{color:'#475569',fontSize:13,marginBottom:24}}>Deep-dive with ML-powered analysis</p>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
      <div className="card" style={{padding:20}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>Impressions Over Time</div>
        <div style={{fontSize:12,color:'#475569',marginBottom:14}}>Weekly trend</div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={analyticsData}>
            <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7c3aed" stopOpacity={.3}/><stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,.07)"/>
            <XAxis dataKey="date" stroke="#334155" tick={{fill:'#64748b',fontSize:9}}/>
            <YAxis stroke="#334155" tick={{fill:'#64748b',fontSize:9}}/>
            <Tooltip content={<CustomTooltip/>}/>
            <Area type="monotone" dataKey="impressions" stroke="#7c3aed" strokeWidth={2.5} fill="url(#g1)"/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="card" style={{padding:20}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>Conversions & Clicks</div>
        <div style={{fontSize:12,color:'#475569',marginBottom:14}}>Engagement funnel</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={analyticsData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,.07)"/>
            <XAxis dataKey="date" stroke="#334155" tick={{fill:'#64748b',fontSize:9}}/>
            <YAxis stroke="#334155" tick={{fill:'#64748b',fontSize:9}}/>
            <Tooltip content={<CustomTooltip/>}/>
            <Line type="monotone" dataKey="clicks" stroke="#06b6d4" strokeWidth={2.5} dot={{r:2}}/>
            <Line type="monotone" dataKey="conversions" stroke="#10b981" strokeWidth={2.5} dot={{r:2}}/>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
    <div className="card" style={{padding:18}}>
      <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>🧠 ML Models Active — TensorFlow · XGBoost · SHAP</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
        {[{name:'Churn Predictor',type:'XGBoost',acc:'87.3%',c:'#7c3aed'},{name:'Anomaly Detector',type:'Isolation Forest',acc:'94.1%',c:'#06b6d4'},{name:'Click Predictor',type:'Neural Net',acc:'82.7%',c:'#10b981'},{name:'ROAS Optimizer',type:'AutoML',acc:'91.2%',c:'#f59e0b'}].map((m,i)=><div key={i} style={{padding:12,borderRadius:12,background:`${m.c}09`,border:`1px solid ${m.c}20`}}>
          <div style={{fontSize:9,fontWeight:700,color:m.c,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>{m.type}</div>
          <div style={{fontWeight:600,fontSize:12,marginBottom:4}}>{m.name}</div>
          <div style={{fontSize:11,color:'#64748b'}}>Accuracy: <strong style={{color:m.c}}>{m.acc}</strong></div>
        </div>)}
      </div>
    </div>
  </div>;
}

function UploadPage(){
  const {tr}=useLangCtx();
  const [files,setFiles]=useState([]);
  const [drag,setDrag]=useState(false);
  const [processing,setProcessing]=useState(false);
  const [done,setDone]=useState(false);
  const MAX=10;

  const addFiles=useCallback((newFiles)=>{
    const toAdd=[...newFiles].slice(0,MAX-files.length);
    const objs=toAdd.map(f=>({
      id:Math.random().toString(36).slice(2),
      name:f.name, size:f.size,
      ext:f.name.split('.').pop().toUpperCase(),
      status:'ready', progress:0, rows:null,
    }));
    setFiles(prev=>[...prev,...objs].slice(0,MAX));
    setDone(false);
  },[files.length]);

  const onDrop=useCallback(e=>{e.preventDefault();setDrag(false);addFiles(e.dataTransfer.files);},[addFiles]);

  const process=()=>{
    if(!files.length) return;
    setProcessing(true);setDone(false);
    files.forEach((file,fi)=>{
      const total=Math.floor(Math.random()*900000)+50000;
      let done2=0;
      const iv=setInterval(()=>{
        done2=Math.min(done2+50000,total);
        const pct=Math.round(done2/total*100);
        setFiles(prev=>prev.map(f=>f.id===file.id?{...f,status:pct<100?'processing':'done',progress:pct,rows:pct>=100?total:done2}:f));
        if(pct>=100)clearInterval(iv);
      },180+fi*100);
    });
    setTimeout(()=>{setProcessing(false);setDone(true);},files.length*800+1000);
  };

  const typeColor=ext=>ACCEPTED_FORMATS.find(f=>f.aliases.includes(ext))?.color||'#94a3b8';
  const typeLabel=ext=>ACCEPTED_FORMATS.find(f=>f.aliases.includes(ext))?.ext||ext;
  const fmtSize=b=>b>1e6?`${(b/1e6).toFixed(1)} MB`:`${(b/1e3).toFixed(0)} KB`;

  return <div className="page">
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
      <div>
        <h1 style={{fontSize:28,fontWeight:900,background:'linear-gradient(135deg,#f0f0ff,#a78bfa)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{tr.upload.title}</h1>
        <p style={{color:'#475569',fontSize:13}}>Process up to 10M rows · Parallel processing</p>
      </div>
      <span style={{background:'rgba(6,182,212,.08)',border:'1px solid rgba(6,182,212,.2)',borderRadius:10,padding:'8px 14px',fontSize:12,color:'#06b6d4'}}>⚡ 10 files · 10M rows max</span>
    </div>

    <div className={`drop-zone${drag?' drag':''}`} style={{padding:36,textAlign:'center',marginBottom:16}}
      onDragOver={e=>{e.preventDefault();setDrag(true);}}
      onDragLeave={()=>setDrag(false)}
      onDrop={onDrop}>
      <input type="file" multiple
        accept=".csv,.xlsx,.xls,.json,.pdf,.xml,.tsv,.txt,.parquet,.avro,.jsonl,.ndjson,.ipynb"
        style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:0,cursor:'pointer'}}
        onChange={e=>{if(e.target.files?.length)addFiles(e.target.files);e.target.value='';}}
      />
      <div style={{fontSize:36,marginBottom:10}}>⤒</div>
      <div style={{fontWeight:700,fontSize:17,marginBottom:6}}>{drag?tr.upload.active:tr.upload.idle}</div>
      <div style={{color:'#475569',fontSize:13,marginBottom:14}}>or <span style={{color:'#7c3aed'}}>{tr.upload.browse}</span></div>
      <div style={{display:'flex',flexWrap:'wrap',justifyContent:'center',gap:6}}>
        {ACCEPTED_FORMATS.map(f=><span key={f.ext} style={{background:`${f.color}15`,border:`1px solid ${f.color}25`,color:f.color,padding:'3px 9px',borderRadius:7,fontSize:10,fontWeight:700}}>{f.icon} {f.ext}</span>)}
      </div>
    </div>

    {files.length>0&&<div className="card" style={{padding:18,marginBottom:14}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
        <div style={{fontWeight:700}}>Files ({files.length}/{MAX})</div>
        <div style={{fontSize:11,color:'#475569'}}>{files.filter(f=>f.status==='done').length} done · {files.filter(f=>f.status==='ready').length} ready</div>
      </div>
      {files.map(f=><div key={f.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid rgba(124,58,237,.07)'}}>
        <div style={{width:36,height:36,borderRadius:8,background:`${typeColor(f.ext)}15`,display:'flex',alignItems:'center',justifyContent:'center',color:typeColor(f.ext),fontWeight:800,fontSize:10,flexShrink:0}}>{typeLabel(f.ext)}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:600,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</div>
          <div style={{fontSize:11,color:'#475569',marginTop:2}}>{fmtSize(f.size)}{f.rows?` · ${f.rows.toLocaleString()} rows`:''}{f.status==='processing'?' · processing...':''}</div>
          {(f.status==='processing'||f.status==='done')&&<div className="progress" style={{marginTop:6}}>
            <div className="progress-fill" style={{width:`${f.progress}%`,background:f.status==='done'?'linear-gradient(90deg,#10b981,#06b6d4)':undefined}}/>
          </div>}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
          {f.status==='done'&&<span style={{color:'#10b981',fontSize:16}}>✓</span>}
          {f.status==='processing'&&<span style={{color:'#f59e0b',fontSize:11,fontWeight:700}}>{f.progress}%</span>}
          {f.status==='ready'&&<span style={{color:'#475569',fontSize:11}}>Ready</span>}
          <button onClick={()=>setFiles(p=>p.filter(x=>x.id!==f.id))}
            style={{background:'rgba(239,68,68,.08)',border:'none',color:'#ef4444',width:26,height:26,borderRadius:6,cursor:'pointer',fontSize:14}}>×</button>
        </div>
      </div>)}
    </div>}

    <div style={{display:'flex',gap:10,marginBottom:14}}>
      <button className="btn btn-success" onClick={process} disabled={!files.length||processing} style={{flex:1}}>
        {processing?'⟳ Processing...':tr.upload.process}
      </button>
      <button className="btn btn-danger" onClick={()=>{setFiles([]);setDone(false);}} disabled={!files.length||processing} style={{flex:1}}>
        {tr.upload.clear}
      </button>
      {done&&<button className="btn btn-secondary">↓ Export</button>}
    </div>

    {done&&<div style={{padding:14,borderRadius:12,background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.2)',display:'flex',gap:10,alignItems:'center'}}>
      <span style={{fontSize:22}}>✅</span>
      <div>
        <div style={{fontWeight:700,color:'#10b981'}}>{tr.upload.done}</div>
        <div style={{fontSize:12,color:'#065f46'}}>{files.length} files · {files.reduce((s,f)=>s+(f.rows||0),0).toLocaleString()} total rows · Ready for ML pipeline</div>
      </div>
    </div>}
  </div>;
}

function CreateAdPage(){
  const [platform,setPlatform]=useState('Google Ads');
  const [headline,setHeadline]=useState('');
  const [body,setBody]=useState('');
  const [loading,setLoading]=useState(false);
  const gen=()=>{setLoading(true);setTimeout(()=>{setHeadline('Boost Your Business with Smart AI Advertising');setBody('Reach ideal customers with precision targeting. Powered by ML for maximum ROI.');setLoading(false);},800);};
  return <div className="page">
    <h1 style={{fontSize:28,fontWeight:900,background:'linear-gradient(135deg,#f0f0ff,#a78bfa)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:4}}>Create New Ad</h1>
    <p style={{color:'#475569',fontSize:13,marginBottom:24}}>AI-powered ad creation with automatic optimization</p>
    <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:16}}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div className="card" style={{padding:20}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>Campaign Settings</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            {[{label:'Platform',value:platform,setter:setPlatform,opts:['Google Ads','Meta Ads','TikTok','LinkedIn','Twitter/X']},
              {label:'Objective',value:'Conversions',setter:()=>{},opts:['Conversions','Awareness','Traffic','Leads']}].map((f,i)=><div key={i}>
              <label style={{fontSize:11,color:'#475569',display:'block',marginBottom:5,fontWeight:600}}>{f.label}</label>
              <select value={f.value} onChange={e=>f.setter(e.target.value)} style={{width:'100%',background:'rgba(124,58,237,.08)',border:'1px solid rgba(124,58,237,.2)',borderRadius:9,padding:'9px 12px',color:'#e8e8f8',fontSize:13,outline:'none'}}>
                {f.opts.map(o=><option key={o} style={{background:'#0f0f1a'}}>{o}</option>)}
              </select>
            </div>)}
          </div>
        </div>
        <div className="card" style={{padding:20}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div style={{fontWeight:700,fontSize:14}}>Ad Copy</div>
            <button className="btn btn-primary" style={{fontSize:11,padding:'6px 14px'}} onClick={gen}>{loading?'Generating...':'🤖 AI Generate'}</button>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{fontSize:11,color:'#475569',display:'block',marginBottom:5,fontWeight:600}}>Headline</label>
            <input value={headline} onChange={e=>setHeadline(e.target.value)} placeholder="Enter your ad headline..."
              style={{width:'100%',background:'rgba(124,58,237,.08)',border:'1px solid rgba(124,58,237,.2)',borderRadius:9,padding:'10px 12px',color:'#e8e8f8',fontSize:13,outline:'none'}}/>
          </div>
          <div>
            <label style={{fontSize:11,color:'#475569',display:'block',marginBottom:5,fontWeight:600}}>Body Text</label>
            <textarea value={body} onChange={e=>setBody(e.target.value)} rows={3} placeholder="Enter ad body text..."
              style={{width:'100%',background:'rgba(124,58,237,.08)',border:'1px solid rgba(124,58,237,.2)',borderRadius:9,padding:'10px 12px',color:'#e8e8f8',fontSize:13,outline:'none',resize:'vertical'}}/>
          </div>
        </div>
        <button className="btn btn-primary" style={{padding:14,fontSize:14,fontWeight:700}}>🚀 Launch Campaign</button>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div className="card" style={{padding:18}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Ad Preview</div>
          <div style={{background:'#fff',borderRadius:9,padding:14,color:'#111'}}>
            <div style={{fontSize:10,color:'#666',marginBottom:3}}>Sponsored</div>
            <div style={{fontWeight:700,color:'#1a0dab',fontSize:13,marginBottom:4}}>{headline||'Your Ad Headline Here'}</div>
            <div style={{fontSize:12,color:'#555',lineHeight:1.5}}>{body||'Your ad body text will appear here.'}</div>
          </div>
        </div>
        <div className="card" style={{padding:18}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>🤖 AI Optimization Score</div>
          {[{label:'Relevance',score:82},{label:'CTR Prediction',score:76},{label:'Quality Score',score:91},{label:'Targeting Match',score:88}].map((item,i)=><div key={i} style={{marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:4}}>
              <span style={{color:'#94a3b8'}}>{item.label}</span>
              <span style={{fontWeight:700,color:item.score>85?'#10b981':'#f59e0b'}}>{item.score}/100</span>
            </div>
            <div className="progress"><div className="progress-fill" style={{width:`${item.score}%`,background:item.score>85?'linear-gradient(90deg,#10b981,#06b6d4)':'linear-gradient(90deg,#f59e0b,#f97316)'}}/></div>
          </div>)}
        </div>
      </div>
    </div>
  </div>;
}

export default function LumindAd(){
  const [lang,setLang]=useState('en');
  const [page,setPage]=useState('dashboard');
  const tr=LANGS[lang]||LANGS.en;

  useEffect(()=>{
    document.documentElement.dir=tr.rtl?'rtl':'ltr';
    document.documentElement.lang=lang;
  },[lang,tr]);

  const pages={dashboard:<DashboardPage/>,campaigns:<CampaignsPage/>,budget:<BudgetPage/>,analytics:<AnalyticsPage/>,upload:<UploadPage/>,create:<CreateAdPage/>};
  const navItems=[
    {id:'dashboard',icon:'⊞'},{id:'create',icon:'✦'},{id:'campaigns',icon:'◎'},
    {id:'budget',icon:'◈'},{id:'analytics',icon:'◫'},{id:'upload',icon:'⤒'},
  ];
  const navLabels={dashboard:tr.nav.dashboard,create:tr.nav.createAd,campaigns:tr.nav.campaigns,budget:tr.nav.budget,analytics:tr.nav.analytics,upload:tr.nav.upload};

  return <LangCtx.Provider value={{lang,setLang,tr}}>
    <div style={{display:'flex',height:'100vh',background:'#060610',fontFamily:"'Outfit',sans-serif",overflow:'hidden'}}>
      <style>{CSS}</style>
      {/* SIDEBAR */}
      <aside style={{width:220,height:'100vh',background:'rgba(6,4,18,.97)',borderRight:'1px solid rgba(124,58,237,.12)',display:'flex',flexDirection:'column',padding:'18px 10px',position:'fixed',left:0,top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'6px 8px',marginBottom:24}}>
          <div style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#7c3aed,#5b21b6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,boxShadow:'0 4px 14px rgba(124,58,237,.5)'}}>✦</div>
          <div>
            <div style={{fontWeight:800,fontSize:15,background:'linear-gradient(135deg,#c4b5fd,#7c3aed)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>LumindAd</div>
            <div style={{fontSize:9,color:'#4c1d95'}}>v1.0.0 · ENTERPRISE</div>
          </div>
        </div>
        <div style={{fontSize:9,color:'#3d3d60',fontWeight:700,letterSpacing:1.5,padding:'0 8px',marginBottom:8}}>NAVIGATION</div>
        <nav style={{display:'flex',flexDirection:'column',gap:2}}>
          {navItems.map(item=><div key={item.id} className={`nav-item${page===item.id?' active':''}`} onClick={()=>setPage(item.id)}>
            <span style={{fontSize:14,width:18,textAlign:'center'}}>{item.icon}</span>
            <span>{navLabels[item.id]}</span>
            {item.id==='upload'&&<span style={{marginLeft:'auto',background:'rgba(6,182,212,.15)',color:'#06b6d4',padding:'1px 6px',borderRadius:8,fontSize:9,fontWeight:700}}>NEW</span>}
          </div>)}
        </nav>
        <div style={{margin:'16px 3px',padding:12,borderRadius:11,background:'linear-gradient(135deg,rgba(124,58,237,.1),rgba(6,182,212,.06))',border:'1px solid rgba(124,58,237,.18)'}}>
          <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:6}}>
            <span>🤖</span><span style={{fontSize:11,fontWeight:700,color:'#a78bfa'}}>AI Engine</span>
            <span style={{marginLeft:'auto',width:6,height:6,borderRadius:'50%',background:'#10b981',animation:'pulse 2s infinite'}}/>
          </div>
          <div style={{fontSize:10,color:'#64748b',lineHeight:1.5}}>TensorFlow · XGBoost<br/>SHAP · Anomaly Detection</div>
        </div>
        <div style={{margin:'0 3px 12px',padding:10,borderRadius:11,background:'rgba(16,185,129,.06)',border:'1px solid rgba(16,185,129,.14)'}}>
          <div style={{display:'flex',alignItems:'center',gap:7}}>
            <span>🌱</span>
            <div><div style={{fontSize:10,fontWeight:700,color:'#10b981'}}>Green AI</div><div style={{fontSize:9,color:'#047857'}}>0.003 gCO₂ · Scope 2</div></div>
          </div>
        </div>
        <div style={{marginTop:'auto',display:'flex',alignItems:'center',gap:8,padding:10,borderRadius:10,border:'1px solid rgba(124,58,237,.1)',background:'rgba(124,58,237,.04)',cursor:'pointer'}}>
          <div style={{width:30,height:30,borderRadius:8,background:'linear-gradient(135deg,#7c3aed,#5b21b6)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:12}}>E</div>
          <div><div style={{fontSize:12,fontWeight:600,color:'#c4b5fd'}}>Elizabeth D.F.</div><div style={{fontSize:9,color:'#4c1d95'}}>Sustainable AI</div></div>
        </div>
      </aside>
      {/* MAIN */}
      <div style={{marginLeft:220,flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {/* TOPBAR */}
        <div style={{height:50,borderBottom:'1px solid rgba(124,58,237,.1)',background:'rgba(6,4,18,.97)',display:'flex',alignItems:'center',padding:'0 24px',gap:10,flexShrink:0}}>
          <div style={{flex:1,display:'flex',gap:6}}>
            {navItems.map(({id})=><button key={id} onClick={()=>setPage(id)}
              style={{background:'none',border:'none',color:page===id?'#a78bfa':'#334155',cursor:'pointer',fontSize:12,fontWeight:600,padding:'3px 9px',borderRadius:6,borderBottom:page===id?'2px solid #7c3aed':'2px solid transparent',fontFamily:'inherit'}}>
              {navLabels[id]}
            </button>)}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <span style={{fontSize:10,color:'#10b981',display:'flex',alignItems:'center',gap:4}}>
              <span style={{width:5,height:5,borderRadius:'50%',background:'#10b981',display:'inline-block'}}/>AI Online
            </span>
            <div style={{width:1,height:14,background:'rgba(124,58,237,.2)'}}/>
            <LanguageSelector/>
          </div>
        </div>
        {/* PAGE */}
        <main style={{flex:1,overflowY:'auto',padding:24,background:'radial-gradient(ellipse at 20% 0%,rgba(124,58,237,.05) 0%,transparent 60%)'}}>
          {pages[page]||<DashboardPage/>}
        </main>
        {/* FOOTER */}
        <footer style={{borderTop:'1px solid rgba(124,58,237,.1)',padding:'12px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',background:'rgba(6,4,18,.97)',flexShrink:0,fontSize:11}}>
          <span style={{color:'#2d2050'}}>© 2025 <span style={{color:'#7c3aed',fontWeight:600}}>Elizabeth Díaz Familia</span> · LumindAd Enterprise · Python · TensorFlow · React</span>
          <div style={{display:'flex',gap:14,color:'#2d2050'}}>
            <span style={{color:'#10b981'}}>🌱 Green AI</span>
            <span>i18n 11 langs</span>
            <span>v1.0.0 Enterprise</span>
          </div>
        </footer>
      </div>
    </div>
  </LangCtx.Provider>;
}
