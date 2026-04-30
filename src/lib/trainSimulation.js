// Train simulation data and utilities

export const STATIONS = [
  { name: "Grand Central", code: "GCT", latitude: 40.7527, longitude: -73.9772, platforms: 12, zone: "A" },
  { name: "Penn Station", code: "PEN", latitude: 40.7506, longitude: -73.9935, platforms: 11, zone: "A" },
  { name: "Union Terminal", code: "UNT", latitude: 40.7614, longitude: -73.9776, platforms: 8, zone: "B" },
  { name: "Riverside Hub", code: "RVH", latitude: 40.7831, longitude: -73.9712, platforms: 6, zone: "B" },
  { name: "Eastgate Junction", code: "EGJ", latitude: 40.7282, longitude: -73.9942, platforms: 5, zone: "C" },
  { name: "Harbor Bridge", code: "HBG", latitude: 40.7061, longitude: -74.0087, platforms: 4, zone: "C" },
  { name: "Northfield Park", code: "NFP", latitude: 40.8005, longitude: -73.9582, platforms: 6, zone: "D" },
  { name: "Westbrook Central", code: "WBC", latitude: 40.7425, longitude: -74.0260, platforms: 7, zone: "D" },
  { name: "Southport Terminal", code: "SPT", latitude: 40.6892, longitude: -74.0445, platforms: 5, zone: "E" },
  { name: "Metro Square", code: "MSQ", latitude: 40.7580, longitude: -73.9855, platforms: 9, zone: "A" },
];

const TRAIN_TEMPLATES = [
  { train_number: "EX-101", name: "Blue Arrow Express", type: "express", origin: "Grand Central", destination: "Southport Terminal", route: ["Grand Central", "Penn Station", "Eastgate Junction", "Harbor Bridge", "Southport Terminal"], capacity: 450 },
  { train_number: "HS-202", name: "Thunderbolt", type: "high_speed", origin: "Grand Central", destination: "Westbrook Central", route: ["Grand Central", "Metro Square", "Penn Station", "Westbrook Central"], capacity: 320 },
  { train_number: "LC-303", name: "City Hopper", type: "local", origin: "Northfield Park", destination: "Harbor Bridge", route: ["Northfield Park", "Riverside Hub", "Union Terminal", "Metro Square", "Grand Central", "Penn Station", "Eastgate Junction", "Harbor Bridge"], capacity: 600 },
  { train_number: "FR-404", name: "Iron Horse", type: "freight", origin: "Westbrook Central", destination: "Northfield Park", route: ["Westbrook Central", "Penn Station", "Grand Central", "Union Terminal", "Riverside Hub", "Northfield Park"], capacity: 0 },
  { train_number: "EX-105", name: "Silver Streak", type: "express", origin: "Riverside Hub", destination: "Southport Terminal", route: ["Riverside Hub", "Union Terminal", "Grand Central", "Penn Station", "Eastgate Junction", "Southport Terminal"], capacity: 400 },
  { train_number: "HS-206", name: "Velocity", type: "high_speed", origin: "Southport Terminal", destination: "Northfield Park", route: ["Southport Terminal", "Harbor Bridge", "Eastgate Junction", "Grand Central", "Riverside Hub", "Northfield Park"], capacity: 280 },
  { train_number: "LC-307", name: "Metro Link", type: "local", origin: "Penn Station", destination: "Northfield Park", route: ["Penn Station", "Metro Square", "Union Terminal", "Riverside Hub", "Northfield Park"], capacity: 550 },
  { train_number: "EX-109", name: "Dawn Rider", type: "express", origin: "Metro Square", destination: "Westbrook Central", route: ["Metro Square", "Penn Station", "Westbrook Central"], capacity: 380 },
  { train_number: "HS-210", name: "Flash Rail", type: "high_speed", origin: "Eastgate Junction", destination: "Riverside Hub", route: ["Eastgate Junction", "Grand Central", "Metro Square", "Union Terminal", "Riverside Hub"], capacity: 300 },
  { train_number: "LC-311", name: "Commuter Plus", type: "local", origin: "Westbrook Central", destination: "Eastgate Junction", route: ["Westbrook Central", "Penn Station", "Grand Central", "Eastgate Junction"], capacity: 520 },
  { train_number: "FR-412", name: "Cargo Express", type: "freight", origin: "Harbor Bridge", destination: "Union Terminal", route: ["Harbor Bridge", "Eastgate Junction", "Penn Station", "Grand Central", "Union Terminal"], capacity: 0 },
  { train_number: "EX-113", name: "Horizon Limited", type: "express", origin: "Northfield Park", destination: "Southport Terminal", route: ["Northfield Park", "Riverside Hub", "Grand Central", "Penn Station", "Harbor Bridge", "Southport Terminal"], capacity: 420 },
];

