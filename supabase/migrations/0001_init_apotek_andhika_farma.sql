-- ============================================================================
-- Migrasi PostgreSQL & Row Level Security (Supabase Compatible)
-- Sistem Manajemen Stok Obat & SPK Pengadaan Metode TOPSIS
-- Apotek Andhika Farma
-- ============================================================================

-- 1. Tabel Profil Pengguna & Role (admin | petugas)
CREATE TABLE IF NOT EXISTS public.profiles (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'petugas' CHECK (role IN ('admin', 'petugas')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);

-- 2. Tabel Kategori Obat
CREATE TABLE IF NOT EXISTS public.categories (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabel Supplier (PBF)
CREATE TABLE IF NOT EXISTS public.suppliers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  lead_time_days INTEGER NOT NULL DEFAULT 2 CHECK (lead_time_days >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabel Master Data Obat
CREATE TABLE IF NOT EXISTS public.medicines (
  id SERIAL PRIMARY KEY,
  plu_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id INTEGER REFERENCES public.categories(id) ON DELETE SET NULL,
  supplier_id INTEGER REFERENCES public.suppliers(id) ON DELETE SET NULL,
  unit TEXT NOT NULL DEFAULT 'TABLET',
  purchase_price DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
  selling_price DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  prescription_price DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (prescription_price >= 0),
  stock DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock INTEGER NOT NULL DEFAULT 10 CHECK (min_stock >= 0),
  nearest_expired_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS medicines_name_idx ON public.medicines(name);
CREATE INDEX IF NOT EXISTS medicines_category_idx ON public.medicines(category_id);
CREATE INDEX IF NOT EXISTS medicines_supplier_idx ON public.medicines(supplier_id);
CREATE INDEX IF NOT EXISTS medicines_stock_idx ON public.medicines(stock);

-- 5. Tabel Batch Obat (Mendukung Multi-ED & Prinsip FEFO)
CREATE TABLE IF NOT EXISTS public.medicine_batches (
  id SERIAL PRIMARY KEY,
  medicine_id INTEGER NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  supplier_id INTEGER REFERENCES public.suppliers(id) ON DELETE SET NULL,
  batch_number TEXT NOT NULL,
  expired_date DATE NOT NULL,
  initial_qty DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (initial_qty >= 0),
  remaining_qty DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (remaining_qty >= 0),
  purchase_price DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS batches_medicine_idx ON public.medicine_batches(medicine_id);
CREATE INDEX IF NOT EXISTS batches_expired_idx ON public.medicine_batches(expired_date);

-- 6. Tabel Riwayat Pergerakan Stok
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id SERIAL PRIMARY KEY,
  medicine_id INTEGER NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  batch_id INTEGER REFERENCES public.medicine_batches(id) ON DELETE SET NULL,
  user_uid TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT 'Sistem',
  movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
  reference_type TEXT NOT NULL DEFAULT 'penjualan',
  quantity DOUBLE PRECISION NOT NULL CHECK (quantity > 0),
  stock_before DOUBLE PRECISION NOT NULL DEFAULT 0,
  stock_after DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (stock_after >= 0),
  unit_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  movement_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS movements_medicine_idx ON public.stock_movements(medicine_id);
CREATE INDEX IF NOT EXISTS movements_type_idx ON public.stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS movements_date_idx ON public.stock_movements(movement_date);

-- 7. Tabel Kriteria TOPSIS
CREATE TABLE IF NOT EXISTS public.topsis_criteria (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  original_type TEXT NOT NULL CHECK (original_type IN ('benefit', 'cost')),
  calculation_type TEXT NOT NULL CHECK (calculation_type IN ('benefit', 'cost')),
  weight DOUBLE PRECISION NOT NULL CHECK (weight > 0),
  description TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Data Awal Kriteria & Bobot Penelitian TOPSIS
INSERT INTO public.topsis_criteria (code, name, original_type, calculation_type, weight, description)
VALUES
  ('K1', 'Jumlah Penjualan', 'benefit', 'benefit', 5, 'Volume penjualan/stok keluar obat pada periode analisis.'),
  ('K2', 'Sisa Stok Fisik', 'cost', 'benefit', 5, 'Jenis asli Cost sesuai penelitian; skor konversi tertinggi (stok paling kritis) diproses sebagai nilai prioritas Benefit agar tidak terjadi pembalikan ganda.'),
  ('K3', 'Lead Time', 'benefit', 'benefit', 3, 'Lama waktu tunggu pengiriman dari supplier (hari).'),
  ('K4', 'Masa Kedaluwarsa', 'benefit', 'benefit', 4, 'Sisa masa kedaluwarsa batch terdekat (bulan) untuk antisipasi penggantian stok.'),
  ('K5', 'Harga Beli', 'benefit', 'benefit', 2, 'Harga beli satuan dari supplier (Rp); harga ekonomis mendapat skor prioritas lebih tinggi.')
ON CONFLICT (code) DO NOTHING;

-- 8. Tabel Header Riwayat Perhitungan TOPSIS
CREATE TABLE IF NOT EXISTS public.topsis_runs (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_by_uid TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  weights_snapshot JSONB NOT NULL,
  ideal_positive JSONB NOT NULL,
  ideal_negative JSONB NOT NULL,
  total_alternatives INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS topsis_runs_created_idx ON public.topsis_runs(created_at);

-- 9. Tabel Detail Hasil Perhitungan TOPSIS (8 Tahapan Matriks)
CREATE TABLE IF NOT EXISTS public.topsis_results (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES public.topsis_runs(id) ON DELETE CASCADE,
  medicine_id INTEGER NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  medicine_plu TEXT NOT NULL,
  medicine_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'TABLET',
  raw_sales DOUBLE PRECISION NOT NULL DEFAULT 0,
  raw_stock DOUBLE PRECISION NOT NULL DEFAULT 0,
  raw_lead_time DOUBLE PRECISION NOT NULL DEFAULT 0,
  raw_expiry_months DOUBLE PRECISION NOT NULL DEFAULT 12,
  raw_purchase_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  score_k1 INTEGER NOT NULL,
  score_k2 INTEGER NOT NULL,
  score_k3 INTEGER NOT NULL,
  score_k4 INTEGER NOT NULL,
  score_k5 INTEGER NOT NULL,
  norm_k1 DOUBLE PRECISION NOT NULL,
  norm_k2 DOUBLE PRECISION NOT NULL,
  norm_k3 DOUBLE PRECISION NOT NULL,
  norm_k4 DOUBLE PRECISION NOT NULL,
  norm_k5 DOUBLE PRECISION NOT NULL,
  weighted_k1 DOUBLE PRECISION NOT NULL,
  weighted_k2 DOUBLE PRECISION NOT NULL,
  weighted_k3 DOUBLE PRECISION NOT NULL,
  weighted_k4 DOUBLE PRECISION NOT NULL,
  weighted_k5 DOUBLE PRECISION NOT NULL,
  distance_positive DOUBLE PRECISION NOT NULL,
  distance_negative DOUBLE PRECISION NOT NULL,
  preference_value DOUBLE PRECISION NOT NULL,
  rank INTEGER NOT NULL,
  priority_label TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS topsis_results_run_idx ON public.topsis_results(run_id);
CREATE INDEX IF NOT EXISTS topsis_results_rank_idx ON public.topsis_results(rank);

-- 10. Tabel Notifikasi Peringatan Stok & Kedaluwarsa
CREATE TABLE IF NOT EXISTS public.notifications (
  id SERIAL PRIMARY KEY,
  medicine_id INTEGER REFERENCES public.medicines(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON public.notifications(is_read);

-- 11. Tabel Audit Log
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id SERIAL PRIMARY KEY,
  user_uid TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL DEFAULT '',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs(created_at);

-- ============================================================================
-- FUNGSI HELPER & TRIGGER SUPABASE AUTH
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE uid = auth.uid()::text AND is_active = TRUE LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_supabase_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  assigned_role TEXT;
BEGIN
  IF LOWER(COALESCE(NEW.email, '')) = 'bintangprakasa22@gmail.com'
     OR NOT EXISTS (SELECT 1 FROM public.profiles) THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'petugas';
  END IF;

  INSERT INTO public.profiles (uid, email, full_name, role, is_active)
  VALUES (
    NEW.id::text,
    LOWER(COALESCE(NEW.email, '')),
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(COALESCE(NEW.email, 'User'), '@', 1)),
    assigned_role,
    TRUE
  )
  ON CONFLICT (uid) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Aktifkan trigger pada Supabase Auth jika skema auth tersedia
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_supabase_user();
  END IF;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topsis_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topsis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topsis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: pengguna melihat profil sendiri, Admin mengelola semua profil
CREATE POLICY "profiles_select_self_or_admin" ON public.profiles
  FOR SELECT USING (uid = auth.uid()::text OR public.get_my_role() = 'admin');
CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

-- Master Data & Stok: Admin & Petugas aktif dapat membaca & mengelola operasional
CREATE POLICY "categories_staff_all" ON public.categories
  FOR ALL USING (public.get_my_role() IN ('admin', 'petugas'))
  WITH CHECK (public.get_my_role() IN ('admin', 'petugas'));

CREATE POLICY "suppliers_staff_all" ON public.suppliers
  FOR ALL USING (public.get_my_role() IN ('admin', 'petugas'))
  WITH CHECK (public.get_my_role() IN ('admin', 'petugas'));

CREATE POLICY "medicines_staff_all" ON public.medicines
  FOR ALL USING (public.get_my_role() IN ('admin', 'petugas'))
  WITH CHECK (public.get_my_role() IN ('admin', 'petugas'));

CREATE POLICY "batches_staff_all" ON public.medicine_batches
  FOR ALL USING (public.get_my_role() IN ('admin', 'petugas'))
  WITH CHECK (public.get_my_role() IN ('admin', 'petugas'));

CREATE POLICY "movements_staff_read_insert" ON public.stock_movements
  FOR SELECT USING (public.get_my_role() IN ('admin', 'petugas'));
CREATE POLICY "movements_staff_insert" ON public.stock_movements
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'petugas'));

-- Kriteria TOPSIS: Semua staf dapat membaca, HANYA Admin dapat mengubah bobot
CREATE POLICY "criteria_staff_read" ON public.topsis_criteria
  FOR SELECT USING (public.get_my_role() IN ('admin', 'petugas'));
CREATE POLICY "criteria_admin_write" ON public.topsis_criteria
  FOR ALL USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

-- Riwayat & Hasil TOPSIS: Staf dapat membaca & menjalankan, HANYA Admin dapat menghapus
CREATE POLICY "topsis_runs_staff_read" ON public.topsis_runs
  FOR SELECT USING (public.get_my_role() IN ('admin', 'petugas'));
CREATE POLICY "topsis_runs_staff_insert" ON public.topsis_runs
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'petugas'));
CREATE POLICY "topsis_runs_admin_delete" ON public.topsis_runs
  FOR DELETE USING (public.get_my_role() = 'admin');

CREATE POLICY "topsis_results_staff_read" ON public.topsis_results
  FOR SELECT USING (public.get_my_role() IN ('admin', 'petugas'));
CREATE POLICY "topsis_results_staff_insert" ON public.topsis_results
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'petugas'));

-- Notifikasi: Staf aktif dapat membaca & menandai dibaca
CREATE POLICY "notifications_staff_all" ON public.notifications
  FOR ALL USING (public.get_my_role() IN ('admin', 'petugas'))
  WITH CHECK (public.get_my_role() IN ('admin', 'petugas'));

-- Audit Logs: HANYA Admin dapat membaca
CREATE POLICY "audit_logs_admin_read" ON public.audit_logs
  FOR SELECT USING (public.get_my_role() = 'admin');
CREATE POLICY "audit_logs_staff_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'petugas'));
