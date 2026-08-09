import { useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { FieldError } from "@/shared/components/FieldError";
import { Spinner } from "@/shared/components/Spinner";
import { getFieldErrors } from "@/shared/utils/apiErrors";
import { ELIGIBILITY_OPTIONS } from "@/shared/constants/eligibility";
import { createProfile, updateProfile } from "../api/applicantsApi";
import type { ApplicantProfile, DemographicProfileInput, EligibilityType } from "../types";

interface Props {
  profile: ApplicantProfile | null;
  onSaved: (profile: ApplicantProfile) => void;
}

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof DemographicProfileInput>(key: K, value: DemographicProfileInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function fieldClass(name: string): string {
    return fieldErrors[name] ? "field has-error" : "field";
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!form.firstName.trim()) errors.firstName = "First name is required.";
    if (!form.lastName.trim()) errors.lastName = "Last name is required.";
    if (!form.dateOfBirth) errors.dateOfBirth = "Date of birth is required.";
    if (!form.address.trim()) errors.address = "Address is required.";
    if (!form.contactNumber.trim()) errors.contactNumber = "Contact number is required.";
    if (form.hasEligibility && form.eligibilityType === "NONE") {
      errors.eligibilityType = "Choose which eligibility you hold.";
    }
    return errors;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError("Please fill in the highlighted field(s) before continuing.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: DemographicProfileInput = {
        ...form,
        eligibilityType: form.hasEligibility ? form.eligibilityType : "NONE",
      };
      const saved = profile ? await updateProfile(payload) : await createProfile(payload);
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(getFieldErrors(err));
      } else {
        setError("Failed to save profile");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <h2>Demographic Profile</h2>
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit} noValidate>
        <div className="field-grid">
          <div className={fieldClass("firstName")}>
            <label htmlFor="firstName" className="required">
              First name
            </label>
            <input id="firstName" required value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
            <FieldError message={fieldErrors.firstName} />
          </div>
          <div className={fieldClass("middleName")}>
            <label htmlFor="middleName">Middle name</label>
            <input id="middleName" value={form.middleName} onChange={(e) => update("middleName", e.target.value)} />
            <FieldError message={fieldErrors.middleName} />
          </div>
          <div className={fieldClass("lastName")}>
            <label htmlFor="lastName" className="required">
              Last name
            </label>
            <input id="lastName" required value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
            <FieldError message={fieldErrors.lastName} />
          </div>
          <div className={fieldClass("suffix")}>
            <label htmlFor="suffix">Suffix</label>
            <input id="suffix" value={form.suffix} onChange={(e) => update("suffix", e.target.value)} />
            <FieldError message={fieldErrors.suffix} />
          </div>
          <div className={fieldClass("dateOfBirth")}>
            <label htmlFor="dateOfBirth" className="required">
              Date of birth
            </label>
            <input
              id="dateOfBirth"
              type="date"
              required
              value={form.dateOfBirth}
              onChange={(e) => update("dateOfBirth", e.target.value)}
            />
            <FieldError message={fieldErrors.dateOfBirth} />
          </div>
          <div className={fieldClass("sex")}>
            <label htmlFor="sex">Sex</label>
            <select id="sex" value={form.sex} onChange={(e) => update("sex", e.target.value as DemographicProfileInput["sex"])}>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
            <FieldError message={fieldErrors.sex} />
          </div>
          <div className={fieldClass("civilStatus")}>
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
            <FieldError message={fieldErrors.civilStatus} />
          </div>
          <div className={fieldClass("contactNumber")}>
            <label htmlFor="contactNumber" className="required">
              Contact number
            </label>
            <input
              id="contactNumber"
              required
              value={form.contactNumber}
              onChange={(e) => update("contactNumber", e.target.value)}
            />
            <FieldError message={fieldErrors.contactNumber} />
          </div>
        </div>
        <div className={fieldClass("address")}>
          <label htmlFor="address" className="required">
            Address
          </label>
          <textarea id="address" required value={form.address} onChange={(e) => update("address", e.target.value)} />
          <FieldError message={fieldErrors.address} />
        </div>

        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={form.hasEligibility}
              onChange={(e) => {
                const checked = e.target.checked;
                // The <select> below never renders a "NONE" option (only real
                // eligibility types), so leaving eligibilityType at its "NONE"
                // default would make the browser visually show the first real
                // option as selected while React's state stays "NONE" - the
                // form would then reject a save that looks, on screen, like a
                // type is already chosen. Default to a real option the moment
                // the checkbox is checked so state and the visible selection
                // never disagree.
                setForm((prev) => ({
                  ...prev,
                  hasEligibility: checked,
                  eligibilityType:
                    checked && prev.eligibilityType === "NONE" ? ELIGIBILITY_OPTIONS[0]!.value : prev.eligibilityType,
                }));
              }}
              style={{ width: "auto", marginRight: "0.5rem" }}
            />
            I have a civil service eligibility
          </label>
        </div>
        {form.hasEligibility ? (
          <div className={fieldClass("eligibilityType")}>
            <label htmlFor="eligibilityType" className="required">
              Eligibility type
            </label>
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
            <FieldError message={fieldErrors.eligibilityType} />
            <p className="field-hint">Upload proof of eligibility in the Documents section below.</p>
          </div>
        ) : (
          <p className="flag-manual-validation">
            No eligibility on file — this application is subject to manual validation by the administrator.
          </p>
        )}

        <button type="submit" disabled={submitting}>
          {submitting && <Spinner size="sm" onDark />}
          {submitting ? "Saving..." : profile ? "Update profile" : "Create profile"}
        </button>
      </form>
    </div>
  );
}
