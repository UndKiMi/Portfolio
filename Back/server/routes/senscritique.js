const express = require('express');
const router = express.Router();
const { fetchSensCritiqueProfile } = require('../services/senscritique-scraper');
const monitoring = require('../services/monitoring');

const SC_CACHE_DURATION = 3600000; // 1 heure
let cachedSensCritique = null;
let lastSCFetch = 0;

/**
 * Route pour vider le cache (debug)
 * GET /senscritique/clear-cache
 */
router.get('/senscritique/clear-cache', (req, res) => {
  cachedSensCritique = null;
  lastSCFetch = 0;
  console.log('🗑️  [SensCritique] Cache vidé');
  res.json({ success: true, message: 'Cache SensCritique vidé' });
});

/**
 * Route pour consulter les statistiques de monitoring
 * GET /senscritique/stats
 */
router.get('/senscritique/stats', (req, res) => {
  try {
    const stats = monitoring.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Erreur récupération stats', message: error.message });
  }
});

/**
 * Route principale pour obtenir les données SensCritique
 * GET /senscritique
 */
router.get('/senscritique', async (req, res) => {
  try {
    const now = Date.now();
    
    // Paramètres de pagination et filtrage
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const type = req.query.type; // 'film', 'serie', 'jeu'
    
    // Validation des paramètres
    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        error: 'Paramètre invalide',
        message: 'La limite doit être entre 1 et 100'
      });
    }
    
    if (offset < 0) {
      return res.status(400).json({
        error: 'Paramètre invalide',
        message: 'L\'offset doit être positif'
      });
    }
    
    // Vérifier le cache d'abord (1 heure), sauf si force=true
    const forceRefresh = req.query.force === 'true';
    
    if (!forceRefresh && cachedSensCritique && (now - lastSCFetch) < SC_CACHE_DURATION) {
      console.log('📦 [SensCritique] Cache utilisé - pas de scraping');
      
      // Logger le hit de cache
      monitoring.logCacheHit();
      
      if (cachedSensCritique.reviews && Array.isArray(cachedSensCritique.reviews) && cachedSensCritique.reviews.length > 0) {
        // Appliquer pagination et filtrage
        let reviews = cachedSensCritique.reviews;
        
        // Filtrer par type si demandé
        if (type) {
          reviews = reviews.filter(r => r.url && r.url.includes(`/${type}/`));
        }
        
        // Paginer
        const totalReviews = reviews.length;
        const paginatedReviews = reviews.slice(offset, offset + limit);
        
        return res.json({
          ...cachedSensCritique,
          reviews: paginatedReviews,
          pagination: {
            total: totalReviews,
            limit,
            offset,
            hasMore: (offset + limit) < totalReviews,
            page: Math.floor(offset / limit) + 1,
            totalPages: Math.ceil(totalReviews / limit)
          }
        });
      } else {
        console.log('⚠️  [SensCritique] Cache invalide, rechargement...');
      }
    }
    
    if (forceRefresh) {
      console.log('🔄 [SensCritique] Force refresh demandé');
    }
    
    console.log('🎬 [SensCritique] Démarrage du scraping Puppeteer...');
    const startTime = Date.now();
    
    // Appel direct du scraper Puppeteer optimisé (cache interne désactivé)
    const profile = await fetchSensCritiqueProfile('KiMi_', {
      loadReviews: true,
      loadFavorites: true,
      useCache: false // Désactiver le cache interne, le serveur gère son propre cache
    });
    
    const scrapingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⏱️  [SensCritique] Scraping terminé en ${scrapingTime}s`);
    
    // Valider les données
    if (!profile.reviews || !Array.isArray(profile.reviews)) {
      console.warn('⚠️  [SensCritique] Aucune critique trouvée, initialisation à tableau vide');
      profile.reviews = [];
    }
    
    const reviewsCount = profile.reviews.length;
    console.log(`✅ [SensCritique] ${reviewsCount} critique(s) récupérée(s)`);
    
    // Logger le scraping avec monitoring
    monitoring.logScrapingCall(scrapingTime, reviewsCount);
    
    // Sauvegarder en cache
    cachedSensCritique = profile;
    lastSCFetch = now;
    
    // Appliquer pagination et filtrage
    let reviews = profile.reviews;
    
    // Filtrer par type si demandé
    if (type) {
      reviews = reviews.filter(r => r.url && r.url.includes(`/${type}/`));
    }
    
    // Paginer
    const totalReviews = reviews.length;
    const paginatedReviews = reviews.slice(offset, offset + limit);
    
    res.json({
      ...profile,
      reviews: paginatedReviews,
      pagination: {
        total: totalReviews,
        limit,
        offset,
        hasMore: (offset + limit) < totalReviews,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(totalReviews / limit)
      }
    });
    
  } catch (error) {
    console.error('❌ [SensCritique] Erreur scraping:', error.message);
    console.error('📍 [SensCritique] Stack:', error.stack);
    
    // Logger l'erreur
    monitoring.logError(error, 'senscritique_endpoint');
    
    // Réponse avec fallback en cas d'erreur
    res.status(500).json({
      error: 'Impossible de récupérer le profil',
      message: error.message,
      fallback: {
        username: 'KiMi_',
        gender: 'Homme',
        location: 'France',
        age: null,
        stats: { films: 32, series: 17, jeux: 19, livres: 0, total: 68 },
        collections: [
          { title: 'Ratatouille', image: 'https://media.senscritique.com/media/000007069038/300/ratatouille.jpg' },
          { title: 'The Rain', image: 'https://media.senscritique.com/media/000017755889/300/the_rain.jpg' },
          { title: 'Star Citizen', image: 'https://media.senscritique.com/media/000020208505/300/star_citizen.png' }
        ],
        reviews: [],
        profileUrl: 'https://www.senscritique.com/KiMi_',
        avatar: 'https://media.senscritique.com/media/media/000022812759/48x48/avatar.jpg'
      }
    });
  }
});

module.exports = router;

