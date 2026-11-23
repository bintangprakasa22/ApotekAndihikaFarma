import React, { useCallback, useEffect, useState } from 'react';
import {
  Calculator,
  Printer,
  FileSpreadsheet,
  Save,
  History,
  Trash2,
  Search,
  CheckSquare,
  Square,
  Info,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { exportToExcel, formatDate, formatDateTime, formatNumber, formatRupiah } from '../lib/format';
import { TopsisAlternativeResult } from '../lib/topsis';

type TopsisTab = 'analyze' | 'results' | 'history';

interface CriterionRow {
  id: number;
  code: 'K1' | 'K2' | 'K3' | 'K4' | 'K5';
  name: string;
  originalType: 'benefit' | 'cost';
  calculationType: 'benefit' | 'cost';
  weight: number;
  description: string;
}

interface CandidateRow {
  medicineId: number;
  medicinePlu: string;
  medicineName: string;
  unit: string;
  categoryName: string;
  supplierName: string;
  rawSales: number;
  rawStock: number;
  rawLeadTime: number;
  rawExpiryMonths: number;
  rawPurchasePrice: number;
  isEstimatedPrice?: boolean;
  scoreK1: number;
  scoreK2: number;
  scoreK3: number;
  scoreK4: number;
  scoreK5: number;
  overrideK1?: number;
  overrideK2?: number;
  overrideK3?: number;
  overrideK4?: number;
  overrideK5?: number;
}

interface TopsisRunSummary {
  id: number;
  title: string;
  periodStart: string;
  periodEnd: string;
  createdByName: string;
  weightsSnapshot: Record<string, number>;
  idealPositive: Record<string, number>;
  idealNegative: Record<string, number>;
  totalAlternatives: number;
  notes: string;
  createdAt: string;
}

interface TopsisRunDetail {
  run: TopsisRunSummary;
  results: TopsisAlternativeResult[];
  divisors: Record<string, number>;
  idealPositive: Record<string, number>;
  idealNegative: Record<string, number>;
}

export function TopsisPage() {
  const { apiFetch, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [activeTab, setActiveTab] = useState<TopsisTab>('analyze');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Criteria & weights
  const [criteria, setCriteria] = useState<CriterionRow[]>([]);
  const [weightEdits, setWeightEdits] = useState<Record<string, string>>({});
  const [savingWeights, setSavingWeights] = useState(false);

  // Analysis parameters & candidates
  const now = new Date();
  const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const defaultEnd = now.toISOString().slice(0, 10);

  const [title, setTitle] = useState(
    `Prioritas Pengadaan Obat (${now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })})`,
  );
  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(defaultEnd);
  const [notes, setNotes] = useState('');
  const [candidateMode, setCandidateMode] = useState<'featured' | 'critical' | 'search'>('featured');
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [runningTopsis, setRunningTopsis] = useState(false);

  // Results & History
  const [runs, setRuns] = useState<TopsisRunSummary[]>([]);
  const [activeDetail, setActiveDetail] = useState<TopsisRunDetail | null>(null);
  const [deleteRunTarget, setDeleteRunTarget] = useState<TopsisRunSummary | null>(null);

  const loadCriteria = useCallback(async () => {
    try {
      const rows = await apiFetch<CriterionRow[]>('/api/topsis/criteria');
      setCriteria(rows);
      const map: Record<string, string> = {};
      for (const c of rows) map[c.code] = String(c.weight);
      setWeightEdits(map);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memuat kriteria TOPSIS.',
      });
    }
  }, [apiFetch]);

  const loadCandidates = useCallback(async () => {
    setLoadingCandidates(true);
    try {
      const params = new URLSearchParams({
        periodStart,
        periodEnd,
        mode: candidateSearch.trim() ? 'search' : candidateMode,
        limit: '30',
      });
      if (candidateSearch.trim()) params.set('search', candidateSearch.trim());

      const res = await apiFetch<{ candidates: CandidateRow[] }>(`/api/topsis/candidates?${params}`);
      setCandidates(res.candidates);
      setSelectedIds(new Set(res.candidates.slice(0, 10).map((c) => c.medicineId)));
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memuat kandidat obat.',
      });
    } finally {
      setLoadingCandidates(false);
    }
  }, [apiFetch, periodStart, periodEnd, candidateMode, candidateSearch]);

  const loadRunDetail = useCallback(
    async (runId: number) => {
      try {
        const detail = await apiFetch<TopsisRunDetail>(`/api/topsis/runs/${runId}`);
        setActiveDetail(detail);
      } catch (err: unknown) {
        setFeedback({
          type: 'error',
          text: err instanceof Error ? err.message : 'Gagal memuat detail TOPSIS.',
        });
      }
    },
    [apiFetch],
  );

  const loadRuns = useCallback(
    async (autoOpenLatest = false) => {
      try {
        const list = await apiFetch<TopsisRunSummary[]>('/api/topsis/runs');
        setRuns(list);
        if (autoOpenLatest && list.length > 0 && !activeDetail) {
          await loadRunDetail(list[0].id);
        }
      } catch {
        // ignore
      }
    },
    [apiFetch, activeDetail, loadRunDetail],
  );

  useEffect(() => {
    loadCriteria();
    loadRuns(true);
  }, [loadCriteria, loadRuns]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadCandidates();
    }, 250);
    return () => clearTimeout(t);
  }, [loadCandidates]);

  const handleSaveWeights = async () => {
    if (!isAdmin) return;
    setSavingWeights(true);
    setFeedback(null);
    try {
      const payload = criteria.map((c) => ({
        code: c.code,
        weight: Number(weightEdits[c.code] ?? c.weight),
      }));
      const updated = await apiFetch<CriterionRow[]>('/api/topsis/criteria', {
        method: 'PUT',
        body: JSON.stringify({ criteria: payload }),
      });
      setCriteria(updated);
      setFeedback({ type: 'success', text: 'Bobot kriteria TOPSIS berhasil diperbarui.' });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan bobot kriteria.',
      });
    } finally {
      setSavingWeights(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map((c) => c.medicineId)));
    }
  };

  const updateOverrideScore = (
    medicineId: number,
    field: 'overrideK1' | 'overrideK2' | 'overrideK3' | 'overrideK4' | 'overrideK5',
    val: string,
  ) => {
    const num = Number(val);
    setCandidates((prev) =>
      prev.map((c) =>
        c.medicineId === medicineId
          ? { ...c, [field]: Number.isFinite(num) && num >= 1 && num <= 5 ? num : undefined }
          : c,
      ),
    );
  };

  const handleRunTopsis = async () => {
    const chosen = candidates.filter((c) => selectedIds.has(c.medicineId));
    if (chosen.length < 2) {
      setFeedback({
        type: 'error',
        text: 'Pilih minimal 2 obat kandidat agar perbandingan matriks TOPSIS dapat dihitung.',
      });
      return;
    }

    setRunningTopsis(true);
    setFeedback(null);
    try {
      const res = await apiFetch<TopsisRunDetail>('/api/topsis/run', {
        method: 'POST',
        body: JSON.stringify({
          title,
          periodStart,
          periodEnd,
          notes,
          candidates: chosen,
        }),
      });
      setActiveDetail(res);
      setActiveTab('results');
      setFeedback({
        type: 'success',
        text: `Perhitungan TOPSIS berhasil disimpan untuk ${res.results.length} obat kandidat.`,
      });
      await loadRuns(false);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menjalankan perhitungan TOPSIS.',
      });
    } finally {
      setRunningTopsis(false);
    }
  };

  const handleDeleteRun = async () => {
    if (!deleteRunTarget || !isAdmin) return;
    try {
      await apiFetch(`/api/topsis/runs/${deleteRunTarget.id}`, { method: 'DELETE' });
      setRuns((prev) => prev.filter((r) => r.id !== deleteRunTarget.id));
      if (activeDetail?.run.id === deleteRunTarget.id) {
        setActiveDetail(null);
      }
      setDeleteRunTarget(null);
      setFeedback({ type: 'success', text: 'Riwayat perhitungan TOPSIS berhasil dihapus.' });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menghapus riwayat TOPSIS.',
      });
    }
  };

  const handleExportExcel = () => {
    if (!activeDetail) return;
    const rows = activeDetail.results.map((r) => ({
      Ranking: r.rank,
      'Kode PLU': r.medicinePlu,
      'Nama Obat': r.medicineName,
      Satuan: r.unit,
      'Penjualan Periode': r.rawSales,
      'Sisa Stok': r.rawStock,
      'Lead Time (Hari)': r.rawLeadTime,
      'Masa ED (Bulan)': r.rawExpiryMonths,
      'Harga Beli (Rp)': r.rawPurchasePrice,
      'Skor K1': r.scoreK1,
      'Skor K2': r.scoreK2,
      'Skor K3': r.scoreK3,
      'Skor K4': r.scoreK4,
      'Skor K5': r.scoreK5,
      'Jarak D+': r.distancePositive,
      'Jarak D-': r.distanceNegative,
      'Nilai Preferensi (V)': r.preferenceValue,
      'Status Prioritas': r.priorityLabel,
    }));
    exportToExcel(rows, 'Hasil_TOPSIS', `TOPSIS_Andhika_Farma_${activeDetail.run.id}.xlsx`);
  };

  return (
    <div className="space-y-5">
      {/* Header & Tabs */}
      <div className="no-print flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Penentuan Prioritas Pengadaan Obat pada Apotek Andhika Farma Menggunakan Metode TOPSIS
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Sistem Pendukung Keputusan multi-kriteria dengan transparansi penuh 8 tahapan perhitungan
            matriks TOPSIS.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 self-start shrink-0">
          {(
            [
              { key: 'analyze', label: 'Analisis & Bobot', icon: Calculator },
              { key: 'results', label: 'Hasil & 8 Tahap', icon: FileSpreadsheet },
              { key: 'history', label: `Riwayat (${runs.length})`, icon: History },
            ] as { key: TopsisTab; label: string; icon: React.ComponentType<{ className?: string }> }[]
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === t.key
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Methodological Note Banner */}
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-start gap-3 text-xs text-sky-950">
        <Info className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Catatan Metodologis Kriteria K2 (Sisa Stok Fisik)</p>
          <p className="leading-relaxed text-sky-900">
            Sesuai dokumen penelitian Apotek Andhika Farma, kriteria <strong>K2 (Sisa Stok Fisik)</strong>{' '}
            mempertahankan jenis asli sebagai <strong>Cost</strong>. Namun karena konversi skor 1–5
            telah membalikkan nilai stok paling kritis (&le; 5 unit) menjadi skor tertinggi (5),
            maka dalam perhitungan matriks normalisasi terbobot dan solusi ideal (A+ / A-), skor K2
            diproses sebagai nilai prioritas <strong>Benefit</strong> agar tidak terjadi pembalikan
            skor dua kali.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`no-print px-4 py-3 rounded-xl border text-xs font-medium flex items-center justify-between ${
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

      {/* ==================== TAB 1: ANALISIS BARU & BOBOT ==================== */}
      {activeTab === 'analyze' && (
        <div className="space-y-6">
          {/* Criteria & Weights Panel */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Kriteria &amp; Pembobotan TOPSIS
                </h2>
                <p className="text-xs text-slate-500">
                  {isAdmin
                    ? 'Sebagai Admin, Anda dapat menyesuaikan bobot kepentingan kriteria K1–K5.'
                    : 'Mode Petugas/Apoteker: bobot kriteria hanya dapat diubah oleh Admin.'}
                </p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleSaveWeights}
                  disabled={savingWeights}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingWeights ? 'Menyimpan...' : 'Simpan Bobot'}</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-2.5 px-4">Kode</th>
                    <th className="py-2.5 px-4">Nama Kriteria</th>
                    <th className="py-2.5 px-4">Jenis Asli</th>
                    <th className="py-2.5 px-4">Diproses pada Matriks</th>
                    <th className="py-2.5 px-4 text-right">Bobot (W)</th>
                    <th className="py-2.5 px-4">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {criteria.map((c) => (
                    <tr key={c.code}>
                      <td className="py-2.5 px-4 font-mono font-bold text-sky-700">{c.code}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{c.name}</td>
                      <td className="py-2.5 px-4 uppercase font-medium text-slate-700">
                        {c.originalType === 'cost' ? 'Cost' : 'Benefit'}
                      </td>
                      <td className="py-2.5 px-4 uppercase font-medium text-emerald-700">
                        {c.calculationType === 'benefit' ? 'Benefit (Skor Konversi)' : 'Cost'}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums">
                        {isAdmin ? (
                          <input
                            type="number"
                            min="1"
                            max="10"
                            step="1"
                            value={weightEdits[c.code] ?? String(c.weight)}
                            onChange={(e) =>
                              setWeightEdits({ ...weightEdits, [c.code]: e.target.value })
                            }
                            className="w-16 px-2 py-1 text-right border border-slate-200 rounded-md font-bold tabular-nums"
                          />
                        ) : (
                          <span className="font-bold text-slate-900">{c.weight}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 max-w-md">{c.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Analysis Period & Candidate Selection */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Judul Analisis Pengadaan
                    </label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Periode Penjualan Mulai
                    </label>
                    <input
                      type="date"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Periode Penjualan Akhir
                    </label>
                    <input
                      type="date"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRunTopsis}
                  disabled={runningTopsis || selectedIds.size < 2}
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0 self-start lg:self-auto"
                >
                  <Calculator className="w-4 h-4" />
                  <span>
                    {runningTopsis
                      ? 'Menghitung TOPSIS...'
                      : `Hitung & Simpan TOPSIS (${selectedIds.size} obat)`}
                  </span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={candidateSearch}
                      onChange={(e) => setCandidateSearch(e.target.value)}
                      placeholder="Cari obat kandidat..."
                      className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg"
                    />
                  </div>

                  <select
                    value={candidateMode}
                    onChange={(e) =>
                      setCandidateMode(e.target.value as 'featured' | 'critical' | 'search')
                    }
                    className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="featured">Obat Aktif &amp; Prioritas</option>
                    <option value="critical">Hanya Stok Menipis / Habis</option>
                    <option value="search">Semua Obat</option>
                  </select>
                </div>

                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan analisis (opsional)..."
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg w-full sm:w-72"
                />
              </div>
            </div>

            {/* Candidate Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-2.5 px-3 w-10">
                      <button
                        type="button"
                        onClick={toggleAll}
                        className="text-slate-600 hover:text-sky-700 cursor-pointer"
                        title="Pilih Semua / Batal Semua"
                      >
                        {selectedIds.size === candidates.length && candidates.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-sky-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-2.5 px-3">Obat Alternatif</th>
                    <th className="py-2.5 px-3 text-right">Jual (K1)</th>
                    <th className="py-2.5 px-3 text-right">Stok (K2)</th>
                    <th className="py-2.5 px-3 text-right">Lead (K3)</th>
                    <th className="py-2.5 px-3 text-right">ED Bln (K4)</th>
                    <th className="py-2.5 px-3 text-right">Hrg Beli (K5)</th>
                    <th className="py-2.5 px-3 text-center">Skor K1–K5 (1–5)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingCandidates ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Menyiapkan kandidat obat &amp; menghitung parameter periode...
                      </td>
                    </tr>
                  ) : candidates.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Tidak ada kandidat obat ditemukan.
                      </td>
                    </tr>
                  ) : (
                    candidates.map((c) => {
                      const checked = selectedIds.has(c.medicineId);
                      return (
                        <tr
                          key={c.medicineId}
                          className={checked ? 'bg-sky-50/40' : 'hover:bg-slate-50/60'}
                        >
                          <td className="py-2.5 px-3">
                            <button
                              type="button"
                              onClick={() => toggleSelect(c.medicineId)}
                              className="cursor-pointer text-slate-600"
                            >
                              {checked ? (
                                <CheckSquare className="w-4 h-4 text-sky-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-slate-900">{c.medicineName}</p>
                            <p className="text-[11px] text-slate-500">
                              <span className="font-mono">{c.medicinePlu}</span> · {c.unit} ·{' '}
                              {c.supplierName}
                            </p>
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{c.rawSales}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-semibold">
                            {c.rawStock}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{c.rawLeadTime} hr</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {c.rawExpiryMonths} bln
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                            {formatRupiah(c.rawPurchasePrice)}
                            {c.isEstimatedPrice ? ' *' : ''}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center justify-center gap-1 font-mono tabular-nums">
                              {(
                                [
                                  ['overrideK1', c.overrideK1 ?? c.scoreK1],
                                  ['overrideK2', c.overrideK2 ?? c.scoreK2],
                                  ['overrideK3', c.overrideK3 ?? c.scoreK3],
                                  ['overrideK4', c.overrideK4 ?? c.scoreK4],
                                  ['overrideK5', c.overrideK5 ?? c.scoreK5],
                                ] as const
                              ).map(([field, val]) => (
                                <input
                                  key={field}
                                  type="number"
                                  min="1"
                                  max="5"
                                  value={val}
                                  onChange={(e) =>
                                    updateOverrideScore(c.medicineId, field, e.target.value)
                                  }
                                  className="w-9 py-1 text-center border border-slate-200 rounded bg-white text-[11px] font-bold"
                                  title="Ubah skor manual 1-5 jika diperlukan"
                                />
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500">
              * Harga beli bernilai 0 pada PDF awal diestimasi 78% dari harga jual agar penilaian K5
              tetap akurat. Anda dapat mengubah skor 1–5 secara langsung sebelum menghitung TOPSIS.
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: HASIL & 8 TAHAP PERHITUNGAN ==================== */}
      {activeTab === 'results' && (
        <div className="space-y-6">
          {!activeDetail ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
              <p className="text-sm text-slate-600">
                Belum ada hasil perhitungan TOPSIS yang dipilih.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('analyze')}
                className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-lg cursor-pointer"
              >
                Buat Analisis TOPSIS Baru
              </button>
            </div>
          ) : (
            <>
              {/* Summary Bar + Print/Export */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-sky-700 uppercase tracking-wider">
                    Hasil Perhitungan TOPSIS #{activeDetail.run.id}
                  </p>
                  <h2 className="text-base font-bold text-slate-900 mt-0.5">
                    {activeDetail.run.title}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Periode: {formatDate(activeDetail.run.periodStart)} s/d{' '}
                    {formatDate(activeDetail.run.periodEnd)} · Oleh:{' '}
                    {activeDetail.run.createdByName} · {activeDetail.results.length} Alternatif Obat
                  </p>
                </div>

                <div className="no-print flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak / PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Ekspor Excel</span>
                  </button>
                </div>
              </div>

              {/* Tahap 7 & 8: Nilai Preferensi & Ranking Prioritas */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">
                    Tahap 6, 7 &amp; 8: Jarak Ideal (D+ / D-), Nilai Preferensi (V) &amp; Ranking
                    Prioritas Pengadaan
                  </h3>
                  <p className="text-xs text-slate-500">
                    Diurutkan dari nilai preferensi (V = D- / (D+ + D-)) tertinggi ke terendah.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                        <th className="py-2.5 px-4">Ranking</th>
                        <th className="py-2.5 px-4">Kode PLU</th>
                        <th className="py-2.5 px-4">Nama Obat</th>
                        <th className="py-2.5 px-4 text-right">D+</th>
                        <th className="py-2.5 px-4 text-right">D-</th>
                        <th className="py-2.5 px-4 text-right">Nilai V</th>
                        <th className="py-2.5 px-4">Rekomendasi Pengadaan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeDetail.results.map((r) => (
                        <tr key={r.medicineId} className={r.rank <= 3 ? 'bg-emerald-50/30' : ''}>
                          <td className="py-2.5 px-4 font-bold text-sky-700 tabular-nums">
                            #{r.rank}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-600">{r.medicinePlu}</td>
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            {r.medicineName}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                            {r.distancePositive.toFixed(4)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                            {r.distanceNegative.toFixed(4)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700 tabular-nums">
                            {r.preferenceValue.toFixed(4)}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-slate-800">
                            {r.priorityLabel}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tahap 1: Matriks Keputusan (X) */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">
                    Tahap 1: Matriks Keputusan (X) — Data Aktual &amp; Konversi Skor 1–5
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                        <th className="py-2.5 px-4">Alternatif Obat</th>
                        <th className="py-2.5 px-3 text-right">K1 Jual (Skor)</th>
                        <th className="py-2.5 px-3 text-right">K2 Stok (Skor)</th>
                        <th className="py-2.5 px-3 text-right">K3 Lead (Skor)</th>
                        <th className="py-2.5 px-3 text-right">K4 ED Bln (Skor)</th>
                        <th className="py-2.5 px-3 text-right">K5 Harga (Skor)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 tabular-nums">
                      {activeDetail.results.map((r) => (
                        <tr key={r.medicineId}>
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            {r.medicineName}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {r.rawSales} (<strong className="text-sky-700">{r.scoreK1}</strong>)
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {r.rawStock} (<strong className="text-sky-700">{r.scoreK2}</strong>)
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {r.rawLeadTime} hr (<strong className="text-sky-700">{r.scoreK3}</strong>)
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {r.rawExpiryMonths} bln (
                            <strong className="text-sky-700">{r.scoreK4}</strong>)
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {formatRupiah(r.rawPurchasePrice)} (
                            <strong className="text-sky-700">{r.scoreK5}</strong>)
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tahap 2: Matriks Normalisasi (R) */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">
                    Tahap 2: Matriks Normalisasi (R) — r<sub>ij</sub> = x<sub>ij</sub> / &radic;&Sigma;x
                    <sub>ij</sub>&sup2;
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                    Pembagi: K1={Number(activeDetail.divisors.K1 ?? 0).toFixed(4)} · K2=
                    {Number(activeDetail.divisors.K2 ?? 0).toFixed(4)} · K3=
                    {Number(activeDetail.divisors.K3 ?? 0).toFixed(4)} · K4=
                    {Number(activeDetail.divisors.K4 ?? 0).toFixed(4)} · K5=
                    {Number(activeDetail.divisors.K5 ?? 0).toFixed(4)}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                        <th className="py-2.5 px-4">Alternatif Obat</th>
                        <th className="py-2.5 px-3 text-right">R (K1)</th>
                        <th className="py-2.5 px-3 text-right">R (K2)</th>
                        <th className="py-2.5 px-3 text-right">R (K3)</th>
                        <th className="py-2.5 px-3 text-right">R (K4)</th>
                        <th className="py-2.5 px-3 text-right">R (K5)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                      {activeDetail.results.map((r) => (
                        <tr key={r.medicineId}>
                          <td className="py-2.5 px-4 font-sans font-semibold text-slate-900">
                            {r.medicineName}
                          </td>
                          <td className="py-2.5 px-3 text-right">{r.normK1.toFixed(4)}</td>
                          <td className="py-2.5 px-3 text-right">{r.normK2.toFixed(4)}</td>
                          <td className="py-2.5 px-3 text-right">{r.normK3.toFixed(4)}</td>
                          <td className="py-2.5 px-3 text-right">{r.normK4.toFixed(4)}</td>
                          <td className="py-2.5 px-3 text-right">{r.normK5.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tahap 3, 4 & 5: Matriks Terbobot (Y) + A+ & A- */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">
                    Tahap 3, 4 &amp; 5: Matriks Normalisasi Terbobot (Y) serta Solusi Ideal Positif
                    (A+) &amp; Negatif (A-)
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                        <th className="py-2.5 px-4">Alternatif / Solusi Ideal</th>
                        <th className="py-2.5 px-3 text-right">Y (K1)</th>
                        <th className="py-2.5 px-3 text-right">Y (K2)</th>
                        <th className="py-2.5 px-3 text-right">Y (K3)</th>
                        <th className="py-2.5 px-3 text-right">Y (K4)</th>
                        <th className="py-2.5 px-3 text-right">Y (K5)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                      {activeDetail.results.map((r) => (
                        <tr key={r.medicineId}>
                          <td className="py-2.5 px-4 font-sans font-semibold text-slate-900">
                            {r.medicineName}
                          </td>
                          <td className="py-2.5 px-3 text-right">{r.weightedK1.toFixed(4)}</td>
                          <td className="py-2.5 px-3 text-right">{r.weightedK2.toFixed(4)}</td>
                          <td className="py-2.5 px-3 text-right">{r.weightedK3.toFixed(4)}</td>
                          <td className="py-2.5 px-3 text-right">{r.weightedK4.toFixed(4)}</td>
                          <td className="py-2.5 px-3 text-right">{r.weightedK5.toFixed(4)}</td>
                        </tr>
                      ))}
                      <tr className="bg-emerald-50/70 font-bold text-emerald-800">
                        <td className="py-2.5 px-4 font-sans">Solusi Ideal Positif (A+)</td>
                        <td className="py-2.5 px-3 text-right">
                          {Number(activeDetail.idealPositive.K1 ?? 0).toFixed(4)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {Number(activeDetail.idealPositive.K2 ?? 0).toFixed(4)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {Number(activeDetail.idealPositive.K3 ?? 0).toFixed(4)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {Number(activeDetail.idealPositive.K4 ?? 0).toFixed(4)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {Number(activeDetail.idealPositive.K5 ?? 0).toFixed(4)}
                        </td>
                      </tr>
                      <tr className="bg-rose-50/60 font-bold text-rose-800">
                        <td className="py-2.5 px-4 font-sans">Solusi Ideal Negatif (A-)</td>
                        <td className="py-2.5 px-3 text-right">
                          {Number(activeDetail.idealNegative.K1 ?? 0).toFixed(4)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {Number(activeDetail.idealNegative.K2 ?? 0).toFixed(4)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {Number(activeDetail.idealNegative.K3 ?? 0).toFixed(4)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {Number(activeDetail.idealNegative.K4 ?? 0).toFixed(4)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {Number(activeDetail.idealNegative.K5 ?? 0).toFixed(4)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ==================== TAB 3: RIWAYAT PERHITUNGAN ==================== */}
      {activeTab === 'history' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Riwayat Perhitungan TOPSIS</h2>
            <p className="text-xs text-slate-500">
              Pilih salah satu riwayat untuk melihat seluruh 8 tahap matriks dan mencetak hasil.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                  <th className="py-3 px-4">Tanggal Hitung</th>
                  <th className="py-3 px-4">Judul Analisis</th>
                  <th className="py-3 px-4">Periode Data</th>
                  <th className="py-3 px-4">Oleh</th>
                  <th className="py-3 px-4 text-right">Alternatif</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Belum ada riwayat perhitungan tersimpan.
                    </td>
                  </tr>
                ) : (
                  runs.map((run) => (
                    <tr key={run.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 text-slate-600 tabular-nums whitespace-nowrap">
                        {formatDateTime(run.createdAt)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{run.title}</td>
                      <td className="py-3 px-4 text-slate-600 tabular-nums whitespace-nowrap">
                        {formatDate(run.periodStart)} – {formatDate(run.periodEnd)}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{run.createdByName}</td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold">
                        {formatNumber(run.totalAlternatives, 0)} obat
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={async () => {
                            await loadRunDetail(run.id);
                            setActiveTab('results');
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-md cursor-pointer"
                        >
                          Buka Detail
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setDeleteRunTarget(run)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 rounded-md ml-1 cursor-pointer"
                            title="Hapus Riwayat"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deleteRunTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-sm p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Hapus Riwayat TOPSIS</h3>
            <p className="text-xs text-slate-600">
              Yakin ingin menghapus riwayat <strong>{deleteRunTarget.title}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteRunTarget(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteRun}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 rounded-lg cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
