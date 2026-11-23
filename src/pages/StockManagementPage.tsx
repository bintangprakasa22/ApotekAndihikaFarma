import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  History,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatDateTime, formatNumber, formatRupiah } from '../lib/format';

type StockTab = 'in' | 'out' | 'history' | 'alerts';

interface MedicineOption {
  id: number;
  pluCode: string;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
  purchasePrice: number;
  supplierId: number | null;
  nearestExpiredDate: string | null;
}

interface SupplierOption {
  id: number;
  name: string;
}

interface BatchItem {
  id: number;
  batchNumber: string;
  expiredDate: string;
  remainingQty: number;
}

interface StockMovementRow {
  id: number;
  medicinePlu: string;
  medicineName: string;
  unit: string;
  batchNumber: string | null;
  batchExpiredDate: string | null;
  movementType: string;
  referenceType: string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  unitPrice: number;
  userName: string;
  notes: string;
  movementDate: string;
}

interface AlertsPayload {
  lowStock: { id: number; pluCode: string; name: string; unit: string; stock: number; minStock: number }[];
  outOfStock: { id: number; pluCode: string; name: string; unit: string; stock: number; minStock: number }[];
  expiringBatches: {
    batchId: number;
    medicineId: number;
    pluCode: string;
    medicineName: string;
    unit: string;
    batchNumber: string;
    expiredDate: string;
    remainingQty: number;
  }[];
}

