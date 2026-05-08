export const NY_STATIONS = [
  { id: "GCT", name: "Grand Central Terminal", platforms: 44, type: "hub", region: "Manhattan", lat: 40.7527, lng: -73.9772 },
  { id: "PEN", name: "Penn Station", platforms: 21, type: "hub", region: "Manhattan", lat: 40.7506, lng: -73.9935 },
  { id: "JAM", name: "Jamaica", platforms: 8, type: "junction", region: "Queens", lat: 40.6996, lng: -73.8087 },
  { id: "ATL", name: "Atlantic Terminal", platforms: 6, type: "terminus", region: "Brooklyn", lat: 40.6835, lng: -73.9775 },
  { id: "NRO", name: "New Rochelle", platforms: 4, type: "junction", region: "Westchester", lat: 40.9113, lng: -73.7828 },
  { id: "STM", name: "Stamford", platforms: 5, type: "hub", region: "CT", lat: 41.0468, lng: -73.5397 },
  { id: "HOB", name: "Hoboken", platforms: 18, type: "terminus", region: "NJ", lat: 40.7348, lng: -74.0276 },
  { id: "SEC", name: "Secaucus Junction", platforms: 4, type: "junction", region: "NJ", lat: 40.7615, lng: -74.0745 },
  { id: "NWK", name: "Newark Penn", platforms: 6, type: "hub", region: "NJ", lat: 40.7345, lng: -74.1645 },
  { id: "LIC", name: "Long Island City", platforms: 3, type: "terminus", region: "Queens", lat: 40.7423, lng: -73.9555 },
  { id: "HAR", name: "Harlem-125th St", platforms: 4, type: "junction", region: "Manhattan", lat: 40.8052, lng: -73.9390 },
  { id: "YNK", name: "Yankees-E 153rd", platforms: 4, type: "local", region: "Bronx", lat: 40.8267, lng: -73.9229 }
];

// Defining edges (rail sections) between stations
export const NY_SECTIONS = [
  { id: "SEC_GCT_HAR", from: "GCT", to: "HAR", capacity: 4, headway_mins: 2, distance_km: 6, speed_limit: 80, isBiDirectional: true },
  { id: "SEC_HAR_YNK", from: "HAR", to: "YNK", capacity: 3, headway_mins: 3, distance_km: 3, speed_limit: 70, isBiDirectional: true },
  { id: "SEC_YNK_NRO", from: "YNK", to: "NRO", capacity: 4, headway_mins: 3, distance_km: 15, speed_limit: 100, isBiDirectional: true },
  { id: "SEC_NRO_STM", from: "NRO", to: "STM", capacity: 4, headway_mins: 4, distance_km: 30, speed_limit: 120, isBiDirectional: true },
  
  { id: "SEC_PEN_JAM", from: "PEN", to: "JAM", capacity: 4, headway_mins: 3, distance_km: 18, speed_limit: 90, isBiDirectional: true },
  { id: "SEC_JAM_ATL", from: "JAM", to: "ATL", capacity: 2, headway_mins: 4, distance_km: 15, speed_limit: 80, isBiDirectional: true },
  { id: "SEC_JAM_LIC", from: "JAM", to: "LIC", capacity: 2, headway_mins: 5, distance_km: 12, speed_limit: 70, isBiDirectional: true },
  
  { id: "SEC_PEN_SEC", from: "PEN", to: "SEC", capacity: 2, headway_mins: 4, distance_km: 8, speed_limit: 90, isBiDirectional: true },
  { id: "SEC_SEC_NWK", from: "SEC", to: "NWK", capacity: 3, headway_mins: 3, distance_km: 10, speed_limit: 100, isBiDirectional: true },
  { id: "SEC_SEC_HOB", from: "SEC", to: "HOB", capacity: 2, headway_mins: 4, distance_km: 7, speed_limit: 70, isBiDirectional: true }
];

export const TRAIN_TEMPLATES = [
  { type: "Metro-North Express", prefix: "MN-EXP", priority: 80, default_capacity: 800, base_speed: 110, category: "express", operator: "MNR" },
  { type: "Metro-North Local", prefix: "MN-LOC", priority: 50, default_capacity: 600, base_speed: 70, category: "local", operator: "MNR" },
  { type: "LIRR Express", prefix: "LI-EXP", priority: 80, default_capacity: 1000, base_speed: 100, category: "express", operator: "LIRR" },
  { type: "LIRR Local", prefix: "LI-LOC", priority: 50, default_capacity: 800, base_speed: 65, category: "local", operator: "LIRR" },
  { type: "NJT Express", prefix: "NJ-EXP", priority: 80, default_capacity: 900, base_speed: 100, category: "express", operator: "NJT" },
  { type: "NJT Local", prefix: "NJ-LOC", priority: 50, default_capacity: 700, base_speed: 65, category: "local", operator: "NJT" },
  { type: "Freight", prefix: "FRT", priority: 20, default_capacity: 0, base_speed: 50, category: "freight", operator: "CSX" },
  { type: "Maintenance", prefix: "MNT", priority: 10, default_capacity: 0, base_speed: 40, category: "maintenance", operator: "MTA" }
];

export const ROUTES = {
  "New Haven Line Express": ["GCT", "HAR", "NRO", "STM"],
  "Hudson Line Local": ["GCT", "HAR", "YNK"],
  "LIRR Ronkonkoma": ["PEN", "JAM"],
  "LIRR Atlantic": ["ATL", "JAM"],
  "NJT Northeast Corridor": ["PEN", "SEC", "NWK"],
  "NJT Hoboken Div": ["HOB", "SEC"]
};

// Generates an initial fleet based on the network and templates
export function generateInitialFleet(count = 15) {
  const fleet = [];
  const routeNames = Object.keys(ROUTES);
  
  for(let i=0; i<count; i++) {
    const routeName = routeNames[i % routeNames.length];
    const routeNodes = ROUTES[routeName];
    const template = TRAIN_TEMPLATES[i % TRAIN_TEMPLATES.length];
    const id = `${template.prefix}-${1000 + i}`;
    
    // Pick a random position along the route
    const currentIdx = Math.floor(Math.random() * (routeNodes.length - 1));
    const nextIdx = currentIdx + 1;
    
    fleet.push({
      id,
      name: `${template.type} ${1000 + i}`,
      templateType: template.type,
      operator: template.operator,
      category: template.category,
      priority: template.priority,
      route: routeNodes,
      currentStation: routeNodes[currentIdx],
      nextStation: routeNodes[nextIdx],
      progress: Math.random(), // 0 to 1 between stations
      passengers: Math.floor(Math.random() * template.default_capacity),
      maxCapacity: template.default_capacity,
      delayMinutes: Math.floor(Math.random() * 5), // Initial slight random delay
      status: "moving", // moving, stopped, held
      speed: template.base_speed
    });
  }
  return fleet;
}
