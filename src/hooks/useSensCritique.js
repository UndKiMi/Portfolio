import { useState, useEffect, useRef } from 'react';

// Utiliser le proxy Vite en développement, ou l'URL directe en production
const BACKEND_URL = import.meta.env.DEV 
  ? '/api' 
  : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000');
const CACHE_DURATION = 60 * 60 * 1000; // 1 heure

export function useSensCritique() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastFetchRef = useRef(0);

  const fetchSensCritiqueData = async () => {
    const now = Date.now();
    
    // Vérifier le cache localStorage
    const cached = localStorage.getItem('portfolio_senscritique_data');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.timestamp && (now - parsed.timestamp) < CACHE_DURATION) {
          setData(parsed.value);
          setLoading(false);
          return;
        }
      } catch (e) {
        // Cache invalide, continuer
      }
    }

    // Vérifier le cache mémoire
    if (now - lastFetchRef.current < CACHE_DURATION && data) {
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/senscritique`);
      
      if (!response.ok) {
        throw new Error(`Backend non disponible: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result) {
        throw new Error('Données vides reçues du backend');
      }

      // Sauvegarder dans localStorage
      localStorage.setItem('portfolio_senscritique_data', JSON.stringify({
        timestamp: now,
        value: result
      }));

      setData(result);
      setError(null);
      lastFetchRef.current = now;
    } catch (err) {
      console.error('❌ Erreur SensCritique:', err);
      setError(err.message);
      
      // Essayer d'utiliser le cache même s'il est expiré
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setData(parsed.value);
        } catch (e) {
          // Ignorer
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSensCritiqueData();
  }, []);

  return { data, loading, error, refetch: fetchSensCritiqueData };
}

