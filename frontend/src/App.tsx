import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './features/auth';
import { FullScreenLoader } from './components/ui/FullScreenLoader';
import { WelcomePage } from './pages/auth/WelcomePage';
import { EnrollmentPage } from './pages/auth/EnrollmentPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { DashboardPage } from './pages/patients/DashboardPage';
import { ArchivesPage } from './pages/patients/ArchivesPage';
import { PatientDetailPage } from './pages/patients/PatientDetailPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { SessionsPage } from './pages/sessions/SessionsPage';
import { SessionWorkspacePage } from './pages/sessions/SessionWorkspacePage';
import { AiReportPage } from './pages/sessions/AiReportPage';
import { ClinicalToolsPage } from './pages/clinicalTools/ClinicalToolsPage';
import { ToolDetailPage } from './pages/clinicalTools/ToolDetailPage';
import { MainLayout } from './components/layout/MainLayout';

function ProtectedRoute({ allowedRoles }: { allowedRoles?: string[] } = {}) {
  const { isAuthenticated, isInitialized, user } = useAuth();
  const location = useLocation();

  // Wait for the session restore to settle. `isAuthenticated` is derived from the user record, which
  // starts empty and is only filled once the identity has been established — so until then "not
  // signed in" and "not known yet" are the same value. Deciding on the first render sent every
  // refresh and every bookmarked link to the login screen, and the `replace` below made the
  // requested URL unrecoverable before the answer even arrived.
  if (!isInitialized) return <FullScreenLoader message="Chargement de votre espace…" />;

  // Carry the requested location so signing in returns there rather than to the dashboard. Stored as
  // a plain path: history state has to be serialisable, and a string is what the login screen
  // validates before navigating to it.
  if (!isAuthenticated) {
    const requested = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from: requested }} />;
  }

  if (allowedRoles && !allowedRoles.some(r => user?.roles?.includes(r))) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<WelcomePage />} />
          <Route path="/enroll" element={<EnrollmentPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="patients/:id" element={<PatientDetailPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route element={<ProtectedRoute allowedRoles={['Admin']} />}>
                <Route path="archives" element={<ArchivesPage />} />
                <Route path="sessions" element={<SessionsPage />} />
                <Route path="sessions/:sessionId" element={<SessionWorkspacePage />} />
                <Route path="sessions/:sessionId/report" element={<AiReportPage />} />
                <Route path="clinical-tools" element={<ClinicalToolsPage />} />
                <Route path="clinical-tools/:id" element={<ToolDetailPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
