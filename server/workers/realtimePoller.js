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

    // Delete trains from Base44 that are no longer active (or old simulated ones)
    for (const [tNum, id] of existingMap.entries()) {
      if (!activeTrainNumbers.has(tNum)) {
        await base44.entities.Train.delete(id);
        console.log('[Worker] Deleted stale train record:', tNum);
      }
    }
  } catch (error) {
    console.error('Failed to sync snapshot to Base44:', error.message);
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
