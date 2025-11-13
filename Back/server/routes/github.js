const express = require('express');
const router = express.Router();
const https = require('https');

const GITHUB_CACHE_DURATION = 600000; // 10 minutes
let cachedGitHub = null;
let lastGitHubFetch = 0;

/**
 * Fonction helper pour faire des requêtes HTTPS
 */
function httpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/vnd.github.v3+json',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid JSON response'));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Route pour obtenir les données GitHub
 * GET /github
 */
router.get('/github', async (req, res) => {
  try {
    const now = Date.now();
    const githubUsername = process.env.GITHUB_USERNAME || 'UndKiMi';
    
    // Vérifier le cache
    if (cachedGitHub && (now - lastGitHubFetch) < GITHUB_CACHE_DURATION) {
      console.log('📦 Utilisation du cache GitHub');
      return res.json(cachedGitHub);
    }
    
    console.log('🔍 Récupération des données GitHub...');
    
    // Récupérer les données GitHub en parallèle
    const [user, repos, events] = await Promise.all([
      httpsRequest(`https://api.github.com/users/${githubUsername}`).catch(err => {
        console.warn('⚠️  Erreur récupération user GitHub:', err.message);
        return null;
      }),
      httpsRequest(`https://api.github.com/users/${githubUsername}/repos?sort=updated&per_page=100&type=all`).catch(err => {
        console.warn('⚠️  Erreur récupération repos GitHub:', err.message);
        return [];
      }),
      httpsRequest(`https://api.github.com/users/${githubUsername}/events?per_page=100`).catch(err => {
        console.warn('⚠️  Erreur récupération events GitHub:', err.message);
        return [];
      })
    ]);
    
    if (!user) {
      throw new Error('Impossible de récupérer les données utilisateur GitHub');
    }
    
    // Formater les repos pour le frontend
    const formattedRepos = (repos || []).map(repo => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description || 'Pas de description',
      html_url: repo.html_url,
      language: repo.language,
      stargazers_count: repo.stargazers_count || 0,
      forks_count: repo.forks_count || 0,
      updated_at: repo.updated_at,
      created_at: repo.created_at,
      pushed_at: repo.pushed_at,
      private: repo.private,
      default_branch: repo.default_branch,
      owner: {
        login: repo.owner?.login || '',
        html_url: repo.owner?.html_url || ''
      },
      fork: repo.fork || false
    }));
    
    const githubData = {
      username: user.login,
      user,
      repos: formattedRepos,
      events: events || []
    };
    
    cachedGitHub = githubData;
    lastGitHubFetch = now;
    
    console.log('✅ Données GitHub récupérées:', {
      username: user.login,
      repos: formattedRepos.length,
      events: events?.length || 0
    });
    
    res.json(githubData);
    
  } catch (error) {
    console.error('❌ Erreur GitHub:', error.message);
    // Si on a un cache, le retourner même en cas d'erreur
    if (cachedGitHub) {
      console.log('📦 Retour du cache GitHub en cas d\'erreur');
      return res.json(cachedGitHub);
    }
    res.status(500).json({
      error: 'Impossible de récupérer les données GitHub',
      message: error.message
    });
  }
});

/**
 * Route pour obtenir les commits d'un repository
 * GET /github/commits/:owner/:repo
 */
router.get('/github/commits/:owner/:repo', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    
    // Validation des paramètres
    if (!owner || !repo) {
      return res.status(400).json({
        error: 'Paramètres manquants',
        message: 'Owner et repo sont requis'
      });
    }
    
    const commits = await httpsRequest(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`);
    res.json(commits);
  } catch (error) {
    console.error(`❌ Erreur récupération commits ${req.params.owner}/${req.params.repo}:`, error.message);
    res.status(500).json({
      error: 'Impossible de récupérer les commits',
      message: error.message
    });
  }
});

module.exports = router;

