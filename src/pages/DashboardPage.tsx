import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pill,
  Boxes,
  AlertTriangle,
  PackageX,
  CalendarClock,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownLeft,
  Calculator,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatDateTime, formatNumber } from '../lib/format';
import { PageKey } from '../components/AppLayout';
import { AnimatedHeading } from '../components/AnimatedHeading';
import { CountUp } from '../components/CountUp';
import { MotionCard } from '../components/MotionCard';
import { PageSkeleton } from '../components/PageSkeleton';
import { useSmoothScroll } from '../components/SmoothScrollProvider';

interface ChartPoint {
  date: string;
  label: string;
  stockIn: number;
  stockOut: number;
}

interface DashboardData {
  stats: {
    totalMedicines: number;
    totalStock: number;
    lowStockCount: number;
    outOfStockCount: number;
    nearExpiryCount: number;
    totalTransactions: number;
  };
  today: string;
  chartData: ChartPoint[];
  recentMovements: {
    id: number;
    medicineId: number;
    medicinePlu: string;
    medicineName: string;
    unit: string;
    movementType: string;
    referenceType: string;
    quantity: number;
    stockAfter: number;
    userName: string;
    notes: string;
    movementDate: string;
  }[];
  urgentMedicines: {
    id: number;
    pluCode: string;
    name: string;
    unit: string;
    stock: number;
    minStock: number;
    nearestExpiredDate: string | null;
  }[];
  latestTopsisRun: {
    id: number;
    title: string;
    periodStart: string;
    periodEnd: string;
    createdByName: string;
    totalAlternatives: number;
    createdAt: string;
  } | null;
  topPriorities: {
    id: number;
    rank: number;
    medicinePlu: string;
    medicineName: string;
    unit: string;
    rawStock: number;
    rawSales: number;
    preferenceValue: number;
    priorityLabel: string;
  }[];
}

const CHART_HEIGHT = 200;
const CHART_WIDTH = 760;
const PAD_LEFT = 42;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 32;
const PLOT_W = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_H = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
const GRID_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];

