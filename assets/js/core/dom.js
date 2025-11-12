import { getState } from './state.js';

export function initElements() {
  const state = getState();
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

