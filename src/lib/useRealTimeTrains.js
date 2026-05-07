/**
 * useRealTimeTrains.js
 * Frontend subscription hook.
 * Pulls the latest normalized snapshot from Base44.
 */

import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { simulateTrainStates } from './trainSimulation';

const POLL_INTERVAL_MS = 3000; // Pull from DB every 3s to stay fresh with backend

export function useRealTimeTrains() {
  const [trains, setTrains] = useState([]);
  const [syncStatus, setSyncStatus] = useState('connecting'); // 'live' | 'offline' | 'connecting'

  useEffect(() => {
    let alive = true;

    const pull = async () => {
      try {
        const records = await base44.entities.Train.list(null, 500); // Fetch up to 500 active trains
        if (alive && records?.length > 0) {
          setTrains(records);
          setSyncStatus('live');
        } else if (alive && records?.length === 0) {
          // If empty, backend might be starting up, fallback to sim for demo
          setTrains(simulateTrainStates(0));
          setSyncStatus('offline');
        }
      } catch (err) {
        if (alive) {
          setTrains(simulateTrainStates(0));
          setSyncStatus('offline');
        }
      }
    };

    pull();
    const interval = setInterval(pull, POLL_INTERVAL_MS);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  return { trains, syncStatus };
}
