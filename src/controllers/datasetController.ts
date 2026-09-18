import { Request, Response } from "express";
import {
  createEntry,
  datasetCsvPath,
  datasetJsonPath,
  listEntries,
} from "../services/datasetService";

export function getDataset(_req: Request, res: Response): void {
  const entries = listEntries();
  res.json({ total: entries.length, entries });
}

export function postDatasetEntry(req: Request, res: Response): void {
  try {
    const image = req.file?.filename;
    if (!image) {
      res.status(400).json({ error: "An image is required" });
      return;
    }
    const entry = createEntry(req.body as Record<string, string>, image);
    res
      .status(201)
      .json({ status: "success", message: "Dataset entry saved", entry });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save dataset entry";
    const status =
      message.startsWith("No live telemetry") || message.startsWith("Phone GPS")
        ? 409
        : 500;
    res.status(status).json({ error: message });
  }
}

export function downloadCsv(_req: Request, res: Response): void {
  res.download(datasetCsvPath(), "metadata.csv");
}
export function downloadJson(_req: Request, res: Response): void {
  res.download(datasetJsonPath(), "sensor_data.json");
}
