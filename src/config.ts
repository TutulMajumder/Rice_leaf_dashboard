import path from "node:path";

export const PORT = Number(process.env.PORT ?? 3000);
export const ROOT_DIR = path.resolve(__dirname, "..");
export const PUBLIC_DIR = path.join(ROOT_DIR, "public");
export const DATASET_DIR = process.env.VERCEL
  ? path.join("/tmp", "agrisense-dataset")
  : path.join(ROOT_DIR, "Dataset");
export const IMAGES_DIR = path.join(DATASET_DIR, "Images");
export const METADATA_CSV = path.join(DATASET_DIR, "metadata.csv");
export const SENSOR_DATA_JSON = path.join(DATASET_DIR, "sensor_data.json");
export const TELEMETRY_HISTORY_JSON = path.join(
  DATASET_DIR,
  "telemetry_history.json",
);
