const express = require('express');
const router = express.Router();

/**
 * Route pour obtenir le statut Discord
 * GET /discord-status
 */
router.get('/discord-status', (req, res) => {
  try {
    const { getCachedPresence } = require('../services/discord');
    const discordClient = req.app.locals.discordClient;
    const cachedPresence = getCachedPresence();
    
    // Vérifier si le bot est connecté
    if (!discordClient || !discordClient.isReady()) {
      return res.json({
        user: null,
        status: 'offline',
        activities: [],
        voiceState: null,
        botReady: false,
        message: 'Bot Discord en cours de connexion...'
      });
    }
    
    // Si cachedPresence n'a pas encore d'utilisateur, retourner un état par défaut
    if (!cachedPresence || !cachedPresence.user) {
      return res.json({
        user: null,
        status: 'offline',
        activities: [],
        voiceState: null,
        botReady: true,
        message: 'Utilisateur non trouvé ou bot en cours d\'initialisation'
      });
    }
    
    res.json({
      ...cachedPresence,
      botReady: true
    });
  } catch (error) {
    console.error('❌ Erreur endpoint /discord-status:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: error.message,
      botReady: req.app.locals.discordClient?.isReady() || false
    });
  }
});

module.exports = router;

