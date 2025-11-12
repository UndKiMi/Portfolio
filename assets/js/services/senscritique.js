import { CONFIG, URLS } from '../config/constants.js';
import { getCache, getElements } from '../core/state.js';
import { isCacheValid } from '../utils/cache.js';
import { formatReviewDate } from '../utils/date.js';
import { setupFavoritesSlider, setupStatLinks } from '../utils/ui.js';

export async function fetchSensCritiqueData() {
  const cache = getCache();
  if (isCacheValid(cache.lastScFetch, CONFIG.cacheDurations.sensCritique) && cache.sensCritique) {
    updateUIWithSCData(cache.sensCritique);
    return;
  }

  try {
    const response = await fetch(`${CONFIG.backendUrl}/senscritique`);
    if (!response.ok) {
      throw new Error(`Backend non disponible: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data) {
      throw new Error('Aucune donnée reçue du backend');
    }
    
    cache.sensCritique = data;
    cache.lastScFetch = Date.now();

    if (data.error && data.fallback) {
      useFallbackData(data.fallback);
      return;
    }

    updateUIWithSCData(data);
  } catch (error) {
    console.error('Erreur lors de la récupération Sens Critique:', error);
    // Toujours afficher les données de secours en cas d'erreur
    useFallbackData({
      username: CONFIG.scUsername,
      stats: { films: 66, series: 32, jeux: 19, livres: 17 }
    });
  }
}

function updateUIWithSCData(data) {
  const elements = getElements();
  const { sc } = elements;
  
  if (!sc || !sc.reviewsContainer) {
    console.error('Éléments DOM Sens Critique non initialisés');
    return;
  }
  
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
  // Toujours supprimer le message de chargement
  reviewsContainer.innerHTML = '';

  if (data.reviews && data.reviews.length > 0 && data.reviews[0].content) {
    const reviewsToShow = data.reviews.slice(0, 50);
    reviewsToShow.forEach(review => {
      const reviewItem = document.createElement('a');
      reviewItem.className = 'sc-review-item';
      
      // Extraire l'URL du href dans le content si url est null
      let reviewUrl = review.url;
      if (!reviewUrl && review.content) {
        const hrefMatch = review.content.match(/href="([^"]+)"/);
        if (hrefMatch) {
          reviewUrl = hrefMatch[1];
        }
      }
      
      // Construire l'URL complète si elle est relative
      if (!reviewUrl) {
        reviewUrl = `${URLS.scProfile}/critiques`;
      } else if (reviewUrl.startsWith('/')) {
        reviewUrl = `https://www.senscritique.com${reviewUrl}`;
      }
      
      reviewItem.href = reviewUrl;
      reviewItem.target = '_blank';
      reviewItem.rel = 'noopener noreferrer';

      // Nettoyer le contenu : enlever le HTML et décoder les entités
      let rawContent = review.content || review.comment || '';
      let cleanContent = null;
      
      if (rawContent && rawContent.trim().length > 0) {
        // Vérifier si le contenu ressemble à une balise HTML invalide
        // (contient class=, href=, data-testid= mais pas de texte réel)
        // On vérifie que ce n'est PAS juste une balise HTML incomplète
        const looksLikeInvalidHTML = rawContent.includes('class=') && 
                                      rawContent.includes('href=') && 
                                      (rawContent.includes('data-testid=') || rawContent.includes('sc-')) &&
                                      rawContent.length < 200 &&
                                      !rawContent.match(/[a-zA-Z]{10,}/) && // Pas de mot de plus de 10 lettres (texte réel)
                                      !rawContent.match(/^[^<]*[a-zA-Z]{20,}[^>]*$/); // Pas de texte réel de plus de 20 caractères
        
        if (!looksLikeInvalidHTML) {
          // Si le content contient du HTML, extraire seulement le texte
          if (rawContent.includes('<') || rawContent.includes('href=')) {
            // Créer un élément temporaire pour parser le HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = rawContent;
            cleanContent = tempDiv.textContent || tempDiv.innerText || '';
          } else {
            cleanContent = rawContent;
          }
          
          // Décoder les entités HTML
          if (cleanContent && cleanContent.trim().length > 0) {
            const textarea = document.createElement('textarea');
            textarea.innerHTML = cleanContent;
            cleanContent = textarea.value.trim();
            
            // Vérifier que le contenu final est valide (pas vide après nettoyage)
            // et qu'il contient du texte réel (pas juste des attributs HTML)
            // Si le contenu fait plus de 30 caractères et contient des mots, c'est valide
            if (cleanContent.length > 0 && 
                (cleanContent.length >= 30 || !cleanContent.includes('class=') || !cleanContent.includes('href='))) {
              // Le contenu est valide, on le garde
            } else {
              cleanContent = null;
            }
          } else {
            cleanContent = null;
          }
        }
        // Si looksLikeInvalidHTML est true, cleanContent reste null (ne pas afficher)
      }
      
      // Nettoyer le titre aussi (décoder &amp; etc.)
      let cleanTitle = review.title || 'Sans titre';
      const titleTextarea = document.createElement('textarea');
      titleTextarea.innerHTML = cleanTitle;
      cleanTitle = titleTextarea.value;

      // Priorité: date_raw (texte brut original) > date (texte) > created_at (ISO)
      // On préfère utiliser le texte brut original pour garder le format Sens Critique
      let dateToFormat = null;
      
      // Si on a un texte brut original, l'utiliser directement (il sera formaté par formatReviewDate)
      if (review.date_raw) {
        dateToFormat = review.date_raw;
      } else if (review.date) {
        // Sinon, utiliser le champ date
        dateToFormat = review.date;
      } else if (review.created_at || review.updated_at) {
        // En dernier recours, utiliser la date ISO
        dateToFormat = review.created_at || review.updated_at;
      }
      
      const formattedDate = dateToFormat ? formatReviewDate(dateToFormat) : '';
      const ratingStars = review.rating ? ` | ${review.rating}⭐` : '';

      reviewItem.innerHTML = `
        <div class="sc-review-header">
          <div class="sc-review-title">${cleanTitle}${ratingStars}</div>
        </div>
        ${cleanContent ? `<div class="sc-review-comment">${cleanContent}</div>` : ''}
        ${formattedDate ? `<div class="sc-review-date">${formattedDate}</div>` : ''}
      `;

      reviewsContainer.appendChild(reviewItem);
    });
  } else {
    // Si pas de critiques, utiliser les données de secours
    useFallbackData({ username: CONFIG.scUsername, stats: data.stats });
    return;
  }

  loadFavoriteMovies(data.favorites || []);
  setupStatLinks();
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
  const elements = getElements();
  const grid = elements.sc.favoritesGrid;
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

function useFallbackData(fallbackData) {
  const elements = getElements();
  const { sc } = elements;
  
  if (!sc || !sc.reviewsContainer) {
    console.error('Éléments DOM Sens Critique non initialisés dans useFallbackData');
    return;
  }
  
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
      date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      url: `${URLS.scProfile}/critiques`,
      rating: 9
    },
    {
      title: 'Nouvelle École',
      content: 'Franchement, c\'est juste nul. Tout sonne faux, surjoué, trop de drama pour pas grand-chose...',
      date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      url: `${URLS.scProfile}/critiques`,
      rating: 3
    },
    {
      title: 'Astérix & Obélix : Le Combat des chefs',
      content: 'Franchement, j\'ai passé un bon moment devant ce petit cartoon, sans que ce soit une claque non plus...',
      date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      url: `${URLS.scProfile}/critiques`,
      rating: 7
    }
  ];

  const reviewsContainer = sc.reviewsContainer;
  // S'assurer que le message de chargement est supprimé
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
      ${formattedDate ? `<div class="sc-review-date">${formattedDate}</div>` : ''}
    `;

    reviewsContainer.appendChild(reviewItem);
  });

  loadFavoriteMovies([]);
  setupStatLinks();
}

