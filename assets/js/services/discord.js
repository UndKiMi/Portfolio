import { CONFIG, STATUS_LABELS, activityLogos } from '../config/constants.js';
import { getState, getElements, getCache, setDiscordFetchInProgress, isDiscordFetchInProgress, getBadgeIconsCache } from '../core/state.js';
import { isCacheValid } from '../utils/cache.js';

export function preloadBadgeIcons() {
  const badgeFlags = [
    'Staff', 'Partner', 'Hypesquad', 'BugHunterLevel1', 'HypeSquadOnlineHouse1',
    'HypeSquadOnlineHouse2', 'HypeSquadOnlineHouse3', 'PremiumEarlySupporter',
    'BugHunterLevel2', 'VerifiedBot', 'VerifiedDeveloper', 'CertifiedModerator',
    'ActiveDeveloper', 'Nitro', 'BotHTTPInteractions', 'Spammer', 'DisablePremium',
    'HasUnreadUrgentMessages', 'Quarantined', 'Collaborator', 'RestrictedCollaborator',
    'QuestCompleted', 'GuildProductPurchaser', 'SupportsCommands', 'ApplicationAutoModerationRuleCreateBadge'
  ];

  const badgeIconsCache = getBadgeIconsCache();
  badgeFlags.forEach(flag => {
    const badge = getDiscordBadgeInfo(flag);
    if (badge && badge.icon && !badgeIconsCache.has(badge.name)) {
      const img = new Image();
      img.src = badge.icon;
      badgeIconsCache.set(badge.name, img);
    }
  });
}

export async function updateDiscordPresence() {
  if (isDiscordFetchInProgress()) {
    return;
  }

  const cache = getCache();
  if (isCacheValid(cache.lastDiscordFetch, CONFIG.cacheDurations.discord) && cache.discord) {
    return;
  }

  setDiscordFetchInProgress(true);

  try {
    const response = await fetch(`${CONFIG.backendUrl}/discord-status`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!data.user) throw new Error('Utilisateur non trouvé');

    const payload = JSON.stringify(data);
    if (payload !== cache.lastDiscordData) {
      cache.discord = data;
      cache.lastDiscordData = payload;
      applyDiscordPresence(data);
    }

    cache.lastDiscordFetch = Date.now();
  } catch (error) {
    console.error('Erreur Discord:', error);
    if (!cache.discord) {
      const elements = getElements();
      const { discord } = elements;
      
      if (!discord || !discord.username || !discord.status || !discord.statusText || !discord.activity) {
        console.error('❌ Éléments DOM Discord non initialisés');
        return;
      }
      
      discord.username.textContent = 'KiMi';
      discord.status.className = 'status-dot offline';
      discord.statusText.textContent = 'Serveur hors ligne';
      discord.activity.textContent = 'Démarrez le serveur backend pour voir le statut Discord';
      discord.activity.classList.remove('voice');
      if (discord.streaming) {
        discord.streaming.classList.remove('is-visible');
      }
    }
  } finally {
    setDiscordFetchInProgress(false);
  }
}

function applyDiscordPresence(data) {
  const elements = getElements();
  const { discord } = elements;
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
  const elements = getElements();
  const { activity, streaming } = elements.discord;
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
  streaming.textContent = isStreaming ? '📺 En partage d\'écran' : '';
}

function renderStandardActivity(activities) {
  const elements = getElements();
  const { activity, streaming } = elements.discord;
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

export function getDiscordBadgeInfo(flag) {
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
  const elements = getElements();
  const badgesEl = elements.discord.badges;
  badgesEl.innerHTML = '';

  const badges = (user.flags && user.flags.length > 0) ? user.flags : (user.publicFlags || []);
  const badgeIconsCache = getBadgeIconsCache();

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

