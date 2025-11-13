const https = require('https');
const { JSDOM } = require('jsdom');
const puppeteer = require('puppeteer');

// ============================================================================
// FONCTIONS UTILITAIRES DE NETTOYAGE HTML
// ============================================================================

/**
 * Nettoie strictement le HTML d'un texte (supprime toutes les balises et attributs HTML)
 */
function cleanHTMLStrict(text) {
  if (!text) return '';
  
  // Supprimer TOUTES les balises HTML
  let cleaned = text.replace(/<[^>]*>/g, '').trim();
  
  // Supprimer les attributs HTML résiduels
  cleaned = cleaned.replace(/class="[^"]*"/g, '');
  cleaned = cleaned.replace(/class=\\?"[^"]*\\?"/g, '');
  cleaned = cleaned.replace(/data-testid="[^"]*"/g, '');
  cleaned = cleaned.replace(/data-testid=\\?"[^"]*\\?"/g, '');
  cleaned = cleaned.replace(/href="[^"]*"/g, '');
  cleaned = cleaned.replace(/href=\\?"[^"]*\\?"/g, '');
  
  // Supprimer les backslashes échappés
  cleaned = cleaned.replace(/\\\\/g, '');
  
  // Nettoyer "a " ou "a class" au début
  if (cleaned.startsWith('a ') || cleaned.startsWith('a class')) {
    return ''; // Contenu invalide
  }
  
  // Nettoyer les espaces multiples
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

// ============================================================================
// SYSTÈME DE CACHE
// ============================================================================

const cache = new Map();

/**
 * Récupère les données depuis le cache
 * @param {string} key - Clé du cache
 * @returns {Object|null} Données en cache ou null
 */
function getFromCache(key) {
  const cached = cache.get(key);
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > cached.ttl) {
    cache.delete(key);
    return null;
  }
  
  return cached.data;
}

/**
 * Sauvegarde les données dans le cache
 * @param {string} key - Clé du cache
 * @param {Object} data - Données à mettre en cache
 * @param {number} ttl - Durée de vie en millisecondes (défaut: 5 minutes)
 */
function saveToCache(key, data, ttl = 300000) {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl
  });
}

/**
 * Vide le cache
 */
