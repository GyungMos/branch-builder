import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Header from './components/layout/Header';
import MobileNav from './components/layout/MobileNav';

// 화면별로 나눠서 필요할 때만 내려받음 (첫 접속 시 받는 양을 줄여 빨리 뜨게)
const LoginPage = lazy(() => import('./pages/LoginPage'));
const BranchListPage = lazy(() => import('./pages/BranchListPage'));
const BranchDetailPage = lazy(() => import('./pages/BranchDetailPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const BranchReportPage = lazy(() => import('./pages/BranchReportPage'));

const pageLoading = (
  <div className="loading-overlay">
    <div className="spinner spinner-lg" />
  </div>
);

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner spinner-lg" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <Suspense fallback={pageLoading}>
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <>
              <Header />
              <BranchListPage />
              <MobileNav />
            </>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <>
              <Header />
              <DashboardPage />
              <MobileNav />
            </>
          </ProtectedRoute>
        }
      />
      <Route
        path="/search"
        element={
          <ProtectedRoute>
            <>
              <Header />
              <SearchPage />
              <MobileNav />
            </>
          </ProtectedRoute>
        }
      />
      <Route
        path="/compare"
        element={
          <ProtectedRoute>
            <>
              <Header />
              <ComparePage />
              <MobileNav />
            </>
          </ProtectedRoute>
        }
      />
      <Route
        path="/branch/:branchId/report"
        element={
          <ProtectedRoute>
            <>
              <Header />
              <BranchReportPage />
            </>
          </ProtectedRoute>
        }
      />
      <Route
        path="/branch/:branchId"
        element={
          <ProtectedRoute>
            <>
              <Header />
              <BranchDetailPage />
            </>
          </ProtectedRoute>
        }
      />
      <Route
        path="/branch/:branchId/timeline"
        element={
          <ProtectedRoute>
            <>
              <Header />
              <BranchDetailPage initialTab="timeline" />
            </>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
