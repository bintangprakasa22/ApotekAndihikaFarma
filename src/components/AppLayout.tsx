import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useAuth, UserProfile } from '../context/AuthContext';
import { formatDateTime } from '../lib/format';
import { BrandLogo } from './BrandLogo';
import { NotificationListSkeleton } from './PageSkeleton';

export type PageKey = 'dashboard' | 'master' | 'stock' | 'topsis' | 'reports' | 'users';

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface NavItemConfig {
  key: PageKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItemConfig[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'master', label: 'Master Data', icon: Pill },
  { key: 'stock', label: 'Manajemen Stok', icon: ArrowLeftRight },
  { key: 'topsis', label: 'SPK TOPSIS', icon: Calculator },
  { key: 'reports', label: 'Laporan', icon: FileSpreadsheet },
  { key: 'users', label: 'Pengguna & Audit', icon: Users, adminOnly: true },
];

const PAGE_TITLE_MAP: Record<PageKey, string> = {
  dashboard: 'Dashboard Operasional',
  master: 'Manajemen Data Obat, Kategori & Supplier',
  stock: 'Manajemen Stok & Batch FEFO',
  topsis: 'SPK Penentuan Prioritas Pengadaan (TOPSIS)',
  reports: 'Pusat Laporan & Ekspor',
  users: 'Manajemen Pengguna & Audit Log',
};

const DRAWER_EASE = [0.22, 1, 0.36, 1] as const;

interface SidebarProps {
  visibleNav: NavItemConfig[];
  activePage: PageKey;
  onSelectNav: (key: PageKey) => void;
  onPrefetchNav?: (key: PageKey) => void;
  profile: UserProfile | null;
  onLogout: () => Promise<void>;
}

const DesktopSidebar = React.memo(function DesktopSidebar({
  visibleNav,
  activePage,
  onSelectNav,
  onPrefetchNav,
  profile,
  onLogout,
}: SidebarProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <aside className="no-print hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-30">
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <BrandLogo size="md" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">Apotek Andhika Farma</p>
            <p className="text-xs text-slate-500 truncate">Stok FEFO · SPK TOPSIS</p>
          </div>
        </div>
      </div>

      <nav data-lenis-prevent className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelectNav(item.key)}
              onMouseEnter={() => onPrefetchNav?.(item.key)}
              onFocus={() => onPrefetchNav?.(item.key)}
              className={`group relative w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30 ${
                isActive
                  ? 'text-sky-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {isActive &&
                (shouldReduceMotion ? (
                  <span className="absolute inset-0 bg-sky-50 rounded-lg" />
                ) : (
                  <motion.span
                    layoutId="desktop-sidebar-active"
                    transition={{ type: 'spring', stiffness: 460, damping: 36, mass: 0.8 }}
                    className="absolute inset-0 bg-sky-50 rounded-lg"
                  />
                ))}
              <Icon
                className={`relative z-10 w-4 h-4 shrink-0 transition-transform duration-150 ${
                  isActive
                    ? 'text-sky-600'
                    : 'text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5'
                }`}
              />
              <span className="relative z-10 truncate">{item.label}</span>
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
          onClick={onLogout}
          className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
});

interface MobileMenuContextValue {
  open: boolean;
  openMenu: () => void;
  closeMenu: () => void;
}

const MobileMenuContext = React.createContext<MobileMenuContextValue>({
  open: false,
  openMenu: () => {},
  closeMenu: () => {},
});

function MobileMenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openMenu = useCallback(() => setOpen(true), []);
  const closeMenu = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, openMenu, closeMenu }), [open, openMenu, closeMenu]);
  return <MobileMenuContext.Provider value={value}>{children}</MobileMenuContext.Provider>;
}

const MobileDrawer = React.memo(function MobileDrawer({
  visibleNav,
  activePage,
  onSelectNav,
  profile,
  onLogout,
}: SidebarProps) {
  const { open, closeMenu: onClose } = React.useContext(MobileMenuContext);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <div
      aria-hidden={!open}
      className={`no-print fixed inset-0 z-50 lg:hidden flex ${
        open ? 'pointer-events-auto visible' : 'pointer-events-none invisible'
      }`}
      style={{
        transition: shouldReduceMotion
          ? undefined
          : open
            ? 'visibility 0s linear 0s'
            : 'visibility 0s linear 200ms',
      }}
    >
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 bg-slate-900/45 touch-none ${
          shouldReduceMotion ? '' : 'transition-opacity duration-200 ease-out will-change-[opacity]'
        } ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <aside
        role="dialog"
        aria-modal={open}
        aria-label="Menu navigasi"
        className={`relative w-72 max-w-[85vw] bg-white h-full flex flex-col border-r border-slate-200 z-10 shadow-lg overscroll-contain transform-gpu [contain:layout_paint] ${
          shouldReduceMotion
            ? ''
            : 'transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform'
        } ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandLogo size="sm" />
            <span className="text-sm font-bold text-slate-900">Apotek Andhika Farma</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
            aria-label="Tutup menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav data-lenis-prevent className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overscroll-contain">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectNav(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  isActive ? 'bg-sky-50 text-sky-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${isActive ? 'text-sky-600' : 'text-slate-400'}`}
                />
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
            onClick={onLogout}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>
    </div>
  );
});

