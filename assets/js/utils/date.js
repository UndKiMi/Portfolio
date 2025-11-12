export function getTimeAgo(date) {
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
  if (days < 7) return `il y a ${days} jour${days > 1 ? 's' : ''}`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`;

  const months = Math.floor(days / 30);
  // Pour les dates de plus de quelques semaines, utiliser le format absolu "le X mois YYYY"
  const monthNames = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 
                      'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const day = parsedDate.getDate();
  const month = monthNames[parsedDate.getMonth()];
  const year = parsedDate.getFullYear();
  return `le ${day} ${month} ${year}`;
}

export function formatReviewDate(dateString) {
  if (!dateString) {
    return '';
  }
  
  // Si c'est déjà un format Sens Critique valide (texte brut), l'utiliser directement
  if (typeof dateString === 'string') {
    const trimmed = dateString.trim();
    // Vérifier si c'est un format "il y a X jours/semaines/mois/ans"
    if (/^il y a\s+\d+\s+(jour|jours|semaine|semaines|mois|an|ans)$/i.test(trimmed)) {
      return trimmed;
    }
    // Vérifier si c'est un format "le X mois YYYY" (avec ou sans point après le mois)
    if (/^le\s+\d{1,2}\s+\w+\.?\s+\d{4}$/i.test(trimmed)) {
      return trimmed;
    }
    // Vérifier si c'est "Aujourd'hui" ou "Hier"
    if (/^(aujourd'hui|hier|auj\.)$/i.test(trimmed)) {
      return trimmed;
    }
  }
  
  // Sinon, parser et formater avec getTimeAgo
  const parsedDate = parseDateFromText(dateString);
  
  if (parsedDate) {
    // Si on a réussi à parser, utiliser getTimeAgo avec la date ISO
    const result = getTimeAgo(parsedDate);
    if (result) {
      return result;
    }
  }
  
  // Si le parsing a échoué ou getTimeAgo n'a pas fonctionné, essayer getTimeAgo directement
  const directResult = getTimeAgo(dateString);
  if (directResult) {
    return directResult;
  }
  
  // En dernier recours, retourner le texte original
  return dateString;
}

// Fonction unifiée pour parser n'importe quel format de date
export function parseDateFromText(dateText) {
  if (!dateText || typeof dateText !== 'string') return null;
  
  const text = dateText.trim().toLowerCase();
  
  // Si c'est déjà une date ISO, la retourner telle quelle
  if (/^\d{4}-\d{2}-\d{2}/.test(dateText)) {
    return dateText;
  }
  
  // Parser les dates relatives "il y a X jours"
  const relativeResult = parseRelativeDateText(dateText);
  if (relativeResult) return relativeResult;
  
  // Parser les dates françaises "le X nov. 2025"
  const frenchResult = parseFrenchDateText(dateText);
  if (frenchResult) return frenchResult;
  
  return null;
}

// Fonction pour parser les dates relatives en dates absolues
export function parseRelativeDateText(dateText) {
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
  
  // "Il y a X ans"
  const ansMatch = lowerText.match(/il y a (\d+)\s*an/i);
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
  
  return null;
}

// Fonction pour parser les dates au format français "le 4 nov. 2025"
export function parseFrenchDateText(dateText) {
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

