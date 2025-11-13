const CONFIG = {
  backendUrl: 'https://mypage-production-4e09.up.railway.app',
  scUsername: 'KiMi_',
  githubUsername: 'UndKiMi',
  discordPollInterval: 10000, // 10s au lieu de 2s pour réduire la charge
  cacheDurations: {
    github: 10 * 60 * 1000,
    discord: 200,
    sensCritique: 60 * 60 * 1000, // 1 heure - optimisé pour performance
    githubProjects: 24 * 60 * 60 * 1000 // 1 jour
  },
  // Configuration pagination
  reviewsPerPage: 5,
  currentPage: 1,
  totalPages: 1,
  allReviews: []
};

const URLS = {
  scProfile: `https://www.senscritique.com/${CONFIG.scUsername}`,
  githubProfile: `https://github.com/${CONFIG.githubUsername}`,
  githubApi: `https://api.github.com/users/${CONFIG.githubUsername}`
};

const STATUS_LABELS = {
  online: 'En ligne',
  idle: 'Absent',
  dnd: 'Ne pas déranger',
  offline: 'Hors ligne'
};

const activityLogos = {
  youtube: { url: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Youtube_logo.png', height: '18px' },
  twitch: { url: 'https://pngimg.com/uploads/twitch/twitch_PNG12.png', height: '25px' },
  spotify: { url: 'https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Primary_Logo_RGB_Green-300x300.png', height: '18px' },
  netflix: { url: 'https://cdn.rcd.gg/PreMiD/websites/N/Netflix/assets/logo.png', height: '18px' }
};

const state = {
  elements: {
    discord: {},
    github: {},
    sc: {}
  },
  cache: {
    github: null,
    lastGithubFetch: 0,
    discord: null,
    lastDiscordFetch: 0,
    lastDiscordData: null,
    sensCritique: null,
    lastScFetch: 0
  },
  discordFetchInProgress: false
};

const badgeIconsCache = new Map();

function initElements() {
  state.elements = {
    discord: {
      avatar: document.getElementById('discord-avatar'),
      username: document.getElementById('discord-username'),
      status: document.getElementById('discord-status'),
      statusText: document.getElementById('discord-status-text'),
      activity: document.getElementById('discord-activity'),
      streaming: document.getElementById('discord-streaming'),
      badges: document.getElementById('discord-badges')
    },
    github: {
      contributions: document.getElementById('total-contributions'),
      streak: document.getElementById('current-streak'),
      repos: document.getElementById('total-repos'),
      followers: document.getElementById('followers'),
      activityTable: document.getElementById('github-activity-tbody')
    },
    sc: {
      username: document.getElementById('sc-username'),
      bio: document.getElementById('sc-bio'),
      movies: document.getElementById('sc-movies'),
      series: document.getElementById('sc-series'),
      games: document.getElementById('sc-games'),
      reviews: document.getElementById('sc-reviews'),
      reviewsContainer: document.getElementById('sc-reviews-container'),
      favoritesGrid: document.getElementById('sc-favorites-grid'),
      moviesCard: document.getElementById('sc-movies-card'),
      seriesCard: document.getElementById('sc-series-card'),
      gamesCard: document.getElementById('sc-games-card'),
      reviewsCard: document.getElementById('sc-reviews-card')
    }
  };
}

function isCacheValid(lastFetch, duration) {
  return lastFetch && Date.now() - lastFetch < duration;
}

function preloadBadgeIcons() {
  const badgeFlags = [
    'Staff', 'Partner', 'Hypesquad', 'BugHunterLevel1', 'HypeSquadOnlineHouse1',
    'HypeSquadOnlineHouse2', 'HypeSquadOnlineHouse3', 'PremiumEarlySupporter',
    'BugHunterLevel2', 'VerifiedBot', 'VerifiedDeveloper', 'CertifiedModerator',
    'ActiveDeveloper', 'Nitro', 'BotHTTPInteractions', 'Spammer', 'DisablePremium',
    'HasUnreadUrgentMessages', 'Quarantined', 'Collaborator', 'RestrictedCollaborator',
    'QuestCompleted', 'GuildProductPurchaser', 'SupportsCommands', 'ApplicationAutoModerationRuleCreateBadge'
  ];

  badgeFlags.forEach(flag => {
    const badge = getDiscordBadgeInfo(flag);
    if (badge && badge.icon && !badgeIconsCache.has(badge.name)) {
      const img = new Image();
      img.src = badge.icon;
      badgeIconsCache.set(badge.name, img);
    }
  });
}

async function updateDiscordPresence() {
  if (state.discordFetchInProgress) {
    return;
  }

  if (isCacheValid(state.cache.lastDiscordFetch, CONFIG.cacheDurations.discord) && state.cache.discord) {
    return;
  }

  state.discordFetchInProgress = true;

  try {
    const response = await fetch(`${CONFIG.backendUrl}/discord-status`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!data.user) throw new Error('Utilisateur non trouvé');

    const payload = JSON.stringify(data);
    if (payload !== state.cache.lastDiscordData) {
      state.cache.discord = data;
      state.cache.lastDiscordData = payload;
      applyDiscordPresence(data);
    }

    state.cache.lastDiscordFetch = Date.now();
  } catch (error) {
    if (!state.cache.discord) {
      const { discord } = state.elements;
      discord.username.textContent = 'KiMi';
      discord.status.className = 'status-dot offline';
      discord.statusText.textContent = 'Serveur hors ligne';
      discord.activity.textContent = 'Démarrez le serveur backend pour voir le statut Discord';
      discord.activity.classList.remove('voice');
      discord.streaming.classList.remove('is-visible');
    }
  } finally {
    state.discordFetchInProgress = false;
  }
}

function applyDiscordPresence(data) {
  const { discord } = state.elements;
  const { user, status, activities, voiceState } = data;

  discord.avatar.src = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
    : 'https://cdn.discordapp.com/embed/avatars/1.png';

  discord.username.textContent = user.discriminator && user.discriminator !== '0'
    ? `${user.username}#${user.discriminator}`
    : user.username;

  discord.status.className = `status-dot ${status}`;
  discord.statusText.textContent = STATUS_LABELS[status] || 'Inconnu';

  if (voiceState) {
    renderVoiceActivity(voiceState);
  } else {
    renderStandardActivity(activities);
    discord.streaming.classList.remove('is-visible');
  }

  displayDiscordBadges(user);
}

function renderVoiceActivity(voiceState) {
  const { activity, streaming } = state.elements.discord;
  const { channelName, guildIcon, guildId, serverName, streaming: isStreaming, video, selfMute, selfDeaf } = voiceState;

  let voiceContent = '';
  if (guildIcon && guildId) {
    const iconUrl = `https://cdn.discordapp.com/icons/${guildId}/${guildIcon}.png?size=32`;
    const serverTitle = serverName ? `title="${serverName}"` : '';
    voiceContent = `<img src="${iconUrl}" class="guild-icon-hover" alt="Serveur" ${serverTitle}> En vocal dans ${channelName}`;
  } else {
    voiceContent = `🎤 En vocal dans ${channelName}`;
  }

  const flags = [];
  if (video) flags.push('📺');
  if (selfMute || selfDeaf) flags.push('🔇');
  if (flags.length) voiceContent += ` ${flags.join(' ')}`;

  activity.innerHTML = voiceContent;
  activity.classList.add('voice');
  streaming.classList.toggle('is-visible', Boolean(isStreaming));
  streaming.textContent = isStreaming ? '📺 En partage d’écran' : '';
}

function renderStandardActivity(activities) {
  const { activity, streaming } = state.elements.discord;
  streaming.classList.remove('is-visible');
  activity.classList.remove('voice');

  if (!activities || activities.length === 0) {
    activity.textContent = 'Aucune activité';
    return;
  }

  const current = activities[0];
  const logo = activityLogos[current.name?.toLowerCase()];
  const parts = [];

  if (logo) {
    parts.push(`<img src="${logo.url}" class="activity-icon" style="height:${logo.height};width:auto;vertical-align:middle;margin-right:4px;" alt="${current.name}" loading="lazy">`);
  }

  parts.push(current.name);
  if (current.details) parts.push(`- ${current.details}`);
  if (current.state) parts.push(`(${current.state})`);

  activity.innerHTML = parts.join(' ');
}

function getDiscordBadgeInfo(flag) {
  const badges = {
    Staff: { name: 'Personnel Discord', icon: 'https://cdn.discordapp.com/badge-icons/5e74e9b61934fc1f67c65515d1f7e60d.png' },
    Partner: { name: 'Propriétaire de serveur partenaire', icon: 'https://cdn.discordapp.com/badge-icons/3f9748e53446a137a052f3454e2de41e.png' },
    Hypesquad: { name: 'Événements HypeSquad', icon: 'https://cdn.discordapp.com/badge-icons/bf01d1073931f921909045f3a39fd264.png' },
    BugHunterLevel1: { name: 'Chasseur de bugs niveau 1', icon: 'https://cdn.discordapp.com/badge-icons/2717692c7dca7289b35297368a940dd0.png' },
    HypeSquadOnlineHouse1: { name: 'HypeSquad Bravery', icon: 'https://cdn.discordapp.com/badge-icons/8a88d63823d8a71cd5e390baa45efa02.png' },
    HypeSquadOnlineHouse2: { name: 'HypeSquad Brilliance', icon: 'https://cdn.discordapp.com/badge-icons/011940fd013da3f7fb926e4a1cd2e618.png' },
    HypeSquadOnlineHouse3: { name: 'HypeSquad Balance', icon: 'https://cdn.discordapp.com/badge-icons/3aa41de486fa12454c3761e8e223442e.png' },
    PremiumEarlySupporter: { name: 'Soutien précoce', icon: 'https://cdn.discordapp.com/badge-icons/7060786766c9c840eb3019e725d2b358.png' },
    BugHunterLevel2: { name: 'Chasseur de bugs niveau 2', icon: 'https://cdn.discordapp.com/badge-icons/848f79194d4be5ff5f81505cbd0ce1e6.png' },
    VerifiedDeveloper: { name: 'Développeur de bot vérifié', icon: 'https://cdn.discordapp.com/badge-icons/6bdc42827a38498929a4920da12695d9.png' },
    CertifiedModerator: { name: 'Ancien du programme de modération', icon: 'https://cdn.discordapp.com/badge-icons/fee1624003e2fee35cb398e125dc479b.png' },
    ActiveDeveloper: { name: 'Développeur actif', icon: 'https://cdn.discordapp.com/badge-icons/6bdc42827a38498929a4920da12695d9.png' },
    PremiumSubscriber: { name: 'Abonné Discord Nitro', icon: 'https://cdn.discordapp.com/badge-icons/2ba85e8026a8614b640c2837bcdfe21b.png' },
    Nitro: { name: 'Abonné Discord Nitro', icon: 'https://cdn.discordapp.com/badge-icons/2ba85e8026a8614b640c2837bcdfe21b.png' },
    QuestCompleted: { name: 'Quête Discord terminée', icon: 'https://cdn.discordapp.com/badge-icons/7d9ae358c8c5e118768335dbe68b4fb8.png' },
    GuildProductPurchaser: { name: 'Apprenti Orbs', icon: 'https://cdn.discordapp.com/badge-icons/83d8a1eb09a8d64e59233eec5d4d5c2d.png' },
    SupportsCommands: { name: 'Apprenti Orbs', icon: 'https://cdn.discordapp.com/badge-icons/83d8a1eb09a8d64e59233eec5d4d5c2d.png' },
    ApplicationAutoModerationRuleCreateBadge: { name: 'Apprenti Orbs', icon: 'https://cdn.discordapp.com/badge-icons/83d8a1eb09a8d64e59233eec5d4d5c2d.png' }
  };

  return badges[flag] || null;
}

function displayDiscordBadges(user) {
  const badgesEl = state.elements.discord.badges;
  badgesEl.innerHTML = '';

  const badges = (user.flags && user.flags.length > 0) ? user.flags : (user.publicFlags || []);

  if (badges.length > 0) {
    const fragment = document.createDocumentFragment();

    badges.forEach(flag => {
      const badgeInfo = getDiscordBadgeInfo(flag);
      if (!badgeInfo) return;

      const badgeEl = document.createElement('div');
      badgeEl.className = 'discord-badge';
      badgeEl.title = badgeInfo.name;

      if (badgeIconsCache.has(badgeInfo.name)) {
        badgeEl.style.backgroundImage = `url('${badgeInfo.icon}')`;
      } else {
        const img = new Image();
        img.onload = () => {
          badgeEl.style.backgroundImage = `url('${badgeInfo.icon}')`;
        };
        img.src = badgeInfo.icon;
        badgeIconsCache.set(badgeInfo.name, img);
      }

      fragment.appendChild(badgeEl);
    });

    badgesEl.appendChild(fragment);
  }

  if (user.premiumType && user.premiumType > 0) {
    const nitroInfo = getDiscordBadgeInfo('Nitro');
    if (nitroInfo) {
      const badgeEl = document.createElement('div');
      badgeEl.className = 'discord-badge';
      badgeEl.style.backgroundImage = `url('${nitroInfo.icon}')`;
      badgeEl.title = nitroInfo.name;
      badgesEl.appendChild(badgeEl);
    }
  }
}

async function fetchGitHubStats() {
  // Vérifier le cache localStorage d'abord
  if (window.CacheManager) {
    const cachedData = window.CacheManager.get('github_data');
    if (cachedData) {
      updateUIWithGitHubData(cachedData);
      // Charger aussi les projets depuis le cache
      loadGitHubProjects(cachedData.repos);
      return; // Pas besoin d'appel API
    }
  }

  // Vérifier le cache mémoire (fallback)
  if (isCacheValid(state.cache.lastGithubFetch, CONFIG.cacheDurations.github) && state.cache.github) {
    updateUIWithGitHubData(state.cache.github);
    loadGitHubProjects(state.cache.github.repos);
    return;
  }

  try {
    console.log('🔄 [GitHub] Récupération depuis le backend...');
    // Utiliser le backend pour éviter les erreurs CORS et 403
    const response = await fetch(`${CONFIG.backendUrl}/github`);
    
    if (!response.ok) {
      throw new Error(`Backend GitHub non disponible: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.message || data.error);
    }

    // Sauvegarder dans le cache localStorage
    if (window.CacheManager) {
      window.CacheManager.set('github_data', data);
    }

    // Sauvegarder aussi dans le cache mémoire
    state.cache.github = data;
    state.cache.lastGithubFetch = Date.now();

    updateUIWithGitHubData(data);
    
    // Charger les projets GitHub
    loadGitHubProjects(data.repos);
  } catch (error) {
    console.error('❌ Erreur GitHub:', error);
    // Utiliser les données de fallback seulement si on n'a pas de cache
    if (!state.cache.github) {
      useFallbackGitHubData();
    } else {
      // Utiliser le cache existant si disponible
      updateUIWithGitHubData(state.cache.github);
      loadGitHubProjects(state.cache.github.repos);
    }
  }
}

function updateUIWithGitHubData(data) {
  if (!data || !data.user) {
    useFallbackGitHubData();
    return;
  }

  const { user, repos, events } = data;
  const { github } = state.elements;

  github.followers.textContent = user.followers || 0;
  github.repos.textContent = user.public_repos || 0;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // NOUVELLE MÉTHODE: Utiliser parseGitHubDate pour parser correctement les dates
  const recentEvents = (events || []).filter(event => {
    try {
      if (!event?.created_at) return false;
      const eventDate = parseGitHubDate(event.created_at);
      if (!eventDate) return false;
      return eventDate > thirtyDaysAgo;
    } catch (error) {
      console.log(`⚠️  Erreur lors du parsing de la date d'événement:`, error);
      return false;
    }
  });

  github.contributions.textContent = recentEvents.length;

  const streak = calculateStreak(events);
  github.streak.textContent = streak;

  generateActivityTable(events, repos);
  
  // Charger et afficher les projets GitHub
  loadGitHubProjects(repos);
}

/**
 * Charge et affiche les projets GitHub dynamiquement
 */
async function loadGitHubProjects(repos = null) {
  try {
    // Vérifier le cache localStorage d'abord
    if (window.CacheManager) {
      const cachedProjects = window.CacheManager.get('github_projects');
      if (cachedProjects) {
        renderProjects(cachedProjects);
        return; // Pas besoin d'appel API
      }
    }
    
    // Si repos fournis depuis fetchGitHubStats, les utiliser
    if (repos && Array.isArray(repos) && repos.length > 0) {
      // Sauvegarder dans le cache
      if (window.CacheManager) {
        window.CacheManager.set('github_projects', repos);
      }
      renderProjects(repos);
      return;
    }
    
    // Sinon, récupérer depuis le backend
    console.log('🔄 [Projects] Récupération depuis le backend...');
    const response = await fetch(`${CONFIG.backendUrl}/github`);
    
    if (!response.ok) {
      throw new Error(`Backend non disponible: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.repos && Array.isArray(data.repos)) {
      // Sauvegarder dans le cache
      if (window.CacheManager) {
        window.CacheManager.set('github_projects', data.repos);
      }
      renderProjects(data.repos);
    }
  } catch (error) {
    console.error('❌ Erreur chargement projets GitHub:', error);
  }
}

/**
 * Affiche les projets GitHub dans le DOM
 */
function renderProjects(repos) {
  const projectsContainer = document.querySelector('.project-cards');
  if (!projectsContainer) {
    console.warn('⚠️  Conteneur projets non trouvé');
    return;
  }
  
  // Filtrer seulement les repos publics et les trier par date de mise à jour
  const publicRepos = repos
    .filter(repo => !repo.private)
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 10); // Limiter à 10 projets
  
  if (publicRepos.length === 0) {
    console.log('ℹ️  Aucun projet public trouvé');
    return;
  }
  
  // Vider le conteneur
  projectsContainer.innerHTML = '';
  
  // Créer les cartes de projets
  publicRepos.forEach(repo => {
    const li = document.createElement('li');
    const card = document.createElement('a');
    card.className = 'project-card';
    card.href = repo.html_url;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    
    // Icône selon le langage
    const icon = getProjectIcon(repo.language);
    
    // Badge Public/Private
    const badge = repo.private ? 'Private' : 'Public';
    
    // Description (limiter à 80 caractères)
    const description = repo.description 
      ? (repo.description.length > 80 ? repo.description.substring(0, 80) + '...' : repo.description)
      : 'Pas de description';
    
    // Couleur du langage
    const langColor = getLanguageColor(repo.language);
    
    // Vérifier si l'utilisateur n'est pas l'auteur principal
    const isNotMainAuthor = repo.owner && repo.owner.login && repo.owner.login.toLowerCase() !== CONFIG.githubUsername.toLowerCase();
    const authorName = isNotMainAuthor ? repo.owner.login : null;
    
    card.innerHTML = `
      <span class="pc-icon">${icon}</span>
      <div class="pc-content">
        <div class="pc-title">
          <span class="pc-name">${escapeHtml(repo.name)}</span>
          <span class="pc-badge">${badge}</span>
        </div>
        ${authorName ? `<div class="pc-author">Par <a href="${repo.owner.html_url}" target="_blank" rel="noopener noreferrer" class="pc-author-link">${escapeHtml(authorName)}</a></div>` : ''}
        <div class="pc-desc">${escapeHtml(description)}</div>
        <div class="pc-meta">
          ${repo.language ? `<span class="pc-lang"><span class="pc-dot" style="background-color: ${langColor}"></span>${escapeHtml(repo.language)}</span>` : ''}
          <span class="pc-stars">⭐ ${repo.stargazers_count || 0}</span>
        </div>
      </div>
    `;
    
    li.appendChild(card);
    projectsContainer.appendChild(li);
  });
  
  console.log(`✅ ${publicRepos.length} projets GitHub affichés`);
}

/**
 * Retourne une icône selon le langage du projet
 */
function getProjectIcon(language) {
  const icons = {
    'Python': '🐍',
    'JavaScript': '🤖',
    'TypeScript': '📘',
    'Java': '☕',
    'C++': '⚙️',
    'C': '⚙️',
    'C#': '🎮',
    'Go': '🐹',
    'Rust': '🦀',
    'PHP': '🐘',
    'Ruby': '💎',
    'Swift': '🐦',
    'Kotlin': '🔷',
    'HTML': '🌐',
    'CSS': '🎨',
    'Shell': '💻',
    'Dockerfile': '🐳',
    'Vue': '💚',
    'React': '⚛️'
  };
  
  return icons[language] || '💻';
}

/**
 * Retourne une couleur selon le langage
 */
function getLanguageColor(language) {
  const colors = {
    'Python': '#3776ab',
    'JavaScript': '#f7df1e',
    'TypeScript': '#3178c6',
    'Java': '#ed8b00',
    'C++': '#00599c',
    'C': '#a8b9cc',
    'C#': '#239120',
    'Go': '#00add8',
    'Rust': '#000000',
    'PHP': '#777bb4',
    'Ruby': '#cc342d',
    'Swift': '#fa7343',
    'Kotlin': '#7f52ff',
    'HTML': '#e34c26',
    'CSS': '#1572b6',
    'Shell': '#89e051',
    'Vue': '#4fc08d',
    'React': '#61dafb'
  };
  
  return colors[language] || '#6e7681';
}

function calculateStreak(events = []) {
  const today = new Date();
  const dateSet = new Set();

  // NOUVELLE MÉTHODE: Utiliser parseGitHubDate pour parser correctement les dates
  events.forEach(event => {
    if (!event?.created_at) return;
    
    // Parser la date avec la fonction dédiée
    const eventDate = parseGitHubDate(event.created_at);
    if (!eventDate) return;
    
    // Extraire la date au format YYYY-MM-DD
    const dateStr = eventDate.toISOString().split('T')[0];
    dateSet.add(dateStr);
  });

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];
    if (dateSet.has(dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return streak;
}

function useFallbackGitHubData() {
  const fallbackData = {
    user: {
      followers: 2,
      public_repos: 8
    },
    repos: [
      {
        name: '5Ghz_Cleaner',
        html_url: `${URLS.githubProfile}/5Ghz_Cleaner`,
        // Pas de date par défaut - sera affiché comme "non disponible"
        full_name: `${CONFIG.githubUsername}/5Ghz_Cleaner`,
        description: 'Optimisez et nettoyez votre installation Windows 11'
      },
      {
        name: 'Medal-Bot',
        html_url: `${URLS.githubProfile}/Medal-Bot`,
        // Pas de date par défaut - sera affiché comme "non disponible"
        full_name: `${CONFIG.githubUsername}/Medal-Bot`,
        description: 'Bot Discord multifonction'
      },
      {
        name: 'K.Ring',
        html_url: `${URLS.githubProfile}/K.Ring`,
        // Pas de date par défaut - sera affiché comme "non disponible"
        full_name: `${CONFIG.githubUsername}/K.Ring`,
        description: 'Bot Discord privé multifonctions'
      }
    ],
    events: []
  };

  const { github } = state.elements;
  github.contributions.textContent = '45';
  github.streak.textContent = '3';
  github.followers.textContent = fallbackData.user.followers;
  github.repos.textContent = fallbackData.user.public_repos;

  generateActivityTable(fallbackData.events, fallbackData.repos);
}

async function generateActivityTable(events, repos = []) {
  const tbody = state.elements.github.activityTable;
  tbody.innerHTML = '';

  if (!repos || repos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-dim);">Aucune activité récente</td></tr>';
    return;
  }

  const reposToShow = repos.slice(0, 5);

  for (const repo of reposToShow) {
    if (!repo?.name) continue;

    const row = document.createElement('tr');
    const repoName = repo.name;
    
    // Utiliser la fonction dédiée pour extraire la date
    const dateISO = extractGitHubDate(repo);
    const timeAgo = dateISO ? getTimeAgo(dateISO) : null;

    row.innerHTML = `
      <td>
        <a href="${repo.html_url || '#'}" target="_blank" class="repo-name">
          ${repoName}
        </a>
      </td>
      <td class="commit-message">
        Chargement...
      </td>
      <td class="commit-time">${timeAgo || 'non disponible'}</td>
    `;

    tbody.appendChild(row);

    // Récupérer le dernier commit pour mettre à jour la date et le message
    if (repo.full_name) {
      fetchLatestCommit(repo, row);
    }
  }
}

async function fetchLatestCommit(repo, row) {
  try {
    // Utiliser le backend pour éviter les erreurs CORS et 403
    const [owner, repoName] = repo.full_name.split('/');
    const commitsResponse = await fetch(`${CONFIG.backendUrl}/github/commits/${owner}/${repoName}`);
    
    if (!commitsResponse.ok) {
      console.warn(`⚠️  Impossible de récupérer les commits pour ${repo.full_name}: ${commitsResponse.status}`);
      return;
    }

    const commits = await commitsResponse.json();
    if (!Array.isArray(commits) || commits.length === 0) {
      // Si pas de commits, afficher un message par défaut
      const commitMessageCell = row.querySelector('.commit-message');
      if (commitMessageCell) {
        commitMessageCell.textContent = 'Aucun commit';
      }
      return;
    }

    const commit = commits[0];
    // Extraire le message du commit (peut être dans commit.commit.message ou commit.message)
    const commitMessage = commit?.commit?.message || commit?.message || null;
    
    // Extraire la date du commit (plus précise)
    const commitDateISO = extractGitHubDate(repo, commit);
    
    // Mettre à jour le message du commit
    const commitMessageCell = row.querySelector('.commit-message');
    if (commitMessageCell) {
      if (commitMessage) {
        // Nettoyer le message (enlever les retours à la ligne)
        const cleanMessage = commitMessage.split('\n')[0].trim();
        commitMessageCell.textContent = cleanMessage.length > 40
          ? `${cleanMessage.slice(0, 40)}…`
          : cleanMessage;
        commitMessageCell.title = commitMessage;
      } else {
        commitMessageCell.textContent = 'Aucun message';
      }
    }
    
    // Mettre à jour la date affichée avec la date du commit (plus précise)
    if (commitDateISO) {
      const commitTimeCell = row.querySelector('.commit-time');
      if (commitTimeCell) {
        const timeAgo = getTimeAgo(commitDateISO);
        if (timeAgo) {
          commitTimeCell.textContent = timeAgo;
        }
      }
    }
  } catch (error) {
    // Ignore commit fetch errors silently
    console.log(`⚠️  Erreur lors de la récupération du commit pour ${repo.full_name}:`, error);
  }
}

// Fonction robuste pour extraire la date d'un repository GitHub
function extractGitHubDate(repo, commit = null) {
  // Fonction helper pour valider une date
  const isValidDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return false;
    const parsed = parseGitHubDate(dateStr);
    return parsed !== null && !isNaN(parsed.getTime());
  };
  
  // MÉTHODE 1: Utiliser la date du commit si disponible (la plus précise)
  if (commit && commit.commit && commit.commit.author && commit.commit.author.date) {
    const commitDate = commit.commit.author.date;
    if (isValidDate(commitDate)) {
      return commitDate;
    }
  }
  
  // MÉTHODE 2: Utiliser pushed_at (date du dernier push)
  if (repo.pushed_at && isValidDate(repo.pushed_at)) {
    return repo.pushed_at;
  }
  
  // MÉTHODE 3: Utiliser updated_at (date de dernière mise à jour)
  if (repo.updated_at && isValidDate(repo.updated_at)) {
    return repo.updated_at;
  }
  
  // MÉTHODE 4: Utiliser created_at (date de création) en dernier recours
  if (repo.created_at && isValidDate(repo.created_at)) {
    return repo.created_at;
  }
  
  return null;
}

// Fonction pour parser une date GitHub (format ISO 8601)
function parseGitHubDate(dateString) {
  if (!dateString) return null;
  
  // Les dates GitHub sont au format ISO 8601: "2024-01-15T10:30:00Z"
  // Vérifier que c'est bien une date ISO valide
  if (typeof dateString !== 'string') {
    return null;
  }
  
  // Nettoyer la date (enlever les espaces, etc.)
  const cleanedDate = dateString.trim();
  
  // Vérifier le format ISO
  if (!/^\d{4}-\d{2}-\d{2}/.test(cleanedDate)) {
    return null;
  }
  
  // Parser la date
  const parsedDate = new Date(cleanedDate);
  
  // Vérifier que la date est valide
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }
  
  return parsedDate;
}

// Fonction améliorée pour formater une date en "il y a X"
function getTimeAgo(date) {
  if (!date) return null;

  // Si c'est une string, essayer de la parser d'abord avec parseGitHubDate
  let parsedDate;
  if (typeof date === 'string') {
    parsedDate = parseGitHubDate(date);
    // Si parseGitHubDate a échoué, essayer le parsing standard
    if (!parsedDate) {
      parsedDate = new Date(date);
    }
  } else if (date instanceof Date) {
    parsedDate = date;
  } else {
    return null;
  }

  // Vérifier que la date est valide
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const now = new Date();
  const seconds = Math.floor((now - parsedDate) / 1000);

  // Vérifier que la date n'est pas dans le futur
  if (seconds < 0) {
    return null;
  }
  
  // Moins d'une minute
  if (seconds < 60) return 'À l\'instant';

  // Moins d'une heure
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;

  // Moins d'un jour
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  // Calculer les jours
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Hier';
  
  // Afficher en jours jusqu'à 13 jours (pour éviter "1 sem" pour 7 jours)
  if (days < 14) return `${days}j`;

  // À partir de 14 jours, afficher en semaines
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} sem`;

  // Moins d'un an
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mois`;

  // Plus d'un an
  const years = Math.floor(days / 365);
  return `${years} an${years > 1 ? 's' : ''}`;
}

async function fetchSensCritiqueData() {
  // Afficher le message de chargement
  const { sc } = state.elements;
  if (sc && sc.reviewsContainer) {
    sc.reviewsContainer.innerHTML = '<div class="sc-loading">Chargement des critiques...</div>';
  }
  
  // Vérifier le cache localStorage d'abord
  if (window.CacheManager) {
    const cachedData = window.CacheManager.get('senscritique_data');
    if (cachedData) {
      // Initialiser la pagination depuis le cache
      CONFIG.currentPage = 1;
      CONFIG.totalPages = Math.ceil((cachedData.reviews || []).length / CONFIG.reviewsPerPage);
      
      // Afficher la première page depuis le cache
      const firstPageReviews = (cachedData.reviews || []).slice(0, CONFIG.reviewsPerPage);
      updateUIWithSCData({ ...cachedData, reviews: firstPageReviews });
      
      // Stocker toutes les reviews pour la pagination
      CONFIG.allReviews = cachedData.reviews || [];
      return; // Pas besoin d'appel API
    }
  }

  // Vérifier le cache mémoire (fallback)
  if (isCacheValid(state.cache.lastScFetch, CONFIG.cacheDurations.sensCritique) && state.cache.sensCritique) {
    updateUIWithSCData(state.cache.sensCritique);
    return;
  }

  try {
    console.log('🔄 [SensCritique] Récupération depuis le backend...');
    
    // Récupérer TOUTES les critiques (sans limite) pour les mettre en cache
    const response = await fetch(`${CONFIG.backendUrl}/senscritique`);
    
    if (!response.ok) {
      throw new Error(`Backend non disponible: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data) {
      throw new Error('Données vides reçues du backend');
    }

    // Log pour debug
    console.log('📊 Données SensCritique reçues:', {
      username: data.username,
      reviewsCount: data.reviews ? data.reviews.length : 0,
      hasReviews: Array.isArray(data.reviews) && data.reviews.length > 0
    });

    // Sauvegarder TOUTES les critiques dans le cache localStorage
    if (window.CacheManager && data.reviews) {
      window.CacheManager.set('senscritique_data', data);
    }

    // Mettre aussi en cache mémoire
    state.cache.sensCritique = data;
    state.cache.lastScFetch = Date.now();

    // Stocker toutes les reviews pour la pagination
    CONFIG.allReviews = data.reviews || [];

    // Gérer les erreurs avec fallback
    if (data.error && data.fallback) {
      useFallbackData(data.fallback);
      return;
    }

    // Initialiser la pagination
    CONFIG.currentPage = 1;
    CONFIG.totalPages = Math.ceil((data.reviews || []).length / CONFIG.reviewsPerPage);
    
    // Afficher seulement la première page
    const firstPageReviews = (data.reviews || []).slice(0, CONFIG.reviewsPerPage);
    updateUIWithSCData({ ...data, reviews: firstPageReviews });
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération Sens Critique:', error);
    useFallbackData({
      username: CONFIG.scUsername,
      stats: { films: 66, series: 32, jeux: 19, livres: 17 },
      reviews: []
    });
  }
}

function updateUIWithSCData(data) {
  if (!data) {
    console.error('❌ Aucune donnée reçue pour SensCritique');
    return;
  }

  const { sc } = state.elements;
  
  // Mettre à jour les informations de base
  sc.username.textContent = data.username || CONFIG.scUsername;
  
  let bioText = `${data.gender || 'Homme'} | ${data.location || 'France'}`;
  if (data.age) {
    bioText += ` | ${data.age} ans`;
  }
  sc.bio.textContent = bioText;
  
  // Mettre à jour les statistiques
  sc.movies.textContent = data.stats?.films || 0;
  sc.series.textContent = data.stats?.series || 0;
  sc.games.textContent = data.stats?.jeux || 0;
  sc.reviews.textContent = data.stats?.total || ((data.stats?.films || 0) + (data.stats?.series || 0) + (data.stats?.jeux || 0));

  // Charger les favoris et les liens
  loadFavoriteMovies(data.favorites || data.collections || []);
  setupStatLinks();
  
  // Afficher les critiques récentes
  displayRecentReviews(data.reviews || []);
}

function displayRecentReviews(reviews, append = false) {
  const { sc } = state.elements;
  
  if (!sc || !sc.reviewsContainer) {
    console.error('❌ Conteneur des critiques non trouvé');
    return;
  }
  
  const container = sc.reviewsContainer;
  
  // Vérifier que reviews est un tableau valide
  if (!Array.isArray(reviews) || reviews.length === 0) {
    if (!append) {
      container.innerHTML = '<div class="sc-review-empty">Aucune critique disponible</div>';
    }
    return;
  }
  
  // Filtrer les critiques valides (doivent avoir un titre)
  const validReviews = reviews.filter(r => r && r.title && r.title.trim().length > 0);
  
  if (validReviews.length === 0) {
    if (!append) {
      container.innerHTML = '<div class="sc-review-empty">Aucune critique disponible</div>';
    }
    return;
  }
  
  // Vider le conteneur ou supprimer le bouton "Charger plus"
  if (!append) {
    container.innerHTML = '';
  } else {
    const oldButton = container.querySelector('.sc-load-more-button');
    if (oldButton) {
      oldButton.remove();
    }
  }
  
  // Créer un fragment pour optimiser les performances
  const fragment = document.createDocumentFragment();
  
  // Créer un élément pour chaque critique
  validReviews.forEach(review => {
    const reviewItem = document.createElement('div');
    reviewItem.className = 'sc-review-item';
    
    // Extraire et nettoyer le titre (IMPORTANT : nettoyer le HTML en premier)
    const rawTitle = review.title || 'Sans titre';
    const title = cleanHTML(rawTitle);
    
    // Extraire et formater la date
    let dateText = 'non disponible';
    if (review.created_at) {
      dateText = formatReviewDate(review.created_at);
    } else if (review.date_raw) {
      const parsed = parseDateFromText(review.date_raw);
      dateText = parsed ? formatReviewDate(parsed) : review.date_raw;
    } else if (review.date) {
      const parsed = parseDateFromText(review.date);
      dateText = parsed ? formatReviewDate(parsed) : review.date;
    }
    
    // Nettoyer aussi la date
    const cleanDateText = cleanHTML(dateText);
    
    // Extraire la note
    const rating = review.rating ? ` | ${review.rating}⭐` : '';
    
    // Extraire et nettoyer le contenu (IMPORTANT : nettoyer le HTML)
    const rawContent = review.content || review.comment || 'Pas de commentaire';
    const content = cleanHTML(rawContent);
    
    // Image de l'œuvre (si disponible)
    if (review.image) {
      const imageEl = document.createElement('img');
      imageEl.src = review.image;
      imageEl.alt = title || 'Critique'; // Utiliser le titre nettoyé
      imageEl.className = 'sc-review-image';
      imageEl.loading = 'lazy';
      imageEl.onerror = function() {
        this.style.display = 'none';
      };
      reviewItem.appendChild(imageEl);
    }
    
    // Lien wrapper
    const linkEl = document.createElement('a');
    linkEl.href = review.url || `${URLS.scProfile}/critiques`;
    linkEl.target = '_blank';
    linkEl.rel = 'noopener noreferrer';
    linkEl.className = 'sc-review-content-wrapper';
    
    // Créer les éléments DOM avec .textContent (pas .innerHTML)
    const headerDiv = document.createElement('div');
    headerDiv.className = 'sc-review-header';
    
    const titleDiv = document.createElement('div');
    titleDiv.className = 'sc-review-title';
    titleDiv.textContent = title + rating; // Utiliser .textContent
    
    const commentDiv = document.createElement('div');
    commentDiv.className = 'sc-review-comment';
    commentDiv.textContent = content; // Utiliser .textContent
    
    const dateDiv = document.createElement('div');
    dateDiv.className = 'sc-review-date';
    dateDiv.textContent = cleanDateText; // Utiliser .textContent
    
    // Assembler la structure
    headerDiv.appendChild(titleDiv);
    linkEl.appendChild(headerDiv);
    linkEl.appendChild(commentDiv);
    linkEl.appendChild(dateDiv);
    
    reviewItem.appendChild(linkEl);
    fragment.appendChild(reviewItem);
  });
  
  // Ajouter toutes les critiques en une seule opération
  container.appendChild(fragment);
  
  // Ajouter le bouton "Charger plus" si nécessaire
  addLoadMoreButton(container);
  
  console.log(`✅ ${validReviews.length} critiques affichées`);
}

/**
 * Ajoute le bouton "Charger plus" si la pagination le permet
 */
function addLoadMoreButton(container) {
  if (CONFIG.currentPage < CONFIG.totalPages) {
    const buttonEl = document.createElement('button');
    buttonEl.className = 'sc-load-more-button';
    buttonEl.textContent = `Charger plus (${CONFIG.currentPage}/${CONFIG.totalPages})`;
    buttonEl.onclick = loadMoreReviews;
    container.appendChild(buttonEl);
  }
}

/**
 * Charge plus de critiques via pagination (depuis le cache localStorage)
 */
async function loadMoreReviews() {
  const button = document.querySelector('.sc-load-more-button');
  if (button) {
    button.textContent = 'Chargement...';
    button.disabled = true;
  }
  
  try {
    // Récupérer TOUTES les critiques depuis le cache localStorage
    const cachedData = window.CacheManager ? window.CacheManager.get('senscritique_data') : null;
    
    if (cachedData && cachedData.reviews) {
      CONFIG.currentPage++;
      const offset = (CONFIG.currentPage - 1) * CONFIG.reviewsPerPage;
      
      // Extraire la page suivante depuis le cache
      const nextPageReviews = cachedData.reviews.slice(offset, offset + CONFIG.reviewsPerPage);
      
      if (nextPageReviews.length > 0) {
        // Ajouter les nouvelles critiques
        displayRecentReviews(nextPageReviews, true);
        console.log(`✅ [Pagination] Page ${CONFIG.currentPage} chargée depuis le cache (${nextPageReviews.length} critiques)`);
      } else {
        console.log('ℹ️  [SensCritique] Aucune critique supplémentaire dans le cache');
        if (button) {
          button.remove(); // Supprimer le bouton si plus de critiques
        }
      }
    } else {
      // Si pas de cache, faire un appel API classique (fallback)
      console.log('⚠️  [SensCritique] Pas de cache, appel API...');
      const offset = (CONFIG.currentPage - 1) * CONFIG.reviewsPerPage;
      
      const response = await fetch(`${CONFIG.backendUrl}/senscritique?limit=${CONFIG.reviewsPerPage}&offset=${offset}`);
      
      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.pagination) {
        CONFIG.totalPages = data.pagination.totalPages;
      }
      
      // Ajouter les nouvelles critiques
      displayRecentReviews(data.reviews || [], true);
    }
    
  } catch (error) {
    console.error('❌ Erreur chargement critiques supplémentaires:', error);
    if (button) {
      button.textContent = 'Erreur - Réessayer';
      button.disabled = false;
    }
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Nettoie strictement le HTML d'un texte (supprime toutes les balises et attributs HTML)
 */
function cleanHTML(text) {
  if (!text) return '';
  
  // Supprimer TOUTES les balises HTML
  let cleaned = text.replace(/<[^>]*>/g, '').trim();
  
  // Supprimer les attributs HTML résiduels
  cleaned = cleaned.replace(/class="[^"]*"/g, '');
  cleaned = cleaned.replace(/class=\\?"[^"]*\\?"/g, '');
  cleaned = cleaned.replace(/data-testid="[^"]*"/g, '');
  cleaned = cleaned.replace(/data-testid=\\?"[^"]*\\?"/g, '');
  cleaned = cleaned.replace(/href="[^"]*"/g, '');
  cleaned = cleaned.replace(/href=\\?"[^"]*\\?"/g, '');
  
  // Supprimer les backslashes échappés
  cleaned = cleaned.replace(/\\\\/g, '');
  
  // Nettoyer "a " ou "a class" au début
  if (cleaned.startsWith('a ') || cleaned.startsWith('a class')) {
    return ''; // Contenu invalide
  }
  
  // Nettoyer les espaces multiples
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

function formatReviewDate(dateString) {
  if (!dateString) {
    return 'non disponible';
  }
  
  // SOLUTION ALTERNATIVE: Toujours parser avec parseDateFromText d'abord
  const parsedDate = parseDateFromText(dateString);
  
  if (parsedDate) {
    // Si on a réussi à parser, utiliser getTimeAgo avec la date ISO
    const result = getTimeAgo(parsedDate);
    if (result) {
      return result;
    }
  }
  
  // Si le parsing a échoué ou getTimeAgo n'a pas fonctionné, essayer getTimeAgo directement
  const directResult = getTimeAgo(dateString);
  if (directResult) {
    return directResult;
  }
  
  // En dernier recours, retourner "non disponible" au lieu du texte original
  return 'non disponible';
}

// SOLUTION ALTERNATIVE: Fonction unifiée pour parser n'importe quel format de date
function parseDateFromText(dateText) {
  if (!dateText || typeof dateText !== 'string') return null;
  
  const text = dateText.trim().toLowerCase();
  
  // Si c'est déjà une date ISO, la retourner telle quelle
  if (/^\d{4}-\d{2}-\d{2}/.test(dateText)) {
    return dateText;
  }
  
  // Parser les dates relatives "il y a X jours"
  const relativeResult = parseRelativeDateText(dateText);
  if (relativeResult) return relativeResult;
  
  // Parser les dates françaises "le X nov. 2025"
  const frenchResult = parseFrenchDateText(dateText);
  if (frenchResult) return frenchResult;
  
  return null;
}

// Fonction pour parser les dates relatives en dates absolues
function parseRelativeDateText(dateText) {
  if (!dateText) return null;
  
  const now = new Date();
  const lowerText = dateText.toLowerCase().trim();
  
  // "Il y a X jour(s)" - accepter "jour" ou "jours"
  const joursMatch = lowerText.match(/il y a (\d+)\s*jour(s)?/i);
  if (joursMatch) {
    const days = parseInt(joursMatch[1]);
    const date = new Date(now);
    date.setDate(date.getDate() - days);
    return date.toISOString();
  }
  
  // "Il y a X semaines"
  const semainesMatch = lowerText.match(/il y a (\d+)\s*semaine/i);
  if (semainesMatch) {
    const weeks = parseInt(semainesMatch[1]);
    const date = new Date(now);
    date.setDate(date.getDate() - (weeks * 7));
    return date.toISOString();
  }
  
  // "Il y a X mois"
  const moisMatch = lowerText.match(/il y a (\d+)\s*mois/i);
  if (moisMatch) {
    const months = parseInt(moisMatch[1]);
    const date = new Date(now);
    date.setMonth(date.getMonth() - months);
    return date.toISOString();
  }
  
  // "Il y a X ans"
  const ansMatch = lowerText.match(/il y a (\d+)\s*an/i);
  if (ansMatch) {
    const years = parseInt(ansMatch[1]);
    const date = new Date(now);
    date.setFullYear(date.getFullYear() - years);
    return date.toISOString();
  }
  
  // "Aujourd'hui" ou "Hier"
  if (lowerText.includes('aujourd') || lowerText.includes('auj.')) {
    return now.toISOString();
  }
  
  if (lowerText.includes('hier')) {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    return date.toISOString();
  }
  
  return null;
}

// Fonction pour parser les dates au format français "le 4 nov. 2025"
function parseFrenchDateText(dateText) {
  if (!dateText) return null;
  
  const months = {
    'jan': 0, 'janv': 0, 'janvier': 0,
    'fév': 1, 'févr': 1, 'février': 1,
    'mar': 2, 'mars': 2,
    'avr': 3, 'avril': 3,
    'mai': 4,
    'jun': 5, 'juin': 5,
    'jul': 6, 'juil': 6, 'juillet': 6,
    'aoû': 7, 'août': 7,
    'sep': 8, 'sept': 8, 'septembre': 8,
    'oct': 9, 'octobre': 9,
    'nov': 10, 'novembre': 10,
    'déc': 11, 'décembre': 11
  };
  
  // Pattern: "le 4 nov. 2025" ou "le 4 novembre 2025" (avec ou sans "le")
  const match = dateText.match(/(?:le\s+)?(\d{1,2})\s+(\w+)\.?\s+(\d{4})/i);
  if (match) {
    const day = parseInt(match[1]);
    const monthName = match[2].toLowerCase().replace(/\.$/, ''); // Enlever le point final
    const year = parseInt(match[3]);
    
    const month = months[monthName];
    if (month !== undefined) {
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
  }
  
  return null;
}

function setupStatLinks() {
  const cards = [
    state.elements.sc.moviesCard,
    state.elements.sc.seriesCard,
    state.elements.sc.gamesCard,
    state.elements.sc.reviewsCard
  ];

  cards.forEach(card => {
    if (!card || !card.dataset.url || card.dataset.boundClick) return;
    card.dataset.boundClick = 'true';
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => window.open(card.dataset.url, '_blank'));
  });
}

function loadFavoriteMovies(favorites) {
  if (!favorites || favorites.length === 0) {
    favorites = [
      { title: 'Stranger Things', poster: 'https://media.senscritique.com/media/000017934150/0/stranger_things.jpg', link: `${URLS.scProfile}/film/Stranger-Things-3-1-Stranger-Things` },
      { title: 'The Rain', poster: 'https://media.senscritique.com/media/000017755889/0/the_rain.jpg', link: `${URLS.scProfile}/film/The-Rain-2016-The-Rain` },
      { title: 'Sherlock', poster: 'https://media.senscritique.com/media/000006471582/0/sherlock.jpg', link: `${URLS.scProfile}/film/Sherlock-2010-Sherlock` },
      { title: 'The Last of Us', poster: 'https://media.senscritique.com/media/000021088759/0/the_last_of_us.jpg', link: `${URLS.scProfile}/film/The-Last-of-Us-2013-The-Last-of-Us` },
      { title: 'Ratatouille', poster: 'https://media.senscritique.com/media/000007069038/300/ratatouille.jpg', link: `${URLS.scProfile}/film/Ratatouille-2007-Ratatouille` },
      { title: 'Seven Deadly Sins', poster: 'https://media.senscritique.com/media/000019069819/0/seven_deadly_sins.jpg', link: `${URLS.scProfile}/film/Seven-Deadly-Sins-2011-Seven-Deadly-Sins` },
      { title: 'Syberia', poster: 'https://media.senscritique.com/media/000000085496/0/syberia.jpg', link: `${URLS.scProfile}/film/Syberia-1995-Syberia` },
      { title: 'Syberia II', poster: 'https://media.senscritique.com/media/000010801008/0/syberia_ii.jpg', link: `${URLS.scProfile}/film/Syberia-II-2000-Syberia-II` },
      { title: 'Syberia III', poster: 'https://media.senscritique.com/media/000021911486/300/syberia_3.png', link: `${URLS.scProfile}/film/Syberia-III-2002-Syberia-III` },
      { title: 'Syberia IV', poster: 'https://media.senscritique.com/media/000020210160/300/syberia_le_monde_d_avant.jpg', link: `${URLS.scProfile}/film/Syberia-Le-Monde-D-Avant-2004-Syberia-Le-Monde-D-Avant` },
      { title: 'Syberia: Remastered', poster: 'https://media.senscritique.com/media/000022857396/300/syberia_remastered.jpg', link: `${URLS.scProfile}/film/Syberia-Remastered-2015-Syberia-Remastered` },
      { title: 'Star Citizen', poster: 'https://media.senscritique.com/media/000020208505/300/star_citizen.png', link: `${URLS.scProfile}/film/Star-Citizen-2016-Star-Citizen` },
      { title: 'Mafia: Definitive Edition', poster: 'https://media.senscritique.com/media/000021012864/300/mafia_definitive_edition.png', link: `${URLS.scProfile}/film/Mafia-Definitive-Edition-2016-Mafia-Definitive-Edition` },
      { title: 'Mafia II: Definitive Edition', poster: 'https://media.senscritique.com/media/000021012865/300/mafia_ii_definitive_edition.png', link: `${URLS.scProfile}/film/Mafia-II-Definitive-Edition-2016-Mafia-II-Definitive-Edition` },
      { title: 'The Binding of Isaac: Rebirth', poster: 'https://media.senscritique.com/media/000022914982/300/the_binding_of_isaac_rebirth.jpg', link: `${URLS.scProfile}/film/The-Binding-of-Isaac-Rebirth-2015-The-Binding-of-Isaac-Rebirth` }
    ];
  }

  renderFavoriteMovies(favorites);
}

function renderFavoriteMovies(favorites) {
  const grid = state.elements.sc.favoritesGrid;
  grid.innerHTML = '';

  favorites.forEach(movie => {
    const movieItem = document.createElement('div');
    movieItem.className = 'sc-favorite-item';

    const img = document.createElement('img');
    img.src = movie.poster;
    img.alt = movie.title;
    img.className = 'sc-favorite-poster';
    img.loading = 'lazy';
    img.fetchPriority = 'low';
    img.decoding = 'async';

    const title = document.createElement('div');
    title.className = 'sc-favorite-title';
    title.textContent = movie.title;

    movieItem.appendChild(img);
    movieItem.appendChild(title);
    grid.appendChild(movieItem);
  });

  setupFavoritesSlider();
}

function setupFavoritesSlider() {
  const grid = state.elements.sc.favoritesGrid;
  const prevBtn = document.getElementById('sc-prev-btn');
  const nextBtn = document.getElementById('sc-next-btn');

  if (!grid || !prevBtn || !nextBtn) return;

  const newPrevBtn = prevBtn.cloneNode(true);
  const newNextBtn = nextBtn.cloneNode(true);

  prevBtn.replaceWith(newPrevBtn);
  nextBtn.replaceWith(newNextBtn);

  let currentPosition = 0;
  const scrollAmount = 220; // Réduit pour correspondre à la nouvelle taille des items

  const updateTransform = () => {
    grid.style.transform = `translateX(${currentPosition}px)`;
  };

  const updateButtonsVisibility = () => {
    const wrapperWidth = grid.parentElement.clientWidth;
    const gridWidth = grid.scrollWidth;
    const maxScroll = -(gridWidth - wrapperWidth);

    newPrevBtn.style.opacity = currentPosition >= 0 ? '0.3' : '1';
    newPrevBtn.style.pointerEvents = currentPosition >= 0 ? 'none' : 'auto';

    newNextBtn.style.opacity = currentPosition <= maxScroll ? '0.3' : '1';
    newNextBtn.style.pointerEvents = currentPosition <= maxScroll ? 'none' : 'auto';
  };

  newPrevBtn.addEventListener('click', () => {
    currentPosition = Math.min(currentPosition + scrollAmount, 0);
    updateTransform();
    updateButtonsVisibility();
  });

  newNextBtn.addEventListener('click', () => {
    const wrapperWidth = grid.parentElement.clientWidth;
    const gridWidth = grid.scrollWidth;
    const maxScroll = -(gridWidth - wrapperWidth);
    currentPosition = Math.max(currentPosition - scrollAmount, maxScroll);
    updateTransform();
    updateButtonsVisibility();
  });

  updateButtonsVisibility();
}

function useFallbackData(fallbackData) {
  const { sc } = state.elements;
  sc.username.textContent = fallbackData.username || CONFIG.scUsername;
  sc.bio.textContent = `${fallbackData.gender || 'Homme'} | ${fallbackData.location || 'France'}`;
  sc.movies.textContent = fallbackData.stats?.films || 66;
  sc.series.textContent = fallbackData.stats?.series || 32;
  sc.games.textContent = fallbackData.stats?.jeux || 19;
  sc.reviews.textContent = fallbackData.stats?.total || 117;

  // Afficher les critiques de fallback ou vides
  displayRecentReviews(fallbackData.reviews || []);
  
  loadFavoriteMovies(fallbackData.collections || []);
  setupStatLinks();
}

document.addEventListener('DOMContentLoaded', () => {
  initElements();
  preloadBadgeIcons();
  
  // Charger les données en parallèle pour optimiser le temps de chargement
  Promise.all([
    updateDiscordPresence(),
    fetchGitHubStats(),
    fetchSensCritiqueData()
  ]).catch(error => {
    console.error('Erreur lors du chargement initial:', error);
  });
  
  // Mettre à jour Discord périodiquement
  setInterval(updateDiscordPresence, CONFIG.discordPollInterval);
});

