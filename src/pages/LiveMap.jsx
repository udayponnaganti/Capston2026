import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { STATIONS } from '@/lib/trainSimulation';
import { useRealTimeTrains } from '@/lib/useRealTimeTrains';
import { ArrowRight, Gauge, Users, Train, X, Zap, Activity, Wifi, WifiOff, Radio } from 'lucide-react';
import TrainStatusBadge from '@/components/admin/TrainStatusBadge';

const STATUS_COLORS = {
  on_time:   { fill: '#22d3a5', glow: '#22d3a580' },
  departed:  { fill: '#22d3a5', glow: '#22d3a580' },
  arrived:   { fill: '#3b9eff', glow: '#3b9eff80' },
  delayed:   { fill: '#f59e0b', glow: '#f59e0b80' },
  cancelled: { fill: '#ef4444', glow: '#ef444480' },
  stalled:   { fill: '#94a3b8', glow: '#94a3b840' }, // grey for stale/stalled
};

const ROUTE_LINES = [
  ['Grand Central', 'Penn Station'],
  ['Penn Station', 'Metro Square'],
  ['Metro Square', 'Grand Central'],
  ['Grand Central', 'Union Terminal'],
  ['Union Terminal', 'Riverside Hub'],
  ['Riverside Hub', 'Northfield Park'],
  ['Penn Station', 'Eastgate Junction'],
  ['Eastgate Junction', 'Grand Central'],
  ['Eastgate Junction', 'Harbor Bridge'],
  ['Harbor Bridge', 'Southport Terminal'],
  ['Penn Station', 'Westbrook Central'],
  ['Metro Square', 'Union Terminal'],
];

const REAL_MTA_STATIONS = [
  { code: 'TSQ', name: 'Times Sq-42 St', latitude: 40.7552, longitude: -73.9874, platforms: 12, zone: 'Manhattan' },
  { code: 'PEN', name: '34 St-Penn Station', latitude: 40.7503, longitude: -73.9923, platforms: 6, zone: 'Manhattan' },
  { code: 'GC', name: 'Grand Central-42 St', latitude: 40.7527, longitude: -73.9772, platforms: 8, zone: 'Manhattan' },
  { code: 'FUL', name: 'Fulton St', latitude: 40.7103, longitude: -74.0087, platforms: 8, zone: 'Manhattan' },
  { code: 'ATL', name: 'Atlantic Av-Barclays', latitude: 40.6836, longitude: -73.9788, platforms: 6, zone: 'Brooklyn' },
  { code: 'USQ', name: '14 St-Union Sq', latitude: 40.7346, longitude: -73.9904, platforms: 6, zone: 'Manhattan' },
  { code: 'W4', name: 'W 4 St-Wash Sq', latitude: 40.7323, longitude: -74.0004, platforms: 6, zone: 'Manhattan' },
];

function lerp(a, b, t) { return a + (b - a) * t; }

function getStationPos(name) {
  const s = STATIONS.find(st => st.name === name);
  return s ? [s.latitude, s.longitude] : null;
}

