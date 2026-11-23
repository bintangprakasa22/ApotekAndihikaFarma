import React, { useState } from 'react';
import {
  LayoutDashboard,
  Pill,
  ArrowLeftRight,
  Calculator,
  FileSpreadsheet,
  Users,
  Bell,
  Menu,
  X,
  LogOut,
  CheckCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../lib/format';

export type PageKey = 'dashboard' | 'master' | 'stock' | 'topsis' | 'reports' | 'users';

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface AppLayoutProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  children: React.ReactNode;
}

export function AppLayout({ activePage, onNavigate, children }: AppLayoutProps) {
  const { profile, unreadNotifications, logout, refreshProfile, apiFetch } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifList, setNotifList] = useState<NotificationItem[]>([]);
  const [loadingNotif, setLoadingNotif] = useState(false);

  const navItems: { key: PageKey; label: string; icon: React.ComponentType<{ className?: string }>; adminOnly?: boolean }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'master', label: 'Master Data', icon: Pill },
    { key: 'stock', label: 'Manajemen Stok', icon: ArrowLeftRight },
    { key: 'topsis', label: 'SPK TOPSIS', icon: Calculator },
    { key: 'reports', label: 'Laporan', icon: FileSpreadsheet },
    { key: 'users', label: 'Pengguna & Audit', icon: Users, adminOnly: true },
  ];

  const visibleNav = navItems.filter((item) => !item.adminOnly || profile?.role === 'admin');

  const pageTitleMap: Record<PageKey, string> = {
    dashboard: 'Dashboard Operasional',
    master: 'Manajemen Data Obat, Kategori & Supplier',
    stock: 'Manajemen Stok & Batch FEFO',
    topsis: 'SPK Penentuan Prioritas Pengadaan (TOPSIS)',
    reports: 'Pusat Laporan & Ekspor',
    users: 'Manajemen Pengguna & Audit Log',
  };

  const openNotifications = async () => {
    setNotifOpen(true);
    setLoadingNotif(true);
    try {
      const data = await apiFetch<{ notifications: NotificationItem[] }>('/api/alerts');
      setNotifList(data.notifications || []);
    } catch {
      // Ignore silent panel error
    } finally {
      setLoadingNotif(false);
    }
  };

  const markRead = async (id: number) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      setNotifList((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      await refreshProfile();
    } catch {
      // ignore
    }
  };

  const markAllRead = async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      setNotifList((prev) => prev.map((n) => ({ ...n, isRead: true })));
      await refreshProfile();
    } catch {
      // ignore
    }
  };

  const handleSelectNav = (key: PageKey) => {
    onNavigate(key);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-30">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
              AF
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">Apotek Andhika Farma</p>
              <p className="text-xs text-slate-500 truncate">Stok FEFO · SPK TOPSIS</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleSelectNav(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-sky-50 text-sky-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="text-xs">
            <p className="font-semibold text-slate-900 truncate">{profile?.fullName}</p>
            <p className="text-slate-500 truncate mt-0.5">
              {profile?.role === 'admin' ? 'Admin' : 'Petugas / Apoteker'} · {profile?.email}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col border-r border-slate-200 z-10">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-xs">
                  AF
                </div>
                <span className="text-sm font-bold text-slate-900">Apotek Andhika Farma</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg"
                aria-label="Tutup menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const isActive = activePage === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleSelectNav(item.key)}
                    className={`w-full flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-sky-50 text-sky-700'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-900 truncate">{profile?.fullName}</p>
              <p className="text-xs text-slate-500 truncate">
                {profile?.role === 'admin' ? 'Admin' : 'Petugas / Apoteker'}
              </p>
              <button
                type="button"
                onClick={logout}
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on left, primary utility action on right */}
        <header className="no-print sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm text-slate-500 truncate flex items-center gap-2">
              <span className="hidden sm:inline text-slate-400">Apotek Andhika Farma</span>
              <span className="hidden sm:inline text-slate-300">/</span>
              <span className="font-semibold text-slate-900 truncate">{pageTitleMap[activePage]}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={openNotifications}
              className="relative px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Bell className="w-3.5 h-3.5 text-sky-600" />
              <span className="hidden sm:inline">Peringatan</span>
              {unreadNotifications > 0 && (
                <span className="font-mono tabular-nums text-xs font-semibold text-amber-700">
                  ({unreadNotifications})
                </span>
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Notification Slide-over Drawer */}
      {notifOpen && (
        <div className="no-print fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-slate-900/30" onClick={() => setNotifOpen(false)} />
          <div className="relative w-full max-w-md bg-white h-full border-l border-slate-200 flex flex-col z-10">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Peringatan Stok &amp; Kedaluwarsa</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pemantauan otomatis stok menipis, habis, dan mendekati ED.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNotifOpen(false)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-xs text-slate-600 tabular-nums">
                {notifList.filter((n) => !n.isRead).length} belum dibaca
              </span>
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-sky-700 hover:text-sky-800 flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Tandai semua dibaca</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {loadingNotif ? (
                <div className="p-5 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : notifList.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  Tidak ada peringatan aktif saat ini.
                </div>
              ) : (
                notifList.map((n) => (
                  <div
                    key={n.id}
                    className={`p-4 transition-colors ${n.isRead ? 'bg-white' : 'bg-sky-50/40'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-500">
                          {n.type === 'out_of_stock'
                            ? 'Stok Habis'
                            : n.type === 'low_stock'
                              ? 'Stok Menipis'
                              : n.type === 'expired'
                                ? 'Kedaluwarsa'
                                : 'Mendekati Kedaluwarsa'}{' '}
                          · {formatDateTime(n.createdAt)}
                        </p>
                        <p className="text-sm font-semibold text-slate-900 mt-0.5">{n.title}</p>
                        <p className="text-xs text-slate-600 mt-1">{n.message}</p>
                      </div>
                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={() => markRead(n.id)}
                          className="text-xs font-medium text-sky-700 hover:underline shrink-0 cursor-pointer"
                        >
                          Tandai dibaca
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
