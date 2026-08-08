import multer from "multer";
import { env } from "@/config/env";
import { ValidationError } from "@/shared/errors/AppError";

const ALLOWED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

// Memory storage - this file is a transient import (name -> score rows read
// once and discarded), not a stored Document, so nothing is written to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new ValidationError("Only XLSX or XLS files are allowed"));
      return;
    }
    cb(null, true);
  },
});

export const uploadExamScoreFile = upload.single("file");
