/**
 * trainSync.js
 * Syncs local simulation state → base44 Train entity (real backend).
 * Called every 5s from the main simulation tick.
 * Also provides fetchRealTimeTrains() to read current state from API.
 */

import { base44 } from '@/api/base44Client';
import { simulateTrainStates } from './trainSimulation';

let isSyncing = false;
let cachedIds = {}; // train_number → backend record id

/**
 * Push current simulated train states to the backend.
 * First sync creates records; subsequent syncs update them.
 */
export async function syncTrainsToBackend(tick) {
  if (isSyncing) return;
  isSyncing = true;
  try {
    const trains = simulateTrainStates(tick);

    // On first sync, fetch existing records to get their IDs
    if (Object.keys(cachedIds).length === 0) {
      try {
        const existing = await base44.entities.Train.list(null, 20);
        if (existing?.length > 0) {
          existing.forEach(t => { cachedIds[t.train_number] = t.id; });
        }
      } catch (e) { /* ignore */ }
    }

    // Upsert each train
    await Promise.allSettled(trains.map(async (train) => {
      const payload = {
        train_number:      train.train_number,
        name:              train.name,
        status:            train.status,
        current_station:   train.current_station,
        next_station:      train.next_station,
        origin:            train.origin,
        destination:       train.destination,
        latitude:          train.latitude,
        longitude:         train.longitude,
        speed_kmh:         train.speed_kmh,
        delay_minutes:     train.delay_minutes,
        scheduled_arrival: train.scheduled_arrival,
        estimated_arrival: train.estimated_arrival,
        platform:          train.platform,
        route:             train.route,
        passenger_count:   train.passenger_count,
        capacity:          train.capacity,
        type:              train.type,
      };

      try {
        if (cachedIds[train.train_number]) {
          // Update existing record
          await base44.entities.Train.update(cachedIds[train.train_number], payload);
        } else {
          // Create new record
          const created = await base44.entities.Train.create(payload);
          if (created?.id) cachedIds[train.train_number] = created.id;
        }
      } catch (e) { /* ignore individual failures */ }
    }));
  } catch (e) { /* ignore top-level failures */ } finally {
    isSyncing = false;
  }
}

/**
 * Fetch the current train states from the real backend.
 * Returns null if unavailable (caller falls back to local sim).
 */
export async function fetchRealTimeTrains() {
  try {
    const trains = await base44.entities.Train.list(null, 20);
    if (trains?.length > 0) return trains;
  } catch (e) { /* backend unavailable */ }
  return null;
}
