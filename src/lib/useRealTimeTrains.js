/**
 * useRealTimeTrains.js
 * Frontend subscription hook.
 * Pulls the latest normalized snapshot from Base44 and enriches each train
 * with movement vectors computed from successive polls.
 */

import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { simulateTrainStates } from './trainSimulation';

const POLL_INTERVAL_MS = 5000; // Pull from DB every 5s

export function useRealTimeTrains() {
  const [trains, setTrains]       = useState([]);
  const [syncStatus, setSyncStatus] = useState('connecting');
  const prevSnapshot  = useRef({});   // train_number → { lat, lng, ts }
  const pollCount     = useRef(0);

  useEffect(() => {
    let alive = true;

    const pull = async () => {
      try {
        const records = await base44.entities.Train.list(null, 750);
        if (!alive) return;

        if (records?.length > 0) {
          const nowMs = Date.now();
          pollCount.current += 1;

          const enriched = records.map(t => {
            const prev = prevSnapshot.current[t.train_number];

            // Unpack next stop coords packed into route[2], route[3] by the backend worker
            // route = [currentStation, nextStation, nextLat, nextLng]
            const routeArr     = Array.isArray(t.route) ? t.route : [];
            const parsedLat    = parseFloat(routeArr[2]);
            const parsedLng    = parseFloat(routeArr[3]);
            let next_latitude  = isNaN(parsedLat) ? null : parsedLat;
            let next_longitude = isNaN(parsedLng) ? null : parsedLng;

            // If backend didn't provide next stop coords, try to extrapolate from consecutive polls
            if (!next_latitude && prev && t.latitude != null && t.longitude != null) {
              const dLat = t.latitude  - prev.lat;
              const dLng = t.longitude - prev.lng;
              const moved = Math.abs(dLat) > 0.00003 || Math.abs(dLng) > 0.00003;
              if (moved) {
                next_latitude  = t.latitude  + dLat * 3;
                next_longitude = t.longitude + dLng * 3;
              }
            }

            // Compute speed from coordinate delta
            let computed_speed = t.speed_kmh || 0;
            if (prev && t.latitude != null) {
              const dLat = t.latitude  - prev.lat;
              const dLng = t.longitude - prev.lng;
              const moved = Math.abs(dLat) > 0.00003 || Math.abs(dLng) > 0.00003;
              if (moved) {
                const elapsedHrs = (nowMs - prev.ts) / 3_600_000;
                if (elapsedHrs > 0) {
                  const R = 6371;
                  const lat1 = prev.lat * Math.PI / 180;
                  const lat2 = t.latitude * Math.PI / 180;
                  const dLatR = dLat * Math.PI / 180;
                  const dLngR = dLng * Math.PI / 180;
                  const a = Math.sin(dLatR/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLngR/2)**2;
                  const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                  computed_speed = Math.min(100, Math.round(distKm / elapsedHrs));
                }
              }
            }

            // Store snapshot for next poll
            prevSnapshot.current[t.train_number] = {
              lat: t.latitude,
              lng: t.longitude,
              ts:  nowMs,
            };

            return {
              ...t,
              next_latitude,
              next_longitude,
              speed_kmh:       computed_speed || t.speed_kmh || 0,
              feed_timestamp:  t.feed_timestamp || (nowMs / 1000),
              age_seconds:     t.age_seconds    || 0,
              arrival_at_next: null,  // unknown from Base44 - use fixed window
              is_dwelling:     (computed_speed === 0),
            };
          });

          // Clean up stale prev entries
          const currentIds = new Set(records.map(r => r.train_number));
          for (const id of Object.keys(prevSnapshot.current)) {
            if (!currentIds.has(id)) delete prevSnapshot.current[id];
          }

          setTrains(enriched);
          setSyncStatus('live');
        } else if (records?.length === 0) {
          setTrains(simulateTrainStates(0));
          setSyncStatus('offline');
        }
      } catch (err) {
        if (alive) {
          console.warn('[useRealTimeTrains] fetch error:', err.message);
          // Keep last trains on transient error, don't drop to sim immediately
          if (pollCount.current === 0) {
            setTrains(simulateTrainStates(0));
            setSyncStatus('offline');
          }
        }
      }
    };

    pull();
    const interval = setInterval(pull, POLL_INTERVAL_MS);
    return () => { alive = false; clearInterval(interval); };
  }, []);

  return { trains, syncStatus };
}
