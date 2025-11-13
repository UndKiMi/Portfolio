import { useState, useEffect, useRef } from 'react';

// Utiliser le proxy Vite en développement, ou l'URL directe en production
const BACKEND_URL = import.meta.env.DEV 
  ? '/api' 
  : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000');
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export function useGitHub() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastFetchRef = useRef(0);

  const fetchGitHubData = async () => {
    const now = Date.now();
    
    // Vérifier le cache localStorage
    const cached = localStorage.getItem('portfolio_github_data');
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
      const response = await fetch(`${BACKEND_URL}/github`);
      
      if (!response.ok) {
        throw new Error(`Backend GitHub non disponible: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.message || result.error);
      }

      // Sauvegarder dans localStorage
      localStorage.setItem('portfolio_github_data', JSON.stringify({
        timestamp: now,
        value: result
      }));

      setData(result);
      setError(null);
      lastFetchRef.current = now;
    } catch (err) {
      console.error('❌ Erreur GitHub:', err);
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
    fetchGitHubData();
  }, []);

  return { data, loading, error, refetch: fetchGitHubData };
}

