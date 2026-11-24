import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Printer, FileSpreadsheet, Search, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { exportToExcel, formatDate, formatDateTime, formatNumber, formatRupiah } from '../lib/format';
import { AnimatedHeading } from '../components/AnimatedHeading';
import { MotionCard } from '../components/MotionCard';
import { ReportsTableSkeleton } from '../components/PageSkeleton';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { useSmoothScroll } from '../components/SmoothScrollProvider';

type ReportType = 'medicines' | 'stock_in' | 'stock_out' | 'low_stock' | 'expiring' | 'topsis';

interface TopsisRunOption {
  id: number;
  title: string;
  periodStart: string;
  periodEnd: string;
}

const REPORT_TABS: { key: ReportType; label: string }[] = [
  { key: 'medicines', label: 'Data Obat' },
  { key: 'stock_in', label: 'Stok Masuk' },
  { key: 'stock_out', label: 'Stok Keluar' },
  { key: 'low_stock', label: 'Stok Menipis & Habis' },
  { key: 'expiring', label: 'Obat Kedaluwarsa' },
  { key: 'topsis', label: 'Hasil TOPSIS' },
];

export function ReportsPage({ isActive = true }: { isActive?: boolean }) {
  const { apiFetch, getCached, mutationVersion } = useAuth();
  const { refreshScrollTriggers } = useSmoothScroll();
  const [reportType, setReportType] = useState<ReportType>('medicines');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [runId, setRunId] = useState('');

  const initialRuns = useMemo(() => getCached<TopsisRunOption[]>('/api/topsis/runs') ?? [], [getCached]);
  const initialMedReport = useMemo(
    () => getCached<{ rows: Record<string, unknown>[] }>('/api/reports/medicines'),
    [getCached],
  );

  const [runs, setRuns] = useState<TopsisRunOption[]>(initialRuns);
  const [rows, setRows] = useState<Record<string, unknown>[]>(initialMedReport?.rows ?? []);
  const [loading, setLoading] = useState(!initialMedReport);
  const [error, setError] = useState<string | null>(null);
  const syncedMutationRef = useRef(mutationVersion);
  const prevActiveRef = useRef(isActive);
  const reportReqIdRef = useRef(0);

  const buildReportUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (reportType === 'topsis' && runId) params.set('runId', runId);
    const qs = params.toString();
    return `/api/reports/${reportType}${qs ? `?${qs}` : ''}`;
  }, [reportType, search, startDate, endDate, runId]);

  const loadTopsisRuns = useCallback(
    async (bypassCache = false) => {
      try {
        const list = await apiFetch<TopsisRunOption[]>(
          '/api/topsis/runs',
          bypassCache ? { cache: 'no-store' } : {},
        );
        setRuns(list);
        if (list.length > 0) {
          setRunId((prev) => prev || String(list[0].id));
        }
      } catch {
        // ignore
      }
    },
    [apiFetch],
  );

  useEffect(() => {
    if (!getCached<TopsisRunOption[]>('/api/topsis/runs')) {
      loadTopsisRuns();
    } else if (initialRuns.length > 0) {
      setRunId((prev) => prev || String(initialRuns[0].id));
    }
  }, [getCached, initialRuns, loadTopsisRuns]);

  const loadReport = useCallback(
    async (silent = false, bypassCache = false) => {
      const url = buildReportUrl();
      if (!bypassCache) {
        const cached = getCached<{ rows: Record<string, unknown>[] }>(url);
        if (cached) {
          setRows(cached.rows || []);
          setLoading(false);
          setError(null);
          return;
        }
      }

      const reqId = ++reportReqIdRef.current;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<{ rows: Record<string, unknown>[] }>(
          url,
          bypassCache ? { cache: 'no-store' } : {},
        );
        if (reqId !== reportReqIdRef.current) return;
        setRows(res.rows || []);
      } catch (err: unknown) {
        if (reqId !== reportReqIdRef.current) return;
        if (!silent) {
          setError(err instanceof Error ? err.message : 'Gagal memuat laporan.');
        }
      } finally {
        if (reqId === reportReqIdRef.current) {
          setLoading(false);
        }
      }
    },
    [apiFetch, buildReportUrl, getCached],
  );

  const prevSearchRef = useRef(search);
  useEffect(() => {
    const searchChanged = prevSearchRef.current !== search;
    prevSearchRef.current = search;

    if (!searchChanged) {
      loadReport(false, false);
      return;
    }
    const t = setTimeout(() => {
      loadReport(false, false);
    }, 200);
    return () => clearTimeout(t);
  }, [search, loadReport]);

  useEffect(() => {
    if (isActive && !prevActiveRef.current && syncedMutationRef.current !== mutationVersion) {
      syncedMutationRef.current = mutationVersion;
      if (!getCached('/api/topsis/runs')) loadTopsisRuns(true);
      if (!getCached(buildReportUrl())) loadReport(true, true);
    } else if (isActive) {
      syncedMutationRef.current = mutationVersion;
    }
    prevActiveRef.current = isActive;
  }, [isActive, mutationVersion, buildReportUrl, getCached, loadTopsisRuns, loadReport]);

  useEffect(() => {
    if (isActive && !loading) {
      refreshScrollTriggers();
    }
  }, [isActive, loading, reportType, refreshScrollTriggers]);

  const currentTabLabel = useMemo(
    () => REPORT_TABS.find((t) => t.key === reportType)?.label ?? '',
    [reportType],
  );

  const handleExport = useCallback(() => {
    if (rows.length === 0) return;
    void exportToExcel(
      rows,
      `Laporan_${reportType}`,
      `Laporan_${reportType}_Apotek_Andhika_Farma.xlsx`,
    );
  }, [rows, reportType]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <AnimatedHeading
            as="h1"
            text="Pusat Laporan Apotek Andhika Farma"
            className="text-xl font-bold text-slate-900 tracking-tight"
          />
          <p className="text-xs text-slate-500 mt-0.5">
            Ekspor dan cetak PDF untuk laporan persediaan obat, pergerakan stok, batch kedaluwarsa,
            dan hasil ranking TOPSIS.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak / PDF</span>
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={rows.length === 0}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Ekspor Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Report Type Selector */}
      <SegmentedTabs
        layoutId="report-tabs"
        activeKey={reportType}
        onChange={setReportType}
        items={REPORT_TABS}
        className="no-print p-1.5 rounded-xl"
        itemClassName="rounded-lg"
      />

      {/* Filters */}
      <MotionCard index={0} hoverLift={false} className="no-print bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center gap-3 text-xs">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter nama obat atau PLU..."
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg"
          />
        </div>

        {(reportType === 'stock_in' || reportType === 'stock_out' || reportType === 'expiring') && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-2 border border-slate-200 rounded-lg"
            />
            <span className="text-slate-400">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-2 border border-slate-200 rounded-lg"
            />
          </div>
        )}

        {reportType === 'topsis' && (
          <select
            value={runId}
            onChange={(e) => setRunId(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
          >
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                #{r.id} — {r.title}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={() => loadReport(false, true)}
          className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer self-start lg:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Muat Ulang</span>
        </button>
      </MotionCard>

      {error && (
        <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Report Table */}
      <MotionCard index={1} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <AnimatedHeading
            as="h2"
            text={`Laporan ${currentTabLabel}`}
            className="text-sm font-bold text-slate-900"
          />
          <span className="text-xs text-slate-500 tabular-nums">
            Total {formatNumber(rows.length, 0)} baris
          </span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <ReportsTableSkeleton />
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Tidak ada data untuk laporan ini.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                  {(reportType === 'medicines' || reportType === 'low_stock') && (
                    <>
                      <th className="py-2.5 px-4">PLU</th>
                      <th className="py-2.5 px-4">Nama Obat</th>
                      <th className="py-2.5 px-4">Kategori</th>
                      <th className="py-2.5 px-4">Satuan</th>
                      <th className="py-2.5 px-4 text-right">Stok</th>
                      <th className="py-2.5 px-4 text-right">Min</th>
                      <th className="py-2.5 px-4 text-right">Harga Beli</th>
                    </>
                  )}
                  {(reportType === 'stock_in' || reportType === 'stock_out') && (
                    <>
                      <th className="py-2.5 px-4">Tanggal</th>
                      <th className="py-2.5 px-4">PLU</th>
                      <th className="py-2.5 px-4">Nama Obat</th>
                      <th className="py-2.5 px-4">Batch</th>
                      <th className="py-2.5 px-4 text-right">Jumlah</th>
                      <th className="py-2.5 px-4 text-right">Stok Akhir</th>
                      <th className="py-2.5 px-4">Petugas &amp; Catatan</th>
                    </>
                  )}
                  {reportType === 'expiring' && (
                    <>
                      <th className="py-2.5 px-4">PLU</th>
                      <th className="py-2.5 px-4">Nama Obat</th>
                      <th className="py-2.5 px-4">No. Batch</th>
                      <th className="py-2.5 px-4">Tanggal ED</th>
                      <th className="py-2.5 px-4 text-right">Sisa Batch</th>
                      <th className="py-2.5 px-4">Supplier</th>
                    </>
                  )}
                  {reportType === 'topsis' && (
                    <>
                      <th className="py-2.5 px-4">Rank</th>
                      <th className="py-2.5 px-4">PLU</th>
                      <th className="py-2.5 px-4">Nama Obat</th>
                      <th className="py-2.5 px-4 text-right">Jual</th>
                      <th className="py-2.5 px-4 text-right">Stok</th>
                      <th className="py-2.5 px-4 text-right">Nilai V</th>
                      <th className="py-2.5 px-4">Prioritas</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, 300).map((r, idx) => (
                  <tr key={String(r.id ?? idx)} className="hover:bg-slate-50/70">
                    {(reportType === 'medicines' || reportType === 'low_stock') && (
                      <>
                        <td className="py-2.5 px-4 font-mono text-slate-600">{String(r.pluCode)}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{String(r.name)}</td>
                        <td className="py-2.5 px-4 text-slate-600">{String(r.categoryName || '-')}</td>
                        <td className="py-2.5 px-4 text-slate-600">{String(r.unit)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-bold">
                          {formatNumber(Number(r.stock), 2)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums">
                          {formatNumber(Number(r.minStock), 0)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums">
                          {formatRupiah(Number(r.purchasePrice))}
                        </td>
                      </>
                    )}
                    {(reportType === 'stock_in' || reportType === 'stock_out') && (
                      <>
                        <td className="py-2.5 px-4 tabular-nums whitespace-nowrap">
                          {formatDateTime(String(r.movementDate))}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-600">{String(r.pluCode)}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">
                          {String(r.medicineName)}
                        </td>
                        <td className="py-2.5 px-4 font-mono">{String(r.batchNumber || '-')}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-bold">
                          {formatNumber(Number(r.quantity), 2)} {String(r.unit)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums">
                          {formatNumber(Number(r.stockAfter), 2)}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {String(r.userName)} · {String(r.notes || '-')}
                        </td>
                      </>
                    )}
                    {reportType === 'expiring' && (
                      <>
                        <td className="py-2.5 px-4 font-mono text-slate-600">{String(r.pluCode)}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">
                          {String(r.medicineName)}
                        </td>
                        <td className="py-2.5 px-4 font-mono">{String(r.batchNumber)}</td>
                        <td className="py-2.5 px-4 tabular-nums font-semibold text-amber-700">
                          {formatDate(String(r.expiredDate))}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-bold">
                          {formatNumber(Number(r.remainingQty), 2)} {String(r.unit)}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {String(r.supplierName || '-')}
                        </td>
                      </>
                    )}
                    {reportType === 'topsis' && (
                      <>
                        <td className="py-2.5 px-4 font-bold text-sky-700 tabular-nums">
                          #{String(r.rank)}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-600">
                          {String(r.medicinePlu)}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">
                          {String(r.medicineName)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums">
                          {formatNumber(Number(r.rawSales), 0)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums">
                          {formatNumber(Number(r.rawStock), 0)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700 tabular-nums">
                          {Number(r.preferenceValue).toFixed(4)}
                        </td>
                        <td className="py-2.5 px-4 font-medium">{String(r.priorityLabel)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {rows.length > 300 && (
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500">
            Menampilkan 300 baris pertama di layar. Gunakan tombol <strong>Ekspor Excel</strong>{' '}
            untuk mengunduh seluruh {formatNumber(rows.length, 0)} baris data.
          </div>
        )}
      </MotionCard>
    </div>
  );
}
