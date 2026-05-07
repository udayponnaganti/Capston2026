/**
 * useMtaTrains.js
 * React hook that polls the /api/mta-feed Vercel serverless function
 * every 20 seconds and returns live MTA delay/status data.
 *
 * Returns: { mtaTrains, mtaStatus }
 *   mtaTrains — array of partial train objects (delay, status, type, mta_route_id)
 *               or null when unavailable
 *   mtaStatus — 'loading' | 'live' | 'error'
 */

import { useState, useEffect, useRef } from 'react';

const POLL_MS = 20_000; // MTA updates every ~30s; poll every 20s

// In dev, Vite serves on a different port from the Vercel function.
// We try the same origin first (works in production), then the Vercel CLI proxy.
const MTA_API_URL = '/api/mta-feed';

export function useMtaTrains() {
  const [mtaTrains, setMtaTrains] = useState(null);
  const [mtaStatus, setMtaStatus] = useState('loading');
  const timerRef = useRef(null);

  const fetchMta = async () => {
    try {
      const res = await fetch(MTA_API_URL, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        setMtaStatus('error');
        return;
      }
      const json = await res.json();
      if (json.trains && json.trains.length > 0) {
        setMtaTrains(json.trains);
        setMtaStatus('live');
      } else {
        setMtaStatus('error');
      }
    } catch {
      // Network failure or serverless function unavailable
      setMtaStatus('error');
    }
  };

  useEffect(() => {
    let alive = true;

    const poll = async () => {
      if (!alive) return;
      await fetchMta();
      if (alive) {
        timerRef.current = setTimeout(poll, POLL_MS);
      }
    };

    poll();

    return () => {
      alive = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { mtaTrains, mtaStatus };
}
