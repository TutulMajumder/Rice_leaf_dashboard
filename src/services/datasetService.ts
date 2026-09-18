import fs from 'node:fs';
import path from 'node:path';
import { DATASET_DIR, IMAGES_DIR, METADATA_CSV, SENSOR_DATA_JSON } from '../config';
import { DatasetEntry } from '../types';
import { calculateMoisturePercent, latestForNode } from './telemetryService';

const headers = ['sample_id', 'timestamp', 'node_id', 'crop_type', 'growth_stage', 'disease_label', 'severity', 'confidence', 'gps_latitude', 'gps_longitude', 'gps_altitude', 'image_filename', 'temperature_c', 'humidity_pct', 'soil_temperature_c', 'soil_moisture_raw', 'soil_moisture_pct', 'voltage_v', 'current_ma', 'power_mw', 'notes'];

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if (char === '\n' && !quoted) { row.push(field); rows.push(row); row = []; field = ''; }
    else if (char !== '\r') field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(item => item.some(value => value.length > 0));
}

function ensureDatasetFiles(): void {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  if (!fs.existsSync(METADATA_CSV)) fs.writeFileSync(METADATA_CSV, `${headers.join(',')}\n`, 'utf8');
  if (!fs.existsSync(SENSOR_DATA_JSON)) fs.writeFileSync(SENSOR_DATA_JSON, '[]\n', 'utf8');
}

export function listEntries(): DatasetEntry[] {
  ensureDatasetFiles();
  const rows = parseCsv(fs.readFileSync(METADATA_CSV, 'utf8'));
  const columnNames = rows.shift() ?? headers;
  return rows.map(values => {
    const entry = Object.fromEntries(columnNames.map((key, index) => [key, values[index] ?? ''])) as unknown as DatasetEntry;
    entry.image_url = `/dataset-images/${encodeURIComponent(entry.image_filename)}`;
    return entry;
  }).reverse();
}

export function createEntry(fields: Record<string, string>, imageFilename?: string): DatasetEntry {
  ensureDatasetFiles();
  const nodeId = fields.node_id || 'FIELD_NODE_01';
  const telemetry = latestForNode(nodeId);
  if (!telemetry) throw new Error(`No live telemetry available for node ${nodeId}`);
  const numberOr = (key: string, fallback: number): number => {
    const value = Number(fields[key]);
    return Number.isFinite(value) ? value : fallback;
  };
  const latitude = numberOr('gps_latitude', Number.NaN);
  const longitude = numberOr('gps_longitude', Number.NaN);
  const altitude = numberOr('gps_altitude', Number.NaN);
  if (![latitude, longitude, altitude].every(Number.isFinite)) throw new Error('Phone GPS latitude, longitude, and altitude are required');
  const moistureRaw = telemetry.soil_moisture;
  const voltage = telemetry.voltage;
  const current = telemetry.current;
  const entry: DatasetEntry = {
    sample_id: `AGRI_SMP_${Date.now().toString().slice(-8)}`,
    timestamp: fields.timestamp || new Date().toISOString(), node_id: nodeId,
    crop_type: fields.crop_type || 'Rice (Oryza sativa)', growth_stage: fields.growth_stage || 'Vegetative',
    disease_label: fields.disease_label || 'Healthy', severity: fields.severity || '0%', confidence: fields.confidence || '0.95',
    gps_latitude: latitude, gps_longitude: longitude, gps_altitude: altitude,
    image_filename: imageFilename || fields.sample_preset_image || '',
    temperature_c: telemetry.temperature, humidity_pct: telemetry.humidity,
    soil_temperature_c: telemetry.soil_temperature, soil_moisture_raw: moistureRaw,
    soil_moisture_pct: calculateMoisturePercent(moistureRaw), voltage_v: voltage, current_ma: current,
    power_mw: Number((voltage * current).toFixed(2)), notes: fields.notes || 'Rice leaf captured in Rajshahi field'
  };
  fs.appendFileSync(METADATA_CSV, `${headers.map(key => csvEscape(entry[key as keyof DatasetEntry])).join(',')}\n`, 'utf8');
  const jsonEntries = JSON.parse(fs.readFileSync(SENSOR_DATA_JSON, 'utf8')) as unknown[];
  jsonEntries.push(entry);
  fs.writeFileSync(SENSOR_DATA_JSON, JSON.stringify(jsonEntries, null, 2), 'utf8');
  return { ...entry, image_url: `/dataset-images/${encodeURIComponent(entry.image_filename)}` };
}

export function datasetCsvPath(): string { return path.resolve(METADATA_CSV); }
export function datasetJsonPath(): string { return path.resolve(SENSOR_DATA_JSON); }
export { DATASET_DIR };
