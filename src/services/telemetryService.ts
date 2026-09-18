import fs from "node:fs";
import { TELEMETRY_HISTORY_JSON } from "../config";
import { Diagnostics, TelemetryPayload, TelemetryRecord } from "../types";

const MAX_HISTORY = 1000;
const history: TelemetryRecord[] = [];
const activeNodes: Record<string, TelemetryRecord> = {};
let historyLoaded = false;

function loadPersistedHistory(): void {
  if (historyLoaded) return;
  historyLoaded = true;
  try {
    const persisted = JSON.parse(
      fs.readFileSync(TELEMETRY_HISTORY_JSON, "utf8"),
    ) as TelemetryRecord[];
    persisted.slice(-MAX_HISTORY).forEach((record) => {
      history.push(record);
      activeNodes[record.node_id] = record;
    });
  } catch {
    /* A new deployment starts with an empty history. */
  }
}

function persistTelemetry(record: TelemetryRecord): void {
  let records: TelemetryRecord[] = [];
  try {
    records = JSON.parse(
      fs.readFileSync(TELEMETRY_HISTORY_JSON, "utf8"),
    ) as TelemetryRecord[];
  } catch {
    records = [];
  }
  records.push(record);
  fs.writeFileSync(
    TELEMETRY_HISTORY_JSON,
    JSON.stringify(records.slice(-MAX_HISTORY), null, 2),
    "utf8",
  );
}

export function calculateMoisturePercent(rawValue: number): number {
  const dry = 2850;
  const wet = 1350;
  const clamped = Math.max(wet, Math.min(dry, rawValue));
  return Math.round(((dry - clamped) / (dry - wet)) * 100);
}

function diagnosticsFor(
  data: TelemetryRecord,
  payload: TelemetryPayload,
): Diagnostics {
  const diagnostics: Diagnostics = {
    dht22: "HEALTHY",
    ds18b20: "HEALTHY",
    ina219: "HEALTHY",
    moisture: "HEALTHY",
    overall: "HEALTHY",
    alerts: [],
  };
  if (
    String(data.temperature).toLowerCase() === "nan" ||
    String(data.humidity).toLowerCase() === "nan"
  ) {
    diagnostics.dht22 = "ERROR_NAN";
    diagnostics.alerts.push({
      sensor: "DHT22",
      error: "Sensor returned nan",
      fix: "Check GPIO4 DATA connection and pull-up resistor.",
    });
  }
  if (data.soil_temperature <= -120) {
    diagnostics.ds18b20 = "ERROR_DISCONNECTED";
    diagnostics.alerts.push({
      sensor: "DS18B20",
      error: "Sensor returned -127 C",
      fix: "Check GPIO5 data wire and 4.7k pull-up resistor.",
    });
  }
  if (
    payload.ina219_status === "NOT_FOUND" ||
    (data.voltage === 0 && data.current === 0 && payload.ina219_error)
  ) {
    diagnostics.ina219 = "ERROR_NOT_FOUND";
    diagnostics.alerts.push({
      sensor: "INA219",
      error: "INA219 not found",
      fix: "Check I2C wiring on GPIO21 and GPIO22.",
    });
  }
  if (data.soil_moisture <= 100 || data.soil_moisture >= 4090)
    diagnostics.moisture = "WARNING_OUT_OF_RANGE";
  if (
    [diagnostics.dht22, diagnostics.ds18b20, diagnostics.ina219].some(
      (status) => status.startsWith("ERROR"),
    )
  )
    diagnostics.overall = "CRITICAL";
  else if (diagnostics.moisture.startsWith("WARNING"))
    diagnostics.overall = "WARNING";
  return diagnostics;
}

function numeric(
  value: number | string | null | undefined,
  fallback: number,
): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

export function ingestTelemetry(payload: TelemetryPayload): TelemetryRecord {
  const soilMoisture = numeric(payload.soil_moisture, 0);
  const voltage = numeric(payload.voltage, 0);
  const current = numeric(payload.current, 0);
  const record: TelemetryRecord = {
    node_id: payload.node_id || "FIELD_NODE_01",
    timestamp: new Date().toISOString(),
    temperature:
      String(payload.temperature ?? "nan").toLowerCase() === "nan"
        ? "nan"
        : numeric(payload.temperature, 0),
    humidity:
      String(payload.humidity ?? "nan").toLowerCase() === "nan"
        ? "nan"
        : numeric(payload.humidity, 0),
    soil_temperature: numeric(payload.soil_temperature, -127),
    soil_moisture: soilMoisture,
    soil_moisture_pct: calculateMoisturePercent(soilMoisture),
    voltage,
    current,
    power_mw: Number((voltage * current).toFixed(2)),
    rssi: payload.rssi ?? -60,
    diagnostics: {} as Diagnostics,
    last_seen: Date.now(),
  };
  record.diagnostics = diagnosticsFor(record, payload);
  activeNodes[record.node_id] = record;
  history.push(record);
  if (history.length > MAX_HISTORY) history.shift();
  persistTelemetry(record);
  return record;
}

export function getTelemetry(nodeId?: string, limit = 50) {
  loadPersistedHistory();
  const nodes = Object.values(activeNodes);
  const latest = nodeId
    ? activeNodes[nodeId]
    : (nodes.sort((a, b) => b.last_seen - a.last_seen)[0] ?? null);
  const filtered = nodeId
    ? history.filter((record) => record.node_id === nodeId)
    : history;
  return {
    status: "success",
    latest,
    history: filtered.slice(-limit),
    active_nodes: Object.values(activeNodes).map((node) => ({
      node_id: node.node_id,
      last_seen: node.last_seen,
      is_online: Date.now() - node.last_seen < 30000,
      overall_status: node.diagnostics.overall,
    })),
  };
}

export function latestForNode(nodeId: string): TelemetryRecord | undefined {
  loadPersistedHistory();
  return activeNodes[nodeId];
}
