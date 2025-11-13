import React from 'react';
import './Sidebar.css';

function Sidebar() {
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav className="sidebar" aria-label="Navigation principale">
      <div className="profile-pic-container">
        <img 
          src="https://avatars.githubusercontent.com/u/51194216?v=4" 
          alt="Photo de profil GitHub" 
          className="profile-pic" 
          loading="lazy"
        />
      </div>
      <h2>Navigation</h2>
      <div className="nav-links" role="navigation">
        <a 
          href="#accueil" 
          onClick={(e) => {
            e.preventDefault();
            scrollToSection('accueil');
          }}
          aria-label="Aller à l'accueil"
        >
          🏠 Accueil
        </a>
        <a 
          href="#senscritique" 
          onClick={(e) => {
            e.preventDefault();
            scrollToSection('senscritique');
          }}
          aria-label="Aller à la section Sens Critique"
        >
          🎥 Sens Critique
        </a>
      </div>
    </nav>
  );
}

export default Sidebar;

