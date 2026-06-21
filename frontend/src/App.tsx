import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './features/auth';
import { WelcomePage } from './pages/auth/WelcomePage';
import { EnrollmentPage } from './pages/auth/EnrollmentPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { DashboardPage } from './pages/patients/DashboardPage';
import { PatientDetailPage } from './pages/patients/PatientDetailPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { SessionsPage } from './pages/sessions/SessionsPage';
import { SessionWorkspacePage } from './pages/sessions/SessionWorkspacePage';
import { ClinicalToolsPage } from './pages/clinicalTools/ClinicalToolsPage';
import { MainLayout } from './components/layout/MainLayout';

function ProtectedRoute({ allowedRoles }: { allowedRoles?: string[] } = {}) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
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
                <Route path="sessions" element={<SessionsPage />} />
                <Route path="sessions/:sessionId" element={<SessionWorkspacePage />} />
                <Route path="clinical-tools" element={<ClinicalToolsPage />} />
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
