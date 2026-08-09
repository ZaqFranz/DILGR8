import fs from "node:fs/promises";
import type { PrismaClient, Document, DocumentType } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/shared/errors/AppError";
import type { ApplicantsRepository } from "../applicants.repository";
import type { CreateDocumentInput, DocumentsRepository } from "./documents.repository";
import type { UploadDocumentFieldsDto } from "./documents.dto";

export interface UploadedFileInfo {
  originalname: string;
  path: string;
  mimetype: string;
  size: number;
}

// These represent one current document per applicant - re-uploading
// replaces whatever was there before rather than accumulating duplicates
// with no way to tell which is authoritative. LD_PROOF/AWARD_PROOF aren't
// here since their "one slot" is scoped per LdIntervention/Award entry
// instead of per applicant - handled separately below - and OTHER is a
// genuine multi-file miscellaneous catch-all, exempt entirely.
const SINGLE_INSTANCE_TYPES = new Set<DocumentType>([
  "PDS",
  "PDS_EXCEL",
  "IPCR",
  "ELIGIBILITY_PROOF",
  "TRANSCRIPT_OF_RECORDS",
  "DIPLOMA",
  "PQE_NOTICE",
  "DESIGNATION_ORDER",
]);

const PDF_OR_IMAGE_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const EXCEL_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

// Every document type accepts a scanned/printed PDF (or a photo of a paper
// copy, JPEG/PNG) by default. PDS is the one exception with two distinct
// required files - the CS Form 212 workbook itself (PDS_EXCEL) alongside the
// signed printed/scanned copy (PDS) - so it needs its own stricter,
// spreadsheet-only slot rather than sharing the PDF/image default.
const ALLOWED_MIME_TYPES_BY_DOCUMENT_TYPE: Partial<Record<DocumentType, Set<string>>> = {
  PDS_EXCEL: EXCEL_MIME_TYPES,
};

function assertMimeTypeAllowed(type: DocumentType, mimetype: string): void {
  const allowed = ALLOWED_MIME_TYPES_BY_DOCUMENT_TYPE[type] ?? PDF_OR_IMAGE_MIME_TYPES;
  if (!allowed.has(mimetype)) {
    const expected = allowed === EXCEL_MIME_TYPES ? "an XLSX or XLS file" : "a PDF, JPEG, or PNG file";
    throw new ValidationError(`This document must be uploaded as ${expected}`);
  }
}

export class DocumentsService {
  constructor(
    private readonly documentsRepository: DocumentsRepository,
    private readonly applicantsRepository: ApplicantsRepository,
    private readonly db: PrismaClient,
  ) {}

  async upload(userId: string, fields: UploadDocumentFieldsDto, file?: UploadedFileInfo): Promise<Document> {
    if (!file) {
      throw new ValidationError("A file is required");
    }
    assertMimeTypeAllowed(fields.type, file.mimetype);

    const applicant = await this.applicantsRepository.findByUserId(userId);
    if (!applicant) {
      throw new NotFoundError("Applicant profile");
    }

    if (fields.applicationId) {
      const application = await this.db.application.findUnique({ where: { id: fields.applicationId } });
      if (!application || application.applicantId !== applicant.id) {
        throw new NotFoundError("Application");
      }
    }

    if (fields.ldInterventionId) {
      const ldIntervention = await this.db.ldIntervention.findUnique({ where: { id: fields.ldInterventionId } });
      if (!ldIntervention || ldIntervention.applicantId !== applicant.id) {
        throw new NotFoundError("L&D intervention");
      }
    }

    if (fields.awardId) {
      const award = await this.db.award.findUnique({ where: { id: fields.awardId } });
      if (!award || award.applicantId !== applicant.id) {
        throw new NotFoundError("Award");
      }
    }

    // One current file per "slot" - an applicant-level slot for
    // SINGLE_INSTANCE_TYPES, or a per-entry slot (this specific
    // LdIntervention/Award) for LD_PROOF/AWARD_PROOF - so re-uploading
    // always replaces rather than accumulating duplicates with no way to
    // tell which one is authoritative.
    const existingDocs = await this.documentsRepository.findByApplicant(applicant.id);
    const duplicate = SINGLE_INSTANCE_TYPES.has(fields.type)
      ? existingDocs.find((doc) => doc.type === fields.type)
      : fields.type === "LD_PROOF" && fields.ldInterventionId
        ? existingDocs.find((doc) => doc.type === "LD_PROOF" && doc.ldInterventionId === fields.ldInterventionId)
        : fields.type === "AWARD_PROOF" && fields.awardId
          ? existingDocs.find((doc) => doc.type === "AWARD_PROOF" && doc.awardId === fields.awardId)
          : undefined;
    if (duplicate) {
      await this.documentsRepository.delete(duplicate.id);
      await fs.unlink(duplicate.filePath).catch(() => undefined);
    }

    const input: CreateDocumentInput = {
      applicantId: applicant.id,
      type: fields.type,
      fileName: file.originalname,
      filePath: file.path,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      ...(fields.applicationId ? { applicationId: fields.applicationId } : {}),
      ...(fields.ldInterventionId ? { ldInterventionId: fields.ldInterventionId } : {}),
      ...(fields.awardId ? { awardId: fields.awardId } : {}),
    };

    return this.documentsRepository.create(input);
  }

  async listMine(userId: string): Promise<Document[]> {
    const applicant = await this.applicantsRepository.findByUserId(userId);
    if (!applicant) {
      throw new NotFoundError("Applicant profile");
    }
    return this.documentsRepository.findByApplicant(applicant.id);
  }

  async remove(userId: string, documentId: string): Promise<void> {
    const applicant = await this.applicantsRepository.findByUserId(userId);
    if (!applicant) {
      throw new NotFoundError("Applicant profile");
    }

    const document = await this.documentsRepository.findById(documentId);
    if (!document || document.applicantId !== applicant.id) {
      throw new NotFoundError("Document");
    }

    await this.documentsRepository.delete(documentId);
    await fs.unlink(document.filePath).catch(() => undefined);
  }
}
