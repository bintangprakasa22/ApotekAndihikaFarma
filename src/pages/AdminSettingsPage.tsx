import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UserPlus, ShieldCheck, Activity, X } from 'lucide-react';
import { useAuth, UserProfile, UserRole } from '../context/AuthContext';
import { formatDateTime } from '../lib/format';
import { AnimatedHeading } from '../components/AnimatedHeading';
import { MotionCard } from '../components/MotionCard';
import { MotionModal } from '../components/MotionModal';
import { TableRowsSkeleton } from '../components/PageSkeleton';
import { useSmoothScroll } from '../components/SmoothScrollProvider';

interface AuditLogRow {
  id: number;
  userEmail: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export function AdminSettingsPage({ isActive = true }: { isActive?: boolean }) {
  const { apiFetch, getCached, profile, mutationVersion } = useAuth();
  const { refreshScrollTriggers } = useSmoothScroll();
  const initialUsers = useMemo(() => getCached<UserProfile[]>('/api/users'), [getCached]);
  const initialLogs = useMemo(() => getCached<AuditLogRow[]>('/api/audit-logs?limit=40'), [getCached]);
  const [users, setUsers] = useState<UserProfile[]>(initialUsers ?? []);
  const [logs, setLogs] = useState<AuditLogRow[]>(initialLogs ?? []);
  const [loading, setLoading] = useState(!(initialUsers && initialLogs));
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const syncedMutationRef = useRef(mutationVersion);
  const prevActiveRef = useRef(isActive);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    fullName: '',
    role: 'petugas' as UserRole,
  });
  const [savingInvite, setSavingInvite] = useState(false);

  const loadData = useCallback(
    async (silent = false, bypassCache = false) => {
      if (!bypassCache) {
        const cachedUsers = getCached<UserProfile[]>('/api/users');
        const cachedLogs = getCached<AuditLogRow[]>('/api/audit-logs?limit=40');
        if (cachedUsers && cachedLogs) {
          setUsers(cachedUsers);
          setLogs(cachedLogs);
          setLoading(false);
          return;
        }
      }
      if (!silent) setLoading(true);
      try {
        const opts = bypassCache ? { cache: 'no-store' as RequestCache } : {};
        const [uList, lList] = await Promise.all([
          apiFetch<UserProfile[]>('/api/users', opts),
          apiFetch<AuditLogRow[]>('/api/audit-logs?limit=40', opts),
        ]);
        setUsers(uList);
        setLogs(lList);
      } catch (err: unknown) {
        if (!silent) {
          setFeedback({
            type: 'error',
            text: err instanceof Error ? err.message : 'Gagal memuat data pengguna dan audit.',
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [apiFetch, getCached],
  );

  useEffect(() => {
    if (!getCached('/api/users') || !getCached('/api/audit-logs?limit=40')) {
      loadData(false, false);
    }
  }, [getCached, loadData]);

  useEffect(() => {
    if (isActive && !prevActiveRef.current && syncedMutationRef.current !== mutationVersion) {
      syncedMutationRef.current = mutationVersion;
      if (!getCached('/api/users') || !getCached('/api/audit-logs?limit=40')) {
        loadData(true, true);
      }
    } else if (isActive) {
      syncedMutationRef.current = mutationVersion;
    }
    prevActiveRef.current = isActive;
  }, [isActive, mutationVersion, getCached, loadData]);

  useEffect(() => {
    if (!loading && isActive) {
      refreshScrollTriggers();
    }
  }, [loading, isActive, refreshScrollTriggers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingInvite(true);
    setFeedback(null);
    try {
      await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(inviteForm),
      });
      setFeedback({
        type: 'success',
        text: `Pengguna ${inviteForm.email} berhasil didaftarkan sebagai ${inviteForm.role}.`,
      });
      setInviteOpen(false);
      setInviteForm({ email: '', fullName: '', role: 'petugas' });
      await loadData();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mendaftarkan pengguna.',
      });
    } finally {
      setSavingInvite(false);
    }
  };

  const updateUser = async (id: number, patch: { role?: UserRole; isActive?: boolean }) => {
    setFeedback(null);
    try {
      await apiFetch(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setFeedback({ type: 'success', text: 'Hak akses pengguna berhasil diperbarui.' });
      await loadData();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memperbarui pengguna.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <AnimatedHeading
            as="h1"
            text="Manajemen Pengguna & Audit Log"
            className="text-xl font-bold text-slate-900 tracking-tight"
          />
          <p className="text-xs text-slate-500 mt-0.5">
            Pengaturan akun Admin dan Petugas/Apoteker serta catatan jejak aktivitas sistem.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Daftarkan Pengguna</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-medium flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} className="cursor-pointer p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Users Table */}
      <MotionCard index={0} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-sky-600" />
          <AnimatedHeading
            as="h2"
            text="Daftar Akun & Role Pengguna"
            className="text-sm font-bold text-slate-900"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                <th className="py-3 px-4">Nama Lengkap</th>
                <th className="py-3 px-4">Email Google</th>
                <th className="py-3 px-4">Status Verifikasi</th>
                <th className="py-3 px-4">Role Akses</th>
                <th className="py-3 px-4">Status Akun</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && users.length === 0 ? (
                <TableRowsSkeleton cols={5} rows={4} />
              ) : (
                users.map((u) => {
                  const isSelf = u.id === profile?.id;
                  const isPending = u.uid.startsWith('pending:');
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {u.fullName} {isSelf ? '(Anda)' : ''}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{u.email}</td>
                      <td className="py-3 px-4 text-slate-500">
                        {isPending ? 'Menunggu login pertama' : 'Terverifikasi'}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          disabled={isSelf}
                          value={u.role}
                          onChange={(e) =>
                            updateUser(u.id, { role: e.target.value as UserRole })
                          }
                          className="px-2.5 py-1.5 border border-slate-200 rounded-md bg-white disabled:opacity-50"
                        >
                          <option value="admin">Admin</option>
                          <option value="petugas">Petugas / Apoteker</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() => updateUser(u.id, { isActive: !u.isActive })}
                          className={`px-3 py-1 rounded-md font-semibold cursor-pointer disabled:opacity-50 ${
                            u.isActive
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          }`}
                        >
                          {u.isActive ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </MotionCard>

      {/* Audit Logs */}
      <MotionCard index={1} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-600" />
          <AnimatedHeading
            as="h2"
            text="Audit Log Aktivitas Terbaru"
            className="text-sm font-bold text-slate-900"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                <th className="py-2.5 px-4">Waktu</th>
                <th className="py-2.5 px-4">Pengguna</th>
                <th className="py-2.5 px-4">Aksi</th>
                <th className="py-2.5 px-4">Entitas</th>
                <th className="py-2.5 px-4">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && logs.length === 0 ? (
                <TableRowsSkeleton cols={5} rows={5} />
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Belum ada catatan audit.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-4 text-slate-600 tabular-nums whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-medium text-slate-900">{log.userEmail}</span> ·{' '}
                      <span className="text-slate-500 uppercase">{log.userRole}</span>
                    </td>
                    <td className="py-2.5 px-4 font-mono font-semibold text-sky-700">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {log.entityType} {log.entityId ? `#${log.entityId}` : ''}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 max-w-md truncate">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </MotionCard>

      {/* Invite Modal */}
      <MotionModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        maxWidthClass="max-w-md"
      >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Daftarkan Pengguna Baru</h3>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Email Akun Google*
                </label>
                <input
                  required
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="apoteker@gmail.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap*</label>
                <input
                  required
                  value={inviteForm.fullName}
                  onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
                  placeholder="Apt. Siti Rahma, S.Farm"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role*</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, role: e.target.value as UserRole })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="petugas">Petugas / Apoteker</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingInvite}
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg cursor-pointer"
                >
                  {savingInvite ? 'Menyimpan...' : 'Daftarkan'}
                </button>
              </div>
            </form>
      </MotionModal>
    </div>
  );
}