const DashboardStockChart = React.memo(function DashboardStockChart({
  chartData,
}: {
  chartData: ChartPoint[];
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxVal = useMemo(
    () => Math.max(10, ...chartData.map((d) => Math.max(d.stockIn, d.stockOut))),
    [chartData],
  );
  const groupW = PLOT_W / Math.max(1, chartData.length);
  const barW = Math.min(16, Math.max(6, groupW * 0.32));

  return (
    <div className="mt-4 relative overflow-x-auto">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full min-w-[560px] h-52 select-none"
      >
        {GRID_FRACTIONS.map((frac) => {
          const y = PAD_TOP + PLOT_H * (1 - frac);
          const labelVal = Math.round(maxVal * frac);
          return (
            <g key={frac}>
              <line
                x1={PAD_LEFT}
                y1={y}
                x2={CHART_WIDTH - PAD_RIGHT}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray={frac === 0 ? undefined : '3 3'}
              />
              <text
                x={PAD_LEFT - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-400 text-[10px]"
              >
                {labelVal}
              </text>
            </g>
          );
        })}

        {chartData.map((d, idx) => {
          const xCenter = PAD_LEFT + idx * groupW + groupW / 2;
          const hIn = (d.stockIn / maxVal) * PLOT_H;
          const hOut = (d.stockOut / maxVal) * PLOT_H;
          const isHover = hoveredIdx === idx;
          const dimmed = hoveredIdx !== null && !isHover;
          return (
            <g
              key={d.date}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer transition-opacity duration-150"
              style={{ opacity: dimmed ? 0.45 : 1 }}
            >
              {isHover && (
                <rect
                  x={PAD_LEFT + idx * groupW + 2}
                  y={PAD_TOP}
                  width={groupW - 4}
                  height={PLOT_H}
                  fill="#f1f5f9"
                  rx={4}
                />
              )}
              <rect
                x={xCenter - barW - 1.5}
                y={PAD_TOP + PLOT_H - hIn}
                width={barW}
                height={Math.max(0, hIn)}
                rx={3}
                fill="#10b981"
              />
              <rect
                x={xCenter + 1.5}
                y={PAD_TOP + PLOT_H - hOut}
                width={barW}
                height={Math.max(0, hOut)}
                rx={3}
                fill="#0284c7"
              />
              <text
                x={xCenter}
                y={CHART_HEIGHT - 10}
                textAnchor="middle"
                className={`text-[10px] transition-colors duration-150 ${
                  isHover ? 'fill-slate-900 font-semibold' : 'fill-slate-500'
                }`}
              >
                {idx % 2 === 0 || isHover ? d.label : ''}
              </text>
            </g>
          );
        })}
      </svg>

      {hoveredIdx !== null && chartData[hoveredIdx] && (
        <div className="mt-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg inline-flex items-center gap-4 tabular-nums">
          <span className="font-semibold">{chartData[hoveredIdx].label}</span>
          <span className="text-emerald-300">
            Masuk: {formatNumber(chartData[hoveredIdx].stockIn, 0)} unit
          </span>
          <span className="text-sky-300">
            Keluar: {formatNumber(chartData[hoveredIdx].stockOut, 0)} unit
          </span>
        </div>
      )}
    </div>
  );
});

function stabilizeSlice<T>(prev: T, next: T): T {
  try {
    return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
  } catch {
    return next;
  }
}

function stabilizeDashboardData(prev: DashboardData | null, next: DashboardData): DashboardData {
  if (!prev) return next;
  return {
    stats: stabilizeSlice(prev.stats, next.stats),
    today: prev.today === next.today ? prev.today : next.today,
    chartData: stabilizeSlice(prev.chartData, next.chartData),
    recentMovements: stabilizeSlice(prev.recentMovements, next.recentMovements),
    urgentMedicines: stabilizeSlice(prev.urgentMedicines, next.urgentMedicines),
    latestTopsisRun: stabilizeSlice(prev.latestTopsisRun, next.latestTopsisRun),
    topPriorities: stabilizeSlice(prev.topPriorities, next.topPriorities),
  };
}

const DashboardUrgentList = React.memo(function DashboardUrgentList({
  urgentMedicines,
  onManageStock,
}: {
  urgentMedicines: DashboardData['urgentMedicines'];
  onManageStock: () => void;
}) {
  return (
    <MotionCard index={1} className="bg-white border border-slate-200 rounded-xl flex flex-col">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
        <div>
          <AnimatedHeading
            as="h2"
            text="Perlu Perhatian Segera"
            className="text-sm font-bold text-slate-900"
          />
          <p className="text-xs text-slate-500">Stok kritis atau mendekati kedaluwarsa</p>
        </div>
        <button
          type="button"
          onClick={onManageStock}
          className="text-xs font-medium text-sky-700 hover:underline shrink-0 cursor-pointer"
        >
          Kelola Stok
        </button>
      </div>
      <div data-lenis-prevent className="divide-y divide-slate-100 flex-1 overflow-y-auto">
        {urgentMedicines.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            Semua stok obat dalam kondisi aman.
          </div>
        ) : (
          urgentMedicines.map((m) => (
            <div
              key={m.id}
              className="px-5 py-3 flex items-center justify-between gap-3 transition-colors duration-150 hover:bg-slate-50/80"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">{m.name}</p>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  <span className="font-mono">{m.pluCode}</span> · Min: {m.minStock} {m.unit}
                  {m.nearestExpiredDate ? ` · ED: ${formatDate(m.nearestExpiredDate)}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0 tabular-nums">
                <p
                  className={`text-sm font-bold ${
                    m.stock <= 0
                      ? 'text-rose-600'
                      : m.stock <= m.minStock
                        ? 'text-amber-600'
                        : 'text-slate-800'
                  }`}
                >
                  {formatNumber(m.stock, 0)}
                </p>
                <p className="text-[11px] text-slate-400">{m.unit}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </MotionCard>
  );
});

const DashboardRecentMovements = React.memo(function DashboardRecentMovements({
  recentMovements,
  onViewAll,
}: {
  recentMovements: DashboardData['recentMovements'];
  onViewAll: () => void;
}) {
  return (
    <MotionCard index={0} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <AnimatedHeading
            as="h2"
            text="Aktivitas Mutasi Stok Terbaru"
            className="text-sm font-bold text-slate-900"
          />
          <p className="text-xs text-slate-500">8 transaksi keluar/masuk terakhir</p>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-medium text-sky-700 hover:underline cursor-pointer"
        >
          Lihat Semua
        </button>
      </div>
      <div className="divide-y divide-slate-100">
        {recentMovements.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            Belum ada riwayat pergerakan stok.
          </div>
        ) : (
          recentMovements.map((mv) => {
            const isIn = mv.movementType === 'in';
            return (
              <div
                key={mv.id}
                className="group px-5 py-3 flex items-center justify-between gap-3 transition-colors duration-150 hover:bg-slate-50/80"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-transform duration-150 group-hover:scale-105 ${
                      isIn ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'
                    }`}
                  >
                    {isIn ? (
                      <ArrowDownLeft className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {mv.medicineName}
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {isIn ? 'Stok Masuk' : 'Stok Keluar'} ({mv.referenceType}) · {mv.userName} ·{' '}
                      {formatDateTime(mv.movementDate)}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 tabular-nums">
                  <p className={`text-xs font-bold ${isIn ? 'text-emerald-600' : 'text-sky-700'}`}>
                    {isIn ? '+' : '-'}
                    {formatNumber(mv.quantity, 0)} {mv.unit}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Sisa: {formatNumber(mv.stockAfter, 0)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </MotionCard>
  );
});

const DashboardTopPriorities = React.memo(function DashboardTopPriorities({
  latestTopsisRun,
  topPriorities,
  onOpenTopsis,
}: {
  latestTopsisRun: DashboardData['latestTopsisRun'];
  topPriorities: DashboardData['topPriorities'];
  onOpenTopsis: () => void;
}) {
  return (
    <MotionCard index={1} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <AnimatedHeading
            as="h2"
            text="Top 5 Prioritas Pengadaan TOPSIS Terbaru"
            className="text-sm font-bold text-slate-900"
          />
          <p className="text-xs text-slate-500 truncate">
            {latestTopsisRun
              ? `${latestTopsisRun.title} (${formatDate(latestTopsisRun.periodStart)} – ${formatDate(latestTopsisRun.periodEnd)})`
              : 'Belum ada perhitungan TOPSIS tersimpan'}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenTopsis}
          className="text-xs font-medium text-sky-700 hover:underline shrink-0 cursor-pointer"
        >
          Buka SPK TOPSIS
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-2.5 px-4">Rank</th>
              <th className="py-2.5 px-4">Nama Obat</th>
              <th className="py-2.5 px-4 text-right">Stok</th>
              <th className="py-2.5 px-4 text-right">Nilai V</th>
              <th className="py-2.5 px-4">Status Prioritas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {topPriorities.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  Jalankan analisis TOPSIS untuk melihat urutan prioritas pengadaan obat.
                </td>
              </tr>
            ) : (
              topPriorities.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60">
                  <td className="py-2.5 px-4 font-bold text-sky-700 tabular-nums">#{item.rank}</td>
                  <td className="py-2.5 px-4">
                    <p className="font-semibold text-slate-900">{item.medicineName}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{item.medicinePlu}</p>
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-slate-700">
                    {formatNumber(item.rawStock, 0)} {item.unit}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700 tabular-nums">
                    {item.preferenceValue.toFixed(4)}
                  </td>
                  <td className="py-2.5 px-4 text-slate-700">{item.priorityLabel}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </MotionCard>
  );
});

interface DashboardPageProps {
  onNavigate: (page: PageKey) => void;
  isActive?: boolean;
}

export function DashboardPage({ onNavigate, isActive = true }: DashboardPageProps) {
  const { apiFetch, getCached, mutationVersion } = useAuth();
  const { refreshScrollTriggers } = useSmoothScroll();
  const initialCached = useMemo(() => getCached<DashboardData>('/api/dashboard'), [getCached]);
  const [data, setData] = useState<DashboardData | null>(initialCached);
  const [loading, setLoading] = useState(!initialCached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncedMutationRef = useRef(mutationVersion);
  const prevActiveRef = useRef(isActive);

  const loadDashboard = useCallback(
    async (silent = false, bypassCache = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const res = await apiFetch<DashboardData>(
          '/api/dashboard',
          bypassCache ? { cache: 'no-store' } : {},
        );
        setData((prev) => stabilizeDashboardData(prev, res));
      } catch (err: unknown) {
        if (!silent) {
          setError(err instanceof Error ? err.message : 'Gagal memuat data dashboard.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiFetch],
  );

  useEffect(() => {
    if (!getCached<DashboardData>('/api/dashboard')) {
      loadDashboard(false, false);
    }
  }, [getCached, loadDashboard]);

  useEffect(() => {
    if (isActive && !prevActiveRef.current && syncedMutationRef.current !== mutationVersion) {
      syncedMutationRef.current = mutationVersion;
      if (!getCached<DashboardData>('/api/dashboard')) {
        loadDashboard(true, true);
      }
    } else if (isActive) {
      syncedMutationRef.current = mutationVersion;
    }
    prevActiveRef.current = isActive;
  }, [isActive, mutationVersion, getCached, loadDashboard]);

  const goStock = useCallback(() => onNavigate('stock'), [onNavigate]);
  const goTopsis = useCallback(() => onNavigate('topsis'), [onNavigate]);

  useEffect(() => {
    if (data && isActive) {
      refreshScrollTriggers();
    }
  }, [data, isActive, refreshScrollTriggers]);

  const kpiCards = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: 'Total Jenis Obat',
        value: data.stats.totalMedicines,
        sub: 'Item terdaftar aktif',
        icon: Pill,
        accent: 'text-sky-600',
        target: 'master' as PageKey,
      },
      {
        label: 'Total Stok Obat',
        value: data.stats.totalStock,
        sub: 'Akumulasi seluruh unit',
        icon: Boxes,
        accent: 'text-emerald-600',
        target: 'stock' as PageKey,
      },
      {
        label: 'Obat Stok Menipis',
        value: data.stats.lowStockCount,
        sub: 'Di bawah stok minimum',
        icon: AlertTriangle,
        accent: 'text-amber-600',
        target: 'stock' as PageKey,
      },
      {
        label: 'Obat Stok Habis',
        value: data.stats.outOfStockCount,
        sub: 'Stok 0 (perlu pengadaan)',
        icon: PackageX,
        accent: 'text-rose-600',
        target: 'stock' as PageKey,
      },
      {
        label: 'Mendekati Kedaluwarsa',
        value: data.stats.nearExpiryCount,
        sub: 'ED <= 90 hari ke depan',
        icon: CalendarClock,
        accent: 'text-amber-700',
        target: 'stock' as PageKey,
      },
      {
        label: 'Jumlah Transaksi',
        value: data.stats.totalTransactions,
        sub: 'Riwayat mutasi stok',
        icon: ArrowLeftRight,
        accent: 'text-sky-700',
        target: 'stock' as PageKey,
      },
    ];
  }, [data]);

  if (loading && !data) {
    return <PageSkeleton variant="dashboard" />;
  }

  if (error && !data) {
    return (
      <div className="bg-white border border-rose-200 rounded-xl p-6 text-center space-y-3">
        <p className="text-sm font-medium text-rose-700">{error}</p>
        <button
          type="button"
          onClick={() => loadDashboard(false, true)}
          className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg cursor-pointer"
        >
          Muat Ulang Dashboard
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <AnimatedHeading
            as="h1"
            text="Ringkasan Operasional Apotek Andhika Farma"
            className="text-xl font-bold text-slate-900 tracking-tight"
          />
          <p className="text-xs text-slate-500 mt-0.5">
            Pemantauan persediaan obat FEFO real-time dan rekomendasi prioritas pengadaan TOPSIS.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadDashboard(true, true)}
            disabled={loading || refreshing}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || refreshing ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('topsis')}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Hitung TOPSIS</span>
          </button>
        </div>
      </div>

      {/* 6 KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <MotionCard
              key={card.label}
              as="button"
              index={idx}
              onClick={() => onNavigate(card.target)}
              className="text-left bg-white border border-slate-200 hover:border-sky-300 rounded-xl p-4 cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500 truncate">{card.label}</span>
                <Icon
                  className={`w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-110 ${card.accent}`}
                />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2 tabular-nums">
                <CountUp value={card.value} delay={Math.min(idx * 0.04, 0.16)} />
              </p>
              <p className="text-xs text-slate-500 mt-1 truncate">{card.sub}</p>
            </MotionCard>
          );
        })}
      </div>

      {/* Interactive Stock In/Out Chart + Urgent List */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Chart 2 cols */}
        <MotionCard index={0} className="xl:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <AnimatedHeading
                as="h2"
                text="Grafik Pergerakan Stok Masuk & Keluar (14 Hari Terakhir)"
                className="text-sm font-bold text-slate-900"
              />
              <p className="text-xs text-slate-500 mt-0.5">
                Arahkan kursor pada batang grafik untuk melihat rincian jumlah harian.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                Stok Masuk
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-600 inline-block" />
                Stok Keluar
              </span>
            </div>
          </div>

          <DashboardStockChart chartData={data.chartData} />
        </MotionCard>

        {/* Urgent Medicines 1 col */}
        <DashboardUrgentList urgentMedicines={data.urgentMedicines} onManageStock={goStock} />
      </div>

      {/* Bottom Grid: Recent Activities + Latest TOPSIS Top 5 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Stock Movements */}
        <DashboardRecentMovements recentMovements={data.recentMovements} onViewAll={goStock} />

        {/* Latest TOPSIS Priorities */}
        <DashboardTopPriorities
          latestTopsisRun={data.latestTopsisRun}
          topPriorities={data.topPriorities}
          onOpenTopsis={goTopsis}
        />
      </div>
    </div>
  );
}
