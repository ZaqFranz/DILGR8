import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/shared/components/Layout";
import { ProtectedRoute } from "@/shared/components/ProtectedRoute";
import { useAuth } from "@/shared/auth/AuthContext";
import { LandingPage } from "@/features/marketing/pages/LandingPage";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { ForgotPasswordPage } from "@/features/auth/pages/ForgotPasswordPage";
import { ChangePasswordPage } from "@/features/auth/pages/ChangePasswordPage";
import { JobPostingsListPage } from "@/features/job-postings/pages/JobPostingsListPage";
import { RegistrationPage } from "@/features/applicant-registration/pages/RegistrationPage";
import { MyApplicationsPage } from "@/features/applicant-registration/pages/MyApplicationsPage";
import { DashboardPage } from "@/features/admin/pages/DashboardPage";
import { JobManagementPage } from "@/features/admin/pages/JobManagementPage";
import { PositionsPage } from "@/features/admin/pages/PositionsPage";
import { UsersManagementPage } from "@/features/admin/pages/UsersManagementPage";
import { EvaluateApplicantsPage } from "@/features/admin/pages/EvaluateApplicantsPage";
import { AuditLogsPage } from "@/features/admin/pages/AuditLogsPage";
import { EvaluationCriteriaPage } from "@/features/admin/pages/EvaluationCriteriaPage";
import { ComplianceRequirementsPage } from "@/features/admin/pages/ComplianceRequirementsPage";
import { PanelAssignmentsPage } from "@/features/admin/pages/PanelAssignmentsPage";
import { MyInterviewsPage } from "@/features/panel/pages/MyInterviewsPage";

const HOME_BY_ROLE: Record<"ADMIN" | "APPLICANT" | "PANEL", string> = {
  ADMIN: "/admin/dashboard",
  APPLICANT: "/jobs",
  PANEL: "/panel/interviews",
};

function HomeRedirect() {
  const { isAuthenticated, isLoading, user, registrationComplete } = useAuth();
  if (isLoading || (isAuthenticated && registrationComplete === null)) return null;
  if (!isAuthenticated || !user) return <LandingPage />;
  if (user.mustChangePassword) return <Navigate to="/account/password" replace />;
  if (user.role === "APPLICANT" && registrationComplete === false) {
    return <Navigate to="/register" replace />;
  }
  return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        {/* Covers the whole applicant registration flow - account creation
            through profile, work experience, L&D, awards, and documents -
            so it isn't wrapped in ProtectedRoute; it manages its own
            authenticated/unauthenticated rendering. */}
        <Route path="/register" element={<RegistrationPage />} />

        {/* Any authenticated role - self-service password change */}
        <Route
          path="/account/password"
          element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />

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
          path="/admin/dashboard"
          element={
            <ProtectedRoute role="ADMIN">
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/jobs"
          element={
            <ProtectedRoute role="ADMIN">
              <JobManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/positions"
          element={
            <ProtectedRoute role="ADMIN">
              <PositionsPage />
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
        <Route
          path="/admin/panel-interviews"
          element={
            <ProtectedRoute role="ADMIN">
              <PanelAssignmentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/criteria"
          element={
            <ProtectedRoute role="ADMIN">
              <EvaluationCriteriaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/compliance-requirements"
          element={
            <ProtectedRoute role="ADMIN">
              <ComplianceRequirementsPage />
            </ProtectedRoute>
          }
        />

        {/* Panel-only */}
        <Route
          path="/panel/interviews"
          element={
            <ProtectedRoute role="PANEL">
              <MyInterviewsPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </Layout>
  );
}
