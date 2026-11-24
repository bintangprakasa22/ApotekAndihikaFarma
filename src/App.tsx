/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useCallback, useMemo } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, MotionConfig } from 'motion/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout, PageKey } from './components/AppLayout';
import { BrandLogo } from './components/BrandLogo';
import { PageSkeleton } from './components/PageSkeleton';
import { PageTransition } from './components/PageTransition';
import { SmoothScrollProvider, useSmoothScroll } from './components/SmoothScrollProvider';

const loadLoginView = () => import('./components/LoginView');
const loadDashboardPage = () => import('./pages/DashboardPage');
const loadMasterDataPage = () => import('./pages/MasterDataPage');
const loadStockManagementPage = () => import('./pages/StockManagementPage');
const loadTopsisPage = () => import('./pages/TopsisPage');
const loadReportsPage = () => import('./pages/ReportsPage');
const loadAdminSettingsPage = () => import('./pages/AdminSettingsPage');

const LoginView = lazy(() =>
  loadLoginView().then((m) => ({ default: m.LoginView })),
);
const DashboardPage = lazy(() =>
  loadDashboardPage().then((m) => ({ default: m.DashboardPage })),
);
const MasterDataPage = lazy(() =>
  loadMasterDataPage().then((m) => ({ default: m.MasterDataPage })),
);
const StockManagementPage = lazy(() =>
  loadStockManagementPage().then((m) => ({ default: m.StockManagementPage })),
);
const TopsisPage = lazy(() =>
  loadTopsisPage().then((m) => ({ default: m.TopsisPage })),
);
const ReportsPage = lazy(() =>
  loadReportsPage().then((m) => ({ default: m.ReportsPage })),
);
const AdminSettingsPage = lazy(() =>
  loadAdminSettingsPage().then((m) => ({ default: m.AdminSettingsPage })),
);

const PAGE_LOADERS: Record<PageKey, () => Promise<unknown>> = {
  dashboard: loadDashboardPage,
  master: loadMasterDataPage,
  stock: loadStockManagementPage,
  topsis: loadTopsisPage,
  reports: loadReportsPage,
  users: loadAdminSettingsPage,
};

const PAGE_TO_PATH: Record<PageKey, string> = {
  dashboard: '/',
  master: '/master-data',
  stock: '/stok',
  topsis: '/topsis',
  reports: '/laporan',
  users: '/pengguna',
};

function resolvePageFromPath(pathname: string, isAdmin: boolean): PageKey {
  if (pathname === '/master-data') return 'master';
  if (pathname === '/stok') return 'stock';
  if (pathname === '/topsis') return 'topsis';
  if (pathname === '/laporan') return 'reports';
  if (pathname === '/pengguna') return isAdmin ? 'users' : 'dashboard';
  return 'dashboard';
}

function MainAppRouter() {
  const { profile, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { scrollToTop, refreshScrollTriggers } = useSmoothScroll();

  const isAdmin = profile?.role === 'admin';

  const activePage = useMemo(
    () => resolvePageFromPath(location.pathname, isAdmin),
    [location.pathname, isAdmin],
  );

  const handleNavigate = useCallback(
    (page: PageKey) => {
      const targetPath = PAGE_TO_PATH[page] ?? '/';
      if (location.pathname !== targetPath) {
        navigate(targetPath);
      }
    },
    [location.pathname, navigate],
  );

  const handlePrefetchPage = useCallback((page: PageKey) => {
    void PAGE_LOADERS[page]?.();
  }, []);

  const handleExitComplete = useCallback(() => {
    scrollToTop(true);
  }, [scrollToTop]);

  const authViewKey = loading ? 'auth-loading' : !profile ? 'login' : 'app-shell';

  return (
    <AnimatePresence mode="wait" initial={false}>
      {authViewKey === 'auth-loading' && (
        <PageTransition key="auth-loading" className="min-h-screen">
          <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
            <BrandLogo size="lg" className="mb-3 shadow-sm" />
            <p className="text-sm font-semibold text-slate-800">Apotek Andhika Farma</p>
            <p className="text-xs text-slate-500 mt-1">Memverifikasi sesi dan menyiapkan sistem...</p>
          </div>
        </PageTransition>
      )}

      {authViewKey === 'login' && (
        <PageTransition key="login" onEnterComplete={refreshScrollTriggers} className="min-h-screen">
          <Suspense fallback={<PageSkeleton variant="login" />}>
            <LoginView />
          </Suspense>
        </PageTransition>
      )}

      {authViewKey === 'app-shell' && profile && (
        <PageTransition key="app-shell" className="min-h-screen">
          <AppLayout
            activePage={activePage}
            onNavigate={handleNavigate}
            onPrefetchPage={handlePrefetchPage}
          >
            <AnimatePresence mode="wait" initial={false} onExitComplete={handleExitComplete}>
              <PageTransition
                key={location.pathname}
                onEnterComplete={refreshScrollTriggers}
              >
                <Routes location={location}>
                  <Route
                    path="/"
                    element={
                      <Suspense fallback={<PageSkeleton variant="dashboard" />}>
                        <DashboardPage onNavigate={handleNavigate} />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/master-data"
                    element={
                      <Suspense fallback={<PageSkeleton variant="master" />}>
                        <MasterDataPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/stok"
                    element={
                      <Suspense fallback={<PageSkeleton variant="stock" />}>
                        <StockManagementPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/topsis"
                    element={
                      <Suspense fallback={<PageSkeleton variant="topsis" />}>
                        <TopsisPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/laporan"
                    element={
                      <Suspense fallback={<PageSkeleton variant="reports" />}>
                        <ReportsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/pengguna"
                    element={
                      isAdmin ? (
                        <Suspense fallback={<PageSkeleton variant="users" />}>
                          <AdminSettingsPage />
                        </Suspense>
                      ) : (
                        <Navigate to="/" replace />
                      )
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </PageTransition>
            </AnimatePresence>
          </AppLayout>
        </PageTransition>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <SmoothScrollProvider>
          <AuthProvider>
            <MainAppRouter />
          </AuthProvider>
        </SmoothScrollProvider>
      </BrowserRouter>
    </MotionConfig>
  );
}