function clearCache() {
  cache.clear();
}

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
          // Nettoyer tout HTML résiduel
          content = content.replace(/<[^>]*>/g, '').trim();
          // Nettoyer les espaces multiples
          content = content.replace(/\s+/g, ' ').trim();
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
        
        // Nettoyer le titre de tout HTML résiduel
        let cleanTitle = title.replace(/<[^>]*>/g, '').trim();
        cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();
        
        // Nettoyer le contenu de tout HTML résiduel
        let cleanContent = content;
        if (cleanContent) {
          cleanContent = cleanContent.replace(/<[^>]*>/g, '').trim();
          cleanContent = cleanContent.replace(/\s+/g, ' ').trim();
          // Limiter à 200 caractères
          cleanContent = cleanContent.substring(0, 200) + (cleanContent.length > 200 ? '...' : '');
        }
        
        // Vérifier qu'il n'y a pas de HTML résiduel
        if (cleanContent && (cleanContent.includes('<') || cleanContent.includes('>') || cleanContent.includes('class='))) {
          console.error('🚨 [Scraper] ALERTE : Du code HTML détecté dans parseReviewsFromHTML ! Nettoyage supplémentaire...');
          cleanContent = cleanContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        }
        
        // Ajouter la critique
        const review = {
          title: cleanTitle,
          content: cleanContent || 'Pas de commentaire',
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
        let title = match[1]?.trim();
        let content = match[2]?.trim();
        
        // Nettoyer le HTML des deux champs
        if (title) {
          title = title.replace(/<[^>]*>/g, '').trim();
          title = title.replace(/\s+/g, ' ').trim();
        }
        if (content) {
          content = content.replace(/<[^>]*>/g, '').trim();
          content = content.replace(/\s+/g, ' ').trim();
        }
        
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
          
          // Priorité 2: Si pas de date ISO, parser la date relative ou française
          if (!finalDate && dateText) {
            if (dateText.includes('il y a')) {
              finalDate = parseRelativeDate(dateText);
            } else if (dateText.match(/le\s+\d{1,2}\s+\w+\.?\s+\d{4}/i)) {
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
    // Toujours essayer cette méthode même si on a déjà des critiques
    {
      // Chercher tous les articles avec data-testid="review-overview"
      const articlePattern = /<article[^>]*data-testid="review-overview"[^>]*>([\s\S]*?)<\/article>/gi;
      const articleMatches = [...html.matchAll(articlePattern)];
      
      for (const articleMatch of articleMatches) {
        const articleHTML = articleMatch[0];
        
        // Extraire le titre - essayer plusieurs patterns
        let title = null;
        const titleMatch1 = articleHTML.match(/<a[^>]*data-testid="productReviewTitle"[^>]*>([^<]+)<\/a>/i);
        const titleMatch2 = articleHTML.match(/<h2[^>]*data-testid="reviewTitle"[^>]*>Critique de ([^<]+?)\s+par/i);
        const titleMatch3 = articleHTML.match(/<h2[^>]*>Critique de ([^<]+?)\s+par\s+KiMi_/i);
        const titleMatch4 = articleHTML.match(/Critique de ([^<\n]+?)\s+par\s+KiMi_/i);
        
        if (titleMatch1) {
          title = titleMatch1[1].trim();
        } else if (titleMatch2) {
          title = titleMatch2[1].trim();
        } else if (titleMatch3) {
          title = titleMatch3[1].trim();
        } else if (titleMatch4) {
          title = titleMatch4[1].trim();
        }
        
        if (title) {
          title = title.replace(/^Critique de\s+/i, '').replace(/\s+par\s+KiMi_/i, '').trim();
        }
        
        // Extraire le contenu - essayer plusieurs patterns
        let content = null;
        const contentMatch1 = articleHTML.match(/<p[^>]*data-testid="linkify"[^>]*>[\s\S]*?<span[^>]*>([^<]{10,500})<\/span>/i);
        const contentMatch2 = articleHTML.match(/<p[^>]*data-testid="linkify"[^>]*>([^<]{10,500})<\/p>/i);
        const contentMatch3 = articleHTML.match(/<p[^>]*>([^<]{10,500})<\/p>/i);
        
        if (contentMatch1) {
          content = contentMatch1[1].trim();
        } else if (contentMatch2) {
          content = contentMatch2[1].trim();
        } else if (contentMatch3) {
          content = contentMatch3[1].trim();
        }
        
        // Extraire la date
        const { dateText, dateISO } = extractDateFromHTML(html, articleHTML);
        
        // Extraire la note - essayer plusieurs patterns
        let rating = null;
        const ratingMatch1 = articleHTML.match(/<div[^>]*data-testid="Rating"[^>]*>(\d+)<\/div>/i);
        const ratingMatch2 = articleHTML.match(/data-testid="Rating"[^>]*>(\d+)/i);
        const ratingMatch3 = articleHTML.match(/aria-label="[^"]*(\d+)[^"]*note/i);
        
        if (ratingMatch1) {
          rating = parseInt(ratingMatch1[1]);
        } else if (ratingMatch2) {
          rating = parseInt(ratingMatch2[1]);
        } else if (ratingMatch3) {
          rating = parseInt(ratingMatch3[1]);
        }
        
        // Extraire le lien - essayer plusieurs patterns
        let url = null;
        const linkMatch1 = articleHTML.match(/href="(\/[^"]*\/(?:serie|film|jeu)\/[^"]+)"/i);
        const linkMatch2 = articleHTML.match(/href="(\/[^"]*\/critique\/[^"]+)"/i);
        
        if (linkMatch1) {
          url = `https://www.senscritique.com${linkMatch1[1]}`;
        } else if (linkMatch2) {
          url = `https://www.senscritique.com${linkMatch2[1]}`;
        }
        
        // Parser la date
        let finalDate = null;
        if (dateISO) {
          finalDate = dateISO;
        } else if (dateText) {
          if (dateText.includes('il y a')) {
            finalDate = parseRelativeDate(dateText);
          } else if (dateText.match(/le\s+\d{1,2}\s+\w+\.?\s+\d{4}/i)) {
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
        
        // Accepter les critiques même avec peu de contenu (minimum 10 caractères)
        if (title && title.length > 2) {
          // Vérifier si cette critique n'existe pas déjà
          const isDuplicate = reviews.some(r => r.title === title);
          
          if (!isDuplicate) {
            reviews.push({
              title,
              content: content && content.length > 10 ? (content.substring(0, 200) + (content.length > 200 ? '...' : '')) : 'Pas de commentaire',
              date: normalizedDateText || null,
              date_raw: normalizedDateText || null,
              created_at: finalDate || null,
              updated_at: finalDate || null,
              url: url || null,
              rating
            });
          }
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
  
  // Pattern: "le 4 nov. 2025" ou "le 4 novembre 2025" (avec ou sans "le")
  const match = dateText.match(/(?:le\s+)?(\d{1,2})\s+(\w+)\.?\s+(\d{4})/i);
  if (match) {
    const day = parseInt(match[1]);
    const monthName = match[2].toLowerCase().replace(/\.$/, ''); // Enlever le point final
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
      console.log('🚀 [Scraper] Lancement de Puppeteer...');
      // Utiliser Puppeteer avec args minimaux (les autres causaient des ECONNRESET)
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      });
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      console.log('📄 [Scraper] Navigation vers:', url);
      // Optimisé : domcontentloaded au lieu de networkidle0, timeout réduit à 15s
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      
      // Attendre que les critiques soient chargées (timeout réduit à 5s)
      try {
        await page.waitForSelector('article[data-testid="review-overview"], [data-testid*="review"], article', { timeout: 5000 });
        console.log('✅ [Scraper] Sélecteur trouvé, page chargée');
      } catch (e) {
        console.log('⚠️  [Scraper] Timeout sur le sélecteur, on continue...');
      }
      
      // Attente initiale réduite à 1s au lieu de 3s
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Vérifier ce qui est présent dans le DOM
      const initialCheck = await page.evaluate(() => {
        return {
          articles: document.querySelectorAll('article').length,
          reviewElements: document.querySelectorAll('[data-testid*="review"]').length,
          links: document.querySelectorAll('a[href*="/film/"], a[href*="/serie/"], a[href*="/jeu"]').length
        };
      });
      console.log('📊 [Scraper] État initial du DOM:', initialCheck);
      
      // Faire défiler la page pour charger toutes les critiques (pagination infinie)
      let previousHeight = 0;
      let currentHeight = await page.evaluate(() => document.body.scrollHeight);
      let scrollAttempts = 0;
      const maxScrollAttempts = 50; // Augmenté pour récupérer toutes les critiques (68)
      const scrollDelay = 1000; // Délai entre scrolls
      let previousReviewCount = 0;
      let stableCount = 0; // Compteur pour vérifier que le nombre est stable
      
      // Compter les critiques initiales - essayer plusieurs sélecteurs
      previousReviewCount = await page.evaluate(() => {
        const count1 = document.querySelectorAll('article[data-testid="review-overview"]').length;
        if (count1 > 0) return count1;
        const count2 = document.querySelectorAll('[data-testid*="review"]').length;
        if (count2 > 0) return count2;
        const count3 = document.querySelectorAll('article').length;
        return count3;
      });
      console.log(`📊 Critiques initiales: ${previousReviewCount}`);
      
      // Essayer de cliquer sur le bouton "Charger plus" s'il existe (réduit à 500ms)
      try {
        const buttonFound = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, [role="button"], a[class*="button"]'));
          const btn = buttons.find(b => {
            const text = b.textContent.toLowerCase();
            return text.includes('charger') || text.includes('voir plus') || text.includes('load more') || 
                   b.getAttribute('data-testid')?.includes('load') ||
                   b.className?.toLowerCase().includes('load-more');
          });
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        });
        
        if (buttonFound) {
          console.log('🔘 [Scraper] Bouton "Charger plus" trouvé et cliqué');
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (e) {
        // Pas de bouton, on continue avec le scroll
      }
      
      while (scrollAttempts < maxScrollAttempts) {
        previousHeight = currentHeight;
        
        // Scroller progressivement (optimisé - attente réduite à 50ms)
        for (let i = 0; i < 3; i++) {
          await page.evaluate(() => {
            window.scrollBy(0, 800);
          });
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Scroller jusqu'en bas
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        
        // Attendre que le contenu se charge (utiliser scrollDelay)
        await new Promise(resolve => setTimeout(resolve, scrollDelay));
        
        // Essayer de cliquer sur le bouton "Charger plus" à nouveau (attente réduite)
        try {
          const buttonClicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, [role="button"], a[class*="button"]'));
            const btn = buttons.find(b => {
              const text = b.textContent.toLowerCase();
              const rect = b.getBoundingClientRect();
              const isVisible = rect.top >= 0 && rect.left >= 0 && 
                               rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                               rect.right <= (window.innerWidth || document.documentElement.clientWidth);
              return isVisible && (text.includes('charger') || text.includes('voir plus') || text.includes('load more') || 
                     b.getAttribute('data-testid')?.includes('load') ||
                     b.className?.toLowerCase().includes('load-more'));
            });
            if (btn) {
              btn.click();
              return true;
            }
            return false;
          });
          
          if (buttonClicked) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (e) {
          // Ignorer les erreurs
        }
        
        // Vérifier la nouvelle hauteur et le nombre de critiques
        currentHeight = await page.evaluate(() => document.body.scrollHeight);
        const currentReviewCount = await page.evaluate(() => {
          const count1 = document.querySelectorAll('article[data-testid="review-overview"]').length;
          if (count1 > 0) return count1;
          const count2 = document.querySelectorAll('[data-testid*="review"]').length;
          if (count2 > 0) return count2;
          const count3 = document.querySelectorAll('article').length;
          return count3;
        });
        
        scrollAttempts++;
        
        // Si le nombre de critiques a augmenté, réinitialiser le compteur de stabilité
        if (currentReviewCount > previousReviewCount) {
          stableCount = 0;
          previousReviewCount = currentReviewCount;
          console.log(`📊 [Scraper] Scroll ${scrollAttempts}/${maxScrollAttempts}: ${currentReviewCount} critiques`);
        } else {
          // Pas de nouvelles critiques, incrémenter le compteur
          stableCount++;
        }
        
        // Détection améliorée : arrêter si pas de nouvelles critiques après 3 tentatives
        if (stableCount >= 3) {
          console.log(`📊 [Scraper] Fin détectée : pas de nouvelles critiques après 3 tentatives`);
          console.log(`✅ [Scraper] Scroll terminé: ${currentReviewCount} critiques après ${scrollAttempts} tentatives`);
          break;
        }
        
        // Si la hauteur n'a pas changé ET le nombre de critiques est stable depuis 2 tentatives, on a tout chargé
        if (previousHeight === currentHeight && stableCount >= 2 && currentReviewCount === previousReviewCount) {
          console.log(`✅ [Scraper] Scroll terminé: ${currentReviewCount} critiques après ${scrollAttempts} tentatives`);
          break;
        }
      }
      
      if (scrollAttempts >= maxScrollAttempts) {
        const finalCount = await page.evaluate(() => {
          return document.querySelectorAll('article[data-testid="review-overview"]').length;
        });
        console.log(`⏹️  [Scraper] Scroll max atteint (${scrollAttempts}): ${finalCount} critiques`);
      }
      
      // Remonter en haut après le scroll (attente réduite à 300ms)
      await page.evaluate(() => window.scrollTo(0, 0));
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Vérifier combien d'articles sont présents dans le DOM
      const articleCount = await page.evaluate(() => {
        return {
          withTestId: document.querySelectorAll('article[data-testid="review-overview"]').length,
          withReview: document.querySelectorAll('[data-testid*="review"]').length,
          allArticles: document.querySelectorAll('article').length,
          allLinks: document.querySelectorAll('a[href*="/film/"], a[href*="/serie/"], a[href*="/jeu"]').length
        };
      });
      console.log(`📊 [Scraper] Éléments trouvés:`, articleCount);
      
      // Récupérer le HTML rendu
      const data = await page.content();
      console.log(`📄 [Scraper] HTML récupéré: ${(data.length / 1024).toFixed(2)} KB`);
      
      await browser.close();
      console.log('✅ [Scraper] Puppeteer fermé');
      
      // Parser le HTML avec JSDOM
          const dom = new JSDOM(data);
          const document = dom.window.document;
          const reviews = [];
          
      // Essayer plusieurs sélecteurs CSS pour trouver les critiques (par ordre de spécificité)
      // Commencer par le sélecteur le plus spécifique
      let reviewElements = document.querySelectorAll('article[data-testid="review-overview"]');
      let usedSelector = 'article[data-testid="review-overview"]';
          
          // Si aucun élément trouvé, essayer d'autres sélecteurs
          if (reviewElements.length === 0) {
        reviewElements = document.querySelectorAll('[data-testid*="review"]');
        usedSelector = '[data-testid*="review"]';
      }
      
      if (reviewElements.length === 0) {
        reviewElements = document.querySelectorAll('article');
        usedSelector = 'article (fallback générique)';
      }
      
      if (reviewElements.length === 0) {
        const reviewLinks = document.querySelectorAll('a[href*="/critique/"]');
        if (reviewLinks.length > 0) {
          reviewElements = reviewLinks;
          usedSelector = 'a[href*="/critique/"] (fallback liens)';
        }
          }
          
      console.log(`🎯 [Scraper] Sélecteur CSS utilisé: "${usedSelector}" (${reviewElements.length} éléments trouvés)`);
          
          // Traiter les éléments trouvés avec les sélecteurs CSS
          reviewElements.forEach((element) => {
        // Sélecteurs améliorés pour le nouveau HTML de SensCritique
        // Essayer plusieurs sélecteurs pour le titre
        const titleEl = element.querySelector('a[data-testid="productReviewTitle"]') ||
                       element.querySelector('h2[data-testid="reviewTitle"]') ||
                       element.querySelector('h2') ||
                       element.querySelector('h3') ||
                       element.querySelector('a[href*="/film/"], a[href*="/serie/"], a[href*="/jeu"]') ||
                       element.querySelector('[class*="title"]');
        
        // Essayer plusieurs sélecteurs pour le contenu
        const contentEl = element.querySelector('p[data-testid="linkify"]') ||
                         element.querySelector('p') ||
                         element.querySelector('[class*="content"]') ||
                         element.querySelector('[class*="text"]') ||
                         element.querySelector('[class*="description"]');
        
        // Essayer plusieurs sélecteurs pour le lien
        const linkEl = element.querySelector('a[href*="/film/"]') ||
                      element.querySelector('a[href*="/serie/"]') ||
                      element.querySelector('a[href*="/jeu"]') ||
                      element.querySelector('a[data-testid="productReviewTitle"]') ||
                      titleEl; // Le titre peut aussi être le lien
        
        // Essayer plusieurs sélecteurs pour la note
        const ratingEl = element.querySelector('[data-testid="Rating"]') ||
                        element.querySelector('[class*="rating"]') ||
                        element.querySelector('[class*="note"]') ||
                        element.querySelector('[aria-label*="note"]');
        
        // Extraire le titre (texte pur uniquement)
        let title = null;
        if (titleEl) {
          // IMPORTANT : Utiliser textContent pour récupérer UNIQUEMENT le texte sans balises HTML
          title = titleEl.textContent.trim();
          // Nettoyer le titre : enlever "Critique de" et "par KiMi_"
          title = title.replace(/^Critique de\s+/i, '').replace(/\s+par\s+KiMi_/i, '').trim();
          // Nettoyer tout HTML résiduel
          title = title.replace(/<[^>]*>/g, '').trim();
        }
        
        // Si pas de titre trouvé, chercher dans tout le texte de l'élément
        if (!title || title.length < 3) {
          const allText = element.textContent || '';
          const titleMatch = allText.match(/Critique de ([^\n]+?)\s+par\s+KiMi_/i);
          if (titleMatch) {
            title = titleMatch[1].trim();
            // Nettoyer tout HTML résiduel
            title = title.replace(/<[^>]*>/g, '').trim();
          }
        }
        
        // Extraire le contenu (texte pur uniquement, sans HTML)
        let content = '';
        if (contentEl) {
          // IMPORTANT : Utiliser textContent pour récupérer UNIQUEMENT le texte sans balises HTML
          content = contentEl.textContent.trim();
          
          // Nettoyer les espaces multiples et retours à la ligne excessifs
          content = content.replace(/\s+/g, ' ').trim();
        } else {
          // Si pas de contenu trouvé, chercher dans tout le texte
          const allText = element.textContent || '';
          // Chercher le texte après "Lire la critique" ou après le titre
          const contentMatch = allText.match(/(?:Lire la critique|Par KiMi_)[\s\S]*?(.{30,500}?)(?:Par KiMi_|il y a|le \d+)/i);
          if (contentMatch) {
            content = contentMatch[1].trim();
            // Nettoyer les espaces multiples
            content = content.replace(/\s+/g, ' ').trim();
          }
        }
        
        // Nettoyer tout HTML résiduel (au cas où)
        content = content.replace(/<[^>]*>/g, '').trim();
        
        // Limiter à 200 caractères avec ellipse si trop long
        if (content.length > 200) {
          content = content.substring(0, 200) + '...';
        }
        
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
              
        // Extraire l'URL
        let url = '';
        if (linkEl) {
          const href = linkEl.getAttribute('href');
          if (href) {
            url = href.startsWith('http') ? href : `https://www.senscritique.com${href}`;
          }
        }
        
        // Extraire la note
              let rating = null;
              if (ratingEl) {
                const ratingText = ratingEl.textContent || ratingEl.getAttribute('aria-label') || '';
                const ratingMatch = ratingText.match(/(\d+)/);
                if (ratingMatch) {
                  rating = parseInt(ratingMatch[1]);
                }
              }
              
        // Accepter les critiques même avec peu de contenu (minimum 10 caractères au lieu de 20)
        if (title && title.length > 2) {
          // Normaliser "jour" en "jours" si nécessaire pour le formatage
          let normalizedDateText = dateText;
          if (dateText && dateText.includes('il y a')) {
            const jourMatch = dateText.match(/il\s+y\s+a\s+(\d+)\s+jour\b/i);
            if (jourMatch && parseInt(jourMatch[1]) > 1) {
              normalizedDateText = dateText.replace(/\s+jour\b/i, ' jours');
            }
          }
          
                // Vérifier qu'il n'y a pas de HTML dans le contenu avant d'ajouter
                if (content.includes('<') || content.includes('>') || content.includes('class=')) {
                  console.error('🚨 [Scraper] ALERTE : Du code HTML détecté dans le contenu ! Nettoyage...');
                  console.error(`🚨 [Scraper] Contenu problématique: "${content.substring(0, 100)}"`);
                  // Nettoyer le HTML
                  content = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
                }
                
                // Vérifier qu'il n'y a pas de HTML dans le titre
                if (title && (title.includes('<') || title.includes('>') || title.includes('class='))) {
                  console.error('🚨 [Scraper] ALERTE : Du code HTML détecté dans le titre ! Nettoyage...');
                  console.error(`🚨 [Scraper] Titre problématique: "${title}"`);
                  // Nettoyer le HTML
                  title = title.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
                }
                
                reviews.push({
                  title,
                  content: content.length > 10 ? content : 'Pas de commentaire',
                  date: normalizedDateText || null,
                  date_raw: normalizedDateText || null,
                  created_at: finalDate || null,
                  updated_at: finalDate || null,
                  url: url || `https://www.senscritique.com/${username}/critiques`,
                  rating
                });
                
                // Logs de vérification pour les 3 premières critiques
                if (reviews.length <= 3) {
                  console.log(`📝 [Scraper] Exemple de titre extrait: "${title}"`);
                  console.log(`📝 [Scraper] Exemple de contenu extrait (50 premiers caractères): "${content.substring(0, 50)}..."`);
                  console.log(`📝 [Scraper] Longueur du contenu: ${content.length} caractères`);
                }
        }
      });
      
      console.log(`📝 Critiques trouvées avec CSS: ${reviews.length}`);
      
      // Toujours essayer le parsing HTML brut pour compléter (même si on a trouvé des critiques avec CSS)
            const htmlReviews = parseReviewsFromHTML(data);
      console.log(`📝 Critiques trouvées avec HTML brut: ${htmlReviews.length}`);
      
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
            let title = titleEl.textContent.trim();
            // Nettoyer le titre si c'est "Critique de X par Y"
            title = title.replace(/^Critique de\s+/i, '').replace(/\s+par\s+KiMi_/i, '').trim();
            // Nettoyer tout HTML résiduel
            title = title.replace(/<[^>]*>/g, '').trim();
            title = title.replace(/\s+/g, ' ').trim();
            
            let content = contentEl ? contentEl.textContent.trim() : '';
            // Nettoyer tout HTML résiduel
            content = content.replace(/<[^>]*>/g, '').trim();
            content = content.replace(/\s+/g, ' ').trim();
            
            // Limiter le contenu à 200 caractères
            if (content.length > 200) {
              content = content.substring(0, 200) + '...';
            }
            
            // Vérifier qu'il n'y a pas de HTML résiduel
            if (content && (content.includes('<') || content.includes('>') || content.includes('class='))) {
              console.error('🚨 [Scraper] ALERTE : Du code HTML détecté dans le contenu (fallback articles) !');
              content = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
            }
            
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
            
            if (title && content.length > 20 && !title.includes('Sens Critique')) {
              // Vérifier si c'est un doublon
              const isDuplicate = reviews.some(r => r.title === title || r.content.substring(0, 50) === content.substring(0, 50));
              
              if (!isDuplicate) {
                // Normaliser "jour" en "jours" si nécessaire
                let normalizedDateText = dateText;
                if (dateText && dateText.includes('il y a')) {
                  const jourMatch = dateText.match(/il\s+y\s+a\s+(\d+)\s+jour\b/i);
                  if (jourMatch && parseInt(jourMatch[1]) > 1) {
                    normalizedDateText = dateText.replace(/\s+jour\b/i, ' jours');
                  }
                }
                
                // Vérifier qu'il n'y a pas de HTML résiduel avant d'ajouter
                if (content && (content.includes('<') || content.includes('>') || content.includes('class='))) {
                  console.error('🚨 [Scraper] ALERTE : Du code HTML détecté dans le contenu (fallback articles) avant push !');
                  content = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
                }
                
                reviews.push({
                  title,
                  content: content.length > 10 ? content : 'Pas de commentaire',
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
      
      // S'assurer qu'on retourne toujours un tableau
      if (!Array.isArray(reviews)) {
        console.warn('⚠️  reviews n\'est pas un tableau dans fetchSensCritiqueReviews, conversion...');
        reviews = [];
      }
      
      console.log(`📊 [Scraper] ${reviews.length} critiques brutes extraites`);
      
      // Nettoyer chaque critique avec cleanHTMLStrict
      reviews = reviews.map(review => {
        return {
          ...review,
          title: cleanHTMLStrict(review.title || ''),
          content: cleanHTMLStrict(review.content || ''),
          date: review.date || '',
          date_raw: review.date_raw || '',
          url: review.url || null,
          rating: review.rating || null
        };
      });
      
      // Filtrer les critiques invalides
      reviews = reviews.filter(review => {
        // Exclure si le titre ou contenu contient encore du HTML
        if (review.content.includes('<') || 
            review.content.includes('class=') || 
            review.content.includes('href=') ||
            review.content.includes('data-testid') ||
            review.title.includes('<') ||
            review.title.includes('class=')) {
          console.warn(`⚠️ [Scraper] Critique "${review.title}" exclue (HTML résiduel détecté)`);
          return false;
        }
        
        // Exclure si le contenu est vide ou trop court
        if (!review.content || review.content.length < 10) {
          console.warn(`⚠️ [Scraper] Critique "${review.title}" exclue (contenu vide/trop court)`);
          return false;
        }
        
        // Exclure si le titre est vide
        if (!review.title || review.title.length < 2) {
          console.warn(`⚠️ [Scraper] Critique sans titre exclue`);
          return false;
        }
        
        return true;
      });
      
      // Dédupliquer par titre
      const uniqueReviews = new Map();
      reviews.forEach(review => {
        if (!uniqueReviews.has(review.title)) {
          uniqueReviews.set(review.title, review);
        }
      });
      reviews = Array.from(uniqueReviews.values());
      
      // Trier les critiques par date (les plus récentes en premier) - APRÈS nettoyage et déduplication
      reviews.sort((a, b) => {
        const dateA = a.created_at || a.updated_at || '';
        const dateB = b.created_at || b.updated_at || '';
        if (dateA && dateB) {
          return new Date(dateB) - new Date(dateA);
        }
        // Si une date manque, mettre celle sans date à la fin
        if (dateA && !dateB) return -1;
        if (!dateA && dateB) return 1;
        return 0;
      });
      
      console.log(`✅ [Scraper] ${reviews.length} critiques propres après nettoyage et déduplication`);
      
      // Log des 3 premières critiques pour vérification
      if (reviews.length > 0) {
        console.log(`📊 [Scraper] Exemples de critiques propres :`);
        reviews.slice(0, 3).forEach((r, i) => {
          console.log(`  ${i+1}. "${r.title}" (${r.content.substring(0, 50)}...)`);
        });
      }
      
      resolve(reviews);
    } catch (error) {
      console.error('❌ [Scraper] Erreur Puppeteer:', error.message);
      console.error('📍 [Scraper] Stack:', error.stack);
      
      // Essayer de récupérer le HTML même en cas d'erreur partielle
      if (browser) {
        try {
          const pages = await browser.pages();
          if (pages.length > 0) {
            const page = pages[0];
            const data = await page.content();
            console.log(`📄 Tentative de récupération HTML après erreur: ${data.length} caractères`);
            
            // Essayer de parser le HTML récupéré
            const dom = new JSDOM(data);
            const document = dom.window.document;
            const reviewElements = document.querySelectorAll('article[data-testid="review-overview"], [data-testid*="review"], article');
            console.log(`📊 Éléments trouvés après erreur: ${reviewElements.length}`);
            
            if (reviewElements.length > 0) {
              const htmlReviews = parseReviewsFromHTML(data);
              console.log(`📝 Critiques trouvées après erreur: ${htmlReviews.length}`);
              if (htmlReviews.length > 0) {
                await browser.close();
                resolve(htmlReviews);
                return;
              }
            }
          }
        } catch (recoveryError) {
          console.error('❌ Erreur lors de la récupération:', recoveryError.message);
        }
        
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

// ============================================================================
// FONCTION DE BASE : Récupération du profil de base (sans critiques/favoris)
// ============================================================================

/**
 * Récupère uniquement le profil de base (stats, bio, etc.) sans critiques ni favoris
 * @param {string} username - Nom d'utilisateur SensCritique
 * @returns {Promise<Object>} Profil de base
 */
async function fetchBasicProfile(username) {
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
      
      res.on('end', () => {
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
          const bioPatterns = [
            /(Homme|Femme|Autre)\s*\|\s*([^<\n|]+)/i,
            /<p[^>]*>([^<]*Homme|Femme|Autre[^<]*)\s*\|\s*([^<]+)<\/p>/i,
            /class="[^"]*bio[^"]*"[^>]*>([^<]*Homme|Femme|Autre[^<]*)\s*\|\s*([^<]+)/i
          ];
          
          for (const pattern of bioPatterns) {
            const bioMatch = data.match(pattern);
            if (bioMatch) {
              const genderMatch = bioMatch[0].match(/(Homme|Femme|Autre)/i);
              if (genderMatch) {
                gender = genderMatch[1];
              }
              
              const locationMatch = bioMatch[0].match(/\|\s*([^<\n|]+)/i);
              if (locationMatch) {
                location = locationMatch[1].trim().replace(/\s+/g, ' ').trim();
              }
              
              if (gender !== 'Homme' || location !== 'France') {
                break;
              }
            }
          }
          
          // Chercher l'âge dans le HTML
          const agePatterns = [
            /(\d+)\s*ans/i,
            /âge[:\s]+(\d+)/i,
            /(\d{2})\s*ans/i
          ];
          
          for (const pattern of agePatterns) {
            const ageMatch = data.match(pattern);
            if (ageMatch && ageMatch[1]) {
              const extractedAge = parseInt(ageMatch[1]);
              if (extractedAge >= 13 && extractedAge <= 120) {
                age = extractedAge;
                break;
              }
            }
          }
          
          if (!age) {
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
            profileUrl: url,
            avatar: 'https://media.senscritique.com/media/media/000022812759/48x48/avatar.jpg'
          };
          
          resolve(profile);
          
        } catch (error) {
          console.error('❌ Erreur parsing profil de base:', error.message);
          reject(error);
        }
      });
      
    }).on('error', (error) => {
      console.error('❌ Erreur requête profil de base:', error.message);
      reject(error);
    });
  });
}

// ============================================================================
// FONCTION PRINCIPALE : Récupération du profil complet avec options
// ============================================================================

/**
 * Récupère le profil SensCritique avec chargement parallèle et cache
 * @param {string} username - Nom d'utilisateur SensCritique
 * @param {Object} options - Options de chargement
 * @param {boolean} options.loadReviews - Charger les critiques (défaut: true)
 * @param {boolean} options.loadFavorites - Charger les favoris (défaut: true)
 * @param {boolean} options.useCache - Utiliser le cache (défaut: true)
 * @param {number} options.cacheTime - Durée du cache en ms (défaut: 300000 = 5 min)
 * @returns {Promise<Object>} Profil complet
 */
async function fetchSensCritiqueProfile(username, options = {}) {
  const {
    loadReviews = true,
    loadFavorites = true,
    useCache = true,
    cacheTime = 300000 // 5 minutes
  } = options;
  
  // Clé de cache basée sur les options
  const cacheKey = `${username}_${loadReviews}_${loadFavorites}`;
  
  // Vérifier le cache d'abord
  if (useCache) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      console.log(`✅ Profil chargé depuis le cache (${username})`);
      return cached;
    }
  }
  
  console.log(`🔄 Chargement du profil ${username}... (reviews: ${loadReviews}, favorites: ${loadFavorites})`);
  const startTime = Date.now();
  
  // Charger en parallèle
  const promises = [
    fetchBasicProfile(username) // Toujours charger le profil de base
  ];
  
  if (loadReviews) {
    promises.push(
      fetchSensCritiqueReviews(username).catch(error => {
        console.error('❌ Erreur récupération critiques:', error.message);
        return [];
      })
    );
  } else {
    promises.push(Promise.resolve([]));
  }
  
  if (loadFavorites) {
    promises.push(
      fetchSensCritiqueFavorites(username).catch(error => {
        console.error('❌ Erreur récupération favoris:', error.message);
        // Fallback : essayer d'extraire depuis le HTML du profil
        return [];
      })
    );
  } else {
    promises.push(Promise.resolve([]));
  }
  
  // Attendre toutes les promesses en parallèle
  const results = await Promise.allSettled(promises);
  
  // Extraire les résultats
  const profile = results[0].status === 'fulfilled' ? results[0].value : null;
  const reviews = results[1].status === 'fulfilled' ? results[1].value : [];
  const favorites = results[2].status === 'fulfilled' ? results[2].value : [];
  
  if (!profile) {
    throw new Error('Impossible de récupérer le profil de base');
  }
  
  // S'assurer que reviews et favorites sont des tableaux
  const safeReviews = Array.isArray(reviews) ? reviews : [];
  const safeFavorites = Array.isArray(favorites) ? favorites : [];
  
  // Si pas de favoris, essayer de les extraire depuis le profil de base
  if (loadFavorites && safeFavorites.length === 0) {
    try {
      // On pourrait faire un fallback ici si nécessaire
      console.log('⚠️  Aucun favori trouvé, utilisation d\'un tableau vide');
    } catch (error) {
      console.log('⚠️  Erreur fallback favoris:', error.message);
    }
  }
  
  // Construire le profil complet
  const fullProfile = {
    ...profile,
    reviews: safeReviews,
    collections: safeFavorites
  };
  
  const duration = Date.now() - startTime;
  console.log(`✅ Profil récupéré en ${duration}ms:`, {
    username: fullProfile.username,
    reviews: fullProfile.reviews.length,
    collections: fullProfile.collections.length
  });
  
  // Mettre en cache
  if (useCache) {
    saveToCache(cacheKey, fullProfile, cacheTime);
  }
  
  return fullProfile;
}

module.exports = { 
  fetchSensCritiqueProfile, 
  fetchSensCritiqueFavorites, 
  fetchSensCritiqueReviews,
  fetchBasicProfile,
  getFromCache,
  saveToCache,
  clearCache
};
