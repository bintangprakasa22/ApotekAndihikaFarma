/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginView } from './components/LoginView';
import { AppLayout, PageKey } from './components/AppLayout';
import { BrandLogo } from './components/BrandLogo';
import { SmoothScrollProvider, useSmoothScroll } from './components/SmoothScrollProvider';
import { DashboardPage } from './pages/DashboardPage';
import { MasterDataPage } from './pages/MasterDataPage';
import { StockManagementPage } from './pages/StockManagementPage';
import { TopsisPage } from './pages/TopsisPage';
import { ReportsPage } from './pages/ReportsPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';

function MainAppRouter() {
  const { profile, loading } = useAuth();
  const [activePage, setActivePage] = useState<PageKey>('dashboard');
  const { scrollToTop, refreshScrollTriggers } = useSmoothScroll();

  useEffect(() => {
    scrollToTop(true);
    refreshScrollTriggers();
  }, [activePage, profile?.uid, scrollToTop, refreshScrollTriggers]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <BrandLogo size="lg" className="mb-3 shadow-sm" />
        <p className="text-sm font-semibold text-slate-800">Apotek Andhika Farma</p>
        <p className="text-xs text-slate-500 mt-1">Memverifikasi sesi dan menyiapkan sistem...</p>
      </div>
    );
  }

  if (!profile) {
    return <LoginView />;
  }

  const resolvedPage: PageKey =
    activePage === 'users' && profile.role !== 'admin' ? 'dashboard' : activePage;

  return (
    <AppLayout activePage={resolvedPage} onNavigate={setActivePage}>
      {resolvedPage === 'dashboard' && <DashboardPage onNavigate={setActivePage} />}
      {resolvedPage === 'master' && <MasterDataPage />}
      {resolvedPage === 'stock' && <StockManagementPage />}
      {resolvedPage === 'topsis' && <TopsisPage />}
      {resolvedPage === 'reports' && <ReportsPage />}
      {resolvedPage === 'users' && profile.role === 'admin' && <AdminSettingsPage />}
    </AppLayout>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <SmoothScrollProvider>
        <AuthProvider>
          <MainAppRouter />
        </AuthProvider>
      </SmoothScrollProvider>
    </MotionConfig>
  );
}
