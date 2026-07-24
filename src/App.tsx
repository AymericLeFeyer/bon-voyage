import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/presentation/theme/ThemeProvider';
import { AuthProvider } from '@/presentation/auth/AuthProvider';
import { RequireAuth } from '@/presentation/components/auth/RequireAuth';
import { HomePage } from '@/presentation/pages/HomePage';
import { TripPage } from '@/presentation/pages/TripPage';
import { AuthPage } from '@/presentation/pages/AuthPage';
import { ProfilePage } from '@/presentation/pages/ProfilePage';
import { InvitePage } from '@/presentation/pages/InvitePage';

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            {/* Lien d'invitation par email (ouvert : gère lui-même la connexion). */}
            <Route path="/invite/:token" element={<InvitePage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <HomePage />
                </RequireAuth>
              }
            />
            <Route
              path="/profil"
              element={
                <RequireAuth>
                  <ProfilePage />
                </RequireAuth>
              }
            />
            {/* Voyage : ouvert (un voyage public est consultable sans compte). */}
            <Route path="/trip/:id" element={<TripPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
