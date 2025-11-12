export const CONFIG = {
  backendUrl: 'https://mypage-production-4e09.up.railway.app',
  // backendUrl: 'http://localhost:3000',
  scUsername: 'KiMi_',
  githubUsername: 'UndKiMi',
  discordPollInterval: 2000,
  cacheDurations: {
    github: 10 * 60 * 1000,
    discord: 200,
    sensCritique: 30 * 60 * 1000
  }
};

export const URLS = {
  scProfile: `https://www.senscritique.com/${CONFIG.scUsername}`,
  githubProfile: `https://github.com/${CONFIG.githubUsername}`,
  githubApi: `https://api.github.com/users/${CONFIG.githubUsername}`
};

export const STATUS_LABELS = {
  online: 'En ligne',
  idle: 'Absent',
  dnd: 'Ne pas déranger',
  offline: 'Hors ligne'
};

export const activityLogos = {
  youtube: { url: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Youtube_logo.png', height: '18px' },
  twitch: { url: 'https://pngimg.com/uploads/twitch/twitch_PNG12.png', height: '25px' },
  spotify: { url: 'https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Primary_Logo_RGB_Green-300x300.png', height: '18px' },
  netflix: { url: 'https://cdn.rcd.gg/PreMiD/websites/N/Netflix/assets/logo.png', height: '18px' }
};

