import { Toaster } from "@/components/ui/toaster"
import { useEffect } from 'react';
import { startFirebaseSync, stopFirebaseSync } from '@/lib/firebaseSync';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AdminLayout from '@/components/admin/AdminLayout';
import Dashboard from '@/pages/Dashboard';
import LiveMap from '@/pages/LiveMap';
import Trains from '@/pages/Trains';
import Alerts from '@/pages/Alerts';
import Workflows from '@/pages/Workflows';
import Analytics from '@/pages/Analytics';
import PassengerView from '@/pages/PassengerView';
import AdminLogin from '@/pages/AdminLogin';
import PassengerPortal from '@/pages/PassengerPortal';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // ── Firebase Sync: mirrors all simulation data to Firestore ──────────────
  useEffect(() => {
    startFirebaseSync();
    return () => stopFirebaseSync();
  }, []);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-xs text-muted-foreground font-mono">Loading RailTwin AI...</span>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/passenger-portal" element={<PassengerPortal />} />

      {/* Admin routes with layout */}
      <Route element={<AdminLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/map" element={<LiveMap />} />
        <Route path="/trains" element={<Trains />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/workflows" element={<Workflows />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/passenger" element={<PassengerView />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;