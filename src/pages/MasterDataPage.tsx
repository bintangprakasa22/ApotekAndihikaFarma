import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Layers,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatNumber, formatRupiah } from '../lib/format';
import { AnimatedHeading } from '../components/AnimatedHeading';
import { MotionCard } from '../components/MotionCard';

type MasterTab = 'medicines' | 'categories' | 'suppliers';

interface CategoryItem {
  id: number;
  code: string;
  name: string;
  description: string;
  medicineCount?: number;
}

interface SupplierItem {
  id: number;
  name: string;
  address: string;
  phone: string;
  email: string;
  leadTimeDays: number;
  medicineCount?: number;
}

interface MedicineItem {
  id: number;
  pluCode: string;
  name: string;
  categoryId: number | null;
  categoryName: string | null;
  supplierId: number | null;
  supplierName: string | null;
  supplierLeadTime: number | null;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  prescriptionPrice: number;
  stock: number;
  minStock: number;
  nearestExpiredDate: string | null;
}

interface BatchItem {
  id: number;
  batchNumber: string;
  expiredDate: string;
  initialQty: number;
  remainingQty: number;
  purchasePrice: number;
  supplierName: string | null;
  receivedAt: string;
}

export function MasterDataPage() {
  const { apiFetch } = useAuth();
  const [activeTab, setActiveTab] = useState<MasterTab>('medicines');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Shared lists for dropdowns
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);

  // Medicines state
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [medSearch, setMedSearch] = useState('');
  const [medCategoryFilter, setMedCategoryFilter] = useState('');
  const [medStatusFilter, setMedStatusFilter] = useState('all');
  const [medPage, setMedPage] = useState(1);
  const [medTotal, setMedTotal] = useState(0);
  const [medTotalPages, setMedTotalPages] = useState(1);
  const [loadingMeds, setLoadingMeds] = useState(false);

  // Medicine modal
  const [medModalOpen, setMedModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<MedicineItem | null>(null);
  const [medForm, setMedForm] = useState({
    pluCode: '',
    name: '',
    categoryId: '',
    supplierId: '',
    unit: 'TABLET',
    purchasePrice: '0',
    sellingPrice: '0',
    prescriptionPrice: '0',
    stock: '0',
    minStock: '10',
    nearestExpiredDate: '',
  });
  const [savingMed, setSavingMed] = useState(false);

  // Batch modal
  const [batchModalMed, setBatchModalMed] = useState<MedicineItem | null>(null);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  // Category search + modal
  const [catSearch, setCatSearch] = useState('');
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoryItem | null>(null);
  const [catForm, setCatForm] = useState({ code: '', name: '', description: '' });
  const [savingCat, setSavingCat] = useState(false);

  // Supplier search + modal
  const [supSearch, setSupSearch] = useState('');
  const [supModalOpen, setSupModalOpen] = useState(false);
  const [editingSup, setEditingSup] = useState<SupplierItem | null>(null);
  const [supForm, setSupForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    leadTimeDays: '2',
  });
  const [savingSup, setSavingSup] = useState(false);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: 'medicine' | 'category' | 'supplier';
    id: number;
    label: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadRefs = useCallback(async () => {
    try {
      const [cats, sups] = await Promise.all([
        apiFetch<CategoryItem[]>('/api/categories'),
        apiFetch<SupplierItem[]>('/api/suppliers'),
      ]);
      setCategories(cats);
      setSuppliers(sups);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memuat kategori dan supplier.',
      });
    }
  }, [apiFetch]);

  const loadMedicines = useCallback(async () => {
    setLoadingMeds(true);
    try {
      const params = new URLSearchParams({
        page: String(medPage),
        limit: '20',
        status: medStatusFilter,
      });
      if (medSearch.trim()) params.set('search', medSearch.trim());
      if (medCategoryFilter) params.set('categoryId', medCategoryFilter);

      const res = await apiFetch<{
        items: MedicineItem[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/api/medicines?${params.toString()}`);

      setMedicines(res.items);
      setMedTotal(res.total);
      setMedTotalPages(res.totalPages);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memuat daftar obat.',
      });
    } finally {
      setLoadingMeds(false);
    }
  }, [apiFetch, medPage, medStatusFilter, medSearch, medCategoryFilter]);

  useEffect(() => {
    loadRefs();
  }, [loadRefs]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadMedicines();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadMedicines]);

  const openAddMedicine = () => {
    setEditingMed(null);
    setMedForm({
      pluCode: '',
      name: '',
      categoryId: categories[0]?.id ? String(categories[0].id) : '',
      supplierId: suppliers[0]?.id ? String(suppliers[0].id) : '',
      unit: 'TABLET',
      purchasePrice: '0',
      sellingPrice: '0',
      prescriptionPrice: '0',
      stock: '0',
      minStock: '10',
      nearestExpiredDate: '',
    });
    setMedModalOpen(true);
  };

  const openEditMedicine = (m: MedicineItem) => {
    setEditingMed(m);
    setMedForm({
      pluCode: m.pluCode,
      name: m.name,
      categoryId: m.categoryId ? String(m.categoryId) : '',
      supplierId: m.supplierId ? String(m.supplierId) : '',
      unit: m.unit,
      purchasePrice: String(m.purchasePrice),
      sellingPrice: String(m.sellingPrice),
      prescriptionPrice: String(m.prescriptionPrice),
      stock: String(m.stock),
      minStock: String(m.minStock),
      nearestExpiredDate: m.nearestExpiredDate || '',
    });
    setMedModalOpen(true);
  };

  const handleSaveMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMed(true);
    setFeedback(null);
    try {
      const payload = {
        pluCode: medForm.pluCode,
        name: medForm.name,
        categoryId: medForm.categoryId ? Number(medForm.categoryId) : null,
        supplierId: medForm.supplierId ? Number(medForm.supplierId) : null,
        unit: medForm.unit,
        purchasePrice: Number(medForm.purchasePrice),
        sellingPrice: Number(medForm.sellingPrice),
        prescriptionPrice: Number(medForm.prescriptionPrice || medForm.sellingPrice),
        stock: Number(medForm.stock),
        minStock: Number(medForm.minStock),
        nearestExpiredDate: medForm.nearestExpiredDate || null,
      };
      if (editingMed) {
        await apiFetch(`/api/medicines/${editingMed.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setFeedback({ type: 'success', text: `Data obat "${medForm.name}" berhasil diperbarui.` });
      } else {
        await apiFetch('/api/medicines', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback({ type: 'success', text: `Obat baru "${medForm.name}" berhasil ditambahkan.` });
      }
      setMedModalOpen(false);
      await Promise.all([loadMedicines(), loadRefs()]);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan data obat.',
      });
    } finally {
      setSavingMed(false);
    }
  };

  const openBatches = async (m: MedicineItem) => {
    setBatchModalMed(m);
    setLoadingBatches(true);
    try {
      const rows = await apiFetch<BatchItem[]>(`/api/medicines/${m.id}/batches`);
      setBatches(rows);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memuat daftar batch.',
      });
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCat(true);
    setFeedback(null);
    try {
      if (editingCat) {
        await apiFetch(`/api/categories/${editingCat.id}`, {
          method: 'PUT',
          body: JSON.stringify(catForm),
        });
        setFeedback({ type: 'success', text: `Kategori "${catForm.name}" diperbarui.` });
      } else {
        await apiFetch('/api/categories', {
          method: 'POST',
          body: JSON.stringify(catForm),
        });
        setFeedback({ type: 'success', text: `Kategori "${catForm.name}" ditambahkan.` });
      }
      setCatModalOpen(false);
      await loadRefs();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan kategori.',
      });
    } finally {
      setSavingCat(false);
    }
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSup(true);
    setFeedback(null);
    try {
      const payload = {
        ...supForm,
        leadTimeDays: Number(supForm.leadTimeDays),
      };
      if (editingSup) {
        await apiFetch(`/api/suppliers/${editingSup.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setFeedback({ type: 'success', text: `Supplier "${supForm.name}" diperbarui.` });
      } else {
        await apiFetch('/api/suppliers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback({ type: 'success', text: `Supplier "${supForm.name}" ditambahkan.` });
      }
      setSupModalOpen(false);
      await loadRefs();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan supplier.',
      });
    } finally {
      setSavingSup(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setFeedback(null);
    try {
      const endpoint =
        deleteTarget.kind === 'medicine'
          ? `/api/medicines/${deleteTarget.id}`
          : deleteTarget.kind === 'category'
            ? `/api/categories/${deleteTarget.id}`
            : `/api/suppliers/${deleteTarget.id}`;

      await apiFetch(endpoint, { method: 'DELETE' });
      setFeedback({ type: 'success', text: `"${deleteTarget.label}" berhasil dihapus.` });
      setDeleteTarget(null);
      await Promise.all([loadMedicines(), loadRefs()]);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menghapus data.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const filteredCategories = categories.filter(
    (c) =>
      !catSearch.trim() ||
      c.name.toLowerCase().includes(catSearch.toLowerCase()) ||
      c.code.toLowerCase().includes(catSearch.toLowerCase()),
  );

  const filteredSuppliers = suppliers.filter(
    (s) =>
      !supSearch.trim() ||
      s.name.toLowerCase().includes(supSearch.toLowerCase()) ||
      s.address.toLowerCase().includes(supSearch.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      {/* Header & Sub-tabs */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <AnimatedHeading
            as="h1"
            text="Manajemen Master Data"
            className="text-xl font-bold text-slate-900 tracking-tight"
          />
          <p className="text-xs text-slate-500 mt-0.5">
            Pengelolaan data obat Apotek Andhika Farma, kategori farmasi, serta daftar supplier PBF.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 self-start">
          {(
            [
              { key: 'medicines', label: `Data Obat (${formatNumber(medTotal, 0)})` },
              { key: 'categories', label: `Kategori (${categories.length})` },
              { key: 'suppliers', label: `Supplier (${suppliers.length})` },
            ] as { key: MasterTab; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === t.key
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
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

      {/* ==================== TAB OBAT ==================== */}
      {activeTab === 'medicines' && (
        <MotionCard index={0} hoverLift={false} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row gap-2.5 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={medSearch}
                  onChange={(e) => {
                    setMedSearch(e.target.value);
                    setMedPage(1);
                  }}
                  placeholder="Cari nama obat atau kode PLU..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <select
                value={medCategoryFilter}
                onChange={(e) => {
                  setMedCategoryFilter(e.target.value);
                  setMedPage(1);
                }}
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:border-sky-500"
              >
                <option value="">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={medStatusFilter}
                onChange={(e) => {
                  setMedStatusFilter(e.target.value);
                  setMedPage(1);
                }}
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:border-sky-500"
              >
                <option value="all">Semua Status Stok</option>
                <option value="normal">Stok Aman</option>
                <option value="low">Stok Menipis</option>
                <option value="out">Stok Habis (0)</option>
                <option value="near_expiry">Mendekati Kedaluwarsa (&le; 90 hr)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={openAddMedicine}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 self-start lg:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Obat</span>
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 whitespace-nowrap">Kode PLU</th>
                  <th className="py-3 px-4">Nama Obat</th>
                  <th className="py-3 px-4">Kategori &amp; Supplier</th>
                  <th className="py-3 px-4">Satuan</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Harga Beli</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Harga Jual</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Stok / Min</th>
                  <th className="py-3 px-4 whitespace-nowrap">ED Terdekat</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loadingMeds ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400">
                      Memuat daftar obat...
                    </td>
                  </tr>
                ) : medicines.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-500">
                      Tidak ada obat yang sesuai dengan kriteria pencarian.
                    </td>
                  </tr>
                ) : (
                  medicines.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {m.pluCode}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{m.name}</p>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <p className="truncate max-w-[200px]">{m.categoryName || '-'}</p>
                        <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
                          {m.supplierName || 'Tanpa supplier'}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{m.unit}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-700 whitespace-nowrap">
                        {formatRupiah(m.purchasePrice)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-slate-900 whitespace-nowrap">
                        {formatRupiah(m.sellingPrice)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            m.stock <= 0
                              ? 'text-rose-600'
                              : m.stock <= m.minStock
                                ? 'text-amber-600'
                                : 'text-emerald-700'
                          }`}
                        >
                          {formatNumber(m.stock, 2)}
                        </span>
                        <span className="text-slate-400"> / {m.minStock}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap tabular-nums">
                        {formatDate(m.nearestExpiredDate)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openBatches(m)}
                            title="Lihat Batch FEFO"
                            className="p-1.5 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded-md cursor-pointer"
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditMedicine(m)}
                            title="Edit Obat"
                            className="p-1.5 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded-md cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({ kind: 'medicine', id: m.id, label: m.name })
                            }
                            title="Hapus Obat"
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
            <span className="tabular-nums">
              Menampilkan halaman {medPage} dari {medTotalPages} · Total {formatNumber(medTotal, 0)}{' '}
              obat
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={medPage <= 1}
                onClick={() => setMedPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Sebelumnya</span>
              </button>
              <button
                type="button"
                disabled={medPage >= medTotalPages}
                onClick={() => setMedPage((p) => Math.min(medTotalPages, p + 1))}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
              >
                <span>Berikutnya</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </MotionCard>
      )}

      {/* ==================== TAB KATEGORI ==================== */}
      {activeTab === 'categories' && (
        <MotionCard index={0} hoverLift={false} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={catSearch}
                onChange={(e) => setCatSearch(e.target.value)}
                placeholder="Cari kode atau nama kategori..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingCat(null);
                setCatForm({ code: '', name: '', description: '' });
                setCatModalOpen(true);
              }}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Kategori</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Kode</th>
                  <th className="py-3 px-4">Nama Kategori</th>
                  <th className="py-3 px-4">Deskripsi</th>
                  <th className="py-3 px-4 text-right">Jumlah Obat</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredCategories.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-semibold text-sky-700">{c.code}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{c.name}</td>
                    <td className="py-3 px-4 text-slate-600">{c.description || '-'}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-700">
                      {formatNumber(c.medicineCount ?? 0, 0)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCat(c);
                          setCatForm({ code: c.code, name: c.name, description: c.description });
                          setCatModalOpen(true);
                        }}
                        className="p-1.5 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded-md cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({ kind: 'category', id: c.id, label: c.name })
                        }
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MotionCard>
      )}

      {/* ==================== TAB SUPPLIER ==================== */}
      {activeTab === 'suppliers' && (
        <MotionCard index={0} hoverLift={false} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={supSearch}
                onChange={(e) => setSupSearch(e.target.value)}
                placeholder="Cari nama supplier atau alamat..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingSup(null);
                setSupForm({ name: '', address: '', phone: '', email: '', leadTimeDays: '2' });
                setSupModalOpen(true);
              }}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Supplier</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Nama Supplier (PBF)</th>
                  <th className="py-3 px-4">Alamat</th>
                  <th className="py-3 px-4">Kontak</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Lead Time</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Item Terkait</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredSuppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-semibold text-slate-900">{s.name}</td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs">{s.address || '-'}</td>
                    <td className="py-3 px-4 text-slate-600">
                      <p>{s.phone || '-'}</p>
                      <p className="text-[11px] text-slate-400">{s.email || '-'}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-sky-700 tabular-nums whitespace-nowrap">
                      {s.leadTimeDays} hari
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-700">
                      {formatNumber(s.medicineCount ?? 0, 0)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSup(s);
                          setSupForm({
                            name: s.name,
                            address: s.address,
                            phone: s.phone,
                            email: s.email,
                            leadTimeDays: String(s.leadTimeDays),
                          });
                          setSupModalOpen(true);
                        }}
                        className="p-1.5 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded-md cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({ kind: 'supplier', id: s.id, label: s.name })
                        }
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MotionCard>
      )}

      {/* ==================== MODAL OBAT ==================== */}
      {medModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {editingMed ? 'Edit Data Obat' : 'Tambah Data Obat Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setMedModalOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveMedicine} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode Obat (PLU)*</label>
                  <input
                    required
                    value={medForm.pluCode}
                    onChange={(e) => setMedForm({ ...medForm, pluCode: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                    placeholder="Contoh: OB-1201"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Satuan*</label>
                  <input
                    required
                    value={medForm.unit}
                    onChange={(e) => setMedForm({ ...medForm, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    placeholder="TABLET / STRIP / BOTOL"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Obat*</label>
                <input
                  required
                  value={medForm.name}
                  onChange={(e) => setMedForm({ ...medForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  placeholder="Contoh: PARACETAMOL 500 MG TABLET"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={medForm.categoryId}
                    onChange={(e) => setMedForm({ ...medForm, categoryId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">-- Pilih Kategori --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Supplier</label>
                  <select
                    value={medForm.supplierId}
                    onChange={(e) => setMedForm({ ...medForm, supplierId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">-- Pilih Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.leadTimeDays} hr)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Harga Beli (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={medForm.purchasePrice}
                    onChange={(e) => setMedForm({ ...medForm, purchasePrice: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Harga Jual (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={medForm.sellingPrice}
                    onChange={(e) => setMedForm({ ...medForm, sellingPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Harga Resep (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={medForm.prescriptionPrice}
                    onChange={(e) => setMedForm({ ...medForm, prescriptionPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {!editingMed && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Stok Awal</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={medForm.stock}
                      onChange={(e) => setMedForm({ ...medForm, stock: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
                    />
                  </div>
                )}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Stok Minimum</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={medForm.minStock}
                    onChange={(e) => setMedForm({ ...medForm, minStock: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tanggal Kedaluwarsa Terdekat
                  </label>
                  <input
                    type="date"
                    value={medForm.nearestExpiredDate}
                    onChange={(e) => setMedForm({ ...medForm, nearestExpiredDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {editingMed && (
                <p className="text-[11px] text-slate-500">
                  Catatan: Perubahan jumlah stok dilakukan melalui menu Manajemen Stok (Stok Masuk /
                  Keluar FEFO) agar histori batch tetap akurat.
                </p>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMedModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingMed}
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {savingMed ? 'Menyimpan...' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL BATCH FEFO ==================== */}
      {batchModalMed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Daftar Batch FEFO — {batchModalMed.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Kode PLU: <span className="font-mono">{batchModalMed.pluCode}</span> · Diurutkan
                  berdasarkan kedaluwarsa terdekat (First Expired, First Out)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBatchModalMed(null)}
                className="p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              {loadingBatches ? (
                <p className="text-xs text-slate-500 text-center py-6">Memuat batch...</p>
              ) : batches.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  Belum ada catatan batch untuk obat ini.
                </p>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                      <th className="py-2.5 px-3">No. Batch</th>
                      <th className="py-2.5 px-3">Tanggal ED</th>
                      <th className="py-2.5 px-3">Supplier</th>
                      <th className="py-2.5 px-3 text-right">Awal</th>
                      <th className="py-2.5 px-3 text-right">Sisa</th>
                      <th className="py-2.5 px-3 text-right">Harga Beli</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batches.map((b, idx) => (
                      <tr key={b.id} className={b.remainingQty <= 0 ? 'opacity-45' : ''}>
                        <td className="py-2.5 px-3 font-mono text-slate-800">
                          {b.batchNumber}
                          {idx === 0 && b.remainingQty > 0 ? ' (Prioritas Keluar)' : ''}
                        </td>
                        <td className="py-2.5 px-3 tabular-nums font-medium text-slate-900">
                          {formatDate(b.expiredDate)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{b.supplierName || '-'}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          {formatNumber(b.initialQty, 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold tabular-nums text-emerald-700">
                          {formatNumber(b.remainingQty, 2)}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          {formatRupiah(b.purchasePrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL KATEGORI ==================== */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {editingCat ? 'Edit Kategori' : 'Tambah Kategori Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setCatModalOpen(false)}
                className="p-1.5 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCategory} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kode Kategori*</label>
                <input
                  required
                  value={catForm.code}
                  onChange={(e) => setCatForm({ ...catForm, code: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                  placeholder="KAT-11"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Kategori*</label>
                <input
                  required
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  placeholder="Analgesik & Antipiretik"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deskripsi</label>
                <textarea
                  rows={3}
                  value={catForm.description}
                  onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCatModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingCat}
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg cursor-pointer"
                >
                  {savingCat ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL SUPPLIER ==================== */}
      {supModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {editingSup ? 'Edit Supplier' : 'Tambah Supplier Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setSupModalOpen(false)}
                className="p-1.5 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSupplier} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Supplier*</label>
                <input
                  required
                  value={supForm.name}
                  onChange={(e) => setSupForm({ ...supForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  placeholder="PT Kimia Farma Trading & Distribution"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alamat</label>
                <textarea
                  rows={2}
                  value={supForm.address}
                  onChange={(e) => setSupForm({ ...supForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nomor Telepon</label>
                  <input
                    value={supForm.phone}
                    onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Lead Time (Hari)*
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={supForm.leadTimeDays}
                    onChange={(e) => setSupForm({ ...supForm, leadTimeDays: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={supForm.email}
                  onChange={(e) => setSupForm({ ...supForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSupModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingSup}
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg cursor-pointer"
                >
                  {savingSup ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL KONFIRMASI HAPUS ==================== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-sm p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Konfirmasi Hapus Data</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus{' '}
              <span className="font-semibold text-slate-900">{deleteTarget.label}</span>? Tindakan
              ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
