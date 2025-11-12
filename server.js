const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const cors = require('cors');
const https = require('https');
const { fetchSensCritiqueProfile } = require('./senscritique-scraper');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const STATIC_MAX_AGE = process.env.STATIC_MAX_AGE || '1h';
const CUSTOM_BADGES_PATH = path.join(__dirname, 'user-badges.json');
const PRESENCE_REFRESH_INTERVAL = Number(process.env.PRESENCE_REFRESH_INTERVAL) || 2000;

let customBadges = [];

app.disable('x-powered-by');
app.use(cors());
app.use(express.static('.', { maxAge: STATIC_MAX_AGE }));

let cachedSensCritique = null;
let lastSCFetch = 0;
const SC_CACHE_DURATION = 600000; // 10 minutes - bon équilibre entre performance et fraîcheur des données

let cachedGitHub = null;
let lastGitHubFetch = 0;
const GITHUB_CACHE_DURATION = 600000; // 10 minutes
const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'UndKiMi';

const TOKEN = process.env.DISCORD_TOKEN;
const TARGET_USER_ID = process.env.DISCORD_USER_ID || "558793081663782913";

if (!TOKEN) {
  console.error('❌ ERREUR: DISCORD_TOKEN non défini dans .env');
  console.log('Créez un fichier .env avec votre token Discord');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

let cachedPresence = {
  user: null,
  status: 'offline',
  activities: []
};

let lastPresenceHash = null;

function loadCustomBadges() {
  try {
    if (fs.existsSync(CUSTOM_BADGES_PATH)) {
      const badgesData = JSON.parse(fs.readFileSync(CUSTOM_BADGES_PATH, 'utf8'));
      if (badgesData.badges && Array.isArray(badgesData.badges)) {
        customBadges = [...new Set(badgesData.badges)];
        console.log('✅ Badges personnalisés chargés:', customBadges);
      }
    } else {
      customBadges = [];
    }
  } catch (err) {
    console.log('⚠️ Erreur lors du chargement des badges personnalisés:', err.message);
    customBadges = [];
  }
}

loadCustomBadges();

if (fs.existsSync(CUSTOM_BADGES_PATH)) {
  fs.watchFile(CUSTOM_BADGES_PATH, { persistent: false, interval: 60000 }, () => {
    console.log('🔄 Rechargement des badges personnalisés');
    loadCustomBadges();
  });
}

function hashPresence(presence) {
  return JSON.stringify({
    status: presence.status,
    activities: presence.activities?.map(a => ({ name: a.name, details: a.details, state: a.state })),
    voiceState: presence.voiceState ? {
      channelId: presence.voiceState.channelId,
      streaming: presence.voiceState.streaming,
      video: presence.voiceState.video,
      selfMute: presence.voiceState.selfMute,
      selfDeaf: presence.voiceState.selfDeaf
    } : null
  });
}

client.once('ready', async () => {
  console.log(`✅ Bot connecté: ${client.user.tag}`);
  console.log(`📊 Serveurs: ${client.guilds.cache.size}`);
  console.log(`🔍 Recherche de l'utilisateur ${TARGET_USER_ID}...\n`);

  let targetGuild = null;
  let targetMember = null;

  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const member = await guild.members.fetch(TARGET_USER_ID).catch(() => null);
      if (member) {
        try {
          const fullUser = await client.users.fetch(TARGET_USER_ID, { force: true });
          console.log('🔍 Utilisateur complet récupéré:', {
            flags: fullUser.flags?.toArray(),
            publicFlags: fullUser.publicFlags?.toArray(),
            premiumType: fullUser.premiumType,
            accentColor: fullUser.accentColor,
            banner: fullUser.banner
          });
          member.user = fullUser;
        } catch (err) {
          console.log('⚠️ Impossible de récupérer le profil complet:', err.message);
        }
        updatePresenceCache(member);
        console.log(`✅ Utilisateur trouvé dans: ${guild.name}`);
        console.log(`👤 Username: ${member.user.username}`);
        console.log(`📡 Statut: ${member.presence?.status || 'offline'}\n`);
        targetGuild = guild;
        targetMember = member;
        break;
      }
    } catch (err) {
      console.log(`⚠️  Utilisateur non trouvé dans ${guild.name}`);
    }
  }

  setInterval(async () => {
    if (targetGuild && targetMember) {
      try {
        const freshMember = await targetGuild.members.fetch(TARGET_USER_ID, { force: true, cache: false });
        if (freshMember) {
          const newHash = hashPresence({
            status: freshMember.presence?.status || 'offline',
            activities: freshMember.presence?.activities,
            voiceState: freshMember.voice?.channel ? {
              channelId: freshMember.voice.channel.id,
              streaming: freshMember.voice.streaming,
              video: freshMember.voice.selfVideo,
              selfMute: freshMember.voice.selfMute,
              selfDeaf: freshMember.voice.selfDeaf
            } : null
          });
          
          if (newHash !== lastPresenceHash) {
            lastPresenceHash = newHash;
            updatePresenceCache(freshMember, true);
          }
        }
      } catch (err) {
        console.log('⚠️ Impossible de rafraîchir la présence:', err.message);
      }
    }
  }, PRESENCE_REFRESH_INTERVAL);
});

