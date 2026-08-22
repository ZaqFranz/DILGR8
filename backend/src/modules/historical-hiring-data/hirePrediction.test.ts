import { describe, expect, it } from "vitest";
import {
  MIN_TRAINING_SAMPLES,
  explain,
  extractFeatures,
  fitLogisticRegression,
  predict,
  type TrainingRow,
} from "./hirePrediction";

describe("fitLogisticRegression", () => {
  it("returns null when there are fewer than MIN_TRAINING_SAMPLES rows", () => {
    const rows: TrainingRow[] = Array.from({ length: MIN_TRAINING_SAMPLES - 1 }, (_, i) => ({
      features: [i, i, i, i, i],
      label: (i % 2) as 0 | 1,
    }));
    expect(fitLogisticRegression(rows)).toBeNull();
  });

  it("learns a strong separation: high-feature profiles predict much higher than low-feature profiles", () => {
    const rows: TrainingRow[] = [];
    for (let i = 0; i < 15; i++) {
      // Strong profiles (high education/experience/eligibility/awards/hours) were hired;
      // weak profiles (all zeros/low) were not - an unambiguous pattern to learn.
      rows.push({ features: [8, 15, 2, 5, 100], label: 1 });
      rows.push({ features: [0, 0, 0, 0, 0], label: 0 });
    }

    const model = fitLogisticRegression(rows);
    expect(model).not.toBeNull();

    const strongPrediction = predict(model!, [8, 15, 2, 5, 100]);
    const weakPrediction = predict(model!, [0, 0, 0, 0, 0]);
    expect(strongPrediction).toBeGreaterThan(70);
    expect(weakPrediction).toBeLessThan(30);
    expect(strongPrediction).toBeGreaterThan(weakPrediction);
  });

  it("never returns a probability outside [0, 100]", () => {
    const rows: TrainingRow[] = Array.from({ length: 20 }, (_, i) => ({
      features: [i % 9, i, i % 3, i % 6, i * 10],
      label: (i % 2) as 0 | 1,
    }));
    const model = fitLogisticRegression(rows);
    expect(model).not.toBeNull();

    for (const features of [
      [8, 60, 2, 100, 1000],
      [0, 0, 0, 0, 0],
      [4, 30, 1, 3, 40],
    ]) {
      const percentage = predict(model!, features);
      expect(percentage).toBeGreaterThanOrEqual(0);
      expect(percentage).toBeLessThanOrEqual(100);
    }
  });

  it("does not diverge on a small, separable dataset (L2 regularization keeps it finite)", () => {
    // Perfectly separable by education alone - unregularized logistic
    // regression would drive coefficients toward infinity trying to fit
    // this exactly; regularized should stay finite and still discriminate.
    const rows: TrainingRow[] = [];
    for (let i = 0; i < 10; i++) rows.push({ features: [8, 5, 1, 1, 10], label: 1 });
    for (let i = 0; i < 10; i++) rows.push({ features: [0, 5, 1, 1, 10], label: 0 });

    const model = fitLogisticRegression(rows);
    expect(model).not.toBeNull();
    expect(Number.isFinite(model!.intercept)).toBe(true);
    model!.coefficients.forEach((coef) => expect(Number.isFinite(coef)).toBe(true));
  });
});

describe("explain", () => {
  it("returns one contribution per feature, matching FEATURE_COUNT", () => {
    const rows: TrainingRow[] = Array.from({ length: MIN_TRAINING_SAMPLES + 2 }, (_, i) => ({
      features: [i % 9, i, i % 3, i % 6, i * 5],
      label: (i % 2) as 0 | 1,
    }));
    const model = fitLogisticRegression(rows);
    const contributions = explain(model!, [4, 10, 1, 2, 20]);
    expect(contributions).toHaveLength(5);
    contributions.forEach((c) => expect(Number.isFinite(c)).toBe(true));
  });
});

describe("extractFeatures", () => {
  it("maps education level to its ordinal rank and ranks eligibility by level", () => {
    const features = extractFeatures({
      educationLevel: "BACHELORS",
      yearsOfExperience: 5,
      eligibilityType: "CSC_PROFESSIONAL",
      awardCount: 2,
      ldTotalHours: 40,
    });
    expect(features).toEqual([4, 5, 2, 2, 40]); // BACHELORS is index 4; CSC_PROFESSIONAL ("Second Level") ranks 2
  });

  it("ranks CSC_SUBPROFESSIONAL ('First Level') below CSC_PROFESSIONAL", () => {
    const [, , subprofessionalRank] = extractFeatures({
      educationLevel: "ELEMENTARY",
      yearsOfExperience: 0,
      eligibilityType: "CSC_SUBPROFESSIONAL",
      awardCount: 0,
      ldTotalHours: 0,
    });
    const [, , professionalRank] = extractFeatures({
      educationLevel: "ELEMENTARY",
      yearsOfExperience: 0,
      eligibilityType: "CSC_PROFESSIONAL",
      awardCount: 0,
      ldTotalHours: 0,
    });
    expect(subprofessionalRank).toBeLessThan(professionalRank!);
  });

  it("ranks NONE as 0", () => {
    const [, , rank] = extractFeatures({
      educationLevel: "ELEMENTARY",
      yearsOfExperience: 0,
      eligibilityType: "NONE",
      awardCount: 0,
      ldTotalHours: 0,
    });
    expect(rank).toBe(0);
  });
});
