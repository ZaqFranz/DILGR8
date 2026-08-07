import type { Document, DocumentType, PrismaClient } from "@prisma/client";

export interface CreateDocumentInput {
  applicantId: string;
  applicationId?: string;
  type: DocumentType;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSizeBytes: number;
}

export class DocumentsRepository {
  constructor(private readonly db: PrismaClient) {}

  create(input: CreateDocumentInput): Promise<Document> {
    return this.db.document.create({ data: input });
  }

  findByApplicant(applicantId: string): Promise<Document[]> {
    return this.db.document.findMany({ where: { applicantId }, orderBy: { uploadedAt: "desc" } });
  }

  findById(id: string): Promise<Document | null> {
    return this.db.document.findUnique({ where: { id } });
  }

  delete(id: string): Promise<Document> {
    return this.db.document.delete({ where: { id } });
  }
}
