import { loadStaticGtfs, getStaticData } from '../gtfs/services/gtfsStaticLoader.js';
import { fetchLiveFeeds } from '../gtfs/services/gtfsRealtimeFetcher.js';
import { normalizeTrains } from '../gtfs/services/trainNormalizer.js';
import { base44 } from '../../src/api/base44Client.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POLL_INTERVAL_MS = 30000; // 30 seconds

// Persistent cache of what Base44 already has, to avoid redundant reads
let base44Cache = new Map(); // train_number → { id, latitude, longitude, status, delay_minutes }
let lastFullSyncMs = 0;
const FULL_SYNC_INTERVAL_MS = 120_000; // full re-read every 2 minutes
const MAX_WRITES_PER_CYCLE  = 150;     // hard cap per 30s cycle to stay under rate limit
const WRITE_DELAY_MS        = 80;      // ms between each API write

async function syncToBase44(trains) {
  try {
    const now = Date.now();

    // Refresh our local cache from Base44 every 2 minutes
    if (now - lastFullSyncMs > FULL_SYNC_INTERVAL_MS) {
      const existing = await base44.entities.Train.list(null, 2000);
      base44Cache = new Map(existing.map(t => [t.train_number, t]));
      lastFullSyncMs = now;
    }

    const activeSet  = new Set(trains.map(t => t.train_number));
    let created = 0, updated = 0, deleted = 0;
    const toWrite = [];

    for (const t of trains) {
      const payload = {
        train_number:    t.train_number,
        name:            t.name,
        status:          t.status,
        status_label:    t.status_label,
        current_station: t.current_station,
        next_station:    t.next_station,
        latitude:        t.latitude,
        longitude:       t.longitude,
        next_latitude:   t.next_latitude,
        next_longitude:  t.next_longitude,
        speed_kmh:       t.speed_kmh,
        delay_minutes:   t.delay_minutes,
        age_seconds:     t.age_seconds,
        feed_timestamp:  t.feed_timestamp,
        arrival_at_next: t.arrival_at_next,
        is_dwelling:     t.is_dwelling,
        route:           [t.current_station, t.next_station, t.next_latitude, t.next_longitude].filter(v => v != null),
        // speed_kmh: 0 from Base44 because field may not exist, use hash for demo
        passenger_count: t.occupancy,
        platform:        t.platform,
      };

      const cached = base44Cache.get(t.train_number);
      if (cached) {
        // Only write if something meaningful changed
        if (
          cached.latitude     !== payload.latitude  ||
          cached.longitude    !== payload.longitude  ||
          cached.status       !== payload.status     ||
          cached.delay_minutes !== payload.delay_minutes
        ) {
          toWrite.push({ type: 'update', id: cached.id, payload });
        }
      } else {
        toWrite.push({ type: 'create', payload });
      }
    }

    // Cap writes per cycle to avoid rate limits
    const batch = toWrite.slice(0, MAX_WRITES_PER_CYCLE);

    for (const op of batch) {
      try {
        if (op.type === 'update') {
          await base44.entities.Train.update(op.id, op.payload);
          base44Cache.set(op.payload.train_number, { ...base44Cache.get(op.payload.train_number), ...op.payload });
          updated++;
        } else {
          const created_rec = await base44.entities.Train.create(op.payload);
          base44Cache.set(op.payload.train_number, { id: created_rec.id, ...op.payload });
          created++;
        }
        await new Promise(r => setTimeout(r, WRITE_DELAY_MS));
      } catch(e) {
        if (e.message?.includes('429')) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    // Clean up trains no longer in feed (limit to 20 deletes per cycle)
    let deleteCount = 0;
    for (const [tNum, rec] of base44Cache.entries()) {
      if (!activeSet.has(tNum) && deleteCount < 20) {
        try {
          await base44.entities.Train.delete(rec.id);
          base44Cache.delete(tNum);
          console.log('[Worker] Deleted stale train:', tNum);
          deleteCount++;
          deleted++;
        } catch(e) { /* ignore */ }
      }
    }

    if (created + updated + deleted > 0) {
      console.log(`[Worker] Sync: +${created} created, ~${updated} updated, -${deleted} deleted (${trains.length} active)`);
    }

  } catch (error) {
    console.error('[Worker] Sync error:', error.message);
  }
}

async function generateShapesJson() {
  const { shapesById, routesById, tripsById } = getStaticData();
  
  // Find which shapes belong to which routes
  const shapeToRoute = new Map();
  for (const trip of tripsById.values()) {
    if (trip.shape_id && trip.route_id) {
      shapeToRoute.set(trip.shape_id, trip.route_id);
    }
  }

  const outputShapes = {};
  
  for (const [shapeId, points] of shapesById.entries()) {
    const routeId = shapeToRoute.get(shapeId);
    if (!routeId) continue;
    
    const routeInfo = routesById.get(routeId);
    const color = routeInfo ? routeInfo.color : '#3b9eff';

    // Simplify points (keep 1 in 5 points to reduce file size, or distance-based)
    const simplified = [];
    for (let i = 0; i < points.length; i += 5) {
      simplified.push([points[i].lat, points[i].lon]);
    }
    // Always include the last point to close the segment
    if (points.length > 0) {
      simplified.push([points[points.length-1].lat, points[points.length-1].lon]);
    }

    outputShapes[shapeId] = { color, path: simplified };
  }

  const outputPath = path.join(__dirname, '../../public/shapes.json');
  fs.writeFileSync(outputPath, JSON.stringify(outputShapes));
  console.log('[Worker] Wrote simplified shapes.json (' + Object.keys(outputShapes).length + ' shapes) to public directory.');
}

async function runPoller() {
  console.log('Initializing GTFS Realtime Poller...');
  
  // 1. Load static GTFS first (blocks until complete)
  try {
    await loadStaticGtfs();
    await generateShapesJson(); // Export shapes for frontend map
  } catch (err) {
    console.error('Failed to load static GTFS. Worker cannot start.', err);
    process.exit(1);
  }

  // 2. Recursive Poll Loop
  async function poll() {
    try {
      const entities = await fetchLiveFeeds();
      const trains = normalizeTrains(entities);
      await syncToBase44(trains);
    } catch (err) {
      console.error('[Worker] Error during poll cycle:', err);
    }
    setTimeout(poll, POLL_INTERVAL_MS);
  }

  // Trigger first run
  poll();
}

runPoller();
