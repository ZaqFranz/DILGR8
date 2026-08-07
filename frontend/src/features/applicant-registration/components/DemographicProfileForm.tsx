import { useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { createProfile, updateProfile } from "../api/applicantsApi";
import type { ApplicantProfile, DemographicProfileInput, EligibilityType } from "../types";

interface Props {
  profile: ApplicantProfile | null;
  onSaved: (profile: ApplicantProfile) => void;
}

const ELIGIBILITY_OPTIONS: { value: EligibilityType; label: string }[] = [
  { value: "RA1080", label: "RA 1080" },
  { value: "CSC_PROFESSIONAL", label: "CSC Professional" },
  { value: "CSC_SUBPROFESSIONAL", label: "CSC Sub-Professional" },
  { value: "BARANGAY", label: "Barangay Eligibility" },
];

function toInputValue(input: DemographicProfileInput, profile: ApplicantProfile | null): DemographicProfileInput {
  if (!profile) return input;
  return {
    firstName: profile.firstName,
    middleName: profile.middleName ?? "",
    lastName: profile.lastName,
    suffix: profile.suffix ?? "",
    dateOfBirth: profile.dateOfBirth.slice(0, 10),
    sex: profile.sex,
    civilStatus: profile.civilStatus,
    address: profile.address,
    contactNumber: profile.contactNumber,
    hasEligibility: profile.hasEligibility,
    eligibilityType: profile.eligibilityType,
  };
}

const emptyForm: DemographicProfileInput = {
  firstName: "",
  middleName: "",
  lastName: "",
  suffix: "",
  dateOfBirth: "",
  sex: "MALE",
  civilStatus: "SINGLE",
  address: "",
  contactNumber: "",
  hasEligibility: false,
  eligibilityType: "NONE",
};

export function DemographicProfileForm({ profile, onSaved }: Props) {
  const [form, setForm] = useState<DemographicProfileInput>(toInputValue(emptyForm, profile));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof DemographicProfileInput>(key: K, value: DemographicProfileInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload: DemographicProfileInput = {
        ...form,
        eligibilityType: form.hasEligibility ? form.eligibilityType : "NONE",
      };
      const saved = profile ? await updateProfile(payload) : await createProfile(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save profile");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <h2>Demographic Profile</h2>
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit}>
        <div className="field-grid">
          <div className="field">
            <label htmlFor="firstName">First name</label>
            <input id="firstName" required value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="middleName">Middle name</label>
            <input id="middleName" value={form.middleName} onChange={(e) => update("middleName", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="lastName">Last name</label>
            <input id="lastName" required value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="suffix">Suffix</label>
            <input id="suffix" value={form.suffix} onChange={(e) => update("suffix", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="dateOfBirth">Date of birth</label>
            <input
              id="dateOfBirth"
              type="date"
              required
              value={form.dateOfBirth}
              onChange={(e) => update("dateOfBirth", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="sex">Sex</label>
            <select id="sex" value={form.sex} onChange={(e) => update("sex", e.target.value as DemographicProfileInput["sex"])}>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="civilStatus">Civil status</label>
            <select
              id="civilStatus"
              value={form.civilStatus}
              onChange={(e) => update("civilStatus", e.target.value as DemographicProfileInput["civilStatus"])}
            >
              <option value="SINGLE">Single</option>
              <option value="MARRIED">Married</option>
              <option value="WIDOWED">Widowed</option>
              <option value="SEPARATED">Separated</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="contactNumber">Contact number</label>
            <input
              id="contactNumber"
              required
              value={form.contactNumber}
              onChange={(e) => update("contactNumber", e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="address">Address</label>
          <textarea id="address" required value={form.address} onChange={(e) => update("address", e.target.value)} />
        </div>

        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={form.hasEligibility}
              onChange={(e) => update("hasEligibility", e.target.checked)}
              style={{ width: "auto", marginRight: "0.5rem" }}
            />
            I have a civil service eligibility
          </label>
        </div>
        {form.hasEligibility ? (
          <div className="field">
            <label htmlFor="eligibilityType">Eligibility type</label>
            <select
              id="eligibilityType"
              value={form.eligibilityType}
              onChange={(e) => update("eligibilityType", e.target.value as EligibilityType)}
            >
              {ELIGIBILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p>Upload proof of eligibility in the Documents section below.</p>
          </div>
        ) : (
          <p className="flag-manual-validation">
            No eligibility on file — this application is subject to manual validation by the administrator.
          </p>
        )}

        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : profile ? "Update profile" : "Create profile"}
        </button>
      </form>
    </div>
  );
}
