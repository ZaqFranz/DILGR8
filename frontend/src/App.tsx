import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/shared/components/Layout";
import { ProtectedRoute } from "@/shared/components/ProtectedRoute";
import { useAuth } from "@/shared/auth/AuthContext";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { JobPostingsListPage } from "@/features/job-postings/pages/JobPostingsListPage";
import { RegistrationPage } from "@/features/applicant-registration/pages/RegistrationPage";
import { MyApplicationsPage } from "@/features/applicant-registration/pages/MyApplicationsPage";
import { JobManagementPage } from "@/features/admin/pages/JobManagementPage";
import { UsersManagementPage } from "@/features/admin/pages/UsersManagementPage";
import { EvaluateApplicantsPage } from "@/features/admin/pages/EvaluateApplicantsPage";
import { AuditLogsPage } from "@/features/admin/pages/AuditLogsPage";

function HomeRedirect() {
  const { isAuthenticated, isLoading, user, registrationComplete } = useAuth();
  if (isLoading || (isAuthenticated && registrationComplete === null)) return null;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (user.role === "APPLICANT" && registrationComplete === false) {
    return <Navigate to="/register" replace />;
  }
  return <Navigate to={user.role === "ADMIN" ? "/admin/jobs" : "/jobs"} replace />;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        {/* Covers the whole applicant registration flow - account creation
            through profile, work experience, L&D, awards, and documents -
            so it isn't wrapped in ProtectedRoute; it manages its own
            authenticated/unauthenticated rendering. */}
        <Route path="/register" element={<RegistrationPage />} />

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
              <JobManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute role="ADMIN">
              <UsersManagementPage />
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
        <Route
          path="/admin/logs"
          element={
            <ProtectedRoute role="ADMIN">
              <AuditLogsPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </Layout>
  );
}
