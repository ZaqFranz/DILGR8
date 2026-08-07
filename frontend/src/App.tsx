import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/shared/components/Layout";
import { ProtectedRoute } from "@/shared/components/ProtectedRoute";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { JobPostingsListPage } from "@/features/job-postings/pages/JobPostingsListPage";
import { RegistrationWizardPage } from "@/features/applicant-registration/pages/RegistrationWizardPage";
import { MyApplicationsPage } from "@/features/applicant-registration/pages/MyApplicationsPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/jobs" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/jobs"
          element={
            <ProtectedRoute>
              <JobPostingsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/registration"
          element={
            <ProtectedRoute>
              <RegistrationWizardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/applications"
          element={
            <ProtectedRoute>
              <MyApplicationsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/jobs" replace />} />
      </Routes>
    </Layout>
  );
}
