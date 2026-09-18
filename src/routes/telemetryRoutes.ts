import { Router } from 'express';
import { getTelemetrySnapshot, postTelemetry } from '../controllers/telemetryController';

const router = Router();
router.get('/sensor-data', getTelemetrySnapshot);
router.post('/sensor-data', postTelemetry);
export default router;
