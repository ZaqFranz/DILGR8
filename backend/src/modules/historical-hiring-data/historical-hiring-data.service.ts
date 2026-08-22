import { NotFoundError } from "@/shared/errors/AppError";
import type { HistoricalHiringDataRepository } from "./historical-hiring-data.repository";
import type { CreateHistoricalHiringRecordDto, UpdateHistoricalHiringRecordDto } from "./historical-hiring-data.dto";
import {
  FEATURE_LABELS,
  MIN_TRAINING_SAMPLES,
  explain,
  extractFeatures,
  fitLogisticRegression,
  predict,
} from "./hirePrediction";

export type HirePrediction =
  | { applicationId: string; percentage: number; sampleSize: number; breakdown: { label: string; contribution: number }[] }
  | { applicationId: string; percentage: null; sampleSize: number; minimumRequired: number };

// No audit logging in this service, deliberately - AuditLogsRepository
// entries are readable by any ADMIN via GET /api/audit-logs, which would
// leak this module's existence/activity to every other admin even though
// the module itself is requireOwner-gated. See docs/decisions.md.
export class HistoricalHiringDataService {
  constructor(private readonly repository: HistoricalHiringDataRepository) {}

  create(enteredByUserId: string, dto: CreateHistoricalHiringRecordDto) {
    return this.repository.create(enteredByUserId, dto);
  }

  list() {
    return this.repository.findMany();
  }

  async update(id: string, dto: UpdateHistoricalHiringRecordDto) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError("Historical hiring record");
    }
    return this.repository.update(id, dto);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError("Historical hiring record");
    }
    await this.repository.delete(id);
  }

  async predictForApplications(applicationIds: string[]): Promise<HirePrediction[]> {
    const historicalRecords = await this.repository.findMany();
    const model = fitLogisticRegression(
      historicalRecords.map((record) => ({
        features: extractFeatures({
          educationLevel: record.educationLevel,
          yearsOfExperience: record.yearsOfExperience,
          eligibilityType: record.eligibilityType,
          awardCount: record.awards.length,
          ldTotalHours: record.ldEntries.reduce((sum, entry) => sum + entry.hours, 0),
        }),
        label: record.wasHired ? 1 : 0,
      })),
    );
    const sampleSize = historicalRecords.length;

    const applicantFeatures = await this.repository.findApplicantFeaturesByApplicationIds(applicationIds);

    return applicantFeatures.map((row): HirePrediction => {
      if (!model) {
        return { applicationId: row.applicationId, percentage: null, sampleSize, minimumRequired: MIN_TRAINING_SAMPLES };
      }
      const features = extractFeatures(row);
      const percentage = predict(model, features);
      const contributions = explain(model, features);
      const breakdown = FEATURE_LABELS.map((label, i) => ({
        label,
        contribution: Math.round(contributions[i]! * 100) / 100,
      }));
      return { applicationId: row.applicationId, percentage: Math.round(percentage * 10) / 10, sampleSize, breakdown };
    });
  }
}
