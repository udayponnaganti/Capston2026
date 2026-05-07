// api/mta-feed.js
// Vercel Serverless Function — MTA GTFS-Realtime Proxy + Decoder
// Fetches binary protobuf from MTA, decodes it, returns clean JSON
// No API key required as of 2025.

import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

// The feeds we pull in parallel
const MTA_FEEDS = [
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs',         // 1 2 3 4 5 6 7 S
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace',     // A C E
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw',    // N Q R W
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm',    // B D F M
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g',       // G
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz',      // J Z
];

const ROUTE_TYPE_MAP = {
  '1': 'local', '2': 'local', '3': 'express', '4': 'express',
  '5': 'express', '6': 'local', '7': 'high_speed', 'S': 'local',
  'A': 'express', 'C': 'local', 'E': 'express',
  'N': 'express', 'Q': 'high_speed', 'R': 'local', 'W': 'local',
  'B': 'express', 'D': 'express', 'F': 'express', 'M': 'local',
  'G': 'local', 'J': 'express', 'Z': 'express'
};

// Simple pseudo-random generator for consistent simulated metrics per trip
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * Fetch + decode a single MTA GTFS-RT feed.
 * Returns an array of entities or [] on failure.
 */
async function fetchFeed(url) {
  try {
    const res = await fetch(url, {
      headers: { 'x-api-key': '' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const buffer = await res.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );
    return feed.entity || [];
  } catch {
    return [];
  }
}

/**
 * Extract the delay in minutes from a TripUpdate entity.
 */
function extractDelay(tripUpdate) {
  try {
    const su = tripUpdate?.stopTimeUpdate;
    if (!su || su.length === 0) return 0;
    // Use the first stop update with a delay
    for (const s of su) {
      const d = s.arrival?.delay ?? s.departure?.delay;
      if (d != null && d !== 0) return Math.round(d / 60);
    }
  } catch { /* ignore */ }
  return 0;
}

/**
 * Normalizes all GTFS entities into a clean array of real trains
 */
function normalizeTrains(allEntities) {
  // Map to hold merged data by tripId
  const tripMap = new Map();

  // First pass: gather VehiclePositions
  for (const entity of allEntities) {
    if (entity.vehicle?.trip?.tripId) {
      const tripId = entity.vehicle.trip.tripId;
      tripMap.set(tripId, {
        vehicle: entity.vehicle,
        tripUpdate: null
      });
    }
  }

  // Second pass: gather TripUpdates and merge
  for (const entity of allEntities) {
    if (entity.tripUpdate?.trip?.tripId) {
      const tripId = entity.tripUpdate.trip.tripId;
      if (tripMap.has(tripId)) {
        tripMap.get(tripId).tripUpdate = entity.tripUpdate;
      } else {
        tripMap.set(tripId, {
          vehicle: null,
          tripUpdate: entity.tripUpdate
        });
      }
    }
  }

  const trains = [];

  // Filter and map to RailTwin schema
  for (const [tripId, data] of tripMap.entries()) {
    // Only use trains that have at least a known position
    if (!data.vehicle || !data.vehicle.position) continue;
    
    const routeId = data.vehicle.trip?.routeId || data.tripUpdate?.trip?.routeId || 'Unknown';
    if (routeId === 'Unknown') continue;

    const lat = data.vehicle.position.latitude;
    const lng = data.vehicle.position.longitude;
    
    // We only want NYC area coords to filter out noise
    if (lat < 40.0 || lat > 41.5 || lng > -73.0 || lng < -74.5) continue;

    const delayMins = data.tripUpdate ? extractDelay(data.tripUpdate) : 0;
    const type = ROUTE_TYPE_MAP[routeId] ?? 'local';

    let status = 'on_time';
    if (delayMins > 10) status = 'delayed';
    else if (delayMins > 0) status = 'delayed';

    const currentStationId = data.vehicle.stopId || data.tripUpdate?.stopTimeUpdate?.[0]?.stopId || 'Unknown';

    // Simulated metrics based on tripId to keep UI rich
    const hash = Math.abs(hashString(tripId));
    const capacity = type === 'express' ? 1200 : 800; // Realistic subway capacity
    const occFactor = (hash % 60 + 30) / 100; // 30-90%
    const passengers = Math.round(capacity * occFactor);
    const speed = data.vehicle.position.speed ? Math.round(data.vehicle.position.speed * 3.6) : (hash % 40 + 20); // convert m/s to km/h or fake it

    // Extract direction from tripId (ends in N or S typically)
    const directionChar = tripId.match(/\.\.([NS])/)?.[1];
    let directionStr = '';
    if (directionChar === 'N') directionStr = ' (Uptown)';
    else if (directionChar === 'S') directionStr = ' (Downtown)';

    trains.push({
      train_number: \`\${routeId}-\${tripId.substring(tripId.length - 4)}\`,
      name: \`\${routeId} Train\${directionStr}\`,
      mta_trip_id: tripId,
      mta_route_id: routeId,
      latitude: lat,
      longitude: lng,
      speed_kmh: speed,
      delay_minutes: delayMins,
      status,
      type,
      current_station: currentStationId, // We will just use stopId for now or let frontend decode
      next_station: 'Continuing',
      platform: (hash % 4) + 1,
      passenger_count: passengers,
      capacity: capacity,
      route: [currentStationId] // Minimal route
    });
  }

  return trains;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=20, stale-while-revalidate=40');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const results = await Promise.all(MTA_FEEDS.map(fetchFeed));
    const allEntities = results.flat();

    if (allEntities.length === 0) {
      res.status(503).json({ error: 'MTA feeds unavailable', trains: [] });
      return;
    }

    const trains = normalizeTrains(allEntities);
    res.status(200).json({
      trains,
      fetched_at: new Date().toISOString(),
      entity_count: allEntities.length,
      train_count: trains.length,
      source: 'mta-gtfs-realtime',
    });
  } catch (err) {
    res.status(500).json({ error: err.message, trains: [] });
  }
}
