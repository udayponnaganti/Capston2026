import { loadStaticGtfs } from './gtfs/services/gtfsStaticLoader.js';
import { normalizeTrains } from './gtfs/services/trainNormalizer.js';

async function runTests() {
  console.log('--- Running GTFS Backend Tests ---');
  
  try {
    const data = await loadStaticGtfs(false);
    
    // Test 1: Route Matching
    console.log('\\n[Test 1] Verifying Static Data Structures');
    if (data.routesById.size === 0) throw new Error('Failed to parse routes.txt');
    if (data.tripsById.size === 0) throw new Error('Failed to parse trips.txt');
    if (data.stopsById.size === 0) throw new Error('Failed to parse stops.txt');
    if (data.shapesById.size === 0) throw new Error('Failed to parse shapes.txt');
    console.log('✅ Static data structures populated successfully.');

    // Mock entity
    const mockEntities = [{
      vehicle: {
        trip: { tripId: Array.from(data.tripsById.keys())[0] }, // Grab a real trip ID
        position: { latitude: 40.75, longitude: -73.98, speed: 10 },
        stopId: Array.from(data.stopsById.keys())[0]
      }
    }];

    // Test 2: Normalization
    console.log('\\n[Test 2] Verifying Train Normalization');
    const trains = normalizeTrains(mockEntities);
    
    if (trains.length === 0) throw new Error('Normalization failed to produce a train');
    const t = trains[0];
    
    if (!t.route_id) throw new Error('Missing route_id');
    if (!t.shape_id) throw new Error('Missing shape_id mapping');
    if (t.occupancy !== null) throw new Error('Fake occupancy was not removed');
    
    console.log('✅ Train normalized correctly:');
    console.log('   Route: ' + t.route_id + ', Shape: ' + t.shape_id + ', Occupancy: ' + t.occupancy);
    
    console.log('\\nAll tests passed successfully!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

runTests();