client.on('presenceUpdate', (oldPresence, newPresence) => {
  if (newPresence.userId === TARGET_USER_ID) {
    updatePresenceCache(newPresence.member);
    console.log(`🔄 Statut mis à jour: ${newPresence.status}`);
  }
});

client.on('voiceStateUpdate', (oldState, newState) => {
  if (newState.id === TARGET_USER_ID) {
    console.log('🎤 Changement d\'état vocal détecté');
    updatePresenceCache(newState.member);
  }
});

function updatePresenceCache(member, silent = false) {
  if (!member) return;

  let userFlags = member.user.flags?.toArray() || [];
  const userPublicFlags = member.user.publicFlags?.toArray() || [];

  if (customBadges.length) {
    userFlags = [...new Set([...userFlags, ...customBadges])];
  }

  if (!silent) {
    console.log('🎖️ FLAGS DÉTECTÉS:');
    console.log('   - flags:', userFlags);
    console.log('   - publicFlags:', userPublicFlags);
    console.log('   - premiumType:', member.user.premiumType);
    console.log('   - accentColor:', member.user.accentColor);
    console.log('   - banner:', member.user.banner);
  }

  const voiceChannel = member.voice?.channel;
  const isStreaming = member.voice?.streaming || false;
  const isVideo = member.voice?.selfVideo || false;
  
  if (!silent) {
    if (voiceChannel) {
      let voiceInfo = `🎤 Utilisateur en vocal: ${voiceChannel.name} dans ${voiceChannel.guild.name}`;
      if (isStreaming) voiceInfo += ' 🔴 (streaming)';
      if (isVideo) voiceInfo += ' 📹 (caméra)';
      console.log(voiceInfo);
    } else {
      console.log('🔇 Utilisateur pas en vocal');
    }
  }
  
  cachedPresence = {
    user: {
      id: member.user.id,
      username: member.user.username,
      discriminator: member.user.discriminator,
      avatar: member.user.avatar,
      displayName: member.displayName,
      flags: userFlags,
      publicFlags: userPublicFlags,
      premiumType: member.user.premiumType || 0,
      accentColor: member.user.accentColor || null,
      banner: member.user.banner || null
    },
    status: member.presence?.status || 'offline',
    activities: member.presence?.activities?.map(activity => ({
      name: activity.name,
      type: activity.type,
      details: activity.details,
      state: activity.state,
      applicationId: activity.applicationId,
      timestamps: activity.timestamps,
      assets: activity.assets ? {
        largeImage: activity.assets.largeImage,
        largeText: activity.assets.largeText,
        smallImage: activity.assets.smallImage,
        smallText: activity.assets.smallText
      } : null
    })) || [],
    voiceState: voiceChannel ? {
      channelName: voiceChannel.name,
      channelId: voiceChannel.id,
      serverName: voiceChannel.guild.name,
      guildId: voiceChannel.guild.id,
      guildIcon: voiceChannel.guild.icon,
      selfMute: member.voice.selfMute || false,
      selfDeaf: member.voice.selfDeaf || false,
      serverMute: member.voice.serverMute || false,
      serverDeaf: member.voice.serverDeaf || false,
      streaming: isStreaming,
      video: isVideo
    } : null
  };
}

app.get('/discord-status', (req, res) => {
  res.json(cachedPresence);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    botReady: client.isReady(),
    timestamp: new Date().toISOString()
  });
});

// Fonction helper pour faire des requêtes HTTPS
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

