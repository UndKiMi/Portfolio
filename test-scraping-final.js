const fs = require('fs');
const { JSDOM } = require('jsdom');

// Fonction de parsing (copié depuis senscritique-scraper.js)
function parseRelativeDate(dateText) {
  if (!dateText) return null;
  
  const now = new Date();
  const lowerText = dateText.toLowerCase().trim();
  
  console.log(`  🔍 Parsing de: "${dateText}"`);
  console.log(`  🔍 Lowercase: "${lowerText}"`);
  
  // "Il y a X jour(s)"
  const joursMatch = lowerText.match(/il y a (\d+)\s*jour(s)?/i);
  if (joursMatch) {
    console.log(`  ✅ Match trouvé pour jours: ${joursMatch[1]}`);
    const days = parseInt(joursMatch[1]);
    const date = new Date(now);
    date.setDate(date.getDate() - days);
    return date.toISOString();
  }
  
  // "Il y a X semaines"
  const semainesMatch = lowerText.match(/il y a (\d+)\s*semaine/i);
  if (semainesMatch) {
    console.log(`  ✅ Match trouvé pour semaines: ${semainesMatch[1]}`);
    const weeks = parseInt(semainesMatch[1]);
    const date = new Date(now);
    date.setDate(date.getDate() - (weeks * 7));
    return date.toISOString();
  }
  
  // "Il y a X mois"
  const moisMatch = lowerText.match(/il y a (\d+)\s*mois/i);
  if (moisMatch) {
    console.log(`  ✅ Match trouvé pour mois: ${moisMatch[1]}`);
    const months = parseInt(moisMatch[1]);
    const date = new Date(now);
    date.setMonth(date.getMonth() - months);
    return date.toISOString();
  }
  
  console.log(`  ❌ Aucun match trouvé`);
  return null;
}

function getTimeAgo(date) {
  if (!date) return null;

  let parsedDate;
  if (typeof date === 'string') {
    parsedDate = new Date(date);
  } else if (date instanceof Date) {
    parsedDate = date;
  } else {
    return null;
  }

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const now = new Date();
  const seconds = Math.floor((now - parsedDate) / 1000);

  if (seconds < 0) return null;
  if (seconds < 60) return 'À l\'instant';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'Hier';
  if (days < 7) return `${days}j`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} sem`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mois`;

  const years = Math.floor(days / 365);
  return `${years} an${years > 1 ? 's' : ''}`;
}

// Lire le fichier HTML
const html = fs.readFileSync('sensCRITIQUE DEMO FILE.html', 'utf8');
const dom = new JSDOM(html);
const document = dom.window.document;

console.log('🧪 Test final du scraping amélioré\n');
console.log('=' .repeat(60));

// Sélecteurs améliorés
let reviewElements = document.querySelectorAll('.elco-collection-item, .ProductListItem, [class*="review"], [class*="critique"], [class*="elco-collection"]');

if (reviewElements.length === 0) {
  reviewElements = document.querySelectorAll('article, [data-testid*="review"], [class*="Review"], [class*="Critique"], [class*="elco"]');
  console.log(`✅ Sélecteur alternatif: ${reviewElements.length} éléments trouvés\n`);
}

