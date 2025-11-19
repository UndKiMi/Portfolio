const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

// Import des routes
const discordRoutes = require('./server/routes/discord');
const githubRoutes = require('./server/routes/github');
const senscritiqueRoutes = require('./server/routes/senscritique');

// Import des services
const { initializeDiscord, getCachedPresence } = require('./server/services/discord');

const app = express();
const PORT = process.env.PORT || 3000;
const STATIC_MAX_AGE = process.env.STATIC_MAX_AGE || '24h';

app.disable('x-powered-by');

// CORS - Configuration améliorée
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://qkimi.fr',
      'http://sc4os480g8csw0cc8sow8g44.151.240.19.146.sslip.io',
      '44.151.240.19.146',
      'http://qkimi.fr',
      'qkimi.fr',
      'http://localhost:5173', // Vite dev server
    ];
    
    if (allowedOrigins.some(allowed => origin === allowed || origin.startsWith(allowed))) {
      callback(null, true);
    } else {
      console.log(`⚠️  Origine CORS non autorisée: ${origin}`);
      callback(null, true); // Autoriser pour le debug
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Compression gzip
app.use(compression());

// Cache HTTP pour les fichiers statiques
app.use(express.static('.', { 
  maxAge: STATIC_MAX_AGE,
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.match(/\.(html)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// Route de santé (doit être avant les autres routes)
app.get('/health', (req, res) => {
  console.log('🏥 Health check appelé');
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Initialisation du bot Discord (non-bloquant)
let discordClient;
setImmediate(() => {
  try {
    discordClient = initializeDiscord();
    app.locals.discordClient = discordClient;
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation Discord:', error.message);
    console.log('⚠️  Le serveur continuera sans Discord');
  }
});

// Middleware pour partager les données Discord avec les routes
app.use((req, res, next) => {
  req.app.locals.discordClient = discordClient;
  next();
});

// Routes API
app.use('/', discordRoutes);
app.use('/', githubRoutes);
app.use('/', senscritiqueRoutes);

// Démarrage du serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Serveur lancé sur http://0.0.0.0:${PORT}`);
  console.log(`📡 Endpoint Discord: http://0.0.0.0:${PORT}/discord-status`);
  console.log(`📡 Endpoint GitHub: http://0.0.0.0:${PORT}/github`);
  console.log(`📡 Endpoint SensCritique: http://0.0.0.0:${PORT}/senscritique`);
  console.log(`📡 Endpoint Health: http://0.0.0.0:${PORT}/health`);
  console.log(`\n💡 Serveur prêt à recevoir des requêtes\n`);
});
