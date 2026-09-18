import { Request, Response } from 'express';
import { getTelemetry, ingestTelemetry } from '../services/telemetryService';
import { TelemetryPayload } from '../types';

export function postTelemetry(req: Request, res: Response): void {
  if (!req.body || typeof req.body !== 'object') { res.status(400).json({ error: 'Missing JSON payload' }); return; }
  const record = ingestTelemetry(req.body as TelemetryPayload);
  res.status(200).json({ status: 'success', message: 'Sensor telemetry received and processed', received: record, diagnostics: record.diagnostics });
}

export function getTelemetrySnapshot(req: Request, res: Response): void {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 1000);
  res.json(getTelemetry(typeof req.query.node_id === 'string' ? req.query.node_id : undefined, limit));
}
