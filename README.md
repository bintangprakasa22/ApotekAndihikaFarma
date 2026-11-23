# Sistem Manajemen Stok Obat & SPK Penentuan Prioritas Pengadaan Obat — Apotek Andhika Farma (Metode TOPSIS)

Aplikasi web full-stack untuk membantu pengelolaan persediaan obat berbasis **batch & FEFO (First Expired, First Out)** serta menentukan prioritas pengadaan obat menggunakan metode **TOPSIS (Technique for Order of Preference by Similarity to Ideal Solution)** pada **Apotek Andhika Farma**.

---

## Fitur Utama

1. **Autentikasi & Kontrol Akses Berbasis Role (RBAC)**
   - **Admin**: Akses penuh seluruh modul termasuk manajemen pengguna, pengaturan bobot kriteria TOPSIS, manajemen data obat/kategori/supplier, manajemen stok FEFO, laporan, dan audit log.
   - **Petugas / Apoteker**: Mengelola data obat/kategori/supplier, mencatat stok masuk & stok keluar (FEFO), melihat laporan, dan menjalankan perhitungan TOPSIS tanpa hak mengubah bobot kriteria atau menghapus riwayat.
2. **Dashboard Operasional**
   - 6 kartu statistik real-time (Total Jenis Obat, Total Stok Obat, Stok Menipis, Stok Habis, Mendekati Kedaluwarsa, Jumlah Transaksi).
   - Grafik interaktif Stok Masuk vs Stok Keluar 14 hari terakhir.
   - Daftar obat yang membutuhkan perhatian segera, aktivitas mutasi terbaru, dan Top 5 prioritas pengadaan TOPSIS.
3. **Master Data Obat, Kategori & Supplier**
   - Pencarian instan, filter kategori & status stok, pagination, tambah/edit/hapus, serta modal rincian batch FEFO per obat.
   - Data awal mengimpor daftar lengkap **1.075+ item obat** dari katalog Apotek Andhika Farma (nilai stok negatif pada data awal otomatis dinormalkan menjadi `0`).
4. **Manajemen Stok Berbasis Batch & FEFO**
   - Pencatatan stok masuk per nomor batch & tanggal kedaluwarsa.
   - Pengeluaran stok memotong batch dengan tanggal kedaluwarsa paling dekat (**FEFO**) secara atomik dan menolak transaksi jika stok akan menjadi negatif.
   - Notifikasi peringatan stok menipis, stok habis, dan batch mendekati kedaluwarsa ($\le 90$ hari).
5. **Sistem Pendukung Keputusan TOPSIS (8 Tahapan Lengkap)**
   - Menampilkan seluruh tahapan perhitungan secara transparan:
     1. Matriks Keputusan ($X$) beserta skor konversi 1–5
     2. Matriks Normalisasi ($R$) dan pembagi $\sqrt{\sum x_{ij}^2}$
     3. Matriks Normalisasi Terbobot ($Y$)
     4. Solusi Ideal Positif ($A^+$)
     5. Solusi Ideal Negatif ($A^-$)
     6. Jarak ke Solusi Ideal Positif ($D^+$) & Negatif ($D^-$)
     7. Nilai Preferensi ($V = D^- / (D^+ + D^-)$)
     8. Ranking Prioritas Pengadaan dari nilai $V$ tertinggi ke terendah
   - **Catatan Metodologis K2 (Sisa Stok Fisik)**: K2 mempertahankan jenis asli *Cost* sesuai dokumen penelitian. Namun karena konversi skor 1–5 telah membalikkan stok paling kritis ($\le 5$ unit) menjadi skor tertinggi (5), perhitungan matriks TOPSIS memproses skor konversi K2 sebagai *Benefit* agar tidak terjadi pembalikan skor ganda.
6. **Pusat Laporan & Ekspor**
   - 6 laporan: Data Obat, Stok Masuk, Stok Keluar, Stok Menipis & Habis, Obat Kedaluwarsa, dan Hasil Perhitungan TOPSIS.
   - Mendukung cetak / simpan PDF (`window.print()`) dan ekspor Excel (`.xlsx`).

---

## Teknologi

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, SheetJS (`xlsx`)
- **Backend**: Node.js, Express, TSX
- **Database & ORM**: PostgreSQL (Cloud SQL aktif + skrip migrasi Supabase PostgreSQL & RLS), Drizzle ORM
- **Autentikasi**: Firebase Authentication (Google Sign-In) & verifikasi token server-side (`firebase-admin`)

---

## Menjalankan Secara Lokal

1. **Instalasi Dependensi**
   ```bash
   npm install
   ```
2. **Konfigurasi Variabel Lingkungan**
   Pastikan variabel Cloud SQL PostgreSQL (`SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`) dan konfigurasi Firebase sudah tersedia di lingkungan runtime.
3. **Sinkronisasi Skema Database**
   ```bash
   npx drizzle-kit push --config=src/db/drizzle.config.ts
   ```
4. **Jalankan Server Pengembangan (Port 3000)**
   ```bash
   npm run dev
   ```
5. **Build Produksi & Pemeriksaan Tipe**
   ```bash
   npm run lint
   npm run build
   npm start
   ```

---

## Migrasi Database ke Supabase

File migrasi lengkap tersedia pada `supabase/migrations/0001_init_apotek_andhika_farma.sql`.
Langkah migrasi:
1. Buat project baru di [Supabase](https://supabase.com).
2. Buka **SQL Editor** pada dashboard Supabase, lalu jalankan seluruh isi file `supabase/migrations/0001_init_apotek_andhika_farma.sql`.
3. Skrip akan membuat seluruh 11 tabel, indeks, fungsi helper `get_my_role()`, trigger pembuatan profil otomatis dari `auth.users`, data kriteria awal TOPSIS, serta kebijakan **Row Level Security (RLS)** untuk role `admin` dan `petugas`.

---

## Deployment ke GitHub & Vercel / Cloud Run

1. **Simpan ke GitHub**:
   - Pastikan file `.env*` tetap diabaikan oleh `.gitignore`.
   - Push seluruh source code ke repositori GitHub Anda.
2. **Deploy**:
   - **Server Full-Stack (Cloud Run / Railway / Render / VPS)**: gunakan perintah build `npm run build` dan start `npm start` pada port `3000`.
   - **Vercel (Frontend + API)**: atur build command `npm run build`, output directory `dist`, dan tambahkan environment variables database PostgreSQL serta kredensial Firebase/Supabase pada menu **Project Settings → Environment Variables**.
