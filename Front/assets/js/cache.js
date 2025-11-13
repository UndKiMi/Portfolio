/**
 * Système de cache côté client avec localStorage
 * Permet de garder les données entre les recharges de page
 */

const CacheManager = {
  // Durées de cache personnalisées par type de données
  CACHE_DURATIONS: {
    discord_data: 10 * 60 * 1000,      // 10 minutes
    github_data: 10 * 60 * 1000,       // 10 minutes
    github_projects: 24 * 60 * 60 * 1000, // 1 jour
    senscritique_data: 60 * 60 * 1000  // 1 heure
  },
  
  /**
   * Récupère les données du cache localStorage
   * @param {string} key - Clé du cache
   * @returns {any|null} Données en cache ou null si expiré/inexistant
   */
  get(key) {
    try {
      const cached = localStorage.getItem(`portfolio_${key}`);
      if (!cached) return null;
      
      const data = JSON.parse(cached);
      const now = Date.now();
      
      // Récupérer la durée de cache spécifique pour cette clé
      const cacheDuration = this.CACHE_DURATIONS[key] || (10 * 60 * 1000);
      
      // Vérifier si le cache est encore valide
      if (data.timestamp && (now - data.timestamp) < cacheDuration) {
        const ageSeconds = Math.round((now - data.timestamp) / 1000);
        const ageMinutes = Math.round(ageSeconds / 60);
        const timeDisplay = ageMinutes > 0 ? `${ageMinutes}min` : `${ageSeconds}s`;
        console.log(`✅ [Cache] "${key}" récupéré (${timeDisplay}) - Pas besoin d'appel API`);
        return data.value;
      } else {
        const ageMinutes = Math.round((now - data.timestamp) / 60000);
        console.log(`⏰ [Cache] "${key}" expiré (${ageMinutes}min)`);
        localStorage.removeItem(`portfolio_${key}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ [Cache] Erreur lecture "${key}":`, error);
      return null;
    }
  },
  
  /**
   * Sauvegarde les données dans le cache localStorage
   * @param {string} key - Clé du cache
   * @param {any} value - Valeur à cacher
   */
  set(key, value) {
    try {
      const data = {
        timestamp: Date.now(),
        value: value
      };
      localStorage.setItem(`portfolio_${key}`, JSON.stringify(data));
      
      // Afficher la durée de validité selon le type
      const duration = this.CACHE_DURATIONS[key] || (10 * 60 * 1000);
      const durationMinutes = Math.round(duration / 60000);
      const durationDisplay = durationMinutes >= 60 ? `${Math.round(durationMinutes / 60)}h` : `${durationMinutes}min`;
      
      console.log(`💾 [Cache] "${key}" sauvegardé - Valide pendant ${durationDisplay}`);
    } catch (error) {
      console.error(`❌ [Cache] Erreur sauvegarde "${key}":`, error);
      // Si localStorage est plein, vider le cache
      if (error.name === 'QuotaExceededError') {
        console.warn('⚠️  [Cache] localStorage plein, nettoyage...');
        this.clearAll();
      }
    }
  },
  
  /**
   * Vide tout le cache localStorage du portfolio
   */
  clearAll() {
    try {
      const keys = ['discord_data', 'github_data', 'senscritique_data'];
      keys.forEach(key => localStorage.removeItem(`portfolio_${key}`));
      console.log('🗑️  [Cache] Cache localStorage vidé');
    } catch (error) {
      console.error('❌ [Cache] Erreur vidage cache:', error);
    }
  },
  
  /**
   * Affiche les statistiques du cache
   */
  getStats() {
    const keys = ['discord_data', 'github_data', 'github_projects', 'senscritique_data'];
    const stats = {};
    
    keys.forEach(key => {
      const cached = localStorage.getItem(`portfolio_${key}`);
      if (cached) {
        try {
          const data = JSON.parse(cached);
          const cacheDuration = this.CACHE_DURATIONS[key] || (10 * 60 * 1000);
          const ageSeconds = Math.round((Date.now() - data.timestamp) / 1000);
          const ageMinutes = Math.round(ageSeconds / 60);
          const remainingMs = Math.max(0, cacheDuration - (Date.now() - data.timestamp));
          const remainingMinutes = Math.round(remainingMs / 60000);
          
          stats[key] = {
            exists: true,
            age: ageMinutes >= 1 ? `${ageMinutes}min` : `${ageSeconds}s`,
            remaining: remainingMinutes >= 1 ? `${remainingMinutes}min` : `${Math.round(remainingMs / 1000)}s`,
            size: (new Blob([cached]).size / 1024).toFixed(2) + ' KB',
            duration: Math.round(cacheDuration / 60000) >= 60 ? `${Math.round(cacheDuration / 3600000)}h` : `${Math.round(cacheDuration / 60000)}min`
          };
        } catch (e) {
          stats[key] = { exists: true, error: 'Invalid JSON' };
        }
      } else {
        stats[key] = { exists: false };
      }
    });
    
    return stats;
  }
};

// Exposer globalement
window.CacheManager = CacheManager;

// Ajouter un raccourci pour forcer le refresh (Ctrl+Shift+R)
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'R') {
    e.preventDefault();
    console.log('🔄 Force refresh demandé - Vidage du cache...');
    CacheManager.clearAll();
    location.reload();
  }
});

// Log des stats au chargement
console.log('📊 [Cache] Stats localStorage:', CacheManager.getStats());

