const fs = require('fs');
const { JSDOM } = require('jsdom');

// Fonction de parsing (copié depuis senscritique-scraper.js)
function parseRelativeDate(dateText) {
  if (!dateText) return null;
  
  const now = new Date();
  const lowerText = dateText.toLowerCase().trim();
  
  // "Il y a X jour(s)"
  const joursMatch = lowerText.match(/il y a (\d+)\s*jour(s)?/i);
  if (joursMatch) {
    const days = parseInt(joursMatch[1]);
    const date = new Date(now);
    date.setDate(date.getDate() - days);
    return date.toISOString();
  }
  
  // "Il y a X semaines"
  const semainesMatch = lowerText.match(/il y a (\d+)\s*semaine/i);
  if (semainesMatch) {
    const weeks = parseInt(semainesMatch[1]);
    const date = new Date(now);
    date.setDate(date.getDate() - (weeks * 7));
    return date.toISOString();
  }
  
  // "Il y a X mois"
  const moisMatch = lowerText.match(/il y a (\d+)\s*mois/i);
  if (moisMatch) {
    const months = parseInt(moisMatch[1]);
    const date = new Date(now);
    date.setMonth(date.getMonth() - months);
    return date.toISOString();
  }
  
  return null;
}

// Lire le fichier HTML
const html = fs.readFileSync('sensCRITIQUE DEMO FILE.html', 'utf8');
const dom = new JSDOM(html);
const document = dom.window.document;

console.log('🔍 Test complet du flux de scraping\n');

// Sélecteurs du scraper
let reviewElements = document.querySelectorAll('.elco-collection-item, .ProductListItem, [class*="review"], [class*="critique"], [class*="elco-collection"]');
console.log('Sélecteur principal:', reviewElements.length, 'éléments');

if (reviewElements.length === 0) {
  reviewElements = document.querySelectorAll('article, [data-testid*="review"], [class*="Review"], [class*="Critique"], [class*="elco"]');
  console.log('Sélecteur alternatif:', reviewElements.length, 'éléments');
}

// Pour chaque élément
reviewElements.forEach((element, index) => {
  console.log(`\n--- Élément ${index + 1} ---`);
  
  // Chercher le titre (avec tous les sélecteurs possibles)
  let titleEl = element.querySelector('h3, h4, .title, [class*="title"], a[class*="elco-title"]');
  console.log('Titre (sélecteur 1):', titleEl ? titleEl.textContent.trim().substring(0, 50) : 'NON TROUVÉ');
  
  // Essayer d'autres sélecteurs pour le titre
  if (!titleEl) {
    titleEl = element.querySelector('h2, a[data-testid="productReviewTitle"]');
    console.log('Titre (sélecteur alternatif):', titleEl ? titleEl.textContent.trim().substring(0, 50) : 'NON TROUVÉ');
  }
  
  // Chercher le contenu
  const contentEl = element.querySelector('p, .content, [class*="content"], [class*="text"], [class*="elco-description"]');
  console.log('Contenu:', contentEl ? contentEl.textContent.trim().substring(0, 50) : 'NON TROUVÉ');
  
  // Chercher la date
  const dateEl = element.querySelector('time[datetime], time[title], .date, [class*="date"], [class*="elco-date"], [class*="elco-meta-date"], [data-date]');
  console.log('Date (élément):', dateEl ? dateEl.textContent.trim() : 'NON TROUVÉ');
  
  // Si pas de date, chercher dans le HTML brut
  let dateText = '';
  if (!dateEl) {
    const elementHTML = element.outerHTML || '';
    const relativeDateMatch = elementHTML.match(/(il y a \d+ (jour|jours|semaine|semaines|mois|an|ans))/i);
    if (relativeDateMatch) {
      dateText = relativeDateMatch[1];
      console.log('Date (HTML brut):', dateText);
      
      // Parser la date
      const parsedDate = parseRelativeDate(dateText);
      console.log('Date parsée:', parsedDate);
      console.log('Jours depuis:', Math.floor((new Date() - new Date(parsedDate)) / (1000 * 60 * 60 * 24)), 'jours');
    } else {
      console.log('Date (HTML brut): NON TROUVÉ');
    }
  }
  
  // Chercher la note
  const ratingEl = element.querySelector('[class*="rating"], [class*="note"], [aria-label*="note"], [class*="Rating"], [data-testid="Rating"]');
  console.log('Note:', ratingEl ? ratingEl.textContent.trim() : 'NON TROUVÉ');
});

// Test de sélecteurs améliorés
console.log('\n\n🔧 Test avec sélecteurs améliorés:');
const article = document.querySelector('article[data-testid="review-overview"]');
if (article) {
  console.log('✅ Article trouvé avec data-testid="review-overview"');
  
  // Titre plus spécifique
  const titleLink = article.querySelector('a[data-testid="productReviewTitle"]');
  console.log('  Titre (productReviewTitle):', titleLink ? titleLink.textContent.trim() : 'NON TROUVÉ');
  
  // Review title
  const reviewTitle = article.querySelector('h2[data-testid="reviewTitle"]');
  console.log('  Titre critique (reviewTitle):', reviewTitle ? reviewTitle.textContent.trim() : 'NON TROUVÉ');
  
  // Contenu
  const contentP = article.querySelector('p[data-testid="linkify"]');
  console.log('  Contenu (linkify):', contentP ? contentP.textContent.trim().substring(0, 80) : 'NON TROUVÉ');
  
  // Date - chercher dans tous les <p>
  const allPs = article.querySelectorAll('p');
  allPs.forEach((p, i) => {
    const text = p.textContent.trim();
    if (text.includes('il y a')) {
      console.log(`  Date trouvée dans <p>[${i}]:`, text);
      const parsed = parseRelativeDate(text);
      console.log(`  Date parsée:`, parsed);
    }
  });
  
  // Note
  const ratingDiv = article.querySelector('[data-testid="Rating"]');
  console.log('  Note (Rating):', ratingDiv ? ratingDiv.textContent.trim() : 'NON TROUVÉ');
}