interface TopBarProps {
  pageTitle: string;
  unreadNotifications: number;
  onOpenNotifications: () => void;
}

const TopBar = React.memo(function TopBar({
  pageTitle,
  unreadNotifications,
  onOpenNotifications,
}: TopBarProps) {
  const { openMenu: onOpenMobileMenu } = React.useContext(MobileMenuContext);
  return (
    <header className="no-print sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer touch-manipulation"
          aria-label="Buka menu navigasi"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="text-sm text-slate-500 truncate flex items-center gap-2">
          <span className="hidden sm:inline text-slate-400">Apotek Andhika Farma</span>
          <span className="hidden sm:inline text-slate-300">/</span>
          <span className="font-semibold text-slate-900 truncate">{pageTitle}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onOpenNotifications}
          className="group relative px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
        >
          <Bell className="w-3.5 h-3.5 text-sky-600 transition-transform duration-150 group-hover:scale-110" />
          <span className="hidden sm:inline">Peringatan</span>
          {unreadNotifications > 0 && (
            <span className="font-mono tabular-nums text-xs font-semibold text-amber-700">
              ({unreadNotifications})
            </span>
          )}
        </button>
      </div>
    </header>
  );
});

interface NotificationDrawerProps {
  open: boolean;
  loading: boolean;
  notifList: NotificationItem[];
  onClose: () => void;
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
}

