import { createClient } from '@base44/sdk';
const base44 = createClient({
  appId: '69edb95121f424a271bfe9ef',
  headers: { api_key: '93f723322d824726b9429aec5b11ab47' }
});
const trains = await base44.entities.Train.list(null, 3);
console.log('Total fetched:', trains.length);
if (trains[0]) {
  const t = trains[0];
  console.log('Sample train:');
  console.log('  train_number:', t.train_number);
  console.log('  status:', t.status);
  console.log('  latitude:', t.latitude);
  console.log('  longitude:', t.longitude);
  console.log('  next_latitude:', t.next_latitude);
  console.log('  next_longitude:', t.next_longitude);
  console.log('  speed_kmh:', t.speed_kmh);
  console.log('  route:', JSON.stringify(t.route));
  console.log('  feed_timestamp:', t.feed_timestamp);
  console.log('  arrival_at_next:', t.arrival_at_next);
  console.log('  is_dwelling:', t.is_dwelling);
  console.log('  age_seconds:', t.age_seconds);
}
