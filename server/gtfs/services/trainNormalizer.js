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
    if (!data.vehicle || !data.vehicle.position) continue;
    
    // Use Static GTFS to get route and shape info
    const staticTrip = tripsById.get(tripId);
    let routeId = staticTrip?.route_id || data.vehicle.trip?.routeId || data.tripUpdate?.trip?.routeId;
    if (!routeId) continue;

    const lat = data.vehicle.position.latitude;
    const lng = data.vehicle.position.longitude;
    
    if (lat < 40.0 || lat > 41.5 || lng > -73.0 || lng < -74.5) continue;

    const delayMins = data.tripUpdate ? extractDelay(data.tripUpdate) : 0;
    
    let status = 'on_time';
    if (delayMins > 10) status = 'delayed';
    else if (delayMins > 0) status = 'delayed';

    const currentStopId = data.vehicle.stopId || data.tripUpdate?.stopTimeUpdate?.[0]?.stopId;
    const staticStop = currentStopId ? stopsById.get(currentStopId) : null;
    const currentStationName = staticStop ? staticStop.name : (currentStopId || 'Unknown');

    // Direction parsing
    const directionChar = tripId.match(/\.\.([NS])/)?.[1];
    let directionStr = '';
    if (directionChar === 'N') directionStr = ' (Uptown)';
    else if (directionChar === 'S') directionStr = ' (Downtown)';

    const routeInfo = routesById.get(routeId);
    const routeName = routeInfo ? routeInfo.name : routeId;

    trains.push({
      train_number: routeId + '-' + tripId.substring(tripId.length - 4),
      name: routeName + ' Train' + directionStr,
      trip_id: tripId,
      route_id: routeId,
      vehicle_id: data.vehicle.vehicle?.id || tripId, // some feeds don't have explicit vehicle ID
      status,
      latitude: lat,
      longitude: lng,
      speed_kmh: data.vehicle.position.speed ? Math.round(data.vehicle.position.speed * 3.6) : null,
      delay_minutes: delayMins,
      current_station: currentStationName,
      next_station: 'Continuing', // Could be inferred from next stopTimeUpdate
      route: [currentStationName],
      timestamp: new Date().toISOString(),
      occupancy: null, // As requested, no fake occupancy
      capacity: null,
      // Pass the shape path so the frontend can interpolate along it
      shape_id: staticTrip?.shape_id || null
    });
  }

  return trains;
}
