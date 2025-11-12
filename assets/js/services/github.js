import { CONFIG, URLS } from '../config/constants.js';
import { getElements, getCache } from '../core/state.js';
import { isCacheValid } from '../utils/cache.js';
import { getTimeAgo } from '../utils/date.js';

export async function fetchGitHubStats() {
  const cache = getCache();
  if (isCacheValid(cache.lastGithubFetch, CONFIG.cacheDurations.github) && cache.github) {
    updateUIWithGitHubData(cache.github);
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

    cache.github = { user, repos, events };
    cache.lastGithubFetch = Date.now();

    updateUIWithGitHubData(cache.github);
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
  const elements = getElements();
  const { github } = elements;

  github.followers.textContent = user.followers || 0;
  github.repos.textContent = user.public_repos || 0;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentEvents = (events || []).filter(event => {
    try {
      return event?.created_at && new Date(event.created_at) > thirtyDaysAgo;
    } catch {
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

  events.forEach(event => {
    if (!event?.created_at) return;
    const date = event.created_at.split('T')[0];
    dateSet.add(date);
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
        updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        full_name: `${CONFIG.githubUsername}/5Ghz_Cleaner`,
        description: 'Optimisez et nettoyez votre installation Windows 11'
      },
      {
        name: 'Medal-Bot',
        html_url: `${URLS.githubProfile}/Medal-Bot`,
        updated_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        full_name: `${CONFIG.githubUsername}/Medal-Bot`,
        description: 'Bot Discord multifonction'
      },
      {
        name: 'K.Ring',
        html_url: `${URLS.githubProfile}/K.Ring`,
        updated_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
        full_name: `${CONFIG.githubUsername}/K.Ring`,
        description: 'Bot Discord privé multifonctions'
      }
    ],
    events: []
  };

  const elements = getElements();
  const { github } = elements;
  github.contributions.textContent = '45';
  github.streak.textContent = '3';
  github.followers.textContent = fallbackData.user.followers;
  github.repos.textContent = fallbackData.user.public_repos;

  generateActivityTable(fallbackData.events, fallbackData.repos);
}

async function generateActivityTable(events, repos = []) {
  const elements = getElements();
  const tbody = elements.github.activityTable;
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
    const updatedTime = repo.updated_at || repo.pushed_at || new Date().toISOString();
    const timeAgo = getTimeAgo(updatedTime);

    row.innerHTML = `
      <td>
        <a href="${repo.html_url || '#'}" target="_blank" class="repo-name">
          ${repoName}
        </a>
      </td>
      <td class="commit-message">
        ${repo.description || 'Pas de description'}
      </td>
      <td class="commit-time">${timeAgo}</td>
    `;

    tbody.appendChild(row);

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

    const commitMessage = commits[0]?.commit?.message;
    if (!commitMessage) return;

    const commitMessageCell = row.querySelector('.commit-message');
    if (!commitMessageCell) return;

    commitMessageCell.textContent = commitMessage.length > 30
      ? `${commitMessage.slice(0, 30)}…`
      : commitMessage;
    commitMessageCell.title = commitMessage;
  } catch {
    // Ignore commit fetch errors silently
  }
}

