import React, { useState, useEffect } from 'react';
import { useGitHub } from '../hooks/useGitHub';
import './GitHubSection.css';

// Utiliser le proxy Vite en développement, ou l'URL directe en production
const BACKEND_URL = import.meta.env.DEV 
  ? '/api' 
  : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000');
const GITHUB_USERNAME = 'UndKiMi';

function GitHubSection() {
  const { data, loading } = useGitHub();
  const [commits, setCommits] = useState({});

  useEffect(() => {
    if (data?.repos) {
      // Charger les commits pour les 5 premiers repos
      const topRepos = data.repos.slice(0, 5);
      topRepos.forEach(repo => {
        if (repo.full_name) {
          fetchCommit(repo);
        }
      });
    }
  }, [data]);

  const fetchCommit = async (repo) => {
    try {
      const [owner, repoName] = repo.full_name.split('/');
      const response = await fetch(`${BACKEND_URL}/github/commits/${owner}/${repoName}`);
      if (response.ok) {
        const commitsData = await response.json();
        if (Array.isArray(commitsData) && commitsData.length > 0) {
          setCommits(prev => ({
            ...prev,
            [repo.full_name]: commitsData[0]
          }));
        }
      }
    } catch (error) {
      // Ignorer les erreurs silencieusement
    }
  };

  const getTimeAgo = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 0) return null;
    
    if (seconds < 60) return 'À l\'instant';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Hier';
    if (days < 14) return `${days}j`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks} sem`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} mois`;
    const years = Math.floor(days / 365);
    return `${years} an${years > 1 ? 's' : ''}`;
  };

  const getProjectIcon = (language) => {
    const icons = {
      'Python': '🐍', 'JavaScript': '🤖', 'TypeScript': '📘', 'Java': '☕',
      'C++': '⚙️', 'C': '⚙️', 'C#': '🎮', 'Go': '🐹', 'Rust': '🦀',
      'PHP': '🐘', 'Ruby': '💎', 'Swift': '🐦', 'Kotlin': '🔷',
      'HTML': '🌐', 'CSS': '🎨', 'Shell': '💻', 'Dockerfile': '🐳',
      'Vue': '💚', 'React': '⚛️'
    };
    return icons[language] || '💻';
  };

  const getLanguageColor = (language) => {
    const colors = {
      'Python': '#3776ab', 'JavaScript': '#f7df1e', 'TypeScript': '#3178c6',
      'Java': '#ed8b00', 'C++': '#00599c', 'C': '#a8b9cc', 'C#': '#239120',
      'Go': '#00add8', 'Rust': '#000000', 'PHP': '#777bb4', 'Ruby': '#cc342d',
      'Swift': '#fa7343', 'Kotlin': '#7f52ff', 'HTML': '#e34c26', 'CSS': '#1572b6',
      'Shell': '#89e051', 'Vue': '#4fc08d', 'React': '#61dafb'
    };
    return colors[language] || '#6e7681';
  };

  const calculateStreak = (events = []) => {
    const today = new Date();
    const dateSet = new Set();
    
    events.forEach(event => {
      if (!event?.created_at) return;
      const eventDate = new Date(event.created_at);
      if (isNaN(eventDate.getTime())) return;
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
  };

  if (loading && !data) {
    return (
      <div className="projects-activity-titles">
        <div className="projects-heading-wrapper">
          <h2 id="projects-heading">Projets Github</h2>
          <div className="projects-heading-underline"></div>
        </div>
        <h2 className="github-activity-section-title">Activité GitHub</h2>
      </div>
    );
  }

  const githubData = data || {
    user: { followers: 0, public_repos: 0 },
    repos: [],
    events: []
  };

  const publicRepos = (githubData.repos || [])
    .filter(repo => !repo.private)
    .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
    .slice(0, 10);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentEvents = (githubData.events || []).filter(event => {
    if (!event?.created_at) return false;
    const eventDate = new Date(event.created_at);
    return eventDate > thirtyDaysAgo;
  });

  const streak = calculateStreak(githubData.events || []);

  return (
    <>
      <div className="projects-activity-titles">
        <div className="projects-heading-wrapper">
          <h2 id="projects-heading">Projets Github</h2>
          <div className="projects-heading-underline"></div>
        </div>
        <h2 className="github-activity-section-title">Activité GitHub</h2>
      </div>
      <div className="projects-activity-container">
        <section id="projects" className="section" aria-labelledby="projects-heading">
          <ul className="project-cards">
            {publicRepos.length === 0 ? (
              <li>
                <div className="project-loading">Aucun projet disponible</div>
              </li>
            ) : (
              publicRepos.map(repo => {
                const icon = getProjectIcon(repo.language);
                const langColor = getLanguageColor(repo.language);
                const isNotMainAuthor = repo.owner?.login?.toLowerCase() !== GITHUB_USERNAME.toLowerCase();
                
                return (
                  <li key={repo.id}>
                    <a
                      href={repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="project-card"
                    >
                      <span className="pc-icon">{icon}</span>
                      <div className="pc-content">
                        <div className="pc-title">
                          <span className="pc-name">{repo.name}</span>
                          <span className="pc-badge">{repo.private ? 'Private' : 'Public'}</span>
                        </div>
                        {isNotMainAuthor && (
                          <div className="pc-author">
                            Par <a 
                              href={repo.owner.html_url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="pc-author-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {repo.owner.login}
                            </a>
                          </div>
                        )}
                        <div className="pc-desc">
                          {repo.description 
                            ? (repo.description.length > 80 
                                ? repo.description.substring(0, 80) + '...' 
                                : repo.description)
                            : 'Pas de description'}
                        </div>
                        <div className="pc-meta">
                          {repo.language && (
                            <span className="pc-lang">
                              <span className="pc-dot" style={{ backgroundColor: langColor }}></span>
                              {repo.language}
                            </span>
                          )}
                          <span className="pc-stars">⭐ {repo.stargazers_count || 0}</span>
                        </div>
                      </div>
                    </a>
                  </li>
                );
              })
            )}
          </ul>
        </section>
        
        <section id="github-activity" className="section" aria-labelledby="github-activity-heading">
          <div className="github-activity-compact">
            <div className="github-stats-grid">
              <div className="stat-card">
                <div className="stat-value">{recentEvents.length}</div>
                <div className="stat-label">Contributions</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{streak}</div>
                <div className="stat-label">Série actuelle</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{githubData.user.public_repos || 0}</div>
                <div className="stat-label">Dépôts</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{githubData.user.followers || 0}</div>
                <div className="stat-label">Abonnés</div>
              </div>
            </div>
            
            <div className="github-activity-details">
              <table className="activity-table">
                <thead>
                  <tr>
                    <th>Dépôt</th>
                    <th>Dernier commit</th>
                    <th>Il y a</th>
                  </tr>
                </thead>
                <tbody>
                  {publicRepos.slice(0, 5).map(repo => {
                    const commit = commits[repo.full_name];
                    const commitDate = commit?.commit?.author?.date || repo.pushed_at || repo.updated_at;
                    const timeAgo = getTimeAgo(commitDate);
                    const commitMessage = commit?.commit?.message || '';
                    const cleanMessage = commitMessage.split('\n')[0].trim();
                    const displayMessage = cleanMessage.length > 40 
                      ? `${cleanMessage.slice(0, 40)}…` 
                      : cleanMessage || 'Chargement...';
                    
                    return (
                      <tr key={repo.id}>
                        <td>
                          <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="repo-name">
                            {repo.name}
                          </a>
                        </td>
                        <td className="commit-message" title={commitMessage}>
                          {displayMessage}
                        </td>
                        <td className="commit-time">{timeAgo || 'non disponible'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default GitHubSection;

