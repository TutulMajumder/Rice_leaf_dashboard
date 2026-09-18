import cors from "cors";
import express from "express";
import fs from "node:fs";
import {
  DATASET_DIR,
  IMAGES_DIR,
  PORT,
  PUBLIC_DIR,
  TELEMETRY_HISTORY_JSON,
} from "./config";
import datasetRoutes from "./routes/datasetRoutes";
import telemetryRoutes from "./routes/telemetryRoutes";

fs.mkdirSync(DATASET_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });
if (!fs.existsSync(TELEMETRY_HISTORY_JSON))
  fs.writeFileSync(TELEMETRY_HISTORY_JSON, "[]\n", "utf8");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));
app.use("/dataset-images", express.static(IMAGES_DIR));
app.use("/api", telemetryRoutes);
app.use("/api", datasetRoutes);

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`AgriSense dashboard running at http://localhost:${PORT}`);
    console.log(
      "Dataset workflow: POST /api/dataset/entry -> GET /api/dataset/metadata.csv",
    );
  });
}

export default app;
