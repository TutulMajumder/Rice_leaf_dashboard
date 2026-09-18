import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { IMAGES_DIR } from '../config';
import { downloadCsv, downloadJson, getDataset, postDatasetEntry } from '../controllers/datasetController';

const upload = multer({
  storage: multer.diskStorage({
    destination: IMAGES_DIR,
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase() || '.jpg';
      callback(null, `leaf_${Date.now()}-${Math.round(Math.random() * 10000)}${extension}`);
    }
  }),
  fileFilter: (_req, file, callback) => callback(null, file.mimetype.startsWith('image/'))
});

const router = Router();
router.get('/dataset', getDataset);
router.post('/dataset/entry', upload.single('image'), postDatasetEntry);
router.get('/dataset/metadata.csv', downloadCsv);
router.get('/dataset/sensor_data.json', downloadJson);
export default router;
