import { CONFIG } from './config/constants.js';
import { initElements } from './core/dom.js';
import { preloadBadgeIcons, updateDiscordPresence } from './services/discord.js';
import { fetchGitHubStats } from './services/github.js';
import { fetchSensCritiqueData } from './services/senscritique.js';

document.addEventListener('DOMContentLoaded', () => {
  try {
    console.log('🚀 Initialisation de l\'application...');
    initElements();
    console.log('✅ Éléments DOM initialisés');
    
    preloadBadgeIcons();
    console.log('✅ Badges Discord préchargés');
    
    updateDiscordPresence().catch(err => console.error('Erreur Discord:', err));
    setInterval(() => {
      updateDiscordPresence().catch(err => console.error('Erreur Discord:', err));
    }, CONFIG.discordPollInterval);
    
    fetchGitHubStats().catch(err => console.error('Erreur GitHub:', err));
    fetchSensCritiqueData().catch(err => console.error('Erreur Sens Critique:', err));
    
    console.log('✅ Application initialisée');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
  }
});
