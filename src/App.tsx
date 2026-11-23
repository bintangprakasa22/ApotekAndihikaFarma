/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginView } from './components/LoginView';
import { AppLayout, PageKey } from './components/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { MasterDataPage } from './pages/MasterDataPage';
import { StockManagementPage } from './pages/StockManagementPage';
import { TopsisPage } from './pages/TopsisPage';
import { ReportsPage } from './pages/ReportsPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';

function MainAppRouter() {
  const { profile, loading } = useAuth();
  const [activePage, setActivePage] = useState<PageKey>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold text-sm mb-3">
          AF
        </div>
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
    <AuthProvider>
      <MainAppRouter />
    </AuthProvider>
  );
}
