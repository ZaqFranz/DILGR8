import type { EducationLevel, EligibilityType } from "@prisma/client";
import { educationLevelRank } from "@/shared/constants/educationLevels";

// Hand-rolled logistic regression, no ML dependency. The training label
// (HistoricalHiringRecord.wasHired) is a fact, not a subjective score - see
// docs/decisions.md's "only real data" entry - so this is genuine binary
// classification: fit on real hired/not-hired outcomes, predict a
// probability (shown as a percentage) for a new applicant. Chosen over a
// gradient-boosted model for the same reason as before: DILG's
// manually-transcribed corpus is realistically low-tens-to-low-hundreds of
// rows, where a tree ensemble would overfit. Never used to gate any
// decision automatically - purely a displayed percentage, always paired
// with human review.

export const FEATURE_LABELS = ["Education", "Years of experience", "Eligibility", "Awards", "L&D hours"] as const;
export const FEATURE_COUNT = FEATURE_LABELS.length;

// Fewer rows than this and there isn't enough signal to fit 5 features
// reliably - refuse to predict rather than show a number built on noise.
export const MIN_TRAINING_SAMPLES = 10;

const LEARNING_RATE = 0.3;
const L2_PENALTY = 0.05;
const ITERATIONS = 3000;

export interface HireFeatureInput {
  educationLevel: EducationLevel;
  yearsOfExperience: number;
  eligibilityType: EligibilityType;
  awardCount: number;
  ldTotalHours: number;
}

export interface TrainingRow {
  features: number[];
  label: 0 | 1;
}

export interface LogisticModel {
  intercept: number;
  // In standardized-feature space - featureMeans/featureStds convert a raw
  // feature vector into that space, applied identically at predict() time.
  coefficients: number[];
  featureMeans: number[];
  featureStds: number[];
}

// No ordinal eligibility hierarchy exists elsewhere in this codebase
// (qualificationMatch.ts treats eligibility as set membership, not a
// ranking) - this is a modeling choice specific to this module, not an
// app-wide convention. CSC_PROFESSIONAL ("Second Level") ranks above
// CSC_SUBPROFESSIONAL ("First Level"), which ranks above having some other
// eligibility (RA1080/BARANGAY) or none.
function eligibilityRank(type: EligibilityType): number {
  switch (type) {
    case "CSC_PROFESSIONAL":
      return 2;
    case "CSC_SUBPROFESSIONAL":
      return 1;
    case "RA1080":
    case "BARANGAY":
      return 1;
    case "NONE":
    default:
      return 0;
  }
}

export function extractFeatures(input: HireFeatureInput): number[] {
  return [
    educationLevelRank(input.educationLevel),
    input.yearsOfExperience,
    eligibilityRank(input.eligibilityType),
    input.awardCount,
    input.ldTotalHours,
  ];
}

// Numerically stable both directions - a naive 1/(1+e^-z) overflows for
// very negative z.
function sigmoid(z: number): number {
  if (z >= 0) {
    const e = Math.exp(-z);
    return 1 / (1 + e);
  }
  const e = Math.exp(z);
  return e / (1 + e);
}

export function fitLogisticRegression(rows: TrainingRow[]): LogisticModel | null {
  if (rows.length < MIN_TRAINING_SAMPLES) return null;

  const n = rows.length;
  const p = FEATURE_COUNT;

  // Standardize (z-score) every feature column - without this, gradient
  // descent converges poorly given how differently-scaled the raw features
  // are (education rank 0-8 vs. L&D hours potentially in the hundreds).
  const means = new Array(p).fill(0) as number[];
  for (const row of rows) {
    for (let j = 0; j < p; j++) means[j]! += row.features[j]! / n;
  }
  const stds = new Array(p).fill(0) as number[];
  for (const row of rows) {
    for (let j = 0; j < p; j++) stds[j]! += (row.features[j]! - means[j]!) ** 2 / n;
  }
  for (let j = 0; j < p; j++) {
    stds[j] = Math.sqrt(stds[j]!) || 1; // a zero-variance column (every record identical on it) would divide by zero
  }

  const design = rows.map((row) => row.features.map((f, j) => (f - means[j]!) / stds[j]!));

  // Batch gradient descent minimizing binary cross-entropy, with L2
  // regularization - without it, a small/separable dataset (e.g. "everyone
  // with a doctorate was hired") sends unregularized logistic-regression
  // coefficients toward infinity instead of converging.
  let intercept = 0;
  let coefficients = new Array(p).fill(0) as number[];

  for (let iter = 0; iter < ITERATIONS; iter++) {
    let interceptGradient = 0;
    const coefficientGradients = new Array(p).fill(0) as number[];

    for (let i = 0; i < n; i++) {
      const row = design[i]!;
      const z = intercept + row.reduce((sum, x, j) => sum + x * coefficients[j]!, 0);
      const error = sigmoid(z) - rows[i]!.label;
      interceptGradient += error;
      for (let j = 0; j < p; j++) coefficientGradients[j]! += error * row[j]!;
    }

    intercept -= (LEARNING_RATE * interceptGradient) / n;
    coefficients = coefficients.map(
      (coef, j) => coef - LEARNING_RATE * (coefficientGradients[j]! / n + L2_PENALTY * coef),
    );
  }

  return { intercept, coefficients, featureMeans: means, featureStds: stds };
}

function standardize(model: LogisticModel, features: number[]): number[] {
  return features.map((f, j) => (f - model.featureMeans[j]!) / model.featureStds[j]!);
}

export function predict(model: LogisticModel, features: number[]): number {
  const standardized = standardize(model, features);
  const z = model.intercept + standardized.reduce((sum, x, j) => sum + x * model.coefficients[j]!, 0);
  return sigmoid(z) * 100;
}

/**
 * Each feature's contribution to the log-odds sum (coefficient × its
 * standardized value) - the closest honest equivalent to the OLS "+X
 * percentage points" breakdown this module used before switching to
 * logistic regression. Since sigmoid is nonlinear, these don't sum to the
 * displayed percentage the way OLS coefficients did - they're relative
 * influence on the underlying log-odds, not directly percentage points.
 */
export function explain(model: LogisticModel, features: number[]): number[] {
  const standardized = standardize(model, features);
  return standardized.map((x, j) => x * model.coefficients[j]!);
}