export function StockManagementPage() {
  const { apiFetch, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<StockTab>('in');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Medicine search & selector for Stok Masuk / Keluar
  const [medQuery, setMedQuery] = useState('');
  const [medOptions, setMedOptions] = useState<MedicineOption[]>([]);
  const [selectedMed, setSelectedMed] = useState<MedicineOption | null>(null);
  const [selectedBatches, setSelectedBatches] = useState<BatchItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);

  // Stok Masuk form
  const [inForm, setInForm] = useState({
    supplierId: '',
    batchNumber: '',
    expiredDate: '',
    quantity: '',
    purchasePrice: '',
    notes: '',
  });
  const [submittingIn, setSubmittingIn] = useState(false);

  // Stok Keluar form
  const [outForm, setOutForm] = useState({
    quantity: '',
    referenceType: 'penjualan' as 'penjualan' | 'penyesuaian',
    notes: '',
  });
  const [submittingOut, setSubmittingOut] = useState(false);
  const [lastFefoAllocations, setLastFefoAllocations] = useState<
    { batchId: number; batchNumber: string; expiredDate: string; deductedQty: number }[]
  >([]);

  // History state
  const [historyRows, setHistoryRows] = useState<StockMovementRow[]>([]);
  const [histSearch, setHistSearch] = useState('');
  const [histType, setHistType] = useState('all');
  const [histStart, setHistStart] = useState('');
  const [histEnd, setHistEnd] = useState('');
  const [histPage, setHistPage] = useState(1);
  const [histTotal, setHistTotal] = useState(0);
  const [histTotalPages, setHistTotalPages] = useState(1);
  const [loadingHist, setLoadingHist] = useState(false);

  // Alerts state
  const [alerts, setAlerts] = useState<AlertsPayload | null>(null);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  const loadSuppliers = useCallback(async () => {
    try {
      const sups = await apiFetch<SupplierOption[]>('/api/suppliers');
      setSuppliers(sups);
    } catch {
      // ignore
    }
  }, [apiFetch]);

  const searchMedicines = useCallback(
    async (q: string) => {
      try {
        const params = new URLSearchParams({ limit: '25', page: '1' });
        if (q.trim()) params.set('search', q.trim());
        const res = await apiFetch<{ items: MedicineOption[] }>(`/api/medicines?${params}`);
        setMedOptions(res.items);
      } catch {
        // ignore
      }
    },
    [apiFetch],
  );

  const loadBatchesForMed = useCallback(
    async (medId: number) => {
      try {
        const rows = await apiFetch<BatchItem[]>(`/api/medicines/${medId}/batches`);
        setSelectedBatches(rows.filter((b) => b.remainingQty > 0));
      } catch {
        setSelectedBatches([]);
      }
    },
    [apiFetch],
  );

  const loadHistory = useCallback(async () => {
    setLoadingHist(true);
    try {
      const params = new URLSearchParams({
        page: String(histPage),
        limit: '20',
        type: histType,
      });
      if (histSearch.trim()) params.set('search', histSearch.trim());
      if (histStart) params.set('startDate', histStart);
      if (histEnd) params.set('endDate', histEnd);

      const res = await apiFetch<{
        items: StockMovementRow[];
        total: number;
        totalPages: number;
      }>(`/api/stock-movements?${params}`);

      setHistoryRows(res.items);
      setHistTotal(res.total);
      setHistTotalPages(res.totalPages);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memuat riwayat stok.',
      });
    } finally {
      setLoadingHist(false);
    }
  }, [apiFetch, histPage, histType, histSearch, histStart, histEnd]);

  const loadAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    try {
      const res = await apiFetch<AlertsPayload>('/api/alerts');
      setAlerts(res);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memuat data peringatan.',
      });
    } finally {
      setLoadingAlerts(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  useEffect(() => {
    const t = setTimeout(() => {
      searchMedicines(medQuery);
    }, 200);
    return () => clearTimeout(t);
  }, [medQuery, searchMedicines]);

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
    if (activeTab === 'alerts') loadAlerts();
  }, [activeTab, loadHistory, loadAlerts]);

  const handleSelectMedicine = (m: MedicineOption) => {
    setSelectedMed(m);
    setLastFefoAllocations([]);
    setInForm((prev) => ({
      ...prev,
      supplierId: m.supplierId ? String(m.supplierId) : prev.supplierId,
      purchasePrice: m.purchasePrice > 0 ? String(m.purchasePrice) : '',
      batchNumber: `B-${m.pluCode}-${new Date().toISOString().slice(2, 7).replace('-', '')}`,
    }));
    loadBatchesForMed(m.id);
  };

  const handleStockInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMed) {
      setFeedback({ type: 'error', text: 'Pilih obat terlebih dahulu.' });
      return;
    }
    setSubmittingIn(true);
    setFeedback(null);
    try {
      const res = await apiFetch<{ medicine: MedicineOption }>('/api/stock/in', {
        method: 'POST',
        body: JSON.stringify({
          medicineId: selectedMed.id,
          supplierId: inForm.supplierId ? Number(inForm.supplierId) : null,
          batchNumber: inForm.batchNumber,
          expiredDate: inForm.expiredDate,
          quantity: Number(inForm.quantity),
          purchasePrice: Number(inForm.purchasePrice || 0),
          notes: inForm.notes,
        }),
      });
      setFeedback({
        type: 'success',
        text: `Stok masuk ${inForm.quantity} ${selectedMed.unit} untuk "${selectedMed.name}" berhasil dicatat. Stok baru: ${formatNumber(res.medicine.stock, 2)}.`,
      });
      setSelectedMed({ ...selectedMed, stock: res.medicine.stock, nearestExpiredDate: res.medicine.nearestExpiredDate });
      setInForm({
        supplierId: inForm.supplierId,
        batchNumber: '',
        expiredDate: '',
        quantity: '',
        purchasePrice: inForm.purchasePrice,
        notes: '',
      });
      await Promise.all([
        loadBatchesForMed(selectedMed.id),
        searchMedicines(medQuery),
        refreshProfile(),
      ]);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan transaksi stok masuk.',
      });
    } finally {
      setSubmittingIn(false);
    }
  };

  const handleStockOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMed) {
      setFeedback({ type: 'error', text: 'Pilih obat terlebih dahulu.' });
      return;
    }
    const qty = Number(outForm.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setFeedback({ type: 'error', text: 'Jumlah stok keluar harus lebih dari 0.' });
      return;
    }
    if (qty > selectedMed.stock) {
      setFeedback({
        type: 'error',
        text: `Stok tidak mencukupi (tersedia ${selectedMed.stock} ${selectedMed.unit}). Stok tidak boleh menjadi negatif.`,
      });
      return;
    }

    setSubmittingOut(true);
    setFeedback(null);
    setLastFefoAllocations([]);
    try {
      const res = await apiFetch<{
        medicine: MedicineOption;
        allocations: { batchId: number; batchNumber: string; expiredDate: string; deductedQty: number }[];
      }>('/api/stock/out', {
        method: 'POST',
        body: JSON.stringify({
          medicineId: selectedMed.id,
          quantity: qty,
          referenceType: outForm.referenceType,
          notes: outForm.notes,
        }),
      });

      setLastFefoAllocations(res.allocations || []);
      setFeedback({
        type: 'success',
        text: `Stok keluar ${qty} ${selectedMed.unit} untuk "${selectedMed.name}" diproses otomatis dengan prinsip FEFO. Sisa stok: ${formatNumber(res.medicine.stock, 2)}.`,
      });
      setSelectedMed({ ...selectedMed, stock: res.medicine.stock, nearestExpiredDate: res.medicine.nearestExpiredDate });
      setOutForm({ quantity: '', referenceType: 'penjualan', notes: '' });
      await Promise.all([
        loadBatchesForMed(selectedMed.id),
        searchMedicines(medQuery),
        refreshProfile(),
      ]);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memproses stok keluar FEFO.',
      });
    } finally {
      setSubmittingOut(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Manajemen Stok &amp; Batch FEFO
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pencatatan stok masuk per batch, pengeluaran otomatis berbasis First Expired First Out
            (FEFO), dan pemantauan stok kritis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 self-start">
          {(
            [
              { key: 'in', label: 'Stok Masuk', icon: ArrowDownLeft },
              { key: 'out', label: 'Stok Keluar (FEFO)', icon: ArrowUpRight },
              { key: 'history', label: 'Riwayat Pergerakan', icon: History },
              { key: 'alerts', label: 'Peringatan Stok & ED', icon: AlertTriangle },
            ] as { key: StockTab; label: string; icon: React.ComponentType<{ className?: string }> }[]
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

      {/* ==================== STOK MASUK & KELUAR LAYOUT ==================== */}
      {(activeTab === 'in' || activeTab === 'out') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Medicine Picker */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-900 mb-2">1. Pilih Obat</p>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={medQuery}
                  onChange={(e) => setMedQuery(e.target.value)}
                  placeholder="Cari nama obat atau kode PLU..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
            <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {medOptions.map((m) => {
                const isSelected = selectedMed?.id === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectMedicine(m)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected ? 'bg-sky-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">{m.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                        <span className="font-mono">{m.pluCode}</span> · ED:{' '}
                        {formatDate(m.nearestExpiredDate)}
                      </p>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <p
                        className={`text-xs font-bold ${
                          m.stock <= 0
                            ? 'text-rose-600'
                            : m.stock <= m.minStock
                              ? 'text-amber-600'
                              : 'text-emerald-700'
                        }`}
                      >
                        {formatNumber(m.stock, 0)}
                      </p>
                      <p className="text-[10px] text-slate-400">{m.unit}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Transaction Form + Active FEFO Batches */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              {!selectedMed ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  Pilih salah satu obat di panel kiri untuk mencatat transaksi{' '}
                  {activeTab === 'in' ? 'stok masuk' : 'stok keluar (FEFO)'}.
                </div>
              ) : (
                <>
                  <div className="pb-4 mb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-mono text-sky-700 font-semibold">
                        {selectedMed.pluCode}
                      </p>
                      <h2 className="text-sm font-bold text-slate-900">{selectedMed.name}</h2>
                    </div>
                    <div className="text-left sm:text-right tabular-nums">
                      <p className="text-xs text-slate-500">Stok Tersedia Saat Ini</p>
                      <p className="text-lg font-bold text-emerald-700">
                        {formatNumber(selectedMed.stock, 2)} {selectedMed.unit}
                      </p>
                    </div>
                  </div>

                  {activeTab === 'in' ? (
                    <form onSubmit={handleStockInSubmit} className="space-y-4 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Nomor Batch*
                          </label>
                          <input
                            required
                            value={inForm.batchNumber}
                            onChange={(e) => setInForm({ ...inForm, batchNumber: e.target.value })}
                            placeholder="Contoh: B-2026-01"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Tanggal Kedaluwarsa (ED)*
                          </label>
                          <input
                            required
                            type="date"
                            value={inForm.expiredDate}
                            onChange={(e) => setInForm({ ...inForm, expiredDate: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Jumlah Masuk ({selectedMed.unit})*
                          </label>
                          <input
                            required
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={inForm.quantity}
                            onChange={(e) => setInForm({ ...inForm, quantity: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Harga Beli / Unit (Rp)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={inForm.purchasePrice}
                            onChange={(e) => setInForm({ ...inForm, purchasePrice: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Supplier (PBF)
                          </label>
                          <select
                            value={inForm.supplierId}
                            onChange={(e) => setInForm({ ...inForm, supplierId: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                          >
                            <option value="">-- Pilih Supplier --</option>
                            {suppliers.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Keterangan / No. Faktur
                        </label>
                        <input
                          value={inForm.notes}
                          onChange={(e) => setInForm({ ...inForm, notes: e.target.value })}
                          placeholder="Contoh: Penerimaan faktur PBF no. 0421"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                        />
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={submittingIn}
                          className="px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          <ArrowDownLeft className="w-4 h-4" />
                          <span>{submittingIn ? 'Memproses...' : 'Simpan Stok Masuk'}</span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleStockOutSubmit} className="space-y-4 text-xs">
                      <div className="px-3.5 py-2.5 bg-sky-50 border border-sky-200 rounded-lg text-sky-900">
                        Sistem menerapkan prinsip <strong>FEFO (First Expired, First Out)</strong>:
                        pengeluaran stok akan memotong batch dengan tanggal kedaluwarsa terdekat
                        secara otomatis dan mencegah stok menjadi negatif.
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Jumlah Keluar ({selectedMed.unit})*
                          </label>
                          <input
                            required
                            type="number"
                            min="0.01"
                            max={selectedMed.stock}
                            step="0.01"
                            value={outForm.quantity}
                            onChange={(e) => setOutForm({ ...outForm, quantity: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Jenis Pengeluaran
                          </label>
                          <select
                            value={outForm.referenceType}
                            onChange={(e) =>
                              setOutForm({
                                ...outForm,
                                referenceType:
                                  e.target.value === 'penyesuaian' ? 'penyesuaian' : 'penjualan',
                              })
                            }
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                          >
                            <option value="penjualan">Penjualan / Resep</option>
                            <option value="penyesuaian">Penyesuaian / Retur</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Catatan</label>
                        <input
                          value={outForm.notes}
                          onChange={(e) => setOutForm({ ...outForm, notes: e.target.value })}
                          placeholder="Contoh: Penjualan resep harian / non-resep"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                        />
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={submittingOut || selectedMed.stock <= 0}
                          className="px-4 py-2.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                          <span>
                            {submittingOut ? 'Memproses FEFO...' : 'Keluarkan Stok (FEFO)'}
                          </span>
                        </button>
                      </div>

                      {lastFefoAllocations.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                          <p className="font-semibold text-emerald-700 flex items-center gap-1.5 mb-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Rincian Alokasi Batch FEFO Terakhir:
                          </p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                                  <th className="py-2 px-3">No. Batch</th>
                                  <th className="py-2 px-3">Kedaluwarsa</th>
                                  <th className="py-2 px-3 text-right">Dipotong</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {lastFefoAllocations.map((a) => (
                                  <tr key={a.batchId}>
                                    <td className="py-2 px-3 font-mono">{a.batchNumber}</td>
                                    <td className="py-2 px-3 tabular-nums">
                                      {formatDate(a.expiredDate)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-bold tabular-nums text-sky-700">
                                      {formatNumber(a.deductedQty, 2)} {selectedMed.unit}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </form>
                  )}
                </>
              )}
            </div>

            {/* Active Batches Preview */}
            {selectedMed && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900">
                    Batch Aktif Obat Terpilih (Urutan Pengeluaran FEFO)
                  </h3>
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    {selectedBatches.length} batch aktif
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[11px] text-slate-500 uppercase">
                        <th className="py-2.5 px-4">Urutan</th>
                        <th className="py-2.5 px-4">Nomor Batch</th>
                        <th className="py-2.5 px-4">Tanggal Kedaluwarsa</th>
                        <th className="py-2.5 px-4 text-right">Sisa Batch</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedBatches.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-5 text-center text-slate-500">
                            Tidak ada batch dengan sisa stok &gt; 0.
                          </td>
                        </tr>
                      ) : (
                        selectedBatches.map((b, i) => (
                          <tr key={b.id}>
                            <td className="py-2.5 px-4 font-semibold text-sky-700 tabular-nums">
                              #{i + 1} {i === 0 ? '(Keluar Pertama)' : ''}
                            </td>
                            <td className="py-2.5 px-4 font-mono">{b.batchNumber}</td>
                            <td className="py-2.5 px-4 tabular-nums">{formatDate(b.expiredDate)}</td>
                            <td className="py-2.5 px-4 text-right font-bold tabular-nums text-emerald-700">
                              {formatNumber(b.remainingQty, 2)} {selectedMed.unit}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB RIWAYAT PERGERAKAN ==================== */}
      {activeTab === 'history' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center gap-2.5">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={histSearch}
                onChange={(e) => {
                  setHistSearch(e.target.value);
                  setHistPage(1);
                }}
                placeholder="Cari obat, PLU, atau catatan..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>

            <select
              value={histType}
              onChange={(e) => {
                setHistType(e.target.value);
                setHistPage(1);
              }}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="all">Semua Mutasi</option>
              <option value="in">Stok Masuk</option>
              <option value="out">Stok Keluar</option>
            </select>

            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={histStart}
                onChange={(e) => {
                  setHistStart(e.target.value);
                  setHistPage(1);
                }}
                className="px-2.5 py-2 border border-slate-200 rounded-lg"
              />
              <span className="text-slate-400">s/d</span>
              <input
                type="date"
                value={histEnd}
                onChange={(e) => {
                  setHistEnd(e.target.value);
                  setHistPage(1);
                }}
                className="px-2.5 py-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 whitespace-nowrap">Waktu</th>
                  <th className="py-3 px-4">Obat</th>
                  <th className="py-3 px-4">Batch &amp; ED</th>
                  <th className="py-3 px-4">Jenis</th>
                  <th className="py-3 px-4 text-right">Jumlah</th>
                  <th className="py-3 px-4 text-right">Stok Akhir</th>
                  <th className="py-3 px-4">Petugas &amp; Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loadingHist ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      Memuat riwayat pergerakan stok...
                    </td>
                  </tr>
                ) : historyRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      Tidak ada transaksi ditemukan.
                    </td>
                  </tr>
                ) : (
                  historyRows.map((row) => {
                    const isIn = row.movementType === 'in';
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap tabular-nums">
                          {formatDateTime(row.movementDate)}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">{row.medicineName}</p>
                          <p className="text-[11px] font-mono text-slate-400">{row.medicinePlu}</p>
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          <p className="font-mono">{row.batchNumber || '-'}</p>
                          <p className="text-[11px] text-slate-400">
                            {row.batchExpiredDate ? `ED: ${formatDate(row.batchExpiredDate)}` : ''}
                          </p>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              isIn ? 'text-emerald-700' : 'text-sky-700'
                            }`}
                          >
                            {isIn ? 'Masuk' : 'Keluar'} · {row.referenceType}
                          </span>
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-bold tabular-nums whitespace-nowrap ${
                            isIn ? 'text-emerald-700' : 'text-sky-700'
                          }`}
                        >
                          {isIn ? '+' : '-'}
                          {formatNumber(row.quantity, 2)} {row.unit}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-slate-700 whitespace-nowrap">
                          {formatNumber(row.stockAfter, 2)} {row.unit}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs">
                          <p className="font-medium text-slate-800">{row.userName}</p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {row.notes || '-'}
                            {row.unitPrice > 0 ? ` · ${formatRupiah(row.unitPrice)}` : ''}
                          </p>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span className="tabular-nums">
              Halaman {histPage} dari {histTotalPages} · {formatNumber(histTotal, 0)} transaksi
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={histPage <= 1}
                onClick={() => setHistPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Sebelumnya</span>
              </button>
              <button
                type="button"
                disabled={histPage >= histTotalPages}
                onClick={() => setHistPage((p) => Math.min(histTotalPages, p + 1))}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                <span>Berikutnya</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB PERINGATAN STOK & ED ==================== */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          {loadingAlerts && !alerts ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
              Memuat data peringatan...
            </div>
          ) : alerts ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Stok Habis */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-rose-50/60">
                  <h3 className="text-xs font-bold text-rose-800">
                    Stok Habis ({alerts.outOfStock.length} item)
                  </h3>
                  <p className="text-[11px] text-rose-600">Stok fisik 0 — segera lakukan pengadaan</p>
                </div>
                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {alerts.outOfStock.length === 0 ? (
                    <p className="p-5 text-xs text-slate-500 text-center">Tidak ada obat stok habis.</p>
                  ) : (
                    alerts.outOfStock.map((m) => (
                      <div key={m.id} className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{m.name}</p>
                          <p className="text-[11px] font-mono text-slate-400">{m.pluCode}</p>
                        </div>
                        <span className="font-bold text-rose-600 tabular-nums shrink-0">
                          0 {m.unit}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Stok Menipis */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-amber-50/60">
                  <h3 className="text-xs font-bold text-amber-900">
                    Stok Menipis ({alerts.lowStock.length} item)
                  </h3>
                  <p className="text-[11px] text-amber-700">Stok &le; batas minimum</p>
                </div>
                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {alerts.lowStock.length === 0 ? (
                    <p className="p-5 text-xs text-slate-500 text-center">Tidak ada obat stok menipis.</p>
                  ) : (
                    alerts.lowStock.map((m) => (
                      <div key={m.id} className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{m.name}</p>
                          <p className="text-[11px] text-slate-400">
                            <span className="font-mono">{m.pluCode}</span> · Min: {m.minStock}
                          </p>
                        </div>
                        <span className="font-bold text-amber-700 tabular-nums shrink-0">
                          {formatNumber(m.stock, 0)} {m.unit}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Mendekati Kedaluwarsa */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-sky-50/60">
                  <h3 className="text-xs font-bold text-sky-900">
                    Batch Mendekati Kedaluwarsa ({alerts.expiringBatches.length})
                  </h3>
                  <p className="text-[11px] text-sky-700">ED &le; 90 hari — prioritaskan pengeluaran FEFO</p>
                </div>
                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {alerts.expiringBatches.length === 0 ? (
                    <p className="p-5 text-xs text-slate-500 text-center">
                      Tidak ada batch mendekati kedaluwarsa.
                    </p>
                  ) : (
                    alerts.expiringBatches.map((b) => (
                      <div key={b.batchId} className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{b.medicineName}</p>
                          <p className="text-[11px] text-slate-500 font-mono truncate">
                            {b.batchNumber} · ED: {formatDate(b.expiredDate)}
                          </p>
                        </div>
                        <span className="font-bold text-sky-700 tabular-nums shrink-0">
                          {formatNumber(b.remainingQty, 0)} {b.unit}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
