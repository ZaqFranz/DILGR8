import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/shared/components/Layout";
import { ProtectedRoute } from "@/shared/components/ProtectedRoute";
import { useAuth } from "@/shared/auth/AuthContext";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { JobPostingsListPage } from "@/features/job-postings/pages/JobPostingsListPage";
import { RegistrationWizardPage } from "@/features/applicant-registration/pages/RegistrationWizardPage";
import { MyApplicationsPage } from "@/features/applicant-registration/pages/MyApplicationsPage";
import { CreateJobPostingPage } from "@/features/admin/pages/CreateJobPostingPage";
import { EvaluateApplicantsPage } from "@/features/admin/pages/EvaluateApplicantsPage";

function HomeRedirect() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "ADMIN" ? "/admin/jobs" : "/jobs"} replace />;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Applicant-only */}
        <Route
          path="/jobs"
          element={
            <ProtectedRoute role="APPLICANT">
              <JobPostingsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/registration"
          element={
            <ProtectedRoute role="APPLICANT">
              <RegistrationWizardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/applications"
          element={
            <ProtectedRoute role="APPLICANT">
              <MyApplicationsPage />
            </ProtectedRoute>
          }
        />

        {/* Admin-only */}
        <Route
          path="/admin/jobs"
          element={
            <ProtectedRoute role="ADMIN">
              <CreateJobPostingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/evaluations"
          element={
            <ProtectedRoute role="ADMIN">
              <EvaluateApplicantsPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </Layout>
  );
}
