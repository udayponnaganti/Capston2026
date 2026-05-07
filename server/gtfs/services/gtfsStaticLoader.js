import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import AdmZip from 'adm-zip';
import csvParser from 'csv-parser';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GTFS_URL = 'https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip';
const STATIC_DIR = path.join(__dirname, '../static');
const ZIP_PATH = path.join(STATIC_DIR, 'gtfs.zip');

const CACHE = {
  stopsById: new Map(),
  routesById: new Map(),
  tripsById: new Map(),
  shapesById: new Map(),
  isLoaded: false
};

async function downloadGtfs() {
  console.log('Downloading GTFS Static data...');
  const res = await fetch(GTFS_URL);
  if (!res.ok) throw new Error('Failed to fetch GTFS: ' + res.statusText);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(ZIP_PATH, Buffer.from(buffer));
  console.log('Download complete. Extracting...');
  
  const zip = new AdmZip(ZIP_PATH);
  zip.extractAllTo(STATIC_DIR, true);
  console.log('Extraction complete.');
}

function parseCsv(filename, onRow) {
  return new Promise((resolve, reject) => {
    const filepath = path.join(STATIC_DIR, filename);
    if (!fs.existsSync(filepath)) {
      console.warn('Missing file: ' + filename);
      return resolve();
    }
    fs.createReadStream(filepath)
      .pipe(csvParser())
      .on('data', onRow)
      .on('end', resolve)
      .on('error', reject);
  });
}

export async function loadStaticGtfs(forceDownload = false) {
  if (CACHE.isLoaded && !forceDownload) return CACHE;

  if (forceDownload || !fs.existsSync(path.join(STATIC_DIR, 'stops.txt'))) {
    await downloadGtfs();
  }

  console.log('Parsing stops.txt...');
  CACHE.stopsById.clear();
  await parseCsv('stops.txt', row => {
    CACHE.stopsById.set(row.stop_id, {
      name: row.stop_name,
      lat: parseFloat(row.stop_lat),
      lon: parseFloat(row.stop_lon)
    });
  });

  console.log('Parsing routes.txt...');
  CACHE.routesById.clear();
  await parseCsv('routes.txt', row => {
    CACHE.routesById.set(row.route_id, {
      name: row.route_long_name || row.route_short_name,
      color: row.route_color ? '#' + row.route_color : '#3b9eff',
      type: row.route_type
    });
  });

  console.log('Parsing trips.txt...');
  CACHE.tripsById.clear();
  await parseCsv('trips.txt', row => {
    CACHE.tripsById.set(row.trip_id, {
      route_id: row.route_id,
      service_id: row.service_id,
      shape_id: row.shape_id,
      direction_id: row.direction_id
    });
  });

  console.log('Parsing shapes.txt... (This might take a moment)');
  CACHE.shapesById.clear();
  await parseCsv('shapes.txt', row => {
    const shapeId = row.shape_id;
    if (!CACHE.shapesById.has(shapeId)) {
      CACHE.shapesById.set(shapeId, []);
    }
    // We expect them to be roughly ordered by shape_pt_sequence in the file, 
    // but just pushing is fine for now, we can sort later if needed.
    CACHE.shapesById.get(shapeId).push({
      lat: parseFloat(row.shape_pt_lat),
      lon: parseFloat(row.shape_pt_lon),
      seq: parseInt(row.shape_pt_sequence, 10)
    });
  });

  // Sort shapes by sequence
  for (const [shapeId, points] of CACHE.shapesById.entries()) {
    points.sort((a, b) => a.seq - b.seq);
  }

  CACHE.isLoaded = true;
  console.log('GTFS Static data fully loaded into memory.');
  return CACHE;
}

export function getStaticData() {
  return CACHE;
}
