import multer from "multer";
import { env } from "@/config/env";
import { ValidationError } from "@/shared/errors/AppError";
import { createDiskStorage } from "@/shared/upload/diskStorage";

const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

const upload = multer({
  storage: createDiskStorage(),
  limits: { fileSize: env.MAX_UPLOAD_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new ValidationError("Only PDF, JPEG, or PNG files are allowed"));
      return;
    }
    cb(null, true);
  },
});

export const uploadApplicationLetter = upload.single("file");