// Pour chaque élément
reviewElements.forEach((element, index) => {
  console.log(`\n📝 CRITIQUE ${index + 1}`);
  console.log('-'.repeat(60));
  
  // Sélecteurs améliorés pour le nouveau HTML de SensCritique
  const titleEl = element.querySelector('a[data-testid="productReviewTitle"], h2[data-testid="reviewTitle"], h3, h4, .title, [class*="title"], a[class*="elco-title"]');
  const contentEl = element.querySelector('p[data-testid="linkify"], p, .content, [class*="content"], [class*="text"], [class*="elco-description"]');
  const dateEl = element.querySelector('time[datetime], time[title], .date, [class*="date"], [class*="elco-date"], [class*="elco-meta-date"], [data-date]');
  const linkEl = element.querySelector('a[href*="/film/"], a[href*="/serie/"], a[href*="/jeu"], a[class*="elco-title"], a[data-testid="productReviewTitle"]');
  const ratingEl = element.querySelector('[data-testid="Rating"], [class*="rating"], [class*="note"], [aria-label*="note"], [class*="elco-rating"]');
  
  if (!titleEl) {
    console.log('❌ Pas de titre trouvé, élément ignoré');
    return;
  }
  
  const title = titleEl.textContent.trim();
  const content = contentEl ? contentEl.textContent.trim() : '';
  
  console.log(`📌 Titre: ${title}`);
  console.log(`📄 Contenu: ${content.substring(0, 80)}...`);
  
  // Essayer d'extraire la date ISO depuis l'attribut datetime
  let dateISO = null;
  let dateText = '';
  
  if (dateEl) {
    dateISO = dateEl.getAttribute('datetime') || dateEl.getAttribute('data-date');
    if (!dateISO) {
      dateISO = dateEl.getAttribute('title');
    }
    dateText = dateEl.textContent.trim();
    console.log(`📅 Date (élément): ${dateText || 'vide'}`);
  }
  
  // Si toujours pas de date, chercher dans tous les <p> de l'élément
  if (!dateISO && !dateText) {
    console.log(`🔍 Recherche dans les <p>...`);
    const allPs = element.querySelectorAll('p');
    console.log(`   Nombre de <p>: ${allPs.length}`);
    
    for (const p of allPs) {
      const pText = p.textContent.trim();
      // Chercher du texte de date relative dans le <p>
      const relativeDateMatch = pText.match(/(il y a \d+\s*(jour|jours|semaine|semaines|mois|an|ans))/i);
      if (relativeDateMatch) {
        dateText = relativeDateMatch[1];
        console.log(`   ✅ Date trouvée dans <p>: "${dateText}"`);
        break;
      }
    }
  }
  
  // Si toujours pas de date, chercher dans le HTML brut
  if (!dateISO && !dateText) {
    console.log(`🔍 Recherche dans le HTML brut...`);
    const elementHTML = element.outerHTML || '';
    const relativeDateMatch = elementHTML.match(/(il y a \d+\s*(jour|jours|semaine|semaines|mois|an|ans))/i);
    if (relativeDateMatch) {
      dateText = relativeDateMatch[1];
      console.log(`   ✅ Date trouvée dans HTML brut: "${dateText}"`);
    }
  }
  
  // Si on a une date ISO, l'utiliser directement
  // Sinon, essayer de parser la date relative
  let finalDate = null;
  if (dateISO) {
    const cleanedDate = dateISO.trim();
    if (cleanedDate && /^\d{4}-\d{2}-\d{2}/.test(cleanedDate)) {
      finalDate = cleanedDate;
      console.log(`📅 Date ISO: ${finalDate}`);
    }
  }
  
  // Si pas de date ISO, parser la date relative
  if (!finalDate && dateText) {
    console.log(`\n📅 Parsing de la date relative:`);
    finalDate = parseRelativeDate(dateText);
    if (finalDate) {
      console.log(`   ✅ Date parsée: ${finalDate}`);
      const timeAgo = getTimeAgo(finalDate);
      console.log(`   ✅ Format d'affichage: ${timeAgo}`);
    } else {
      console.log(`   ❌ Échec du parsing`);
    }
  }
  
  const url = linkEl ? `https://www.senscritique.com${linkEl.getAttribute('href')}` : '';
  
  let rating = null;
  if (ratingEl) {
    const ratingText = ratingEl.textContent || ratingEl.getAttribute('aria-label') || '';
    const ratingMatch = ratingText.match(/(\d+)/);
    if (ratingMatch) {
      rating = parseInt(ratingMatch[1]);
    }
  }
  
  console.log(`⭐ Note: ${rating || 'N/A'}`);
  console.log(`🔗 URL: ${url.substring(0, 60)}...`);
  
  if (title && content.length > 20) {
    console.log(`\n✅ CRITIQUE VALIDE - Sera ajoutée aux résultats`);
  } else {
    console.log(`\n❌ CRITIQUE INVALIDE - Titre ou contenu manquant`);
  }
});

console.log('\n' + '='.repeat(60));
console.log('✅ Test terminé');

