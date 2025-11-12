const https = require('https');
const { JSDOM } = require('jsdom');

// Fonction pour parser les critiques depuis le HTML brut
function parseReviewsFromHTML(html) {
  const reviews = [];
  
  try {
    // Pattern spécifique pour Sens Critique: "Critique de [Titre] par [User]"
    // Structure: "Critique de [Titre] par KiMi_" + contenu + "Par KiMi_" + date
    // On cherche d'abord les titres, puis le contenu et la date dans le contexte
    const titlePattern = /(?:<h[23][^>]*>|##\s*)Critique de ([^<\n]+?)\s+par\s+KiMi_/gi;
    const titleMatches = [...html.matchAll(titlePattern)];
    
    console.log(`🔍 ${titleMatches.length} titres de critiques trouvés`);
    
    // Pour chaque titre trouvé, chercher le contenu et la date dans le contexte suivant
    for (const titleMatch of titleMatches) {
      const title = titleMatch[1]?.trim();
      if (!title) continue;
      
      // Chercher dans les 3000 caractères suivant le titre
      const startIndex = titleMatch.index + titleMatch[0].length;
      const context = html.substring(startIndex, Math.min(startIndex + 3000, html.length));
      
      // Extraire le contenu (texte entre le titre et "Lire la critique" ou "Par KiMi_")
      // On cherche le texte qui n'est pas dans des balises HTML
      let content = null;
      // Essayer plusieurs patterns pour le contenu
      const contentPatterns = [
        /([^<]{30,500}?)(?:Lire la critique|Par\s+KiMi_|<\/p>|<\/div>)/i,
        /<p[^>]*>([^<]{30,500}?)<\/p>/i,
        /<div[^>]*>([^<]{30,500}?)<\/div>/i
      ];
      
      for (const pattern of contentPatterns) {
        const match = context.match(pattern);
        if (match && match[1] && match[1].trim().length > 20) {
          content = match[1].trim();
          break;
        }
      }
      
      // NOUVELLE MÉTHODE: Utiliser la fonction dédiée pour extraire la date
      const extendedContext = html.substring(Math.max(0, titleMatch.index - 1000), titleMatch.index + 4000);
      const { dateText, dateISO } = extractDateFromHTML(html, context || extendedContext);
      
      if (!dateText && !dateISO) {
        console.log(`⚠️  Aucune date trouvée pour "${title}"`);
        console.log(`🔍 Contexte (500 premiers caractères): ${context.substring(0, 500)}`);
      }
      
      if (title && content && content.length > 20) {
        // Chercher le lien associé
        const linkMatch = context.match(/href="(\/[^"]*\/(?:film|serie|jeu|livre)\/[^"]+)"/i) || 
                          html.substring(Math.max(0, titleMatch.index - 500), titleMatch.index + 500)
                            .match(/href="(\/[^"]*\/(?:film|serie|jeu|livre)\/[^"]+)"/i);
        const url = linkMatch ? `https://www.senscritique.com${linkMatch[1]}` : null;
        
        // Chercher la note (peut être avant ou après le titre)
        const ratingMatch = context.match(/(\d+)\s*(?:⭐|★|note)/i) || 
                           html.substring(Math.max(0, titleMatch.index - 200), titleMatch.index + 200)
                             .match(/(\d+)\s*(?:⭐|★|note)/i);
        const rating = ratingMatch ? parseInt(ratingMatch[1]) : null;
        
        // Parser la date
        let finalDate = null;
        
        // Priorité 1: Si on a une date ISO, l'utiliser directement
        if (dateISO) {
          const cleanedDate = dateISO.trim();
          if (cleanedDate && /^\d{4}-\d{2}-\d{2}/.test(cleanedDate)) {
            finalDate = cleanedDate;
            console.log(`📅 Date ISO utilisée pour "${title}": ${finalDate}`);
          }
        }
        
        // Priorité 2: Si pas de date ISO, parser la date relative
        if (!finalDate && dateText) {
          if (dateText.includes('il y a')) {
            finalDate = parseRelativeDate(dateText);
            if (finalDate) {
              console.log(`📅 Date relative parsée pour "${title}": "${dateText}" → ${finalDate}`);
            } else {
              console.log(`⚠️  Impossible de parser la date "${dateText}" pour "${title}"`);
            }
          } else if (dateText.match(/le \d{1,2}\s+\w+\.?\s+\d{4}/)) {
            finalDate = parseFrenchDate(dateText);
            if (finalDate) {
              console.log(`📅 Date française parsée pour "${title}": "${dateText}" → ${finalDate}`);
            } else {
              console.log(`⚠️  Impossible de parser la date "${dateText}" pour "${title}"`);
            }
          }
        }
        
        // Ajouter la critique
        // SOLUTION ALTERNATIVE: Toujours stocker le texte brut de la date
        const review = {
          title,
          content: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
          date: dateText || null, // Texte brut original
          date_raw: dateText || null, // Texte brut pour parsing côté frontend
          created_at: finalDate || null, // Date ISO si parsing réussi
          updated_at: finalDate || null,
          url,
          rating
        };
        
        console.log(`✅ Critique ajoutée: "${title}" - Date brute: ${review.date_raw || 'N/A'} - Date ISO: ${review.created_at || 'N/A'}`);
        reviews.push(review);
      }
    }
    
    // Si on n'a rien trouvé, essayer un pattern plus général
    if (reviews.length === 0) {
      // Essayer de trouver des critiques avec des patterns de texte
      // Pattern principal: Titre + Contenu + Date
      const reviewTextPattern = /(?:<h[23][^>]*>|<a[^>]*>)([^<]{10,100})(?:<\/h[23]>|<\/a>)[\s\S]{0,500}?(?:<p[^>]*>|<div[^>]*>)([^<]{20,300})(?:<\/p>|<\/div>)[\s\S]{0,200}?(?:il y a \d+ (?:jour|jours|semaine|semaines|mois|an|ans)|le \d{1,2}\s+\w+\.?\s+\d{4}|datetime=["']([^"']+)["'])/gi;
      const textMatches = [...html.matchAll(reviewTextPattern)];
      
      console.log(`🔍 ${textMatches.length} matches trouvés avec le pattern principal`);
    
      // Traiter les matches de texte
      for (const match of textMatches) {
        const title = match[1]?.trim();
        const content = match[2]?.trim();
        
        if (title && content && content.length > 20 && !title.includes('Critique de') && !title.includes('Sens Critique')) {
          // Chercher le lien associé
          const linkMatch = html.substring(Math.max(0, match.index - 500), match.index + match[0].length + 500)
            .match(/href="(\/[^"]*\/(?:film|serie|jeu|livre)\/[^"]+)"/i);
          const url = linkMatch ? `https://www.senscritique.com${linkMatch[1]}` : null;
          
          // Chercher la note
          const ratingMatch = match[0].match(/(\d+)\s*[⭐★]/i) || match[0].match(/note[^>]*>(\d+)/i);
          const rating = ratingMatch ? parseInt(ratingMatch[1]) : null;
          
          // NOUVELLE MÉTHODE: Utiliser la fonction dédiée pour extraire la date
          const context = html.substring(Math.max(0, match.index - 500), match.index + match[0].length + 500);
          const { dateText, dateISO } = extractDateFromHTML(html, context);
          
          // Parser la date
          let finalDate = null;
          
          // Priorité 1: Si on a une date ISO, l'utiliser directement
          if (dateISO) {
            const cleanedDate = dateISO.trim();
            if (cleanedDate && /^\d{4}-\d{2}-\d{2}/.test(cleanedDate)) {
              finalDate = cleanedDate;
            }
          }
          
          // Priorité 2: Si pas de date ISO, parser la date relative
          if (!finalDate && dateText) {
            if (dateText.includes('il y a')) {
              finalDate = parseRelativeDate(dateText);
            } else if (dateText.match(/le \d{1,2}\s+\w+\.?\s+\d{4}/)) {
              finalDate = parseFrenchDate(dateText);
            }
          }
          
          reviews.push({
            title,
            content: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
            date: dateText || null,
            date_raw: dateText || null,
            created_at: finalDate || null,
            updated_at: finalDate || null,
            url,
            rating
          });
        }
      }
    }
    
    // Si on n'a toujours rien trouvé, essayer une approche plus simple
    if (reviews.length === 0) {
      console.log('⚠️  Aucune critique trouvée avec le pattern principal, essai avec pattern simple...');
      // Chercher simplement les titres suivis de contenu
      const simplePattern = /<h[23][^>]*>([^<]{10,100})<\/h[23]>[\s\S]{0,1000}?<p[^>]*>([^<]{30,300})<\/p>/gi;
      const simpleMatches = [...html.matchAll(simplePattern)];
      
      console.log(`🔍 ${simpleMatches.length} matches trouvés avec le pattern simple`);
      
      for (const match of simpleMatches) {
        const title = match[1]?.trim();
        const content = match[2]?.trim();
        
        if (title && content && content.length > 20 && !title.includes('Sens Critique')) {
          // NOUVELLE MÉTHODE: Utiliser la fonction dédiée pour extraire la date
          const context = html.substring(Math.max(0, match.index - 200), match.index + match[0].length + 200);
          const { dateText, dateISO } = extractDateFromHTML(html, context);
          
          // Parser la date
          let finalDate = null;
          
          // Priorité 1: Si on a une date ISO, l'utiliser directement
          if (dateISO) {
            const cleanedDate = dateISO.trim();
            if (cleanedDate && /^\d{4}-\d{2}-\d{2}/.test(cleanedDate)) {
              finalDate = cleanedDate;
            }
          }
          
          // Priorité 2: Si pas de date ISO, parser la date relative
          if (!finalDate && dateText) {
            if (dateText.includes('il y a')) {
              finalDate = parseRelativeDate(dateText);
            } else if (dateText.match(/le \d{1,2}\s+\w+\.?\s+\d{4}/)) {
              finalDate = parseFrenchDate(dateText);
            } else if (/^\d{4}-\d{2}-\d{2}/.test(dateText)) {
              finalDate = dateText;
            }
          }
          
          // Chercher le lien
          const linkMatch = context.match(/href="(\/[^"]*\/(?:film|serie|jeu)\/[^"]+)"/i);
          const url = linkMatch ? `https://www.senscritique.com${linkMatch[1]}` : null;
          
          reviews.push({
            title,
            content: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
            date: dateText || null,
            date_raw: dateText || null,
            created_at: finalDate || null,
            updated_at: finalDate || null,
            url,
            rating: null
          });
        }
      }
    }
    
    console.log(`✅ ${reviews.length} critiques trouvées via parsing HTML brut`);
  } catch (error) {
    console.error('❌ Erreur parsing HTML brut:', error.message);
  }
  
  return reviews;
}

// Fonction pour extraire la date depuis du HTML brut (pour parseReviewsFromHTML)
function extractDateFromHTML(html, context) {
  let dateText = null;
  let dateISO = null;
  
  // MÉTHODE 1: Chercher dans le contexte fourni
  if (context) {
    // Pattern amélioré pour "il y a X jour(s)" - accepter avec ou sans 's'
    const relativeDateMatch = context.match(/il\s+y\s+a\s+(\d+)\s*(jour|jours|semaine|semaines|mois|an|ans)/i);
    if (relativeDateMatch) {
      dateText = relativeDateMatch[0].trim();
      console.log(`📅 Date trouvée dans contexte: "${dateText}"`);
    }
    
    // Chercher aussi après "Par KiMi_"
    if (!dateText) {
      const parPattern = /Par\s+KiMi_[\s\S]{0,500}?(il\s+y\s+a\s+\d+\s*(?:jour|jours|semaine|semaines|mois|an|ans))/i;
      const parMatch = context.match(parPattern);
      if (parMatch && parMatch[1]) {
        dateText = parMatch[1].trim();
        console.log(`📅 Date trouvée après "Par KiMi_": "${dateText}"`);
      }
    }
  }
  
  // MÉTHODE 2: Chercher dans le HTML brut complet si pas trouvé
  if (!dateText && html) {
    const relativeDateMatch = html.match(/il\s+y\s+a\s+(\d+)\s*(jour|jours|semaine|semaines|mois|an|ans)/i);
    if (relativeDateMatch) {
      dateText = relativeDateMatch[0].trim();
      console.log(`📅 Date trouvée dans HTML brut: "${dateText}"`);
    }
  }
  
  // MÉTHODE 3: Chercher des dates ISO dans les attributs datetime
  if (!dateISO && html) {
    const datetimeMatch = html.match(/datetime=["']([^"']+)["']/i);
    if (datetimeMatch && /^\d{4}-\d{2}-\d{2}/.test(datetimeMatch[1])) {
      dateISO = datetimeMatch[1];
      console.log(`📅 Date ISO trouvée: "${dateISO}"`);
    }
  }
  
  return { dateText, dateISO };
}

// Fonction robuste pour extraire la date d'un élément de critique
function extractDateFromElement(element) {
  if (!element) return { dateText: null, dateISO: null };
  
  let dateText = null;
  let dateISO = null;
  
  // MÉTHODE 1: Chercher dans tous les <p> de l'élément (méthode la plus fiable pour SensCritique)
  const allPs = element.querySelectorAll('p');
  for (const p of allPs) {
    const pText = p.textContent.trim();
    // Pattern pour "il y a X jour(s)" ou "il y a X jours"
    const relativeDateMatch = pText.match(/il\s+y\s+a\s+(\d+)\s*(jour|jours|semaine|semaines|mois|an|ans)/i);
    if (relativeDateMatch) {
      dateText = relativeDateMatch[0].trim(); // Récupérer toute la phrase
      console.log(`📅 Date trouvée dans <p>: "${dateText}"`);
      break;
    }
  }
  
  // MÉTHODE 2: Chercher dans tous les <span> de l'élément
  if (!dateText) {
    const allSpans = element.querySelectorAll('span');
    for (const span of allSpans) {
      const spanText = span.textContent.trim();
      const relativeDateMatch = spanText.match(/il\s+y\s+a\s+(\d+)\s*(jour|jours|semaine|semaines|mois|an|ans)/i);
      if (relativeDateMatch) {
        dateText = relativeDateMatch[0].trim();
        console.log(`📅 Date trouvée dans <span>: "${dateText}"`);
        break;
      }
    }
  }
  
  // MÉTHODE 3: Chercher dans les balises <time> avec attribut datetime
  if (!dateISO) {
    const timeEl = element.querySelector('time[datetime]');
    if (timeEl) {
      dateISO = timeEl.getAttribute('datetime');
      if (dateISO && /^\d{4}-\d{2}-\d{2}/.test(dateISO)) {
        console.log(`📅 Date ISO trouvée dans <time>: "${dateISO}"`);
      } else {
        dateISO = null;
      }
    }
  }
  
  // MÉTHODE 4: Chercher dans le HTML brut de l'élément (fallback)
  if (!dateText && !dateISO) {
    const elementHTML = element.outerHTML || '';
    
    // Chercher des attributs datetime
    const datetimeMatch = elementHTML.match(/datetime=["']([^"']+)["']/i);
    if (datetimeMatch && /^\d{4}-\d{2}-\d{2}/.test(datetimeMatch[1])) {
      dateISO = datetimeMatch[1];
      console.log(`📅 Date ISO trouvée dans HTML brut: "${dateISO}"`);
    }
    
    // Chercher du texte de date relative dans le HTML
    if (!dateText) {
      const relativeDateMatch = elementHTML.match(/il\s+y\s+a\s+\d+\s*(jour|jours|semaine|semaines|mois|an|ans)/i);
      if (relativeDateMatch) {
        dateText = relativeDateMatch[0].trim();
        console.log(`📅 Date trouvée dans HTML brut: "${dateText}"`);
      }
    }
  }
  
  return { dateText, dateISO };
}

// Fonction pour parser les dates relatives de Sens Critique
function parseRelativeDate(dateText) {
  if (!dateText) return null;
  
  const now = new Date();
  const lowerText = dateText.toLowerCase().trim();
  
  // "Il y a X jour(s)" - accepter avec ou sans 's'
  const joursMatch = lowerText.match(/il\s+y\s+a\s+(\d+)\s*jour(s)?/i);
  if (joursMatch) {
    const days = parseInt(joursMatch[1]);
    const date = new Date(now);
    date.setDate(date.getDate() - days);
    return date.toISOString();
  }
  
  // "Il y a X semaines"
  const semainesMatch = lowerText.match(/il\s+y\s+a\s+(\d+)\s*semaine(s)?/i);
  if (semainesMatch) {
    const weeks = parseInt(semainesMatch[1]);
    const date = new Date(now);
    date.setDate(date.getDate() - (weeks * 7));
    return date.toISOString();
  }
  
  // "Il y a X mois"
  const moisMatch = lowerText.match(/il\s+y\s+a\s+(\d+)\s*mois/i);
  if (moisMatch) {
    const months = parseInt(moisMatch[1]);
    const date = new Date(now);
    date.setMonth(date.getMonth() - months);
    return date.toISOString();
  }
  
  // "Il y a X ans"
  const ansMatch = lowerText.match(/il\s+y\s+a\s+(\d+)\s*an(s)?/i);
  if (ansMatch) {
    const years = parseInt(ansMatch[1]);
    const date = new Date(now);
    date.setFullYear(date.getFullYear() - years);
    return date.toISOString();
  }
  
  // "Aujourd'hui" ou "Hier"
  if (lowerText.includes('aujourd') || lowerText.includes('auj.')) {
    return now.toISOString();
  }
  
  if (lowerText.includes('hier')) {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    return date.toISOString();
  }
  
  // Essayer de parser une date au format français (JJ/MM/AAAA)
  const frenchDateMatch = dateText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (frenchDateMatch) {
    const [, day, month, year] = frenchDateMatch;
    return new Date(`${year}-${month}-${day}`).toISOString();
  }
  
  return null;
}

// Fonction pour parser les dates au format français "le 4 nov. 2025"
function parseFrenchDate(dateText) {
  if (!dateText) return null;
  
  const months = {
    'jan': 0, 'janv': 0, 'janvier': 0,
    'fév': 1, 'févr': 1, 'février': 1,
    'mar': 2, 'mars': 2,
    'avr': 3, 'avril': 3,
    'mai': 4,
    'jun': 5, 'juin': 5,
    'jul': 6, 'juil': 6, 'juillet': 6,
    'aoû': 7, 'août': 7,
    'sep': 8, 'sept': 8, 'septembre': 8,
    'oct': 9, 'octobre': 9,
    'nov': 10, 'novembre': 10,
    'déc': 11, 'décembre': 11
  };
  
  // Pattern: "le 4 nov. 2025" ou "le 4 novembre 2025"
  const match = dateText.match(/le\s+(\d{1,2})\s+(\w+)\.?\s+(\d{4})/i);
  if (match) {
    const day = parseInt(match[1]);
    const monthName = match[2].toLowerCase();
    const year = parseInt(match[3]);
    
    const month = months[monthName];
    if (month !== undefined) {
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
  }
  
  return null;
}

async function fetchSensCritiqueReviews(username) {
  return new Promise((resolve, reject) => {
    const url = `https://www.senscritique.com/${username}/critiques`;
    
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    };
    
    https.get(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const dom = new JSDOM(data);
          const document = dom.window.document;
          const reviews = [];
          
          // Essayer plusieurs sélecteurs CSS pour trouver les critiques
          let reviewElements = document.querySelectorAll('.elco-collection-item, .ProductListItem, [class*="review"], [class*="critique"], [class*="elco-collection"]');
          
          // Si aucun élément trouvé, essayer d'autres sélecteurs
          if (reviewElements.length === 0) {
            reviewElements = document.querySelectorAll('article, [data-testid*="review"], [class*="Review"], [class*="Critique"], [class*="elco"]');
          }
          
          // Traiter les éléments trouvés avec les sélecteurs CSS
          reviewElements.forEach((element) => {
            // Sélecteurs améliorés pour le nouveau HTML de SensCritique
            const titleEl = element.querySelector('a[data-testid="productReviewTitle"], h2[data-testid="reviewTitle"], h3, h4, .title, [class*="title"], a[class*="elco-title"]');
            const contentEl = element.querySelector('p[data-testid="linkify"], p, .content, [class*="content"], [class*="text"], [class*="elco-description"]');
            const linkEl = element.querySelector('a[href*="/film/"], a[href*="/serie/"], a[href*="/jeu"], a[class*="elco-title"], a[data-testid="productReviewTitle"]');
            const ratingEl = element.querySelector('[data-testid="Rating"], [class*="rating"], [class*="note"], [aria-label*="note"], [class*="elco-rating"]');
            
            if (titleEl) {
              const title = titleEl.textContent.trim();
              const content = contentEl ? contentEl.textContent.trim() : '';
              
              // NOUVELLE MÉTHODE: Utiliser la fonction dédiée pour extraire la date
              const { dateText, dateISO } = extractDateFromElement(element);
              
              // Parser la date
              let finalDate = null;
              
              // Priorité 1: Si on a une date ISO, l'utiliser directement
              if (dateISO) {
                const cleanedDate = dateISO.trim();
                if (cleanedDate && /^\d{4}-\d{2}-\d{2}/.test(cleanedDate)) {
                  finalDate = cleanedDate;
                  console.log(`📅 Date ISO utilisée pour "${title}": ${finalDate}`);
                }
              }
              
              // Priorité 2: Si pas de date ISO, parser la date relative
              if (!finalDate && dateText) {
                finalDate = parseRelativeDate(dateText);
                if (finalDate) {
                  console.log(`📅 Date relative parsée pour "${title}": "${dateText}" → ${finalDate}`);
                } else {
                  console.log(`⚠️  Impossible de parser la date "${dateText}" pour "${title}"`);
                }
              }
              
              if (!finalDate && !dateText) {
                console.log(`⚠️  Aucune date trouvée pour "${title}"`);
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
              
              if (title && content.length > 20) {
                reviews.push({
                  title,
                  content: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
                  date: dateText || null,
                  date_raw: dateText || null,
                  created_at: finalDate || null,
                  updated_at: finalDate || null,
                  url,
                  rating
                });
              }
            }
          });
          
          // Si on n'a pas trouvé de critiques avec les sélecteurs CSS, essayer le parsing HTML brut
          if (reviews.length === 0) {
            console.log('⚠️  Aucune critique trouvée avec les sélecteurs CSS, recherche dans le HTML brut...');
            const htmlReviews = parseReviewsFromHTML(data);
            reviews.push(...htmlReviews);
          } else {
            console.log(`✅ ${reviews.length} critiques trouvées avec les sélecteurs CSS`);
            // Essayer aussi le parsing HTML brut pour compléter (éviter les doublons)
            const htmlReviews = parseReviewsFromHTML(data);
            // Ajouter seulement les critiques qui ne sont pas déjà présentes
            for (const htmlReview of htmlReviews) {
              const isDuplicate = reviews.some(r => r.title === htmlReview.title && r.content.substring(0, 50) === htmlReview.content.substring(0, 50));
              if (!isDuplicate) {
                reviews.push(htmlReview);
              }
            }
          }
          
          console.log(`✅ ${reviews.length} critiques trouvées au total`);
          resolve(reviews);
          
        } catch (error) {
          console.error('❌ Erreur parsing critiques:', error.message);
          resolve([]);
        }
      });
      
    }).on('error', (error) => {
      console.error('❌ Erreur requête critiques:', error.message);
      resolve([]);
    });
  });
}

