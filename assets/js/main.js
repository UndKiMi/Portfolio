import { CONFIG } from './config/constants.js';
import { initElements } from './core/dom.js';
import { preloadBadgeIcons, updateDiscordPresence } from './services/discord.js';
import { fetchGitHubStats } from './services/github.js';
import { fetchSensCritiqueData } from './services/senscritique.js';

document.addEventListener('DOMContentLoaded', () => {
  initElements();
  preloadBadgeIcons();
  updateDiscordPresence();
  setInterval(updateDiscordPresence, CONFIG.discordPollInterval);
  fetchGitHubStats();
  fetchSensCritiqueData();
});
