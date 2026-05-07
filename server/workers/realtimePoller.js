import { loadStaticGtfs, getStaticData } from '../gtfs/services/gtfsStaticLoader.js';
import { fetchLiveFeeds } from '../gtfs/services/gtfsRealtimeFetcher.js';
import { normalizeTrains } from '../gtfs/services/trainNormalizer.js';
import { base44 } from '../../src/api/base44Client.js';

const POLL_INTERVAL_MS = 30000; // 30 seconds

async function syncToBase44(trains) {
  try {
    // 1. Fetch existing records to know whether to create or update
    const existing = await base44.entities.Train.list(null, 500);
    const existingMap = new Map(existing.map(t => [t.train_number, t.id]));

    // 2. We keep track of which trains we updated so we can potentially clean up old ones
    const activeTrainNumbers = new Set();

    // 3. Update or create
    for (const t of trains) {
      activeTrainNumbers.add(t.train_number);
      const payload = {
        train_number: t.train_number,
        name: t.name,
        status: t.status,
        current_station: t.current_station,
        next_station: t.next_station,
        latitude: t.latitude,
        longitude: t.longitude,
        speed_kmh: t.speed_kmh,
        delay_minutes: t.delay_minutes,
        route: t.route,
        capacity: t.capacity,
        passenger_count: t.occupancy
      };

      if (existingMap.has(t.train_number)) {
        await base44.entities.Train.update(existingMap.get(t.train_number), payload);
      } else {
        await base44.entities.Train.create(payload);
      }
    }

    // Optional: Delete trains from Base44 that are no longer active
    // We can do this periodically to keep the DB clean
    for (const [tNum, id] of existingMap.entries()) {
      if (!activeTrainNumbers.has(tNum)) {
        await base44.entities.Train.delete(id);
      }
    }
  } catch (error) {
    console.error('Failed to sync snapshot to Base44:', error.message);
  }
}

async function runPoller() {
  console.log('Initializing GTFS Realtime Poller...');
  
  // 1. Load static GTFS first (blocks until complete)
  try {
    await loadStaticGtfs();
  } catch (err) {
    console.error('Failed to load static GTFS. Worker cannot start.', err);
    process.exit(1);
  }

  // 2. Poll loop
  setInterval(async () => {
    try {
      console.log('[Worker] Fetching GTFS-RT feeds at ' + new Date().toISOString());
      const entities = await fetchLiveFeeds();
      
      const trains = normalizeTrains(entities);
      console.log('[Worker] Normalized ' + trains.length + ' active trains. Syncing to Base44...');
      
      await syncToBase44(trains);
      console.log('[Worker] Sync complete.');
      
    } catch (err) {
      console.error('[Worker] Error during poll cycle:', err);
    }
  }, POLL_INTERVAL_MS);

  // Trigger first run immediately
  try {
    const entities = await fetchLiveFeeds();
    const trains = normalizeTrains(entities);
    await syncToBase44(trains);
    console.log('[Worker] Initial sync complete (' + trains.length + ' trains).');
  } catch (err) {
    console.error('[Worker] Initial run failed:', err);
  }
}

runPoller();
