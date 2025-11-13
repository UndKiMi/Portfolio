/**
 * Système de monitoring persistant pour le scraping SensCritique
 * Enregistre tous les appels, performances et erreurs
 */

const fs = require('fs');
const path = require('path');

const MONITORING_FILE = path.join(__dirname, 'monitoring.json');

// Structure par défaut
const defaultMonitoring = {
  totalRequests: 0,
  scrapingRequests: 0,
  cacheHits: 0,
  errors: [],
  lastScrapingTimes: [],
  alerts: []
};

/**
 * Charge les données de monitoring
 */
function loadMonitoring() {
  try {
    if (fs.existsSync(MONITORING_FILE)) {
      const data = fs.readFileSync(MONITORING_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('❌ [Monitoring] Erreur chargement:', error.message);
  }
  return { ...defaultMonitoring };
}

/**
 * Sauvegarde les données de monitoring
 */
function saveMonitoring(data) {
  try {
    fs.writeFileSync(MONITORING_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('❌ [Monitoring] Erreur sauvegarde:', error.message);
  }
}

/**
 * Enregistre un appel scraping
 */
function logScrapingCall(duration, reviewsCount, error = null) {
  const monitoring = loadMonitoring();
  
  monitoring.totalRequests++;
  monitoring.scrapingRequests++;
  
  // Ajouter les temps de scraping (garder les 50 derniers)
  monitoring.lastScrapingTimes.push({
    timestamp: new Date().toISOString(),
    duration: parseFloat(duration),
    reviewsCount
  });
  
  if (monitoring.lastScrapingTimes.length > 50) {
    monitoring.lastScrapingTimes = monitoring.lastScrapingTimes.slice(-50);
  }
  
  // Enregistrer les erreurs (garder les 100 dernières)
  if (error) {
    monitoring.errors.push({
      timestamp: new Date().toISOString(),
      error: error.message || error,
      type: 'scraping'
    });
    
    if (monitoring.errors.length > 100) {
      monitoring.errors = monitoring.errors.slice(-100);
    }
  }
  
  // Alerte si 0 critiques
  if (reviewsCount === 0) {
    const alert = {
      timestamp: new Date().toISOString(),
      type: 'ZERO_REVIEWS',
      message: '🚨 ALERTE : 0 critiques extraites - Vérifier structure HTML SensCritique'
    };
    
    monitoring.alerts.push(alert);
    
    if (monitoring.alerts.length > 50) {
      monitoring.alerts = monitoring.alerts.slice(-50);
    }
    
    console.error(`🚨 [SensCritique] ALERTE : 0 critiques extraites. Vérifier la structure HTML !`);
    console.error(`📊 [Monitoring] Alerte enregistrée: ${alert.timestamp}`);
    
    // Notification Discord (si webhook configuré)
    sendDiscordAlert(alert);
  }
  
  saveMonitoring(monitoring);
  
  // Log résumé
  console.log(`📊 [Monitoring] Stats: ${monitoring.totalRequests} requêtes | ${monitoring.scrapingRequests} scraping | ${monitoring.cacheHits} cache`);
  
  return monitoring;
}

/**
 * Enregistre un hit de cache
 */
function logCacheHit() {
  const monitoring = loadMonitoring();
  
  monitoring.totalRequests++;
  monitoring.cacheHits++;
  
  saveMonitoring(monitoring);
  
  return monitoring;
}

/**
 * Enregistre une erreur générale
 */
function logError(error, context = 'general') {
  const monitoring = loadMonitoring();
  
  monitoring.errors.push({
    timestamp: new Date().toISOString(),
    error: error.message || error,
    type: context,
    stack: error.stack
  });
  
  if (monitoring.errors.length > 100) {
    monitoring.errors = monitoring.errors.slice(-100);
  }
  
  saveMonitoring(monitoring);
  
  return monitoring;
}

/**
 * Récupère les statistiques de monitoring
 */
function getStats() {
  const monitoring = loadMonitoring();
  
  // Calculer la durée moyenne de scraping
  let avgDuration = 0;
  if (monitoring.lastScrapingTimes.length > 0) {
    const sum = monitoring.lastScrapingTimes.reduce((acc, t) => acc + t.duration, 0);
    avgDuration = (sum / monitoring.lastScrapingTimes.length).toFixed(2);
  }
  
  // Taux de cache
  const cacheRate = monitoring.totalRequests > 0 
    ? ((monitoring.cacheHits / monitoring.totalRequests) * 100).toFixed(1)
    : 0;
  
  return {
    ...monitoring,
    stats: {
      avgScrapingDuration: parseFloat(avgDuration),
      cacheHitRate: parseFloat(cacheRate),
      errorRate: monitoring.totalRequests > 0
        ? ((monitoring.errors.length / monitoring.totalRequests) * 100).toFixed(1)
        : 0,
      lastScraping: monitoring.lastScrapingTimes[monitoring.lastScrapingTimes.length - 1] || null,
      recentAlerts: monitoring.alerts.slice(-5) || []
    }
  };
}

/**
 * Envoie une alerte Discord (si webhook configuré)
 */
function sendDiscordAlert(alert) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('ℹ️  [Monitoring] Pas de webhook Discord configuré (DISCORD_WEBHOOK_URL)');
    return;
  }
  
  const https = require('https');
  const url = require('url');
  
  const payload = JSON.stringify({
    embeds: [{
      title: '🚨 Alerte SensCritique',
      description: alert.message,
      color: 0xFF0000, // Rouge
      fields: [
        {
          name: 'Timestamp',
          value: alert.timestamp,
          inline: true
        },
        {
          name: 'Type',
          value: alert.type,
          inline: true
        }
      ],
      footer: {
        text: 'Monitoring SensCritique'
      }
    }]
  });
  
  const parsedUrl = new URL(webhookUrl);
  
  const options = {
    hostname: parsedUrl.hostname,
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };
  
  const req = https.request(options, (res) => {
    if (res.statusCode === 204) {
      console.log('✅ [Monitoring] Alerte Discord envoyée');
    } else {
      console.error(`⚠️  [Monitoring] Discord webhook status: ${res.statusCode}`);
    }
  });
  
  req.on('error', (error) => {
    console.error('❌ [Monitoring] Erreur envoi Discord:', error.message);
  });
  
  req.write(payload);
  req.end();
}

/**
 * Réinitialise les statistiques
 */
function resetStats() {
  saveMonitoring({ ...defaultMonitoring });
  console.log('🔄 [Monitoring] Statistiques réinitialisées');
}

module.exports = {
  logScrapingCall,
  logCacheHit,
  logError,
  getStats,
  resetStats
};