const NotificationDrawer = React.memo(function NotificationDrawer({
  open,
  loading,
  notifList,
  onClose,
  onMarkRead,
  onMarkAllRead,
}: NotificationDrawerProps) {
  const shouldReduceMotion = useReducedMotion();
  const unreadCount = useMemo(
    () => notifList.filter((n) => !n.isRead).length,
    [notifList],
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const panelBody = (
    <>
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Peringatan Stok &amp; Kedaluwarsa</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pemantauan otomatis stok menipis, habis, dan mendekati ED.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-5 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <span className="text-xs text-slate-600 tabular-nums">
          {unreadCount} belum dibaca
        </span>
        <button
          type="button"
          onClick={onMarkAllRead}
          className="text-xs font-medium text-sky-700 hover:text-sky-800 flex items-center gap-1.5 cursor-pointer"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          <span>Tandai semua dibaca</span>
        </button>
      </div>

      <div data-lenis-prevent className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {loading ? (
          <NotificationListSkeleton rows={5} />
        ) : notifList.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Tidak ada peringatan aktif saat ini.
          </div>
        ) : (
          notifList.map((n) => (
            <div
              key={n.id}
              className={`p-4 transition-colors hover:bg-slate-50/70 ${n.isRead ? 'bg-white' : 'bg-sky-50/40'}`}
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
                    onClick={() => onMarkRead(n.id)}
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
    </>
  );

  if (shouldReduceMotion) {
    if (!open) return null;
    return (
      <div className="no-print fixed inset-0 z-50 flex justify-end">
        <div className="fixed inset-0 bg-slate-900/30" onClick={onClose} />
        <div className="relative w-full max-w-md bg-white h-full border-l border-slate-200 flex flex-col z-10 shadow-xl">
          {panelBody}
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="no-print fixed inset-0 z-50 flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.16 } }}
          exit={{ opacity: 0, transition: { duration: 0.14 } }}
        >
          <div
            className="fixed inset-0 bg-slate-900/35 touch-none"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md bg-white h-full border-l border-slate-200 flex flex-col z-10 shadow-xl will-change-transform"
            initial={{ x: '100%' }}
            animate={{ x: 0, transition: { duration: 0.22, ease: DRAWER_EASE } }}
            exit={{ x: '100%', transition: { duration: 0.16, ease: 'easeIn' } }}
          >
            {panelBody}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

interface AppLayoutProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  onPrefetchPage?: (page: PageKey) => void;
  children: React.ReactNode;
}

const MobileNavSelectWrapper = React.memo(function MobileNavSelectWrapper({
  visibleNav,
  activePage,
  onNavigate,
  profile,
  onLogout,
}: {
  visibleNav: NavItemConfig[];
  activePage: PageKey;
  onNavigate: (key: PageKey) => void;
  profile: UserProfile | null;
  onLogout: () => Promise<void>;
}) {
  const { closeMenu } = React.useContext(MobileMenuContext);
  const handleSelect = useCallback(
    (key: PageKey) => {
      onNavigate(key);
      closeMenu();
    },
    [onNavigate, closeMenu],
  );
  return (
    <MobileDrawer
      visibleNav={visibleNav}
      activePage={activePage}
      onSelectNav={handleSelect}
      profile={profile}
      onLogout={onLogout}
    />
  );
});

export function AppLayout({ activePage, onNavigate, onPrefetchPage, children }: AppLayoutProps) {
  const { profile, unreadNotifications, logout, refreshProfile, getCached, apiFetch } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifList, setNotifList] = useState<NotificationItem[]>([]);
  const [loadingNotif, setLoadingNotif] = useState(false);

  const visibleNav = useMemo(
    () => NAV_ITEMS.filter((item) => !item.adminOnly || profile?.role === 'admin'),
    [profile?.role],
  );

  const openNotifications = useCallback(async () => {
    setNotifOpen(true);
    const cached = getCached<{ notifications: NotificationItem[] }>('/api/alerts');
    if (cached) {
      setNotifList(cached.notifications || []);
      setLoadingNotif(false);
      return;
    }
    setLoadingNotif(true);
    try {
      const data = await apiFetch<{ notifications: NotificationItem[] }>('/api/alerts');
      setNotifList(data.notifications || []);
    } catch {
      // Ignore silent panel error
    } finally {
      setLoadingNotif(false);
    }
  }, [apiFetch, getCached]);

  const closeNotifications = useCallback(() => {
    setNotifOpen(false);
  }, []);

  const markRead = useCallback(
    async (id: number) => {
      try {
        await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
        setNotifList((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
        await refreshProfile();
      } catch {
        // ignore
      }
    },
    [apiFetch, refreshProfile],
  );

  const markAllRead = useCallback(async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      setNotifList((prev) => prev.map((n) => ({ ...n, isRead: true })));
      await refreshProfile();
    } catch {
      // ignore
    }
  }, [apiFetch, refreshProfile]);

  return (
    <MobileMenuProvider>
      <div className="min-h-screen bg-slate-50 flex">
        <DesktopSidebar
          visibleNav={visibleNav}
          activePage={activePage}
          onSelectNav={onNavigate}
          onPrefetchNav={onPrefetchPage}
          profile={profile}
          onLogout={logout}
        />

        <MobileNavSelectWrapper
          visibleNav={visibleNav}
          activePage={activePage}
          onNavigate={onNavigate}
          profile={profile}
          onLogout={logout}
        />

        {/* Main Content Area */}
        <div className="flex-1 lg:pl-64 print:pl-0 flex flex-col min-w-0">
          <TopBar
            pageTitle={PAGE_TITLE_MAP[activePage]}
            unreadNotifications={unreadNotifications}
            onOpenNotifications={openNotifications}
          />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto overflow-x-clip">
            {children}
          </main>
        </div>

        <NotificationDrawer
          open={notifOpen}
          loading={loadingNotif}
          notifList={notifList}
          onClose={closeNotifications}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
        />
      </div>
    </MobileMenuProvider>
  );
}
