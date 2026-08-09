import multer from "multer";
import { env } from "@/config/env";
import { ValidationError } from "@/shared/errors/AppError";
import { createDiskStorage, uploadRoot } from "@/shared/upload/diskStorage";

// Outer gate: every mimetype any document type could possibly accept.
// Which of these a given DocumentType actually allows (e.g. only the two
// spreadsheet types for PDS_EXCEL) is enforced afterwards in
// DocumentsService.upload() via ALLOWED_MIME_TYPES_BY_DOCUMENT_TYPE, once
// `type` has been parsed from the request body - fileFilter runs mid-stream
// and can't reliably depend on a form field ordered after the file part.
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

const upload = multer({
  storage: createDiskStorage(),
  limits: { fileSize: env.MAX_UPLOAD_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new ValidationError("Only PDF, JPEG, PNG, XLS, or XLSX files are allowed"));
      return;
    }
    cb(null, true);
  },
});

export const uploadSingleDocument = upload.single("file");
export { uploadRoot };
