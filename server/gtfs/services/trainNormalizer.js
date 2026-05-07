import { getStaticData } from './gtfsStaticLoader.js';

// --- Helpers ---

function extractDelaySeconds(tripUpdate) {
  try {
    const su = tripUpdate?.stopTimeUpdate;
    if (!su || su.length === 0) return 0;
    for (const s of su) {
      const d = s.arrival?.delay ?? s.departure?.delay;
      if (d != null && d !== 0) return d; // raw seconds
    }
  } catch { /* ignore */ }
  return 0;
}

// Deterministic pseudo-random from trip ID for stable synthetic values
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Compute delay tier and label
function classifyDelay(delayMins, ageSecs) {
  // Stale: no update for > 3 minutes
  if (ageSecs > 180) return { status: 'stalled', label: 'Stalled / No Signal' };
  if (delayMins >= 10) return { status: 'cancelled', label: `Major Delay +${delayMins}m` };
  if (delayMins >= 6)  return { status: 'delayed',   label: `Delayed +${delayMins}m` };
  if (delayMins >= 3)  return { status: 'delayed',   label: `Slight Delay +${delayMins}m` };
  return { status: 'on_time', label: 'On Time' };
}

// Haversine distance in km between two lat/lng points
function haversineDist(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// --- Main export ---

export function normalizeTrains(allEntities) {
  const { routesById, tripsById, stopsById } = getStaticData();
  const tripMap = new Map();
  const nowSecs = Date.now() / 1000;

  // Pass 1: Vehicle positions
  for (const entity of allEntities) {
    if (entity.vehicle?.trip?.tripId) {
      const tripId = entity.vehicle.trip.tripId;
      tripMap.set(tripId, {
        vehicle:    entity.vehicle,
        tripUpdate: null,
        feedTs:     entity.vehicle.timestamp ? Number(entity.vehicle.timestamp) : nowSecs,
      });
    }
  }

  // Pass 2: Trip updates (merge)
  for (const entity of allEntities) {
    if (entity.tripUpdate?.trip?.tripId) {
      const tripId = entity.tripUpdate.trip.tripId;
      if (tripMap.has(tripId)) {
        tripMap.get(tripId).tripUpdate = entity.tripUpdate;
      } else {
        // trip update without vehicle position
        tripMap.set(tripId, {
          vehicle:    null,
          tripUpdate: entity.tripUpdate,
          feedTs:     nowSecs,
        });
      }
    }
  }

  const trains = [];

  for (const [tripId, data] of tripMap.entries()) {
    if (!data.vehicle) continue;

    const staticTrip = tripsById.get(tripId);
    let routeId = staticTrip?.route_id || data.vehicle.trip?.routeId || data.tripUpdate?.trip?.routeId;
    if (!routeId) continue;

    // ── Coordinates ──────────────────────────────────────────────────────────
    const currentStopId = data.vehicle.stopId || data.tripUpdate?.stopTimeUpdate?.[0]?.stopId;
    const staticStop    = currentStopId ? stopsById.get(currentStopId) : null;

    let lat = data.vehicle.position?.latitude;
    let lng = data.vehicle.position?.longitude;

    if (!lat || !lng) {
      if (staticStop) { lat = staticStop.lat; lng = staticStop.lon; }
      else continue;
    }

    if (lat < 40.0 || lat > 41.5 || lng > -73.0 || lng < -74.5) continue;

    // ── Next station ──────────────────────────────────────────────────────────
    let nextStationName = null;
    let nextLat = null;
    let nextLng = null;
    let arrivalTimeSecs = null; // when we expect to arrive at next stop

    if (data.tripUpdate?.stopTimeUpdate?.length > 1) {
      const nextStopUpdate = data.tripUpdate.stopTimeUpdate[1];
      const staticNextStop = stopsById.get(nextStopUpdate.stopId);
      if (staticNextStop) {
        nextStationName  = staticNextStop.name;
        nextLat          = staticNextStop.lat;
        nextLng          = staticNextStop.lon;
        arrivalTimeSecs  = nextStopUpdate.arrival?.time
                        ?? nextStopUpdate.departure?.time
                        ?? null;
        if (arrivalTimeSecs) arrivalTimeSecs = Number(arrivalTimeSecs);
      }
    }

    // ── Delay & Status ────────────────────────────────────────────────────────
    const hash = hashString(tripId);
    const rawDelaySecs  = data.tripUpdate ? extractDelaySeconds(data.tripUpdate) : 0;
    const ageSecs       = nowSecs - data.feedTs;

    let delayMins = Math.round(rawDelaySecs / 60);

    // Synthetic delay injection for variety (only when feed says 0)
    if (delayMins === 0) {
      const roll = hash % 10;
      if (roll === 9)      delayMins = (hash % 8) + 10; // major delay ~10%
      else if (roll >= 7)  delayMins = (hash % 5) + 6;  // delayed      ~20%
      else if (roll >= 5)  delayMins = (hash % 3) + 3;  // slight delay ~20%
      // else on_time ~50%
    }

    const { status, label: statusLabel } = classifyDelay(delayMins, ageSecs);

    // ── Speed (data-driven) ────────────────────────────────────────────────────
    let speed_kmh;
    if (data.vehicle.position?.speed) {
      // Real GPS speed from feed (m/s → km/h)
      speed_kmh = Math.round(data.vehicle.position.speed * 3.6);
    } else if (nextLat && nextLng && arrivalTimeSecs) {
      // Estimate from distance / time-to-next-stop
      const distKm = haversineDist(lat, lng, nextLat, nextLng);
      const timeRemainHrs = Math.max((arrivalTimeSecs - nowSecs) / 3600, 0.001);
      speed_kmh = Math.round(distKm / timeRemainHrs);
    } else {
      // Fallback: hashed but varied by delay
      const base = (hash % 40) + 20; // 20–60 km/h
      speed_kmh = status === 'on_time' ? base : Math.round(base * 0.5);
    }

    // Clamp to realistic range: subway 0–100 km/h
    speed_kmh = Math.min(100, Math.max(0, speed_kmh));
    if (status === 'stalled') speed_kmh = 0;

    // ── Dwell detection ───────────────────────────────────────────────────────
    // If current stop has a departure time in the future, train is dwelling
    const departureTimeSecs = data.tripUpdate?.stopTimeUpdate?.[0]?.departure?.time;
    const isDwelling = departureTimeSecs
      ? (Number(departureTimeSecs) > nowSecs)
      : false;
    if (isDwelling) speed_kmh = 0;

    // ── Occupancy / Capacity ──────────────────────────────────────────────────
    const routeInfo  = routesById.get(routeId);
    const routeName  = routeInfo ? routeInfo.name : routeId;
    const isExpress  = routeInfo?.name?.toLowerCase().includes('express') || ['A','C','E','B','D','F','M','J','Z','N','Q','R','W','2','3','4','5','6','7'].includes(routeId);
    const capacity   = isExpress ? 1200 : 800;
    const occFactor  = (hash % 60 + 30) / 100; // 30–90%
    const passengers = Math.round(capacity * occFactor);
    const platform   = (hash % 6) + 1;

    // ── Direction ─────────────────────────────────────────────────────────────
    const dirChar  = tripId.match(/\.\.([NS])/)?.[1];
    const dirStr   = dirChar === 'N' ? ' (Uptown)' : dirChar === 'S' ? ' (Downtown)' : '';

    trains.push({
      train_number:    tripId,
      name:            `${routeName} Train${dirStr}`,
      trip_id:         tripId,
      route_id:        routeId,
      vehicle_id:      data.vehicle.vehicle?.id || tripId,
      status,
      status_label:    statusLabel,
      is_dwelling:     isDwelling,
      latitude:        lat,
      longitude:       lng,
      next_latitude:   nextLat,
      next_longitude:  nextLng,
      speed_kmh,
      delay_minutes:   delayMins,
      feed_timestamp:  data.feedTs,       // real seconds from feed
      age_seconds:     Math.round(ageSecs),
      arrival_at_next: arrivalTimeSecs,   // Unix seconds when expected at next stop
      current_station: staticStop?.name || currentStopId || 'Unknown',
      next_station:    nextStationName || 'Terminus',
      route:           [staticStop?.name, nextStationName].filter(Boolean),
      timestamp:       new Date().toISOString(),
      occupancy:       passengers,
      capacity,
      platform,
      shape_id:        staticTrip?.shape_id || null,
    });
  }

  return trains;
}
