import { useState, useEffect, useRef } from 'react';

// Utiliser le proxy Vite en développement, ou l'URL directe en production
const BACKEND_URL = import.meta.env.DEV 
  ? '/api' 
  : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000');
const POLL_INTERVAL = 10000; // 10 secondes
const CACHE_DURATION = 200; // 200ms pour éviter les appels trop fréquents

const STATUS_LABELS = {
  online: 'En ligne',
  idle: 'Absent',
  dnd: 'Ne pas déranger',
  offline: 'Hors ligne'
};

export function useDiscord() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastFetchRef = useRef(0);
  const fetchInProgressRef = useRef(false);

  const fetchDiscordStatus = async () => {
    const now = Date.now();
    
    // Vérifier le cache
    if (now - lastFetchRef.current < CACHE_DURATION) {
      return;
    }

    if (fetchInProgressRef.current) {
      return;
    }

    fetchInProgressRef.current = true;

    try {
      const response = await fetch(`${BACKEND_URL}/discord-status`, { 
        cache: 'no-store' 
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.botReady || !result.user) {
        setData({
          user: null,
          status: 'offline',
          activities: [],
          voiceState: null,
          message: result.message || 'Bot en cours de connexion...'
        });
        setLoading(false);
        return;
      }

      setData({
        ...result,
        statusLabel: STATUS_LABELS[result.status] || 'Inconnu'
      });
      setError(null);
      lastFetchRef.current = now;
    } catch (err) {
      console.error('❌ Erreur Discord:', err);
      setError(err.message);
      if (!data) {
        setData({
          user: null,
          status: 'offline',
          activities: [],
          voiceState: null,
          message: 'Serveur hors ligne'
        });
      }
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false;
    }
  };

  useEffect(() => {
    fetchDiscordStatus();
    const interval = setInterval(fetchDiscordStatus, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error, refetch: fetchDiscordStatus };
}

