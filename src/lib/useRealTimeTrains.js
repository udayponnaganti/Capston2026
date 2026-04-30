/**
 * useRealTimeTrains.js
 * React hook for real-time train data.
 *
 * Flow:
 *  1. On mount: seed backend with initial simulation state (create all 12 trains)
 *  2. Every 3s: update backend with new simulation tick (positions, speed, occupancy, etc.)
 *  3. Every 3s: fetch fresh data from backend → return to components
 *  4. If backend unavailable: fall back to local simulation silently
 */

import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { simulateTrainStates } from './trainSimulation';

const TICK_MS = 3000; // push & pull every 3 seconds

// module-level cache so multiple component instances share the same ID map
const idCache = {}; // train_number → backend record id
let seeded = false; // has initial seed been done?

export function useRealTimeTrains() {
  const [trains, setTrains]       = useState(() => simulateTrainStates(0));
  const [syncStatus, setSyncStatus] = useState('connecting'); // 'live' | 'offline' | 'connecting'
  const tickRef = useRef(0);

  useEffect(() => {
    let alive = true;

    // ── helpers ──────────────────────────────────────────────────────────────
    const buildPayload = (t) => ({
      train_number:      t.train_number,
      name:              t.name,
      status:            t.status,
      current_station:   t.current_station,
      next_station:      t.next_station,
      origin:            t.origin,
      destination:       t.destination,
      latitude:          parseFloat(t.latitude.toFixed(6)),
      longitude:         parseFloat(t.longitude.toFixed(6)),
      speed_kmh:         t.speed_kmh,
      delay_minutes:     t.delay_minutes,
      scheduled_arrival: t.scheduled_arrival,
      estimated_arrival: t.estimated_arrival,
      platform:          t.platform,
      route:             t.route,
      passenger_count:   t.passenger_count,
      capacity:          t.capacity,
      type:              t.type,
    });

    /** Seed backend: create all 12 train records if not yet done */
    const seed = async (trains) => {
      if (seeded) return;
      seeded = true;
      try {
        // Fetch any existing records to populate idCache
        const existing = await base44.entities.Train.list(null, 30);
        if (existing?.length > 0) {
          existing.forEach(r => { idCache[r.train_number] = r.id; });
        }

        // Create records for trains not yet in backend
        await Promise.allSettled(
          trains.map(async (t) => {
            if (!idCache[t.train_number]) {
              try {
                const created = await base44.entities.Train.create(buildPayload(t));
                if (created?.id) idCache[t.train_number] = created.id;
              } catch { /* ignore */ }
            }
          })
        );
      } catch { seeded = false; /* retry next cycle */ }
    };

    /** Push updated states to backend */
    const push = async (trains) => {
      await Promise.allSettled(
        trains.map(async (t) => {
          const payload = buildPayload(t);
          try {
            if (idCache[t.train_number]) {
              await base44.entities.Train.update(idCache[t.train_number], payload);
            } else {
              const created = await base44.entities.Train.create(payload);
              if (created?.id) idCache[t.train_number] = created.id;
            }
          } catch { /* ignore individual failures */ }
        })
      );
    };

    /** Fetch current state from backend → use as source of truth */
    const pull = async () => {
      const records = await base44.entities.Train.list(null, 30);
      if (records?.length > 0) return records;
      return null;
    };

    /** Main tick: simulate → push → pull → update UI */
    const tick = async () => {
      if (!alive) return;
      tickRef.current += 1;
      const simulated = simulateTrainStates(tickRef.current);

      // Always show local sim immediately for smooth UI
      if (alive) setTrains(simulated);

      try {
        // Seed on first tick
        if (!seeded) await seed(simulated);

        // Push new state to backend
        await push(simulated);

        // Pull back from backend (API is now source of truth)
        const apiTrains = await pull();
        if (alive && apiTrains?.length > 0) {
          // Merge API data with sim data:
          // API has persisted IDs + any manual edits;
          // sim has smooth interpolated positions
          const merged = apiTrains.map(apiTrain => {
            const sim = simulated.find(s => s.train_number === apiTrain.train_number);
            return {
              ...sim,         // smooth positions from simulation
              ...apiTrain,    // override with backend values
              // Keep smooth lat/lng from simulation for map animation
              latitude:  sim ? sim.latitude  : apiTrain.latitude,
              longitude: sim ? sim.longitude : apiTrain.longitude,
            };
          });
          if (alive) setTrains(merged);
          if (alive) setSyncStatus('live');
        }
      } catch (e) {
        // Backend unreachable — keep using local sim
        if (alive) setSyncStatus('offline');
      }
    };

    // Run immediately on mount then every TICK_MS
    tick();
    const interval = setInterval(tick, TICK_MS);
    return () => { alive = false; clearInterval(interval); };
  }, []);

  return { trains, syncStatus };
}
