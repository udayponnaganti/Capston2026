/**
 * firebaseSync.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Syncs Base44 simulation data → Firebase Firestore in real-time.
 *
 * ✅ SAFE: Does NOT touch any Base44 entity calls or existing features.
 * ✅ Runs independently alongside the existing simulation tick.
 * ✅ Syncs: Trains · Stations · Alerts · TrainLogs · NetworkStats
 *
 * Usage (in any component or App.jsx):
 *   import { startFirebaseSync, stopFirebaseSync } from '@/lib/firebaseSync';
 *   useEffect(() => { startFirebaseSync(); return () => stopFirebaseSync(); }, []);
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  db,
  setDocument,
  addDocument,
  getDocuments,
} from '@/firebase';
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { simulateTrainStates, getNetworkStats, STATIONS } from './trainSimulation';
import { base44 } from '@/api/base44Client';

// ─── State ────────────────────────────────────────────────────────────────────
let syncInterval = null;
let localTick = 0;
let stationsSeeded = false;
let isSyncing = false;

// ─────────────────────────────────────────────────────────────────────────────
//  STATIONS — seed once on startup (static data)
// ─────────────────────────────────────────────────────────────────────────────
async function seedStationsToFirebase() {
  if (stationsSeeded) return;
  try {
    const existing = await getDocuments('stations');
    if (existing.length > 0) {
      stationsSeeded = true;
      console.log('[FirebaseSync] Stations already in Firestore ✓');
      return;
    }

    const batch = writeBatch(db);
    STATIONS.forEach((station) => {
      const ref = doc(db, 'stations', station.code);
      batch.set(ref, {
        ...station,
        platforms_occupied: 0,
        syncedAt: serverTimestamp(),
      });
    });
    await batch.commit();
    stationsSeeded = true;
    console.log(`[FirebaseSync] ✅ Seeded ${STATIONS.length} stations to Firestore`);
  } catch (err) {
    console.warn('[FirebaseSync] Station seed failed:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TRAINS — batch upsert every sync cycle
// ─────────────────────────────────────────────────────────────────────────────
async function syncTrainsToFirebase(tick) {
  try {
    const trains = simulateTrainStates(tick);
    const batch = writeBatch(db);

    trains.forEach((train) => {
      const ref = doc(db, 'trains', train.train_number);
      batch.set(ref, {
        train_number:      train.train_number,
        name:              train.name,
        status:            train.status,
        current_station:   train.current_station,
        next_station:      train.next_station,
        origin:            train.origin,
        destination:       train.destination,
        latitude:          train.latitude,
        longitude:         train.longitude,
        speed_kmh:         train.speed_kmh,
        delay_minutes:     train.delay_minutes,
        scheduled_arrival: train.scheduled_arrival,
        estimated_arrival: train.estimated_arrival,
        platform:          train.platform,
        route:             train.route,
        passenger_count:   train.passenger_count,
        capacity:          train.capacity,
        type:              train.type,
        syncedAt:          serverTimestamp(),
      }, { merge: true });
    });

    await batch.commit();
    console.log(`[FirebaseSync] ✅ Synced ${trains.length} trains (tick ${tick})`);
    return trains;
  } catch (err) {
    console.warn('[FirebaseSync] Train sync failed:', err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  ALERTS — pull from Base44 and mirror to Firestore
// ─────────────────────────────────────────────────────────────────────────────
async function syncAlertsToFirebase() {
  try {
    const apiAlerts = await base44.entities.Alert.list('-created_date', 20);
    if (!apiAlerts?.length) return;

    const batch = writeBatch(db);
    apiAlerts.forEach((alert) => {
      const ref = doc(db, 'alerts', alert.id || String(alert.title).replace(/\s/g, '_'));
      batch.set(ref, {
        id:            alert.id,
        title:         alert.title,
        description:   alert.description || '',
        severity:      alert.severity || 'info',
        type:          alert.type || '',
        train_number:  alert.train_number || '',
        station:       alert.station || '',
        ai_suggestion: alert.ai_suggestion || '',
        impact:        alert.impact || '',
        resolved:      alert.resolved || false,
        syncedAt:      serverTimestamp(),
      }, { merge: true });
    });
    await batch.commit();
    console.log(`[FirebaseSync] ✅ Synced ${apiAlerts.length} alerts`);
  } catch (err) {
    // Alerts sync is optional — silent fail
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  NETWORK STATS — summary snapshot every sync cycle
// ─────────────────────────────────────────────────────────────────────────────
async function syncNetworkStats(trains) {
  try {
    const stats = getNetworkStats(trains);
    await setDoc(doc(db, 'network_stats', 'live'), {
      ...stats,
      timestamp: new Date().toISOString(),
      syncedAt:  serverTimestamp(),
    });
  } catch (err) {
    // Silent fail
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TRAIN LOGS — pull from Base44 and mirror to Firestore
// ─────────────────────────────────────────────────────────────────────────────
async function syncTrainLogsToFirebase() {
  try {
    const logs = await base44.entities.TrainLog.list('-created_date', 50);
    if (!logs?.length) return;

    const batch = writeBatch(db);
    logs.forEach((log) => {
      const ref = doc(db, 'train_logs', log.id || `${log.train_number}_${log.event_type}_${Date.now()}`);
      batch.set(ref, {
        id:            log.id,
        train_number:  log.train_number,
        event_type:    log.event_type,
        station:       log.station || '',
        details:       log.details || '',
        delay_minutes: log.delay_minutes || 0,
        speed_kmh:     log.speed_kmh || 0,
        timestamp:     log.timestamp || new Date().toISOString(),
        syncedAt:      serverTimestamp(),
      }, { merge: true });
    });
    await batch.commit();
    console.log(`[FirebaseSync] ✅ Synced ${logs.length} train logs`);
  } catch (err) {
    // Silent fail — logs are optional
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN SYNC CYCLE
// ─────────────────────────────────────────────────────────────────────────────
async function runSyncCycle() {
  if (isSyncing) return;
  isSyncing = true;
  localTick += 1;

  try {
    // 1. Seed stations once
    await seedStationsToFirebase();

    // 2. Sync live train positions
    const trains = await syncTrainsToFirebase(localTick);

    // 3. Sync network summary
    if (trains.length > 0) await syncNetworkStats(trains);

    // 4. Sync alerts every 5 cycles (~15s)
    if (localTick % 5 === 0) await syncAlertsToFirebase();

    // 5. Sync train logs every 10 cycles (~30s)
    if (localTick % 10 === 0) await syncTrainLogsToFirebase();

  } catch (err) {
    console.warn('[FirebaseSync] Cycle error:', err.message);
  } finally {
    isSyncing = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start syncing Base44 simulation data to Firebase every 3 seconds.
 * Safe to call multiple times — will not start duplicate intervals.
 */
export function startFirebaseSync() {
  if (syncInterval) return; // already running
  console.log('[FirebaseSync] 🚀 Starting Firebase sync (every 3s)...');
  runSyncCycle(); // immediate first run
  syncInterval = setInterval(runSyncCycle, 3000);
}

/**
 * Stop the Firebase sync interval.
 */
export function stopFirebaseSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[FirebaseSync] 🛑 Sync stopped.');
  }
}

/**
 * Force a one-time manual sync right now.
 */
export async function forceSyncNow() {
  console.log('[FirebaseSync] ⚡ Manual sync triggered');
  await runSyncCycle();
}
