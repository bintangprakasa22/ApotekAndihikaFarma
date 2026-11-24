import React, { useCallback, useEffect, useState } from 'react';
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
import { MotionCard } from '../components/MotionCard';
import { useSmoothScroll } from '../components/SmoothScrollProvider';

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
  chartData: {
    date: string;
    label: string;
    stockIn: number;
    stockOut: number;
  }[];
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

interface DashboardPageProps {
  onNavigate: (page: PageKey) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { apiFetch } = useAuth();
  const { refreshScrollTriggers } = useSmoothScroll();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<DashboardData>('/api/dashboard');
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data dashboard.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (data) {
      refreshScrollTriggers();
    }
  }, [data, refreshScrollTriggers]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-80 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-rose-200 rounded-xl p-6 text-center space-y-3">
        <p className="text-sm font-medium text-rose-700">{error}</p>
        <button
          type="button"
          onClick={loadDashboard}
          className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg cursor-pointer"
        >
          Muat Ulang Dashboard
        </button>
      </div>
    );
  }

  if (!data) return null;

  const kpiCards = [
    {
      label: 'Total Jenis Obat',
      value: formatNumber(data.stats.totalMedicines, 0),
      sub: 'Item terdaftar aktif',
      icon: Pill,
      accent: 'text-sky-600',
      onClick: () => onNavigate('master'),
    },
    {
      label: 'Total Stok Obat',
      value: formatNumber(data.stats.totalStock, 0),
      sub: 'Akumulasi seluruh unit',
      icon: Boxes,
      accent: 'text-emerald-600',
      onClick: () => onNavigate('stock'),
    },
    {
      label: 'Obat Stok Menipis',
      value: formatNumber(data.stats.lowStockCount, 0),
      sub: 'Di bawah stok minimum',
      icon: AlertTriangle,
      accent: 'text-amber-600',
      onClick: () => onNavigate('stock'),
    },
    {
      label: 'Obat Stok Habis',
      value: formatNumber(data.stats.outOfStockCount, 0),
      sub: 'Stok 0 (perlu pengadaan)',
      icon: PackageX,
      accent: 'text-rose-600',
      onClick: () => onNavigate('stock'),
    },
    {
      label: 'Mendekati Kedaluwarsa',
      value: formatNumber(data.stats.nearExpiryCount, 0),
      sub: 'ED <= 90 hari ke depan',
      icon: CalendarClock,
      accent: 'text-amber-700',
      onClick: () => onNavigate('stock'),
    },
    {
      label: 'Jumlah Transaksi',
      value: formatNumber(data.stats.totalTransactions, 0),
      sub: 'Riwayat mutasi stok',
      icon: ArrowLeftRight,
      accent: 'text-sky-700',
      onClick: () => onNavigate('stock'),
    },
  ];

  // Chart calculations
  const maxVal = Math.max(
    10,
    ...data.chartData.map((d) => Math.max(d.stockIn, d.stockOut)),
  );
  const chartHeight = 200;
  const chartWidth = 760;
  const padLeft = 42;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 32;
  const plotW = chartWidth - padLeft - padRight;
  const plotH = chartHeight - padTop - padBottom;
  const groupW = plotW / Math.max(1, data.chartData.length);
  const barW = Math.min(16, Math.max(6, groupW * 0.32));

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
            onClick={loadDashboard}
            disabled={loading}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
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
              onClick={card.onClick}
              className="text-left bg-white border border-slate-200 hover:border-sky-300 rounded-xl p-4 cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500 truncate">{card.label}</span>
                <Icon className={`w-4 h-4 shrink-0 ${card.accent}`} />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2 tabular-nums">{card.value}</p>
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

          <div className="mt-4 relative overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full min-w-[560px] h-52 select-none"
            >
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                const y = padTop + plotH * (1 - frac);
                const labelVal = Math.round(maxVal * frac);
                return (
                  <g key={frac}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={chartWidth - padRight}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeDasharray={frac === 0 ? undefined : '3 3'}
                    />
                    <text
                      x={padLeft - 6}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px]"
                    >
                      {labelVal}
                    </text>
                  </g>
                );
              })}

              {data.chartData.map((d, idx) => {
                const xCenter = padLeft + idx * groupW + groupW / 2;
                const hIn = (d.stockIn / maxVal) * plotH;
                const hOut = (d.stockOut / maxVal) * plotH;
                const isHover = hoveredIdx === idx;
                return (
                  <g
                    key={d.date}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="cursor-pointer"
                  >
                    {isHover && (
                      <rect
                        x={padLeft + idx * groupW + 2}
                        y={padTop}
                        width={groupW - 4}
                        height={plotH}
                        fill="#f1f5f9"
                        rx={4}
                      />
                    )}
                    {/* Stok Masuk */}
                    <rect
                      x={xCenter - barW - 1.5}
                      y={padTop + plotH - hIn}
                      width={barW}
                      height={Math.max(0, hIn)}
                      rx={3}
                      fill="#10b981"
                    />
                    {/* Stok Keluar */}
                    <rect
                      x={xCenter + 1.5}
                      y={padTop + plotH - hOut}
                      width={barW}
                      height={Math.max(0, hOut)}
                      rx={3}
                      fill="#0284c7"
                    />
                    {/* Label tanggal */}
                    <text
                      x={xCenter}
                      y={chartHeight - 10}
                      textAnchor="middle"
                      className="fill-slate-500 text-[10px]"
                    >
                      {idx % 2 === 0 || isHover ? d.label : ''}
                    </text>
                  </g>
                );
              })}
            </svg>

            {hoveredIdx !== null && data.chartData[hoveredIdx] && (
              <div className="mt-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg inline-flex items-center gap-4 tabular-nums">
                <span className="font-semibold">{data.chartData[hoveredIdx].label}</span>
                <span className="text-emerald-300">
                  Masuk: {formatNumber(data.chartData[hoveredIdx].stockIn, 0)} unit
                </span>
                <span className="text-sky-300">
                  Keluar: {formatNumber(data.chartData[hoveredIdx].stockOut, 0)} unit
                </span>
              </div>
            )}
          </div>
        </MotionCard>

        {/* Urgent Medicines 1 col */}
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
              onClick={() => onNavigate('stock')}
              className="text-xs font-medium text-sky-700 hover:underline shrink-0 cursor-pointer"
            >
              Kelola Stok
            </button>
          </div>
          <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
            {data.urgentMedicines.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Semua stok obat dalam kondisi aman.
              </div>
            ) : (
              data.urgentMedicines.map((m) => (
                <div key={m.id} className="px-5 py-3 flex items-center justify-between gap-3">
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
      </div>

      {/* Bottom Grid: Recent Activities + Latest TOPSIS Top 5 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Stock Movements */}
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
              onClick={() => onNavigate('stock')}
              className="text-xs font-medium text-sky-700 hover:underline cursor-pointer"
            >
              Lihat Semua
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {data.recentMovements.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Belum ada riwayat pergerakan stok.
              </div>
            ) : (
              data.recentMovements.map((mv) => {
                const isIn = mv.movementType === 'in';
                return (
                  <div key={mv.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
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
                      <p
                        className={`text-xs font-bold ${
                          isIn ? 'text-emerald-600' : 'text-sky-700'
                        }`}
                      >
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

        {/* Latest TOPSIS Priorities */}
        <MotionCard index={1} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <AnimatedHeading
                as="h2"
                text="Top 5 Prioritas Pengadaan TOPSIS Terbaru"
                className="text-sm font-bold text-slate-900"
              />
              <p className="text-xs text-slate-500 truncate">
                {data.latestTopsisRun
                  ? `${data.latestTopsisRun.title} (${formatDate(data.latestTopsisRun.periodStart)} – ${formatDate(data.latestTopsisRun.periodEnd)})`
                  : 'Belum ada perhitungan TOPSIS tersimpan'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('topsis')}
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
                {data.topPriorities.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Jalankan analisis TOPSIS untuk melihat urutan prioritas pengadaan obat.
                    </td>
                  </tr>
                ) : (
                  data.topPriorities.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-4 font-bold text-sky-700 tabular-nums">
                        #{item.rank}
                      </td>
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
      </div>
    </div>
  );
}
