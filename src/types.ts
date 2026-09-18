export interface TelemetryPayload {
  node_id?: string;
  temperature?: number | string | null;
  humidity?: number | string | null;
  soil_temperature?: number | string | null;
  soil_moisture?: number | string | null;
  voltage?: number | string | null;
  current?: number | string | null;
  rssi?: number;
  ina219_status?: string;
  ina219_error?: boolean;
}

export interface Diagnostics {
  dht22: string;
  ds18b20: string;
  ina219: string;
  moisture: string;
  overall: string;
  alerts: Array<{ sensor: string; error: string; fix: string }>;
}

export interface TelemetryRecord {
  node_id: string;
  timestamp: string;
  temperature: number | string;
  humidity: number | string;
  soil_temperature: number;
  soil_moisture: number;
  soil_moisture_pct: number;
  voltage: number;
  current: number;
  power_mw: number;
  rssi: number;
  diagnostics: Diagnostics;
  last_seen: number;
}

export interface DatasetEntry {
  sample_id: string;
  timestamp: string;
  node_id: string;
  crop_type: string;
  growth_stage: string;
  disease_label: string;
  severity: string;
  confidence: string;
  gps_latitude: number;
  gps_longitude: number;
  gps_altitude: number;
  image_filename: string;
  image_url?: string;
  temperature_c: number | string;
  humidity_pct: number | string;
  soil_temperature_c: number | string;
  soil_moisture_raw: number | string;
  soil_moisture_pct: number | string;
  voltage_v: number | string;
  current_ma: number | string;
  power_mw: number | string;
  notes: string;
}