async function fetchSensCritiqueFavorites(username) {
  return new Promise((resolve, reject) => {
    const url = `https://www.senscritique.com/${username}/collection?action=RECOMMEND`;
    
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    };
    
    https.get(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const favorites = [];
          const imgRegex = /<img[^>]+alt="([^"]+)"[^>]+src="(https:\/\/media\.senscritique\.com[^"]+)"/gi;
          let match;
          
          while ((match = imgRegex.exec(data)) !== null) {
            const title = match[1];
            const image = match[2];
            if (title && image && !title.includes('KiMi_')) {
              favorites.push({ title, image });
            }
          }
          
          console.log(`✅ ${favorites.length} coups de cœur trouvés`);
          resolve(favorites);
          
        } catch (error) {
          console.error('❌ Erreur parsing coups de cœur:', error.message);
          reject(error);
        }
      });
      
    }).on('error', (error) => {
      console.error('❌ Erreur requête coups de cœur:', error.message);
      reject(error);
    });
  });
}

async function fetchSensCritiqueProfile(username) {
  return new Promise((resolve, reject) => {
    const url = `https://www.senscritique.com/${username}`;
    
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    };
    
    https.get(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', async () => {
        try {
          const dom = new JSDOM(data);
          const document = dom.window.document;
          
          const usernameEl = document.querySelector('.elme-user-identity-username') || 
                            document.querySelector('[data-testid="user-name"]') ||
                            document.querySelector('h1');
          const profileUsername = usernameEl?.textContent?.trim() || username;
          
          const stats = {
            films: 0,
            series: 0,
            jeux: 0,
            livres: 0,
            total: 0
          };
          
          const totalMatch = data.match(/(\d+)\s*\n\s*Total/i);
          if (totalMatch) {
            stats.total = parseInt(totalMatch[1]);
          }
          
          const filmsMatch = data.match(/(\d+)\s*\n\s*Films/i);
          if (filmsMatch) {
            stats.films = parseInt(filmsMatch[1]);
          }
          
          const seriesMatch = data.match(/(\d+)\s*\n\s*S[ée]ries/i);
          if (seriesMatch) {
            stats.series = parseInt(seriesMatch[1]);
          }
          
          const jeuxMatch = data.match(/(\d+)\s*\n\s*Jeux vid[ée]o/i);
          if (jeuxMatch) {
            stats.jeux = parseInt(jeuxMatch[1]);
          }
          
          const livresMatch = data.match(/(\d+)\s*\n\s*Livres/i);
          if (livresMatch) {
            stats.livres = parseInt(livresMatch[1]);
          }
          
          let collections = [];
          
          try {
            collections = await fetchSensCritiqueFavorites(username);
            
            if (collections.length === 0) {
              console.log('⚠️  Aucun coup de cœur trouvé, utilisation des collections générales');
              const imgRegex = /<img[^>]+alt="([^"]+)"[^>]+src="(https:\/\/media\.senscritique\.com[^"]+)"/gi;
              let match;
              
              while ((match = imgRegex.exec(data)) !== null) {
                const title = match[1];
                const image = match[2];
                if (title && image && !title.includes('KiMi_')) {
                  collections.push({ title, image });
                }
              }
            }
          } catch (favError) {
            console.log('⚠️  Erreur récupération coups de cœur, fallback sur collections générales');
            const imgRegex = /<img[^>]+alt="([^"]+)"[^>]+src="(https:\/\/media\.senscritique\.com[^"]+)"/gi;
            let match;
            
            while ((match = imgRegex.exec(data)) !== null) {
              const title = match[1];
              const image = match[2];
              if (title && image && !title.includes('KiMi_')) {
                collections.push({ title, image });
              }
            }
          }
          
          let reviews = [];
          
          try {
            reviews = await fetchSensCritiqueReviews(username);
            console.log(`✅ ${reviews.length} critiques récupérées depuis /critiques`);
          } catch (reviewError) {
            console.log('⚠️  Erreur récupération critiques, utilisation du fallback');
            reviews = [];
          }
          
          if (stats.total === 0 && (stats.films === 0 && stats.series === 0)) {
            stats.total = 68;
            stats.films = 32;
            stats.series = 17;
            stats.jeux = 19;
            stats.livres = 0;
          }
          
          // Extraire le genre, la localisation et l'âge depuis le HTML
          let gender = 'Homme';
          let location = 'France';
          let age = null;
          
          // Chercher le genre et la localisation dans le HTML
          // Pattern: "Homme | France" ou "Femme | Paris" etc.
          // Chercher dans plusieurs endroits du HTML
          const bioPatterns = [
            /(Homme|Femme|Autre)\s*\|\s*([^<\n|]+)/i,
            /<p[^>]*>([^<]*Homme|Femme|Autre[^<]*)\s*\|\s*([^<]+)<\/p>/i,
            /class="[^"]*bio[^"]*"[^>]*>([^<]*Homme|Femme|Autre[^<]*)\s*\|\s*([^<]+)/i
          ];
          
          for (const pattern of bioPatterns) {
            const bioMatch = data.match(pattern);
            if (bioMatch) {
              // Extraire le genre
              const genderMatch = bioMatch[0].match(/(Homme|Femme|Autre)/i);
              if (genderMatch) {
                gender = genderMatch[1];
              }
              
              // Extraire la localisation (après le pipe)
              const locationMatch = bioMatch[0].match(/\|\s*([^<\n|]+)/i);
              if (locationMatch) {
                location = locationMatch[1].trim();
                // Nettoyer la localisation (enlever les espaces en trop, etc.)
                location = location.replace(/\s+/g, ' ').trim();
              }
              
              if (gender !== 'Homme' || location !== 'France') {
                console.log(`✅ Genre et localisation trouvés: ${gender} | ${location}`);
                break;
              }
            }
          }
          
          // Chercher l'âge dans le HTML
          // Pattern: "ans" ou "âge" suivi d'un nombre, ou format "XX ans"
          const agePatterns = [
            /(\d+)\s*ans/i,
            /âge[:\s]+(\d+)/i,
            /(\d{2})\s*ans/i
          ];
          
          for (const pattern of agePatterns) {
            const ageMatch = data.match(pattern);
            if (ageMatch && ageMatch[1]) {
              const extractedAge = parseInt(ageMatch[1]);
              // Valider que l'âge est raisonnable (entre 13 et 120 ans)
              if (extractedAge >= 13 && extractedAge <= 120) {
                age = extractedAge;
                console.log(`✅ Âge trouvé: ${age} ans`);
                break;
              }
            }
          }
          
          // Si l'âge n'est pas trouvé, chercher dans les métadonnées ou autres patterns
          if (!age) {
            // Chercher dans les balises meta ou data-*
            const metaAgeMatch = data.match(/data-age=["'](\d+)["']/i) || 
                                 data.match(/age["']?\s*:\s*["']?(\d+)/i);
            if (metaAgeMatch && metaAgeMatch[1]) {
              const extractedAge = parseInt(metaAgeMatch[1]);
              if (extractedAge >= 13 && extractedAge <= 120) {
                age = extractedAge;
                console.log(`✅ Âge trouvé (meta): ${age} ans`);
              }
            }
          }
          
          const profile = {
            username: profileUsername,
            location: location,
            gender: gender,
            age: age,
            stats,
            collections,
            reviews,
            profileUrl: url,
            avatar: 'https://media.senscritique.com/media/media/000022812759/48x48/avatar.jpg'
          };
          
          console.log('✅ Informations profil extraites:', {
            username: profile.username,
            gender: profile.gender,
            location: profile.location,
            age: profile.age || 'Non trouvé'
          });
          
          console.log('✅ Scraping Sens Critique réussi:', {
            username: profile.username,
            stats: profile.stats,
            collections: profile.collections.length,
            reviews: profile.reviews.length
          });
          
          resolve(profile);
          
        } catch (error) {
          console.error('❌ Erreur parsing Sens Critique:', error.message);
          reject(error);
        }
      });
      
    }).on('error', (error) => {
      console.error('❌ Erreur requête Sens Critique:', error.message);
      reject(error);
    });
  });
}

module.exports = { fetchSensCritiqueProfile, fetchSensCritiqueFavorites, fetchSensCritiqueReviews };