function createTrainIcon(status, isSelected) {
  const { fill, glow } = STATUS_COLORS[status] || STATUS_COLORS.on_time;
  const size = isSelected ? 22 : 15;
  const ring = isSelected
    ? `box-shadow:0 0 0 3px ${fill}40,0 0 14px ${glow}`
    : `box-shadow:0 0 8px ${glow}`;
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;background:${fill};border-radius:50%;border:2.5px solid white;${ring};transition:all 0.4s ease"></div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createStationIcon(isArriving) {
  if (isArriving) {
    return L.divIcon({
      html: `
        <div style="position:relative;width:20px;height:20px;display:flex;align-items:center;justify-content:center">
          <div style="position:absolute;width:20px;height:20px;border-radius:50%;background:#3b9eff30;animation:sp 1.2s ease-out infinite"></div>
          <div style="position:relative;width:10px;height:10px;background:#fff;border-radius:50%;border:2px solid #3b9eff;box-shadow:0 0 10px #3b9effcc"></div>
        </div>
        <style>@keyframes sp{0%{transform:scale(0.8);opacity:0.9}100%{transform:scale(2.2);opacity:0}}</style>
      `,
      className: '',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }
  return L.divIcon({
    html: `<div style="width:8px;height:8px;background:#fff;border-radius:50%;border:1.5px solid #3b9eff;box-shadow:0 0 4px #3b9eff60"></div>`,
    className: '',
    iconSize: [8, 8],
    iconAnchor: [4, 4],
  });
}

// ── Inner component: manages live marker layer directly on Leaflet map ─────────
function LiveTrainLayer({ trainsRef, selectedRef, onSelect }) {
  const map = useMap();
  const markersRef = useRef({});   // id → L.marker
  const stateRef   = useRef({});   // id → animation state
  const rafRef     = useRef(null);

  // ── Physics constants ───────────────────────────────────────────────────────
  // STALE_THRESHOLD: treat feed as stale after this many seconds without update
  const STALE_SECS    = 180;  
  // How many seconds to dwell at a stop before resuming animation
  const DWELL_SECS    = 15;   

  // ── rAF animation loop ──────────────────────────────────────────────────────
  useEffect(() => {
    const animate = () => {
      // CRITICAL: Use Date.now() here, NOT the rAF argument.
      // rAF passes performance.now() (ms since page load, e.g. 45000)
      // but departedAt/dwellUntil use Date.now()/1000 (Unix timestamp, e.g. 1715200000)
      // Mixing the two makes elapsed always hugely negative → trains never move.
      const nowSecs = Date.now() / 1000;

      Object.entries(stateRef.current).forEach(([id, s]) => {
        const marker = markersRef.current[id];
        if (!marker) return;

        // ── Dwell at station ───────────────────────────────────────────────
        if (s.dwellUntil && nowSecs < s.dwellUntil) return;

        // ── No destination or stale ────────────────────────────────────────
        if (!s.nextLat || !s.nextLng) return;
        if (s.stale) return;

        // ── Time-based progress ────────────────────────────────────────────
        // We want the train to reach nextLat/nextLng by arrivalAt.
        // If arrivalAt unknown, interpolate over a fixed window.
        const travelWindow = s.arrivalAt ? (s.arrivalAt - s.departedAt) : 45; // seconds
        const elapsed      = nowSecs - s.departedAt;
        const rawT         = travelWindow > 0 ? Math.min(elapsed / travelWindow, 1) : 1;

        // Ease-in-out for smooth decel/accel around stations
        const t = rawT < 0.5
          ? 2 * rawT * rawT
          : 1 - (-2 * rawT + 2) ** 2 / 2;

        const lat = s.fromLat + (s.nextLat - s.fromLat) * t;
        const lng = s.fromLng + (s.nextLng - s.fromLng) * t;
        marker.setLatLng([lat, lng]);

        // When arrived, dwell then RE-QUEUE same target to keep animating
        // until feed gives a new position. fromLat/Lng stay at feed position.
        if (rawT >= 1) {
          s.dwellUntil = nowSecs + (s.isDwelling ? DWELL_SECS : 5);
          // Don't update fromLat/Lng here — keep the feed anchor unchanged
          // Just clear nextLat so the tick loop can re-queue it
          s.nextLat = null;
          s.nextLng = null;
        }
      });

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Sync markers from feed every 500ms ─────────────────────────────────────
  useEffect(() => {
    const tick = setInterval(() => {
      const trains  = trainsRef.current;
      const sel     = selectedRef.current;
      if (!trains.length) return;

      const nowSecs = Date.now() / 1000;
      const seen    = new Set();

      trains.forEach(train => {
        const id   = train.train_number;
        seen.add(id);

        // ── Staleness check ──────────────────────────────────────────────
        const ageSecs  = train.age_seconds ?? (nowSecs - (train.feed_timestamp ?? nowSecs));
        const isStale  = ageSecs > STALE_SECS;
        const effStatus = isStale ? 'stalled' : train.status;

        // ── Create marker if new ─────────────────────────────────────────
        if (!markersRef.current[id]) {
          const marker = L.marker([train.latitude, train.longitude], {
            icon: createTrainIcon(effStatus, sel === id),
            zIndexOffset: sel === id ? 1000 : 0,
          }).addTo(map);

          marker.on('click', () => onSelect(id));
          marker.bindPopup(buildPopup(train, effStatus), { className: 'train-popup' });
          markersRef.current[id] = marker;

          // Init physics state
          // feedLat/feedLng = what the GTFS feed reported (never changes with animation)
          // fromLat/fromLng = animation start point (stays at feedLat/feedLng)
          stateRef.current[id] = {
            feedLat:    train.latitude,
            feedLng:    train.longitude,
            fromLat:    train.latitude,
            fromLng:    train.longitude,
            nextLat:    train.next_latitude,
            nextLng:    train.next_longitude,
            departedAt: nowSecs,
            arrivalAt:  train.arrival_at_next,
            isDwelling: train.is_dwelling,
            dwellUntil: train.is_dwelling ? nowSecs + DWELL_SECS : null,
            stale:      isStale,
          };
        } else {
          const s = stateRef.current[id];

          // ── Detect REAL feed position change (compare against feedLat, not animation pos)
          const feedMoved = Math.abs(train.latitude  - s.feedLat) > 0.00005 ||
                            Math.abs(train.longitude - s.feedLng) > 0.00005;

          if (feedMoved) {
            // Feed reported a new stop — snap anchor and restart animation
            s.feedLat    = train.latitude;
            s.feedLng    = train.longitude;
            s.fromLat    = train.latitude;
            s.fromLng    = train.longitude;
            s.nextLat    = train.next_latitude;
            s.nextLng    = train.next_longitude;
            s.departedAt = nowSecs;
            s.arrivalAt  = train.arrival_at_next;
            s.isDwelling = train.is_dwelling;
            s.stale      = isStale;
            s.dwellUntil = train.is_dwelling ? nowSecs + DWELL_SECS : null;
          } else if (s.nextLat == null && train.next_latitude) {
            // Animation finished dwell — re-queue the same next target to keep moving
            // (train is still between same two stops per feed)
            s.fromLat    = s.feedLat;          // reset anim start to feed anchor
            s.fromLng    = s.feedLng;
            s.nextLat    = train.next_latitude;
            s.nextLng    = train.next_longitude;
            s.departedAt = nowSecs;
            s.arrivalAt  = train.arrival_at_next; // may be null — falls back to 45s window
          }

          s.stale = isStale;

          // ── Update icon if status/selection changed ───────────────────────
          markersRef.current[id].setIcon(createTrainIcon(effStatus, sel === id));
          markersRef.current[id].setZIndexOffset(sel === id ? 1000 : 0);
          markersRef.current[id].setPopupContent(buildPopup(train, effStatus));
        }
      });

      // ── Remove markers for trains that left the feed ─────────────────────
      Object.keys(markersRef.current).forEach(id => {
        if (!seen.has(id)) {
          map.removeLayer(markersRef.current[id]);
          delete markersRef.current[id];
          delete stateRef.current[id];
        }
      });
    }, 500);
    return () => clearInterval(tick);
  }, [map, trainsRef, selectedRef, onSelect]);

  return null;
}

function buildPopup(train, effStatus) {
  const statusColor = STATUS_COLORS[effStatus]?.fill || '#fff';
  return `
    <div style="background:#0d1424;color:#e2e8f0;padding:10px;border-radius:8px;min-width:180px;font-family:sans-serif">
      <div style="font-weight:700;font-size:13px">${train.name}</div>
      <div style="font-size:10px;color:#3b9eff;font-family:monospace;margin-top:2px">${train.train_number}</div>
      <div style="font-size:11px;margin-top:6px;color:#94a3b8">${train.current_station} → ${train.next_station}</div>
      <div style="margin-top:6px;display:flex;gap:10px">
        <span style="font-size:11px;color:#e2e8f0">${train.speed_kmh} km/h</span>
        <span style="font-size:11px;color:${statusColor}">${train.status_label || train.status}</span>
      </div>
      ${train.delay_minutes > 0 ? `<div style="font-size:10px;color:#f59e0b;margin-top:3px">+${train.delay_minutes} min delay</div>` : ''}
    </div>
  `;
}

// ── Station layer (static) ─────────────────────────────────────────────────────
function StationLayer({ trains, isMtaLive, onStationClick }) {
  const arrivingStations = new Set(
    trains.filter(t => t.status === 'arrived').map(t => t.current_station)
  );

  const stationsToRender = isMtaLive ? REAL_MTA_STATIONS : STATIONS;

  return (
    <>
      {stationsToRender.map(station => (
        <Marker
          key={station.code}
          position={[station.latitude, station.longitude]}
          icon={createStationIcon(arrivingStations.has(station.name))}
          eventHandlers={{ click: () => onStationClick && onStationClick(station) }}
        >
          <Popup>
            <div style={{ background: '#0d1424', color: '#e2e8f0', padding: '8px', borderRadius: 8, minWidth: 140, fontFamily: 'sans-serif' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{station.name}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Code: {station.code}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Platforms: {station.platforms} · Zone: {station.zone}</div>
            </div>
          </Popup>
        </Marker>
      ))}
      {!isMtaLive && ROUTE_LINES.map(([from, to], i) => {
        const a = getStationPos(from);
        const b = getStationPos(to);
        if (!a || !b) return null;
        return (
          <Polyline key={i} positions={[a, b]}
            pathOptions={{ color: '#3b9eff', weight: 1.5, opacity: 0.25, dashArray: '6 4' }} />
        );
      })}
    </>
  );
}

// ── Main LiveMap Component ─────────────────────────────────────────────────────
export default function LiveMap() {
  const { trains, syncStatus } = useRealTimeTrains();
  const [selected, setSelected] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [shapes, setShapes] = useState({});
  const trainsRef = useRef([]);
  const selectedRef = useRef(null);
  const [showAiRoute, setShowAiRoute] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // Keep refs in sync with live API data
  useEffect(() => { trainsRef.current = trains; }, [trains]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  useEffect(() => {
    fetch('/shapes.json')
      .then(res => res.json())
      .then(data => setShapes(data))
      .catch(err => console.warn('Failed to load shapes:', err));
  }, []);

  const handleSelect = useCallback((id) => {
    setSelected(prev => prev === id ? null : id);
    setSelectedStation(null); // Clear station if train selected
    setShowAiRoute(false);
  }, []);

  const handleStationSelect = useCallback((station) => {
    setSelectedStation(prev => prev?.code === station.code ? null : station);
    setSelected(null); // Clear train if station selected
    setShowAiRoute(false);
  }, []);

  const [aiReducedDelay, setAiReducedDelay] = useState({});

  const handleSimulateReroute = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      setShowAiRoute(false);
      
      // Simulate reroute by applying a delay reduction to the specific train
      const train = trains.find(t => t.train_number === selected);
      if (train) {
        const reduction = Math.round(train.delay_minutes * 0.6);
        setAiReducedDelay(prev => ({
          ...prev,
          [train.train_number]: (prev[train.train_number] || 0) + reduction
        }));
      }
    }, 2000);
  };

  const activeTrains = trains.map(t => {
    if (aiReducedDelay[t.train_number]) {
      const newDelay = Math.max(0, t.delay_minutes - aiReducedDelay[t.train_number]);
      return { ...t, delay_minutes: newDelay, status: newDelay === 0 ? 'on_time' : 'delayed' };
    }
    return t;
  });

  const selectedTrain = activeTrains.find(t => t.train_number === selected);
  const occupancy = selectedTrain && selectedTrain.capacity > 0
    ? Math.round((selectedTrain.passenger_count / selectedTrain.capacity) * 100) : 0;

  return (
    <div className="relative h-screen w-full">
      <MapContainer
        center={[40.73, -73.99]}
        zoom={12}
        style={{ height: '100%', width: '100%', background: '#0a0f1e' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com">CARTO</a>'
        />
        <StationLayer trains={activeTrains} isMtaLive={syncStatus === 'live'} onStationClick={handleStationSelect} />
        {/* Render authentic GTFS shapes if available */}
        {syncStatus === 'live' && Object.entries(shapes).map(([shapeId, shapeData]) => (
          <Polyline 
            key={shapeId} 
            positions={shapeData.path}
            pathOptions={{ color: shapeData.color, weight: 1.5, opacity: 0.15 }} 
          />
        ))}
        <LiveTrainLayer trainsRef={trainsRef} selectedRef={selectedRef} onSelect={handleSelect} />
      </MapContainer>

      {/* Live badge with API sync status */}
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2">
        <div className="glass rounded-full px-3 py-1.5 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-live-pulse" />
          <span className="text-xs font-mono text-foreground">LIVE · {trains.length} trains</span>
        </div>
        <div className={`glass rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs font-mono ${
          syncStatus === 'live'     ? 'text-emerald-400' :
          syncStatus === 'offline'  ? 'text-yellow-400'  : 'text-blue-400'
        }`}>
          {syncStatus === 'live'     ? <Wifi className="w-3 h-3" /> :
           syncStatus === 'offline'  ? <WifiOff className="w-3 h-3" /> :
                                       <span className="w-3 h-3 border border-current rounded-full animate-spin inline-block" />}
          {syncStatus === 'live'     ? 'GTFS-RT Live' :
           syncStatus === 'offline'  ? 'Local Sim' : 'Connecting...'}
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 left-6 z-[1000] glass rounded-xl p-3 space-y-1.5">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Train Status</p>
        {[
          { label: 'On Time',   color: '#22d3a5' },
          { label: 'Delayed',   color: '#f59e0b' },
          { label: 'Cancelled', color: '#ef4444' },
          { label: 'Arrived',   color: '#3b9eff' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border border-white/30" style={{ background: color, boxShadow: `0 0 6px ${color}80` }} />
            <span className="text-xs text-foreground">{label}</span>
          </div>
        ))}
        <div className="border-t border-border mt-2 pt-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-0 border-t-2 border-dashed border-primary/50" />
            <span className="text-xs text-foreground">Rail Line</span>
          </div>
        </div>
      </div>

      {/* Real-time fleet panel (bottom right) */}
      <div className="absolute bottom-6 right-4 z-[1000] glass rounded-xl overflow-hidden w-64">
        <div className="px-3 py-2 border-b border-border flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs font-semibold text-foreground">Live Fleet Status</span>
          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent animate-live-pulse" />
        </div>
        <div className="max-h-52 overflow-y-auto divide-y divide-border">
          {activeTrains.map(train => {
            const { fill } = STATUS_COLORS[train.status] || STATUS_COLORS.on_time;
            const occ = train.capacity > 0 ? Math.round((train.passenger_count / train.capacity) * 100) : null;
            return (
              <button
                key={train.train_number}
                onClick={() => handleSelect(train.train_number)}
                className={`w-full text-left px-3 py-2 hover:bg-secondary transition-all ${selected === train.train_number ? 'bg-secondary' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: fill, boxShadow: `0 0 5px ${fill}` }} />
                  <span className="text-xs font-mono font-bold text-foreground">{train.train_number}</span>
                  <span className="text-xs text-muted-foreground truncate ml-1">{train.name}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 ml-4">
                  <span className="text-xs font-mono" style={{ color: fill }}>{train.speed_kmh} km/h</span>
                  {train.delay_minutes > 0 && (
                    <span className="text-xs text-yellow-400 font-mono">+{train.delay_minutes}m</span>
                  )}
                  {occ !== null && (
                    <span className={`text-xs font-mono ${occ > 85 ? 'text-red-400' : 'text-muted-foreground'}`}>
                      {occ}% full
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected train detail panel */}
      {selectedTrain && (
        <div className="absolute top-4 right-4 z-[1000] w-72 glass rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-bold text-foreground">{selectedTrain.name}</div>
              <div className="text-xs font-mono text-primary">{selectedTrain.train_number}</div>
            </div>
            <button onClick={() => setSelected(null)} className="p-1 hover:bg-secondary rounded">
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>

          <TrainStatusBadge status={selectedTrain.status} />

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>{selectedTrain.origin}</span>
            <ArrowRight className="w-3 h-3" />
            <span>{selectedTrain.destination}</span>
          </div>

          {/* Live metrics */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center rounded-lg bg-secondary p-2">
              <div className="text-xs font-mono font-bold text-primary">{selectedTrain.speed_kmh}</div>
              <div className="text-xs text-muted-foreground">km/h</div>
            </div>
            <div className="text-center rounded-lg bg-secondary p-2">
              <div className={`text-xs font-mono font-bold ${selectedTrain.delay_minutes > 0 ? 'text-warning' : 'text-accent'}`}>
                {selectedTrain.delay_minutes > 0 ? `+${selectedTrain.delay_minutes}m` : 'On time'}
              </div>
              <div className="text-xs text-muted-foreground">Delay</div>
            </div>
            <div className="text-center rounded-lg bg-secondary p-2">
              <div className="text-xs font-mono font-bold text-foreground">P{selectedTrain.platform}</div>
              <div className="text-xs text-muted-foreground">Platform</div>
            </div>
          </div>

          {/* Current segment */}
          <div className="rounded-lg bg-secondary px-3 py-2 text-xs">
            <div className="text-muted-foreground mb-1">Current Segment</div>
            <div className="flex items-center gap-1 text-foreground font-medium">
              <span>{selectedTrain.current_station}</span>
              <ArrowRight className="w-3 h-3 text-primary" />
              <span>{selectedTrain.next_station}</span>
            </div>
          </div>

          {/* Occupancy bar */}
          {selectedTrain.capacity && (
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Occupancy</span>
                <span className="font-mono">{selectedTrain.passenger_count} / {selectedTrain.capacity} ({occupancy}%)</span>
              </div>
              <div className="w-full h-2 bg-secondary rounded-full">
                <div
                  className={`h-2 rounded-full transition-all duration-1000 ${occupancy > 85 ? 'bg-destructive' : occupancy > 60 ? 'bg-warning' : 'bg-accent'}`}
                  style={{ width: `${Math.min(occupancy, 100)}%` }}
                />
              </div>
            </div>
          )}
          {/* Route timeline */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Route</p>
            <div className="space-y-1 max-h-32 overflow-auto">
              {selectedTrain.route?.map((station, i) => {
                const current = station === selectedTrain.current_station;
                const passed = selectedTrain.route.indexOf(selectedTrain.current_station) > i;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${current ? 'bg-primary animate-live-pulse' : passed ? 'bg-accent' : 'bg-secondary border border-border'}`} />
                    <span className={`text-xs ${current ? 'text-primary font-medium' : passed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{station}</span>
                    {current && <span className="text-xs text-primary ml-auto">← now</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Alternative Routing Panel */}
          {selectedTrain.delay_minutes > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              {!showAiRoute ? (
                <button 
                  onClick={() => setShowAiRoute(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-accent/10 border border-accent/30 text-accent text-xs font-bold hover:bg-accent hover:text-accent-foreground transition-all"
                >
                  <Zap className="w-3.5 h-3.5" fill="currentColor" />
                  AI Suggest Alternate Route
                </button>
              ) : (
                <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-2 text-accent text-xs font-bold">
                    <Zap className="w-3.5 h-3.5" fill="currentColor" />
                    AI Reroute Analysis
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">
                    Switching this train to the parallel express track will bypass congestion ahead and decrease delay by <span className="font-bold text-emerald-400">{(selectedTrain.delay_minutes * 0.6).toFixed(0)} mins</span>.
                  </p>
                  <button 
                    onClick={handleSimulateReroute}
                    disabled={isSimulating}
                    className="w-full py-1.5 rounded bg-accent text-accent-foreground text-xs font-bold disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    {isSimulating ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : null}
                    {isSimulating ? 'Simulating...' : 'Execute Reroute Simulation'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Selected Station Panel */}
      {selectedStation && (
        <div className="absolute top-4 right-4 z-[1000] w-72 glass rounded-xl p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-bold text-foreground">{selectedStation.name}</div>
              <div className="text-xs font-mono text-primary">Station Code: {selectedStation.code}</div>
            </div>
            <button onClick={() => setSelectedStation(null)} className="p-1 hover:bg-secondary rounded">
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-secondary p-2 text-center">
              <div className="text-sm font-bold text-foreground">{(selectedStation.code.length * 47) % 200 + 150}</div>
              <div className="text-[10px] uppercase text-muted-foreground">Trains Today</div>
            </div>
            <div className="rounded-lg bg-secondary p-2 text-center">
              <div className="text-sm font-mono text-foreground">{selectedStation.platforms || 2}</div>
              <div className="text-[10px] uppercase text-muted-foreground">Platforms</div>
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Live Approaching Trains</div>
            <div className="space-y-2">
              {activeTrains
                .filter(t => t.next_station === selectedStation.name || t.current_station === selectedStation.name)
                .slice(0, 4)
                .map(t => (
                  <div key={t.train_number} className="flex items-center justify-between bg-secondary/50 rounded p-2 border border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[t.status]?.fill || '#fff' }} />
                      <div>
                        <div className="text-xs font-bold text-foreground truncate max-w-[100px]">{t.train_number}</div>
                        <div className="text-[10px] text-muted-foreground">{t.delay_minutes > 0 ? `+${t.delay_minutes}m delay` : 'On time'}</div>
                      </div>
                    </div>
                    <div className="text-xs font-mono">{t.speed_kmh || 45} km/h</div>
                  </div>
              ))}
              {activeTrains.filter(t => t.next_station === selectedStation.name || t.current_station === selectedStation.name).length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-2">No trains currently approaching.</div>
              )}
            </div>
          </div>
          
          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Last Departure</span>
              <span className="font-mono text-foreground">Just now</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}