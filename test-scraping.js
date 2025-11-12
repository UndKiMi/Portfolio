const fs = require('fs');
const { JSDOM } = require('jsdom');

// Lire le fichier HTML de démonstration
const html = fs.readFileSync('sensCRITIQUE DEMO FILE.html', 'utf8');

console.log('📄 Analyse du fichier HTML de démonstration...\n');

// Créer un DOM
const dom = new JSDOM(html);
const document = dom.window.document;

// Essayer les sélecteurs CSS utilisés dans le scraper
const reviewElements = document.querySelectorAll('.elco-collection-item, .ProductListItem, [class*="review"], [class*="critique"], [class*="elco-collection"]');
console.log(`🔍 Sélecteur principal: ${reviewElements.length} éléments trouvés`);

// Essayer le sélecteur alternatif
const altElements = document.querySelectorAll('article, [data-testid*="review"], [class*="Review"], [class*="Critique"], [class*="elco"]');
console.log(`🔍 Sélecteur alternatif: ${altElements.length} éléments trouvés\n`);

// Si trouvé, analyser le premier élément
if (altElements.length > 0) {
  const element = altElements[0];
  console.log('✅ Premier élément trouvé:');
  console.log('  - Tag:', element.tagName);
  console.log('  - data-testid:', element.getAttribute('data-testid'));
  
  // Chercher le titre
  const titleEl = element.querySelector('h3, h4, .title, [class*="title"], a[class*="elco-title"]');
  console.log('  - Titre trouvé:', titleEl ? titleEl.textContent.trim() : 'NON TROUVÉ');
  
  // Chercher la date avec différents sélecteurs
  const dateEl1 = element.querySelector('time[datetime], time[title], .date, [class*="date"]');
  console.log('  - Date (sélecteur 1):', dateEl1 ? dateEl1.textContent.trim() : 'NON TROUVÉ');
  
  // Chercher dans le HTML brut
  const elementHTML = element.outerHTML || '';
  
  // Pattern pour "il y a X jours"
  const relativeDateMatch = elementHTML.match(/(il y a \d+ (jour|jours|semaine|semaines|mois|an|ans))/i);
  console.log('  - Date (regex HTML brut):', relativeDateMatch ? relativeDateMatch[1] : 'NON TROUVÉ');
  
  // Chercher tous les <p> dans l'élément
  const allPs = element.querySelectorAll('p');
  console.log(`\n📋 ${allPs.length} balises <p> trouvées:`);
  allPs.forEach((p, i) => {
    const text = p.textContent.trim();
    if (text && text.includes('il y a')) {
      console.log(`  [${i}] ${text}`);
      console.log(`      Classes: ${p.className}`);
    }
  });
  
  // Chercher tous les <span>
  const allSpans = element.querySelectorAll('span');
  console.log(`\n📋 ${allSpans.length} balises <span> trouvées:`);
  allSpans.forEach((span, i) => {
    const text = span.textContent.trim();
    if (text && text.includes('il y a')) {
      console.log(`  [${i}] ${text}`);
      console.log(`      Style: ${span.getAttribute('style')}`);
    }
  });
}

// Test du parsing de date relative
console.log('\n\n🧪 Test de parsing de "il y a 7 jours":');
const testDate = 'il y a 7 jours';
const now = new Date();
const joursMatch = testDate.match(/il y a (\d+)\s*jour(s)?/i);
if (joursMatch) {
  const days = parseInt(joursMatch[1]);
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  console.log('  - Match trouvé:', joursMatch[1], 'jour(s)');
  console.log('  - Date calculée:', date.toISOString());
  console.log('  - Il y a', Math.floor((now - date) / (1000 * 60 * 60 * 24)), 'jours');
}