app.get('/github', async (req, res) => {
  try {
    const now = Date.now();
    
    // Vérifier le cache
    if (cachedGitHub && (now - lastGitHubFetch) < GITHUB_CACHE_DURATION) {
      console.log('📦 Utilisation du cache GitHub');
      return res.json(cachedGitHub);
    }
    
    console.log('🔍 Récupération des données GitHub...');
    
    // Récupérer les données GitHub en parallèle
    const [user, repos, events] = await Promise.all([
      httpsRequest(`https://api.github.com/users/${GITHUB_USERNAME}`).catch(err => {
        console.warn('⚠️  Erreur récupération user GitHub:', err.message);
        return null;
      }),
      httpsRequest(`https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=10`).catch(err => {
        console.warn('⚠️  Erreur récupération repos GitHub:', err.message);
        return [];
      }),
      httpsRequest(`https://api.github.com/users/${GITHUB_USERNAME}/events?per_page=100`).catch(err => {
        console.warn('⚠️  Erreur récupération events GitHub:', err.message);
        return [];
      })
    ]);
    
    if (!user) {
      throw new Error('Impossible de récupérer les données utilisateur GitHub');
    }
    
    const githubData = {
      user,
      repos: repos || [],
      events: events || []
    };
    
    cachedGitHub = githubData;
    lastGitHubFetch = now;
    
    console.log('✅ Données GitHub récupérées:', {
      username: user.login,
      repos: repos?.length || 0,
      events: events?.length || 0
    });
    
    res.json(githubData);
    
  } catch (error) {
    console.error('❌ Erreur GitHub:', error.message);
    res.status(500).json({
      error: 'Impossible de récupérer les données GitHub',
      message: error.message
    });
  }
});

app.get('/github/commits/:owner/:repo', async (req, res) => {
  try {
    const { owner, repo } = req.params;
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

app.get('/senscritique', async (req, res) => {
  try {
    const now = Date.now();
    
    if (cachedSensCritique && (now - lastSCFetch) < SC_CACHE_DURATION) {
      console.log('📦 Utilisation du cache Sens Critique');
      // S'assurer que le cache contient bien des critiques
      if (cachedSensCritique.reviews && Array.isArray(cachedSensCritique.reviews) && cachedSensCritique.reviews.length > 0) {
        return res.json(cachedSensCritique);
      } else {
        console.log('⚠️  Cache invalide (pas de critiques), rechargement...');
      }
    }
    
    console.log('🎬 Récupération du profil SensCritique...');
    const profile = await fetchSensCritiqueProfile('KiMi_');
    
    // S'assurer que reviews est un tableau
    if (!profile.reviews || !Array.isArray(profile.reviews)) {
      profile.reviews = [];
    }
    
    console.log(`✅ Profil récupéré: ${profile.reviews.length} critiques`);
    
    cachedSensCritique = profile;
    lastSCFetch = now;
    
    res.json(profile);
    
  } catch (error) {
    console.error('❌ Erreur Sens Critique:', error.message);
    res.status(500).json({
      error: 'Impossible de récupérer le profil',
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
        reviews: [
          {
            title: 'The Rain',
            content: 'Honnêtement, j\'ai vraiment accroché à cette série. Le concept du virus transmis par la pluie est super original et ça rend l\'ambiance unique...',
            date: 'il y a 5 jours'
          }
        ],
        profileUrl: 'https://www.senscritique.com/KiMi_',
        avatar: 'https://media.senscritique.com/media/media/000022812759/48x48/avatar.jpg'
      }
    });
  }
});

client.login(TOKEN).catch(err => {
  console.error('❌ Erreur de connexion Discord:', err.message);
  console.log('\n📝 Vérifiez:');
  console.log('1. Que le token est correct dans .env');
  console.log('2. Que les Privileged Gateway Intents sont activés');
  console.log('3. Que le bot est sur un serveur Discord\n');
  process.exit(1);
});

app.listen(PORT, () => {
  console.log(`\n🚀 Serveur lancé sur http://localhost:${PORT}`);
  console.log(`📡 Endpoint Discord: http://localhost:${PORT}/discord-status`);
  console.log(`📡 Endpoint GitHub: http://localhost:${PORT}/github`);
  console.log(`📡 Endpoint SensCritique: http://localhost:${PORT}/senscritique`);
  console.log(`\n💡 Ouvrez index.html dans votre navigateur\n`);
});
