// api/mta-feed.js
// Vercel Serverless Function — MTA GTFS-Realtime Proxy + Decoder
// Fetches binary protobuf from MTA, decodes it, returns clean JSON
// No API key required as of 2025.

import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

// The 3 feeds we pull in parallel (covers lines 1-7, A/C/E, N/Q/R/W)
const MTA_FEEDS = [
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs',         // 1 2 3 4 5 6 7 S
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace',     // A C E
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw',    // N Q R W
];

// Your 12 train numbers — we cycle MTA trips onto these consistently
const TRAIN_NUMBERS = [
  'EX-101', 'HS-202', 'LC-303', 'FR-404', 'EX-105', 'HS-206',
  'LC-307', 'EX-109', 'HS-210', 'LC-311', 'FR-412', 'EX-113',
];

const ROUTE_TYPE_MAP = {
  '1': 'local', '2': 'local', '3': 'express', '4': 'express',
  '5': 'express', '6': 'local', '7': 'high_speed', 'S': 'local',
  'A': 'express', 'C': 'local', 'E': 'express',
  'N': 'express', 'Q': 'high_speed', 'R': 'local', 'W': 'local',
};

/**
 * Fetch + decode a single MTA GTFS-RT feed.
 * Returns an array of TripUpdate entities or [] on failure.
 */
async function fetchFeed(url) {
  try {
    const res = await fetch(url, {
      headers: { 'x-api-key': '' }, // no key needed, but header presence helps
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
function extractDelay(entity) {
  try {
    const su = entity.tripUpdate?.stopTimeUpdate;
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
 * Map raw MTA entities onto your 12-train schema.
 * Cycles through entities so each of your 12 trains gets a real MTA trip.
 */
function mapToRailTwinTrains(allEntities) {
  // Filter to only TripUpdate entities that have real data
  const tripUpdates = allEntities.filter(e => e.tripUpdate?.trip);

  const trains = TRAIN_NUMBERS.map((trainNumber, idx) => {
    // Pick an MTA trip for this slot (cycle through available trips)
    const entity = tripUpdates[idx % Math.max(tripUpdates.length, 1)];
    const trip = entity?.tripUpdate?.trip;
    const routeId = trip?.routeId ?? String(idx + 1);
    const delayMins = entity ? extractDelay(entity) : 0;
    const type = ROUTE_TYPE_MAP[routeId] ?? 'local';

    let status = 'on_time';
    if (delayMins > 10) status = 'delayed';
    else if (delayMins > 0) status = 'delayed';
    else status = 'on_time';

    return {
      train_number: trainNumber,
      mta_trip_id: trip?.tripId ?? null,
      mta_route_id: routeId,
      delay_minutes: delayMins,
      status,
      type,
      // lat/lng and station names are left empty here —
      // the frontend merges with simulation data for smooth map animation
    };
  });

  return trains;
}

export default async function handler(req, res) {
  // CORS — allow the Vite dev server and Vercel preview
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=20, stale-while-revalidate=40');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Fetch all feeds in parallel
    const results = await Promise.all(MTA_FEEDS.map(fetchFeed));
    const allEntities = results.flat();

    if (allEntities.length === 0) {
      // All feeds failed — tell the client to fall back
      res.status(503).json({ error: 'MTA feeds unavailable', trains: [] });
      return;
    }

    const trains = mapToRailTwinTrains(allEntities);
    res.status(200).json({
      trains,
      fetched_at: new Date().toISOString(),
      entity_count: allEntities.length,
      source: 'mta-gtfs-realtime',
    });
  } catch (err) {
    res.status(500).json({ error: err.message, trains: [] });
  }
}
