import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { WelcomeView } from './features/auth/WelcomeView';
import { ForgotPasswordView } from './features/auth/ForgotPasswordView';
import { ResetPasswordView } from './features/auth/ResetPasswordView';
import { DashboardView } from './features/patients/DashboardView';
import { PatientDetailView } from './features/patients/PatientDetailView';
import { MainLayout } from './components/layout/MainLayout';

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<WelcomeView />} />
          <Route path="/enroll" element={<Navigate to="/login" replace />} />
          <Route path="/forgot-password" element={<ForgotPasswordView />} />
          <Route path="/reset-password" element={<ResetPasswordView />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route index element={<DashboardView />} />
              <Route path="patients/:id" element={<PatientDetailView />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
