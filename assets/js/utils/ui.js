import { getElements } from '../core/state.js';

export function setupStatLinks() {
  const elements = getElements();
  const cards = [
    elements.sc.moviesCard,
    elements.sc.seriesCard,
    elements.sc.gamesCard,
    elements.sc.reviewsCard
  ];

  cards.forEach(card => {
    if (!card || !card.dataset.url || card.dataset.boundClick) return;
    card.dataset.boundClick = 'true';
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => window.open(card.dataset.url, '_blank'));
  });
}

export function setupFavoritesSlider() {
  const elements = getElements();
  const grid = elements.sc.favoritesGrid;
  const prevBtn = document.getElementById('sc-prev-btn');
  const nextBtn = document.getElementById('sc-next-btn');

  if (!grid || !prevBtn || !nextBtn) return;

  const newPrevBtn = prevBtn.cloneNode(true);
  const newNextBtn = nextBtn.cloneNode(true);

  prevBtn.replaceWith(newPrevBtn);
  nextBtn.replaceWith(newNextBtn);

  let currentPosition = 0;
  const scrollAmount = 280;

  const updateTransform = () => {
    grid.style.transform = `translateX(${currentPosition}px)`;
  };

  const updateButtonsVisibility = () => {
    const wrapperWidth = grid.parentElement.clientWidth;
    const gridWidth = grid.scrollWidth;
    const maxScroll = -(gridWidth - wrapperWidth);

    newPrevBtn.style.opacity = currentPosition >= 0 ? '0.3' : '1';
    newPrevBtn.style.pointerEvents = currentPosition >= 0 ? 'none' : 'auto';

    newNextBtn.style.opacity = currentPosition <= maxScroll ? '0.3' : '1';
    newNextBtn.style.pointerEvents = currentPosition <= maxScroll ? 'none' : 'auto';
  };

  newPrevBtn.addEventListener('click', () => {
    currentPosition = Math.min(currentPosition + scrollAmount, 0);
    updateTransform();
    updateButtonsVisibility();
  });

  newNextBtn.addEventListener('click', () => {
    const wrapperWidth = grid.parentElement.clientWidth;
    const gridWidth = grid.scrollWidth;
    const maxScroll = -(gridWidth - wrapperWidth);
    currentPosition = Math.max(currentPosition - scrollAmount, maxScroll);
    updateTransform();
    updateButtonsVisibility();
  });

  updateButtonsVisibility();
}

