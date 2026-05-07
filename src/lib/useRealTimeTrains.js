/**
 * useRealTimeTrains.js
 * React hook for real-time train data with 3-tier priority fallback:
 *
 *  Priority 1 — MTA Live (real NYC subway delay/status via /api/mta-feed)
 *  Priority 2 — Base44 backend (existing API)
 *  Priority 3 — Local simulation (offline fallback)
 *
 * The simulation always drives lat/lng for smooth map animation.
 * MTA overrides delay_minutes, status, and type on matching trains.
 */

import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { simulateTrainStates } from './trainSimulation';
import { useMtaTrains } from './useMtaTrains';

const TICK_MS = 3000; // push & pull every 3 seconds

// module-level cache so multiple component instances share the same ID map
const idCache = {}; // train_number → backend record id
let seeded = false;

/**
 * Merge MTA live data onto a simulated train array.
 * Simulation drives positions; MTA drives delay/status/type.
 */
function applyMtaOverrides(simTrains, mtaTrains) {
  if (!mtaTrains || mtaTrains.length === 0) return simTrains;
  return simTrains.map((sim, idx) => {
    const mta = mtaTrains[idx % mtaTrains.length];
    if (!mta) return sim;
    return {
      ...sim,
      delay_minutes: mta.delay_minutes ?? sim.delay_minutes,
      status:        mta.delay_minutes > 0 ? 'delayed' : sim.status,
      mta_route_id:  mta.mta_route_id,
      mta_trip_id:   mta.mta_trip_id,
      // Only override type if MTA has a valid one
      type: mta.type ?? sim.type,
    };
  });
}

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

    /** Seed backend: create all train records if not yet done */
    const seed = async (simTrains) => {
      if (seeded) return;
      seeded = true;
      try {
        const existing = await base44.entities.Train.list(null, 30);
        if (existing?.length > 0) {
          existing.forEach(r => { idCache[r.train_number] = r.id; });
        }
        await Promise.allSettled(
          simTrains.map(async (t) => {
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
    const push = async (simTrains) => {
      await Promise.allSettled(
        simTrains.map(async (t) => {
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
      const records = await base44.entities.Train.list(null, 30);
      if (records?.length > 0) return records;
      return null;
    };

    /** Main tick */
    const tick = async () => {
      if (!alive) return;
      tickRef.current += 1;
      const simulated = simulateTrainStates(tickRef.current);

      // ── Priority 1: MTA live data ──────────────────────────────────────────
      if (mtaStatus === 'live' && mtaTrains?.length > 0) {
        const merged = applyMtaOverrides(simulated, mtaTrains);
        if (alive) {
          setTrains(merged);
          setSyncStatus('mta-live');
        }
        // Still push to backend for persistence (best-effort, non-blocking)
        if (!seeded) seed(merged).catch(() => {});
        push(merged).catch(() => {});
        return;
      }

      // ── Priority 2: Base44 backend ─────────────────────────────────────────
      // Show sim immediately for smooth UI
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
        // ── Priority 3: Local simulation only ──────────────────────────────
        if (alive) setSyncStatus('offline');
      }
    };

    tick();
    const interval = setInterval(tick, TICK_MS);
    return () => { alive = false; clearInterval(interval); };
  }, [mtaTrains, mtaStatus]); // re-run whenever MTA data changes

  return { trains, syncStatus };
}
