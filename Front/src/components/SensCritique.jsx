import React, { useState, useMemo } from 'react';
import { useSensCritique } from '../hooks/useSensCritique';
import './SensCritique.css';

const SC_USERNAME = 'KiMi_';
const SC_PROFILE_URL = `https://www.senscritique.com/${SC_USERNAME}`;
const REVIEWS_PER_PAGE = 5;

function SensCritique() {
  const { data, loading } = useSensCritique();
  const [currentPage, setCurrentPage] = useState(1);

  const reviews = useMemo(() => {
    if (!data?.reviews) return [];
    return data.reviews;
  }, [data]);

  const paginatedReviews = useMemo(() => {
    const start = (currentPage - 1) * REVIEWS_PER_PAGE;
    return reviews.slice(start, start + REVIEWS_PER_PAGE);
  }, [reviews, currentPage]);

  const totalPages = Math.ceil(reviews.length / REVIEWS_PER_PAGE);

  const handleStatClick = (url) => {
    window.open(url, '_blank');
  };

  if (loading && !data) {
    return (
      <section id="senscritique" className="section" aria-labelledby="senscritique-heading">
        <div className="senscritique-titles">
          <h2>Sens-Critique</h2>
          <a href={`${SC_PROFILE_URL}/critiques`} target="_blank" className="sc-reviews-section-title">
            <h2>Critiques Récentes</h2>
          </a>
        </div>
        <div className="senscritique-container">
          <div className="sc-loading">Chargement...</div>
        </div>
      </section>
    );
  }

  const profileData = data || {
    username: SC_USERNAME,
    gender: 'Homme',
    location: 'France',
    stats: { films: 0, series: 0, jeux: 0, total: 0 },
    favorites: [],
    reviews: []
  };

  return (
    <section id="senscritique" className="section" aria-labelledby="senscritique-heading">
      <div className="senscritique-titles">
        <h2>Sens-Critique</h2>
        <a href={`${SC_PROFILE_URL}/critiques`} target="_blank" className="sc-reviews-section-title">
          <h2>Critiques Récentes</h2>
        </a>
      </div>
      <div className="senscritique-container">
        <div className="sc-profile-card">
          <div className="sc-header">
            <div className="sc-logo">
              <img 
                src="https://www.senscritique.com/logo/senscritique.png" 
                alt="Sens Critique Logo" 
                className="sc-logo-img" 
                loading="lazy"
              />
            </div>
            <div className="sc-user-info">
              <h3>{profileData.username}</h3>
              <p>
                {profileData.gender || 'Homme'} | {profileData.location || 'France'}
                {profileData.age && ` | ${profileData.age} ans`}
              </p>
            </div>
          </div>
          
          <div className="sc-stats">
            <div 
              className="stat-card" 
              onClick={() => handleStatClick(`${SC_PROFILE_URL}/collection?universe=1`)}
            >
              <div className="stat-value">{profileData.stats?.films || 0}</div>
              <div className="stat-label">Films</div>
            </div>
            <div 
              className="stat-card"
              onClick={() => handleStatClick(`${SC_PROFILE_URL}/collection?universe=4`)}
            >
              <div className="stat-value">{profileData.stats?.series || 0}</div>
              <div className="stat-label">Séries</div>
            </div>
            <div 
              className="stat-card"
              onClick={() => handleStatClick(`${SC_PROFILE_URL}/collection?universe=3`)}
            >
              <div className="stat-value">{profileData.stats?.jeux || 0}</div>
              <div className="stat-label">Jeux vidéo</div>
            </div>
            <div 
              className="stat-card"
              onClick={() => handleStatClick(`${SC_PROFILE_URL}/critiques`)}
            >
              <div className="stat-value">{profileData.stats?.total || 0}</div>
              <div className="stat-label">Critiques</div>
            </div>
          </div>
          
          <div className="sc-favorites">
            <a href={`${SC_PROFILE_URL}/collection?action=RECOMMEND`} target="_blank" className="sc-favorites-link">
              <h3 className="sc-favorites-title">Coup de cœur 🍑</h3>
              <div className="sc-favorites-underline"></div>
            </a>
            <FavoritesSlider favorites={profileData.favorites || profileData.collections || []} />
          </div>
        </div>
        
        <div className="sc-recent-reviews">
          <div className="sc-reviews-container">
            {paginatedReviews.length === 0 ? (
              <div className="sc-review-empty">Aucune critique disponible</div>
            ) : (
              <>
                {paginatedReviews.map((review, index) => (
                  <ReviewItem key={index} review={review} profileUrl={SC_PROFILE_URL} />
                ))}
                {totalPages > 1 && (
                  <div className="sc-pagination">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="sc-pagination-btn"
                    >
                      Précédent
                    </button>
                    <span className="sc-pagination-info">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="sc-pagination-btn"
                    >
                      Suivant
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ReviewItem({ review, profileUrl }) {
  const cleanHTML = (text) => {
    if (!text) return '';
    return text.replace(/<[^>]*>/g, '').trim();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'non disponible';
    // Logique simplifiée - vous pouvez améliorer cela
    return dateString;
  };

  const title = cleanHTML(review.title || 'Sans titre');
  const content = cleanHTML(review.content || review.comment || 'Pas de commentaire');
  const date = formatDate(review.created_at || review.date || review.date_raw);
  const rating = review.rating ? ` | ${review.rating}⭐` : '';

  return (
    <div className="sc-review-item">
      {review.image && (
        <img 
          src={review.image} 
          alt={title} 
          className="sc-review-image"
          loading="lazy"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      )}
      <a 
        href={review.url || `${profileUrl}/critiques`} 
        target="_blank" 
        rel="noopener noreferrer"
        className="sc-review-content-wrapper"
      >
        <div className="sc-review-header">
          <div className="sc-review-title">
            {title}{rating}
          </div>
        </div>
        <div className="sc-review-comment">{content}</div>
        <div className="sc-review-date">{date}</div>
      </a>
    </div>
  );
}

function FavoritesSlider({ favorites }) {
  const [position, setPosition] = useState(0);
  const scrollAmount = 220;

  if (!favorites || favorites.length === 0) {
    return null;
  }

  const maxScroll = -(favorites.length * 90 - 220);

  return (
    <div className="sc-favorites-wrapper">
      <button
        className="sc-nav-btn prev"
        onClick={() => setPosition(p => Math.min(0, p + scrollAmount))}
        disabled={position >= 0}
        aria-label="Précédent"
      >
        ‹
      </button>
      <div className="sc-favorites-grid" style={{ transform: `translateX(${position}px)` }}>
        {favorites.map((item, index) => (
          <div key={index} className="sc-favorite-item">
            <img
              src={item.poster || item.image}
              alt={item.title}
              className="sc-favorite-poster"
              loading="lazy"
            />
            <div className="sc-favorite-title">{item.title}</div>
          </div>
        ))}
      </div>
      <button
        className="sc-nav-btn next"
        onClick={() => setPosition(p => Math.max(maxScroll, p - scrollAmount))}
        disabled={position <= maxScroll}
        aria-label="Suivant"
      >
        ›
      </button>
    </div>
  );
}

export default SensCritique;