function getStationCoords(stationName) {
  const s = STATIONS.find(st => st.name === stationName);
  return s ? { lat: s.latitude, lng: s.longitude } : { lat: 40.75, lng: -73.99 };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Deterministic pseudo-random from a seed.
 * Returns a stable float in [0, 1) for the same seed.
 * Used so values only change when the seed (currentSegment) changes.
 */
function seededRandom(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function simulateTrainStates(tick) {
  return TRAIN_TEMPLATES.map((template, idx) => {
    const routeLen = template.route.length;
    const cycleDuration = routeLen * 40;
    const progress = ((tick + idx * 17) % cycleDuration) / cycleDuration;
    const segmentProgress = progress * (routeLen - 1);
    const currentSegment = Math.floor(segmentProgress);
    const segmentT = segmentProgress - currentSegment;
    
    const fromIdx = Math.min(currentSegment, routeLen - 2);
    const toIdx = fromIdx + 1;
    
    const from = getStationCoords(template.route[fromIdx]);
    const to = getStationCoords(template.route[toIdx]);
    
    const lat = lerp(from.lat, to.lat, segmentT);
    const lng = lerp(from.lng, to.lng, segmentT);
    
    // ── Speed: base type speed + small segment-stable variation ──────────────
    const baseSpeed = template.type === 'high_speed' ? 280 : template.type === 'express' ? 160 : template.type === 'local' ? 80 : 60;
    // Speed varies slightly per segment (approach/depart), NOT per tick
    const speedSeed   = idx * 1000 + fromIdx;
    const speedVariation = (seededRandom(speedSeed) - 0.5) * 30; // ±15 km/h
    // Near a station (segmentT < 0.1 or > 0.9) slow down smoothly
    const stationFactor = segmentT < 0.1 ? segmentT / 0.1 : segmentT > 0.9 ? (1 - segmentT) / 0.1 : 1;
    const speed = Math.max(10, (baseSpeed + speedVariation) * stationFactor);

    // ── Delay: stable per train, not per tick ────────────────────────────────
    const delayBase = (Math.sin(tick * 0.05 + idx * 2.3) + 1) * 4;
    const delay = idx % 3 === 0 ? Math.round(delayBase) : idx % 5 === 0 ? Math.round(delayBase * 2) : 0;

    const statuses = ['on_time', 'delayed', 'departed', 'on_time', 'on_time'];
    const status = delay > 5 ? 'delayed' : segmentT < 0.05 ? 'arrived' : segmentT > 0.95 ? 'departed' : statuses[idx % statuses.length];

    // ── Occupancy: ONLY changes at station events (currentSegment change) ────
    // Seed = (trainIdx, currentSegment) → deterministic, stable between stations
    const occSeed = idx * 500 + fromIdx;
    // Base load factor: some routes are busier than others
    const routeBusy = seededRandom(idx * 13) * 0.4 + 0.3; // 30-70% base load
    // Each station stop has a random board/alight delta: -15% to +20%
    const boardingDelta = (seededRandom(occSeed) - 0.4) * 0.35;
    const rawFactor = Math.max(0.05, Math.min(0.98, routeBusy + boardingDelta));
    const passengers = template.type === 'freight' ? 0 : Math.round(template.capacity * rawFactor);

    // ── Platform: fixed per station stop, not per tick ───────────────────────
    const platform = (Math.floor(seededRandom(idx * 200 + fromIdx) * 8) % 8) + 1;
    
    const scheduledTime = new Date();
    scheduledTime.setMinutes(scheduledTime.getMinutes() + Math.round(progress * 60));
    const estimatedTime = new Date(scheduledTime.getTime() + delay * 60000);

    return {
      ...template,
      latitude: lat,
      longitude: lng,
      speed_kmh: Math.round(speed),
      delay_minutes: delay,
      status,
      current_station: template.route[fromIdx],
      next_station: template.route[toIdx],
      passenger_count: passengers,
      platform,
      scheduled_arrival: scheduledTime.toISOString(),
      estimated_arrival: estimatedTime.toISOString(),
    };
  });
}

export function getNetworkStats(trains) {
  const total = trains.length;
  const onTime = trains.filter(t => t.status === "on_time" || t.delay_minutes === 0).length;
  const delayed = trains.filter(t => t.delay_minutes > 0).length;
  const avgDelay = total > 0 ? Math.round(trains.reduce((s, t) => s + (t.delay_minutes || 0), 0) / total) : 0;
  const totalPassengers = trains.reduce((s, t) => s + (t.passenger_count || 0), 0);
  const totalCapacity = trains.filter(t => t.type !== "freight").reduce((s, t) => s + (t.capacity || 0), 0);
  const onTimeRate = total > 0 ? Math.round((onTime / total) * 100) : 0;
  const platformUtil = Math.round(65 + Math.sin(Date.now() / 10000) * 15);

  return { total, onTime, delayed, avgDelay, totalPassengers, totalCapacity, onTimeRate, platformUtil };
}