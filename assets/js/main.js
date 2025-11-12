const CONFIG = {
  backendUrl: 'https://mypage-production-4e09.up.railway.app',
  scUsername: 'KiMi_',
  githubUsername: 'UndKiMi',
  discordPollInterval: 2000,
  cacheDurations: {
    github: 10 * 60 * 1000,
    discord: 200,
    sensCritique: 30 * 60 * 1000
  }
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
  const { channelName, guildIcon, guildId, streaming: isStreaming, video, selfMute, selfDeaf } = voiceState;

  let voiceContent = '';
  if (guildIcon && guildId) {
    const iconUrl = `https://cdn.discordapp.com/icons/${guildId}/${guildIcon}.png?size=32`;
    voiceContent = `<img src="${iconUrl}" class="guild-icon-hover" alt="Serveur"> En vocal dans ${channelName}`;
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
  if (isCacheValid(state.cache.lastGithubFetch, CONFIG.cacheDurations.github) && state.cache.github) {
    updateUIWithGitHubData(state.cache.github);
    return;
  }

  try {
    const [userResponse, reposResponse] = await Promise.all([
      fetch(URLS.githubApi),
      fetch(`${URLS.githubApi}/repos?sort=updated&per_page=10`)
    ]);

    if (!userResponse.ok || !reposResponse.ok) {
      throw new Error('API GitHub non disponible');
    }

    const [user, repos] = await Promise.all([userResponse.json(), reposResponse.json()]);
    const eventsResponse = await fetch(`${URLS.githubApi}/events?per_page=100`);
    const events = eventsResponse.ok ? await eventsResponse.json() : [];

    state.cache.github = { user, repos, events };
    state.cache.lastGithubFetch = Date.now();

    updateUIWithGitHubData(state.cache.github);
  } catch (error) {
    console.error('❌ Erreur GitHub:', error);
    useFallbackGitHubData();
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
    
    // NOUVELLE MÉTHODE: Utiliser la fonction dédiée pour extraire la date
    const dateISO = extractGitHubDate(repo);
    const timeAgo = dateISO ? getTimeAgo(dateISO) : null;
    
    // Log pour déboguer
    if (dateISO) {
      console.log(`📅 Repository "${repoName}": dateISO=${dateISO}, timeAgo=${timeAgo}`);
    } else {
      console.log(`⚠️  Repository "${repoName}": aucune date trouvée`);
    }

    row.innerHTML = `
      <td>
        <a href="${repo.html_url || '#'}" target="_blank" class="repo-name">
          ${repoName}
        </a>
      </td>
      <td class="commit-message">
        ${repo.description || 'Pas de description'}
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
    const commitsResponse = await fetch(`https://api.github.com/repos/${repo.full_name}/commits?per_page=1`);
    if (!commitsResponse.ok) return;

    const commits = await commitsResponse.json();
    if (!Array.isArray(commits) || commits.length === 0) return;

    const commit = commits[0];
    const commitMessage = commit?.commit?.message;
    
    // NOUVELLE MÉTHODE: Extraire la date du commit (plus précise)
    const commitDateISO = extractGitHubDate(repo, commit);
    
    // Mettre à jour le message du commit
    if (commitMessage) {
      const commitMessageCell = row.querySelector('.commit-message');
      if (commitMessageCell) {
        commitMessageCell.textContent = commitMessage.length > 30
          ? `${commitMessage.slice(0, 30)}…`
          : commitMessage;
        commitMessageCell.title = commitMessage;
      }
    }
    
    // Mettre à jour la date affichée avec la date du commit (plus précise)
    if (commitDateISO) {
      const commitTimeCell = row.querySelector('.commit-time');
      if (commitTimeCell) {
        const timeAgo = getTimeAgo(commitDateISO);
        if (timeAgo) {
          commitTimeCell.textContent = timeAgo;
          console.log(`📅 Date GitHub mise à jour avec le commit: ${commitDateISO} → ${timeAgo}`);
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
      console.log(`📅 Date GitHub trouvée (commit): ${commitDate}`);
      return commitDate;
    }
  }
  
  // MÉTHODE 2: Utiliser pushed_at (date du dernier push)
  if (repo.pushed_at && isValidDate(repo.pushed_at)) {
    console.log(`📅 Date GitHub trouvée (pushed_at): ${repo.pushed_at}`);
    return repo.pushed_at;
  }
  
  // MÉTHODE 3: Utiliser updated_at (date de dernière mise à jour)
  if (repo.updated_at && isValidDate(repo.updated_at)) {
    console.log(`📅 Date GitHub trouvée (updated_at): ${repo.updated_at}`);
    return repo.updated_at;
  }
  
  // MÉTHODE 4: Utiliser created_at (date de création) en dernier recours
  if (repo.created_at && isValidDate(repo.created_at)) {
    console.log(`📅 Date GitHub trouvée (created_at): ${repo.created_at}`);
    return repo.created_at;
  }
  
  console.log(`⚠️  Aucune date valide trouvée pour le repository "${repo.name || 'inconnu'}"`);
  console.log(`   pushed_at: ${repo.pushed_at || 'N/A'}, updated_at: ${repo.updated_at || 'N/A'}, created_at: ${repo.created_at || 'N/A'}`);
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
    console.log(`⚠️  Format de date GitHub invalide: "${cleanedDate}"`);
    return null;
  }
  
  // Parser la date
  const parsedDate = new Date(cleanedDate);
  
  // Vérifier que la date est valide
  if (Number.isNaN(parsedDate.getTime())) {
    console.log(`⚠️  Impossible de parser la date GitHub: "${cleanedDate}"`);
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
    console.log(`⚠️  Date invalide dans getTimeAgo: ${date}`);
    return null;
  }

  const now = new Date();
  const seconds = Math.floor((now - parsedDate) / 1000);

  // Vérifier que la date n'est pas dans le futur
  if (seconds < 0) {
    console.log(`⚠️  Date dans le futur: ${parsedDate.toISOString()}`);
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
  if (isCacheValid(state.cache.lastScFetch, CONFIG.cacheDurations.sensCritique) && state.cache.sensCritique) {
    updateUIWithSCData(state.cache.sensCritique);
    return;
  }

  try {
    const response = await fetch(`${CONFIG.backendUrl}/senscritique`);
    if (!response.ok) throw new Error('Backend non disponible');

    const data = await response.json();
    state.cache.sensCritique = data;
    state.cache.lastScFetch = Date.now();

    if (data.error && data.fallback) {
      useFallbackData(data.fallback);
      return;
    }

    updateUIWithSCData(data);
  } catch (error) {
    console.error('Erreur lors de la récupération Sens Critique:', error);
    useFallbackData({
      username: CONFIG.scUsername,
      stats: { films: 66, series: 32, jeux: 19, livres: 17 }
    });
  }
}

function updateUIWithSCData(data) {
  const { sc } = state.elements;
  sc.username.textContent = data.username || CONFIG.scUsername;
  
  // Construire le texte de la bio avec genre, localisation et âge
  let bioText = `${data.gender || 'Homme'} | ${data.location || 'France'}`;
  if (data.age) {
    bioText += ` | ${data.age} ans`;
  }
  sc.bio.textContent = bioText;
  sc.movies.textContent = data.stats?.films || 0;
  sc.series.textContent = data.stats?.series || 0;
  sc.games.textContent = data.stats?.jeux || 0;
  sc.reviews.textContent = data.stats?.total || ((data.stats?.films || 0) + (data.stats?.series || 0) + (data.stats?.jeux || 0));

  const reviewsContainer = sc.reviewsContainer;
  reviewsContainer.innerHTML = '';

  if (data.reviews && data.reviews.length > 0 && data.reviews[0].content) {
    const reviewsToShow = data.reviews.slice(0, 50);
    reviewsToShow.forEach(review => {
      const reviewItem = document.createElement('a');
      reviewItem.className = 'sc-review-item';
      reviewItem.href = review.url || `${URLS.scProfile}/critiques`;
      reviewItem.target = '_blank';
      reviewItem.rel = 'noopener noreferrer';

      // SOLUTION ALTERNATIVE: Toujours parser le texte brut de la date
      // Priorité: date_raw (texte brut) > created_at (ISO) > date (texte)
      let dateToFormat = null;
      
      // Si on a un texte brut, le parser en date ISO
      if (review.date_raw) {
        const parsedFromRaw = parseDateFromText(review.date_raw);
        if (parsedFromRaw) {
          dateToFormat = parsedFromRaw;
        } else {
          // Si le parsing échoue, utiliser le texte brut directement
          dateToFormat = review.date_raw;
        }
      } else if (review.created_at || review.updated_at) {
        // Si on a déjà une date ISO, l'utiliser
        dateToFormat = review.created_at || review.updated_at;
      } else if (review.date) {
        // Sinon, essayer de parser le champ date
        const parsedFromDate = parseDateFromText(review.date);
        dateToFormat = parsedFromDate || review.date;
      }
      
      const formattedDate = dateToFormat ? formatReviewDate(dateToFormat) : 'non disponible';
      const ratingStars = review.rating ? ` | ${review.rating}⭐` : '';

      reviewItem.innerHTML = `
        <div class="sc-review-header">
          <div class="sc-review-title">${review.title || 'Sans titre'}${ratingStars}</div>
        </div>
        <div class="sc-review-comment">${review.content || review.comment || 'Pas de commentaire'}</div>
        <div class="sc-review-date">${formattedDate}</div>
      `;

      reviewsContainer.appendChild(reviewItem);
    });
  } else {
    useFallbackData({ username: CONFIG.scUsername, stats: data.stats });
    return;
  }

  loadFavoriteMovies(data.favorites || []);
  setupStatLinks();
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
  
  // "Il y a X jour(s)"
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
  
  // Pattern: "le 4 nov. 2025" ou "le 4 novembre 2025"
  const match = dateText.match(/le\s+(\d{1,2})\s+(\w+)\.?\s+(\d{4})/i);
  if (match) {
    const day = parseInt(match[1]);
    const monthName = match[2].toLowerCase();
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
  const scrollAmount = 280;

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

  const fallbackReviews = [
    {
      title: 'The Rain',
      content: 'Honnêtement, j\'ai vraiment accroché à cette série. Le concept du virus transmis par la pluie est super original...',
      // Pas de date par défaut - sera affiché comme "non disponible"
      url: `${URLS.scProfile}/critiques`,
      rating: 9
    },
    {
      title: 'Nouvelle École',
      content: 'Franchement, c\'est juste nul. Tout sonne faux, surjoué, trop de drama pour pas grand-chose...',
      // Pas de date par défaut - sera affiché comme "non disponible"
      url: `${URLS.scProfile}/critiques`,
      rating: 3
    },
    {
      title: 'Astérix & Obélix : Le Combat des chefs',
      content: 'Franchement, j\'ai passé un bon moment devant ce petit cartoon, sans que ce soit une claque non plus...',
      // Pas de date par défaut - sera affiché comme "non disponible"
      url: `${URLS.scProfile}/critiques`,
      rating: 7
    }
  ];

  const reviewsContainer = sc.reviewsContainer;
  reviewsContainer.innerHTML = '';

  fallbackReviews.forEach(review => {
    const reviewItem = document.createElement('a');
    reviewItem.className = 'sc-review-item';
    reviewItem.href = review.url;
    reviewItem.target = '_blank';
    reviewItem.rel = 'noopener noreferrer';

    const formattedDate = formatReviewDate(review.date);
    const ratingStars = review.rating ? ` | ${review.rating}⭐` : '';

    reviewItem.innerHTML = `
      <div class="sc-review-header">
        <div class="sc-review-title">${review.title}${ratingStars}</div>
      </div>
      <div class="sc-review-comment">${review.content}</div>
      <div class="sc-review-date">${formattedDate}</div>
    `;

    reviewsContainer.appendChild(reviewItem);
  });

  loadFavoriteMovies([]);
  setupStatLinks();
}

document.addEventListener('DOMContentLoaded', () => {
  initElements();
  preloadBadgeIcons();
  updateDiscordPresence();
  setInterval(updateDiscordPresence, CONFIG.discordPollInterval);
  fetchGitHubStats();
  fetchSensCritiqueData();
});

