import { getStaticData } from './gtfsStaticLoader.js';

function extractDelay(tripUpdate) {
  try {
    const su = tripUpdate?.stopTimeUpdate;
    if (!su || su.length === 0) return 0;
    for (const s of su) {
      const d = s.arrival?.delay ?? s.departure?.delay;
      if (d != null && d !== 0) return Math.round(d / 60);
    }
  } catch { /* ignore */ }
  return 0;
}

// Simple pseudo-random generator for consistent simulated metrics per trip
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function normalizeTrains(allEntities) {
  const { routesById, tripsById, stopsById, shapesById } = getStaticData();
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

  for (const [tripId, data] of tripMap.entries()) {
    if (!data.vehicle) continue;
    
    // Use Static GTFS to get route and shape info
    const staticTrip = tripsById.get(tripId);
    let routeId = staticTrip?.route_id || data.vehicle.trip?.routeId || data.tripUpdate?.trip?.routeId;
    if (!routeId) continue;

    const currentStopId = data.vehicle.stopId || data.tripUpdate?.stopTimeUpdate?.[0]?.stopId;
    const staticStop = currentStopId ? stopsById.get(currentStopId) : null;

    let lat = data.vehicle.position?.latitude;
    let lng = data.vehicle.position?.longitude;
    
    // MTA subway feed often omits GPS positions and relies on stopId
    if (!lat || !lng) {
      if (staticStop) {
        lat = staticStop.lat;
        lng = staticStop.lon;
      } else {
        continue;
      }
    }
    
    if (lat < 40.0 || lat > 41.5 || lng > -73.0 || lng < -74.5) continue;

    const hash = Math.abs(hashString(tripId));
    let delayMins = data.tripUpdate ? extractDelay(data.tripUpdate) : 0;
    
    // Inject synthetic delays for demo purposes if real feed doesn't have it
    if (delayMins === 0 && (hash % 10) > 7) {
      delayMins = (hash % 15) + 2; // 2-16 minutes delay
    }
    
    let status = 'on_time';
    if (delayMins > 10) status = 'delayed';
    else if (delayMins > 0) status = 'delayed';

    const currentStationName = staticStop ? staticStop.name : (currentStopId || 'Unknown');

    // Direction parsing
    const directionChar = tripId.match(/\.\.([NS])/)?.[1];
    let directionStr = '';
    if (directionChar === 'N') directionStr = ' (Uptown)';
    else if (directionChar === 'S') directionStr = ' (Downtown)';

    const routeInfo = routesById.get(routeId);
    const routeName = routeInfo ? routeInfo.name : routeId;

    const capacity = routeInfo?.type === 'express' ? 1200 : 800;
    const occFactor = (hash % 60 + 30) / 100; // 30-90%
    const passengers = Math.round(capacity * occFactor);
    const speed = data.vehicle.position?.speed ? Math.round(data.vehicle.position.speed * 3.6) : (hash % 50 + 25); // 25-75 km/h
    const platformNum = (hash % 6) + 1;

    trains.push({
      train_number: tripId, // Use full tripId to guarantee uniqueness and prevent marker jumping
      name: routeName + ' Train' + directionStr,
      trip_id: tripId,
      route_id: routeId,
      vehicle_id: data.vehicle.vehicle?.id || tripId, // some feeds don't have explicit vehicle ID
      status,
      latitude: lat,
      longitude: lng,
      speed_kmh: speed,
      delay_minutes: delayMins,
      current_station: currentStationName,
      next_station: 'Continuing', // Could be inferred from next stopTimeUpdate
      route: [currentStationName],
      timestamp: new Date().toISOString(),
      occupancy: passengers, // Restored synthetic occupancy
      capacity: capacity,
      platform: platformNum,
      // Pass the shape path so the frontend can interpolate along it
      shape_id: staticTrip?.shape_id || null
    });
  }

  return trains;
}
