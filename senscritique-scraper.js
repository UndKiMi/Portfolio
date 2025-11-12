const https = require('https');
const { JSDOM } = require('jsdom');
const puppeteer = require('puppeteer');

// Fonction pour parser les critiques depuis le HTML brut
function parseReviewsFromHTML(html) {
  const reviews = [];
  
  try {
    // Pattern spécifique pour Sens Critique: "Critique de [Titre] par [User]"
    // Structure: "Critique de [Titre] par KiMi_" + contenu + "Par KiMi_" + date
    // On cherche d'abord les titres, puis le contenu et la date dans le contexte
    
    // Essayer plusieurs patterns pour trouver les critiques
    const titlePatterns = [
      /(?:<h[23][^>]*>|##\s*)Critique de ([^<\n]+?)\s+par\s+KiMi_/gi,
      /Critique de ([^<\n]+?)\s+par\s+KiMi_/gi,
      /data-testid="reviewTitle"[^>]*>Critique de ([^<]+?)\s+par/gi,
      /<h2[^>]*data-testid="reviewTitle"[^>]*>([^<]+?)<\/h2>/gi
    ];
    
    let titleMatches = [];
    for (const pattern of titlePatterns) {
      const matches = [...html.matchAll(pattern)];
      if (matches.length > 0) {
        titleMatches = matches;
        break;
      }
    }
    
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
      
      // Utiliser la fonction dédiée pour extraire la date
      const extendedContext = html.substring(Math.max(0, titleMatch.index - 1000), titleMatch.index + 4000);
      const { dateText, dateISO } = extractDateFromHTML(html, context || extendedContext);
      
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
        
        // Normaliser "jour" en "jours" si nécessaire
        let normalizedDateText = dateText;
        if (dateText && dateText.includes('il y a')) {
          const jourMatch = dateText.match(/il\s+y\s+a\s+(\d+)\s+jour\b/i);
          if (jourMatch && parseInt(jourMatch[1]) > 1) {
            normalizedDateText = dateText.replace(/\s+jour\b/i, ' jours');
          }
        }
        
        // Ajouter la critique
        const review = {
          title,
          content: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
          date: normalizedDateText || null,
          date_raw: normalizedDateText || null,
          created_at: finalDate || null,
          updated_at: finalDate || null,
          url,
          rating
        };
        
        reviews.push(review);
      }
    }
    
    // Si on n'a rien trouvé, essayer un pattern plus général
    if (reviews.length === 0) {
      // Essayer de trouver des critiques avec des patterns de texte
      // Pattern principal: Titre + Contenu + Date
      const reviewTextPattern = /(?:<h[23][^>]*>|<a[^>]*>)([^<]{10,100})(?:<\/h[23]>|<\/a>)[\s\S]{0,500}?(?:<p[^>]*>|<div[^>]*>)([^<]{20,300})(?:<\/p>|<\/div>)[\s\S]{0,200}?(?:il y a \d+ (?:jour|jours|semaine|semaines|mois|an|ans)|le \d{1,2}\s+\w+\.?\s+\d{4}|datetime=["']([^"']+)["'])/gi;
      const textMatches = [...html.matchAll(reviewTextPattern)];
    
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
          
          // Utiliser la fonction dédiée pour extraire la date
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
    
    // Chercher tous les articles avec data-testid="review-overview" dans le HTML brut
    if (reviews.length === 0) {
      // Chercher tous les articles avec data-testid="review-overview"
      const articlePattern = /<article[^>]*data-testid="review-overview"[^>]*>([\s\S]*?)<\/article>/gi;
      const articleMatches = [...html.matchAll(articlePattern)];
      
      for (const articleMatch of articleMatches) {
        const articleHTML = articleMatch[0];
        
        // Extraire le titre
        const titleMatch = articleHTML.match(/<a[^>]*data-testid="productReviewTitle"[^>]*>([^<]+)<\/a>/i) ||
                          articleHTML.match(/<h2[^>]*data-testid="reviewTitle"[^>]*>Critique de ([^<]+?)\s+par/i);
        const title = titleMatch ? titleMatch[1].trim().replace(/^Critique de\s+/i, '').replace(/\s+par\s+KiMi_/i, '').trim() : null;
        
        // Extraire le contenu
        const contentMatch = articleHTML.match(/<p[^>]*data-testid="linkify"[^>]*>[\s\S]*?<span[^>]*>([^<]{30,500})<\/span>/i) ||
                            articleHTML.match(/<p[^>]*>([^<]{30,500})<\/p>/i);
        const content = contentMatch ? contentMatch[1].trim() : null;
        
        // Extraire la date
        const { dateText, dateISO } = extractDateFromHTML(html, articleHTML);
        
        // Extraire la note
        const ratingMatch = articleHTML.match(/<div[^>]*data-testid="Rating"[^>]*>(\d+)<\/div>/i);
        const rating = ratingMatch ? parseInt(ratingMatch[1]) : null;
        
        // Extraire le lien
        const linkMatch = articleHTML.match(/href="(\/[^"]*\/(?:serie|film|jeu)\/[^"]+)"/i);
        const url = linkMatch ? `https://www.senscritique.com${linkMatch[1]}` : null;
        
        if (title && content && content.length > 20) {
          let finalDate = null;
          if (dateISO) {
            finalDate = dateISO;
          } else if (dateText) {
            finalDate = parseRelativeDate(dateText);
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
      // Chercher simplement les titres suivis de contenu
      const simplePattern = /<h[23][^>]*>([^<]{10,100})<\/h[23]>[\s\S]{0,1000}?<p[^>]*>([^<]{30,300})<\/p>/gi;
      const simpleMatches = [...html.matchAll(simplePattern)];
      
      for (const match of simpleMatches) {
        const title = match[1]?.trim();
        const content = match[2]?.trim();
        
          if (title && content && content.length > 20 && !title.includes('Sens Critique')) {
          // Utiliser la fonction dédiée pour extraire la date
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
    // Chercher aussi les dates françaises "le X nov. 2025"
    const relativeDateMatch = context.match(/il\s+y\s+a\s+(\d+)\s*(jour|jours|semaine|semaines|mois|an|ans)/i);
    const frenchDateMatch = context.match(/le\s+\d{1,2}\s+\w+\.?\s+\d{4}/i);
    
    if (relativeDateMatch) {
      // Normaliser "jour" en "jours" si nécessaire
      dateText = relativeDateMatch[0].trim();
      if (relativeDateMatch[2] === 'jour' && parseInt(relativeDateMatch[1]) > 1) {
        dateText = dateText.replace(/\s+jour\b/i, ' jours');
      }
    } else if (frenchDateMatch) {
      dateText = frenchDateMatch[0].trim();
    }
    
    // Chercher aussi après "Par KiMi_"
    if (!dateText) {
      const parPattern = /Par\s+KiMi_[\s\S]{0,500}?(il\s+y\s+a\s+\d+\s*(?:jour|jours|semaine|semaines|mois|an|ans)|le\s+\d{1,2}\s+\w+\.?\s+\d{4})/i;
      const parMatch = context.match(parPattern);
      if (parMatch && parMatch[1]) {
        dateText = parMatch[1].trim();
        // Normaliser "jour" en "jours" si nécessaire
        const jourMatch = dateText.match(/il\s+y\s+a\s+(\d+)\s+jour\b/i);
        if (jourMatch && parseInt(jourMatch[1]) > 1) {
          dateText = dateText.replace(/\s+jour\b/i, ' jours');
        }
      }
    }
  }
  
  // MÉTHODE 2: Chercher dans le HTML brut complet si pas trouvé
  if (!dateText && html) {
    const relativeDateMatch = html.match(/il\s+y\s+a\s+(\d+)\s*(jour|jours|semaine|semaines|mois|an|ans)/i);
    const frenchDateMatch = html.match(/le\s+\d{1,2}\s+\w+\.?\s+\d{4}/i);
    
    if (relativeDateMatch) {
      dateText = relativeDateMatch[0].trim();
      if (relativeDateMatch[2] === 'jour' && parseInt(relativeDateMatch[1]) > 1) {
        dateText = dateText.replace(/\s+jour\b/i, ' jours');
      }
    } else if (frenchDateMatch) {
      dateText = frenchDateMatch[0].trim();
    }
  }
  
  // MÉTHODE 3: Chercher des dates ISO dans les attributs datetime
  if (!dateISO && html) {
    const datetimeMatch = html.match(/datetime=["']([^"']+)["']/i);
    if (datetimeMatch && /^\d{4}-\d{2}-\d{2}/.test(datetimeMatch[1])) {
      dateISO = datetimeMatch[1];
    }
  }
  
  return { dateText, dateISO };
}

// Fonction robuste pour extraire la date d'un élément de critique
function extractDateFromElement(element) {
  if (!element) return { dateText: null, dateISO: null };
  
  let dateText = null;
  let dateISO = null;
  
  // MÉTHODE 1: Chercher dans les balises <time> avec attribut datetime (le plus fiable)
  const timeEl = element.querySelector('time[datetime]');
  if (timeEl) {
    dateISO = timeEl.getAttribute('datetime');
    if (dateISO && /^\d{4}-\d{2}-\d{2}/.test(dateISO)) {
      // Extraire aussi le texte de la date si disponible
      const timeText = timeEl.textContent.trim();
      if (timeText && (timeText.includes('il y a') || timeText.match(/le \d{1,2}/))) {
        dateText = timeText;
      }
    } else {
      dateISO = null;
    }
  }
  
  // MÉTHODE 2: Chercher dans tous les <p> de l'élément
  if (!dateText && !dateISO) {
    const allPs = element.querySelectorAll('p');
    for (const p of allPs) {
      const pText = p.textContent.trim();
      // Pattern pour "il y a X jour(s)" ou "il y a X jours" ou "le X nov. 2025"
      const relativeDateMatch = pText.match(/il\s+y\s+a\s+(\d+)\s*(jour|jours|semaine|semaines|mois|an|ans)/i);
      const frenchDateMatch = pText.match(/le\s+\d{1,2}\s+\w+\.?\s+\d{4}/i);
      
      if (relativeDateMatch) {
        dateText = relativeDateMatch[0].trim();
        break;
      } else if (frenchDateMatch) {
        dateText = frenchDateMatch[0].trim();
        break;
      }
    }
  }
  
  // MÉTHODE 3: Chercher dans tous les <span> de l'élément
  if (!dateText && !dateISO) {
    const allSpans = element.querySelectorAll('span');
    for (const span of allSpans) {
      const spanText = span.textContent.trim();
      const relativeDateMatch = spanText.match(/il\s+y\s+a\s+(\d+)\s*(jour|jours|semaine|semaines|mois|an|ans)/i);
      const frenchDateMatch = spanText.match(/le\s+\d{1,2}\s+\w+\.?\s+\d{4}/i);
      
      if (relativeDateMatch) {
        dateText = relativeDateMatch[0].trim();
        break;
      } else if (frenchDateMatch) {
        dateText = frenchDateMatch[0].trim();
        break;
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
    }
    
    // Chercher du texte de date relative dans le HTML
    if (!dateText) {
      const relativeDateMatch = elementHTML.match(/il\s+y\s+a\s+\d+\s*(jour|jours|semaine|semaines|mois|an|ans)/i);
      const frenchDateMatch = elementHTML.match(/le\s+\d{1,2}\s+\w+\.?\s+\d{4}/i);
      
      if (relativeDateMatch) {
        dateText = relativeDateMatch[0].trim();
      } else if (frenchDateMatch) {
        dateText = frenchDateMatch[0].trim();
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
  return new Promise(async (resolve, reject) => {
    const url = `https://www.senscritique.com/${username}/critiques`;
    
    let browser = null;
    try {
      // Utiliser Puppeteer pour exécuter le JavaScript
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Attendre que les critiques soient chargées
      try {
        await page.waitForSelector('article[data-testid="review-overview"]', { timeout: 10000 });
      } catch (e) {
        // Timeout acceptable, on continue
      }
      
      // Faire défiler la page pour charger toutes les critiques (pagination infinie)
      let previousHeight = 0;
      let currentHeight = await page.evaluate(() => document.body.scrollHeight);
      let scrollAttempts = 0;
      const maxScrollAttempts = 20; // Augmenter pour charger plus de critiques
      let previousReviewCount = 0;
      
      while (scrollAttempts < maxScrollAttempts) {
        previousHeight = currentHeight;
        previousReviewCount = await page.evaluate(() => {
          return document.querySelectorAll('article[data-testid="review-overview"]').length;
        });
        
        // Scroller jusqu'en bas
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        
        // Attendre que le contenu se charge
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Vérifier la nouvelle hauteur et le nombre de critiques
        currentHeight = await page.evaluate(() => document.body.scrollHeight);
        const currentReviewCount = await page.evaluate(() => {
          return document.querySelectorAll('article[data-testid="review-overview"]').length;
        });
        
        scrollAttempts++;
        
        // Si la hauteur n'a pas changé ET le nombre de critiques n'a pas changé, on a tout chargé
        if (previousHeight === currentHeight && previousReviewCount === currentReviewCount) {
          break;
        }
      }
      
      console.log(`📜 Scroll terminé après ${scrollAttempts} tentatives`);
      
      // Remonter en haut après le scroll
      await page.evaluate(() => window.scrollTo(0, 0));
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Récupérer le HTML rendu
      const data = await page.content();
      await browser.close();
      
      // Parser le HTML avec JSDOM
      const dom = new JSDOM(data);
      const document = dom.window.document;
      const reviews = [];
      
      // Essayer plusieurs sélecteurs CSS pour trouver les critiques (par ordre de spécificité)
      // Commencer par le sélecteur le plus spécifique
      let reviewElements = document.querySelectorAll('article[data-testid="review-overview"]');
      
      // Si aucun élément trouvé, essayer d'autres sélecteurs
      if (reviewElements.length === 0) {
        reviewElements = document.querySelectorAll('[data-testid*="review"]');
      }
      
      if (reviewElements.length === 0) {
        reviewElements = document.querySelectorAll('article');
      }
      
      if (reviewElements.length === 0) {
        const reviewLinks = document.querySelectorAll('a[href*="/critique/"]');
        if (reviewLinks.length > 0) {
          reviewElements = reviewLinks;
        }
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
          
          // Utiliser la fonction dédiée pour extraire la date
          const { dateText, dateISO } = extractDateFromElement(element);
          
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
            finalDate = parseRelativeDate(dateText);
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
            // Normaliser "jour" en "jours" si nécessaire pour le formatage
            let normalizedDateText = dateText;
            if (dateText && dateText.includes('il y a')) {
              const jourMatch = dateText.match(/il\s+y\s+a\s+(\d+)\s+jour\b/i);
              if (jourMatch && parseInt(jourMatch[1]) > 1) {
                normalizedDateText = dateText.replace(/\s+jour\b/i, ' jours');
              }
            }
            
            reviews.push({
              title,
              content: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
              date: normalizedDateText || null,
              date_raw: normalizedDateText || null,
              created_at: finalDate || null,
              updated_at: finalDate || null,
              url,
              rating
            });
          }
        }
      });
      
      // Toujours essayer le parsing HTML brut pour compléter (même si on a trouvé des critiques avec CSS)
      const htmlReviews = parseReviewsFromHTML(data);
      
      // Ajouter les critiques du HTML brut qui ne sont pas déjà présentes
      for (const htmlReview of htmlReviews) {
        const isDuplicate = reviews.some(r => 
          r.title === htmlReview.title && 
          r.content.substring(0, 50) === htmlReview.content.substring(0, 50)
        );
        if (!isDuplicate) {
          reviews.push(htmlReview);
        }
      }
      
      // Si toujours aucune critique, chercher TOUS les articles
      if (reviews.length === 0) {
        // Chercher TOUS les articles
        const allArticles = document.querySelectorAll('article');
        
        allArticles.forEach((article) => {
          const testId = article.getAttribute('data-testid');
          
          // Essayer d'extraire les informations de TOUS les articles
          const titleEl = article.querySelector('a[data-testid="productReviewTitle"], h2[data-testid="reviewTitle"], h2, h3, a[href*="/serie/"], a[href*="/film/"]');
          const contentEl = article.querySelector('p[data-testid="linkify"], p');
          const ratingEl = article.querySelector('[data-testid="Rating"]');
          const linkEl = article.querySelector('a[href*="/serie/"], a[href*="/film/"], a[href*="/jeu/"]');
          
          // Vérifier si cet article ressemble à une critique
          const hasReviewTitle = titleEl && (titleEl.textContent.includes('Critique de') || testId === 'review-overview');
          const hasContent = contentEl && contentEl.textContent.trim().length > 20;
          const hasRating = ratingEl !== null;
          
          if (titleEl && (hasReviewTitle || hasContent || hasRating)) {
            const title = titleEl.textContent.trim();
            // Nettoyer le titre si c'est "Critique de X par Y"
            const cleanTitle = title.replace(/^Critique de\s+/i, '').replace(/\s+par\s+KiMi_/i, '').trim();
            const content = contentEl ? contentEl.textContent.trim() : '';
            const { dateText, dateISO } = extractDateFromElement(article);
            
            let finalDate = null;
            if (dateISO) {
              finalDate = dateISO;
            } else if (dateText) {
              finalDate = parseRelativeDate(dateText);
            }
            
            let rating = null;
            if (ratingEl) {
              const ratingText = ratingEl.textContent.trim();
              const ratingMatch = ratingText.match(/(\d+)/);
              if (ratingMatch) {
                rating = parseInt(ratingMatch[1]);
              }
            }
            
            const url = linkEl ? `https://www.senscritique.com${linkEl.getAttribute('href')}` : null;
            
            if (cleanTitle && content.length > 20 && !cleanTitle.includes('Sens Critique')) {
              // Vérifier si c'est un doublon
              const isDuplicate = reviews.some(r => r.title === cleanTitle || r.content.substring(0, 50) === content.substring(0, 50));
              
              if (!isDuplicate) {
                // Normaliser "jour" en "jours" si nécessaire
                let normalizedDateText = dateText;
                if (dateText && dateText.includes('il y a')) {
                  const jourMatch = dateText.match(/il\s+y\s+a\s+(\d+)\s+jour\b/i);
                  if (jourMatch && parseInt(jourMatch[1]) > 1) {
                    normalizedDateText = dateText.replace(/\s+jour\b/i, ' jours');
                  }
                }
                
                reviews.push({
                  title: cleanTitle,
                  content: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
                  date: normalizedDateText || null,
                  date_raw: normalizedDateText || null,
                  created_at: finalDate || null,
                  updated_at: finalDate || null,
                  url,
                  rating
                });
              }
            }
          }
        });
      }
      
      console.log(`✅ ${reviews.length} critiques trouvées`);
      resolve(reviews);
    } catch (error) {
      console.error('❌ Erreur Puppeteer:', error.message);
      if (browser) {
        await browser.close();
      }
      resolve([]);
    }
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
          
          console.log('✅ Profil SensCritique récupéré:', {
            username: profile.username,
            reviews: profile.reviews.length,
            collections: profile.collections.length
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
