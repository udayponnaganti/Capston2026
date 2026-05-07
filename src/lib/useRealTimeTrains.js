/**
 * useRealTimeTrains.js
 * React hook for real-time train data with 3-tier priority fallback:
 *
 *  Priority 1 — MTA Live (real NYC subway coords, delays, routes via /api/mta-feed)
 *  Priority 2 — Base44 backend (existing API fallback)
 *  Priority 3 — Local simulation (offline fallback)
 */

import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { simulateTrainStates } from './trainSimulation';
import { useMtaTrains } from './useMtaTrains';

const TICK_MS = 3000; // push & pull every 3 seconds

// module-level cache so multiple component instances share the same ID map
const idCache = {}; // train_number → backend record id
let seeded = false;

export function useRealTimeTrains() {
  const [trains, setTrains]         = useState(() => simulateTrainStates(0));
  const [syncStatus, setSyncStatus] = useState('connecting'); // 'mta-live' | 'live' | 'offline' | 'connecting'
  const tickRef = useRef(0);

  // ── MTA hook (priority-1 source) ────────────────────────────────────────────
  const { mtaTrains, mtaStatus } = useMtaTrains();

  // ── Fast-path: update status immediately when MTA connects ─────────────────
  // Don't wait for the next Base44 tick — update badge instantly.
  useEffect(() => {
    if (mtaStatus === 'live') {
      setSyncStatus('mta-live');
    }
  }, [mtaStatus]);

  // ── Fallback timeout: if nothing connects in 6s, show 'offline' ────────────
  useEffect(() => {
    const t = setTimeout(() => {
      setSyncStatus(prev =>
        prev === 'connecting' ? 'offline' : prev
      );
    }, 6000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let alive = true;

    // ── helpers ──────────────────────────────────────────────────────────────
    const buildPayload = (t) => ({
      train_number:      t.train_number,
      name:              t.name,
      status:            t.status,
      current_station:   t.current_station,
      next_station:      t.next_station,
      origin:            t.origin || 'Unknown',
      destination:       t.destination || 'Unknown',
      latitude:          parseFloat(Number(t.latitude).toFixed(6)),
      longitude:         parseFloat(Number(t.longitude).toFixed(6)),
      speed_kmh:         t.speed_kmh,
      delay_minutes:     t.delay_minutes,
      scheduled_arrival: t.scheduled_arrival || new Date().toISOString(),
      estimated_arrival: t.estimated_arrival || new Date().toISOString(),
      platform:          t.platform,
      route:             t.route,
      passenger_count:   t.passenger_count,
      capacity:          t.capacity,
      type:              t.type,
    });

    /** Seed backend: create all train records if not yet done */
    const seed = async (sourceTrains) => {
      if (seeded) return;
      seeded = true;
      try {
        const existing = await base44.entities.Train.list(null, 50);
        if (existing?.length > 0) {
          existing.forEach(r => { idCache[r.train_number] = r.id; });
        }
        await Promise.allSettled(
          sourceTrains.map(async (t) => {
            if (!idCache[t.train_number]) {
              try {
                const created = await base44.entities.Train.create(buildPayload(t));
                if (created?.id) idCache[t.train_number] = created.id;
              } catch { /* ignore */ }
            }
          })
        );
      } catch { seeded = false; }
    };

    /** Push updated states to backend */
    const push = async (sourceTrains) => {
      await Promise.allSettled(
        sourceTrains.map(async (t) => {
          try {
            if (idCache[t.train_number]) {
              await base44.entities.Train.update(idCache[t.train_number], buildPayload(t));
            } else {
              const created = await base44.entities.Train.create(buildPayload(t));
              if (created?.id) idCache[t.train_number] = created.id;
            }
          } catch { /* ignore */ }
        })
      );
    };

    /** Fetch from backend */
    const pull = async () => {
      const records = await base44.entities.Train.list(null, 50);
      if (records?.length > 0) return records;
      return null;
    };

    /** Main tick */
    const tick = async () => {
      if (!alive) return;
      tickRef.current += 1;

      // ── Priority 1: MTA live data ──────────────────────────────────────────
      // If MTA is live, use the real trains completely.
      if (mtaStatus === 'live' && mtaTrains?.length > 0) {
        if (alive) {
          setTrains(mtaTrains);
          setSyncStatus('mta-live');
        }
        // Still push to backend for persistence (best-effort)
        if (!seeded) seed(mtaTrains).catch(() => {});
        push(mtaTrains).catch(() => {});
        return;
      }

      // ── Priority 2 & 3: Base44 / Simulation Fallback ───────────────────────
      const simulated = simulateTrainStates(tickRef.current);
      if (alive) setTrains(simulated);

      try {
        if (!seeded) await seed(simulated);
        await push(simulated);
        const apiTrains = await pull();
        if (alive && apiTrains?.length > 0) {
          const merged = apiTrains.map(apiTrain => {
            const sim = simulated.find(s => s.train_number === apiTrain.train_number);
            return {
              ...sim,
              ...apiTrain,
              latitude:  sim ? sim.latitude  : apiTrain.latitude,
              longitude: sim ? sim.longitude : apiTrain.longitude,
            };
          });
          if (alive) setTrains(merged);
          if (alive) setSyncStatus('live');
        }
      } catch {
        if (alive) setSyncStatus('offline');
      }
    };

    tick();
    const interval = setInterval(tick, TICK_MS);
    return () => { alive = false; clearInterval(interval); };
  }, [mtaTrains, mtaStatus]); 

  return { trains, syncStatus };
}
