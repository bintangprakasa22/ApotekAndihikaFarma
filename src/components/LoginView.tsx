import { ShieldCheck, PackageCheck, BarChart3, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from './BrandLogo';
import { AnimatedHeading } from './AnimatedHeading';
import { MotionCard } from './MotionCard';

export function LoginView() {
  const { signInWithGoogle, signingIn, authError } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <MotionCard
          index={0}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-between"
        >
          <div>
            <p className="text-xs font-medium text-sky-700 tracking-wide">
              Apotek Andhika Farma · Sistem Informasi Farmasi
            </p>
            <AnimatedHeading
              as="h1"
              text="Manajemen Stok Obat & Prioritas Pengadaan Metode TOPSIS"
              className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-snug text-balance"
            />
            <p className="mt-4 text-sm text-slate-600 leading-relaxed">
              Platform terpadu untuk pencatatan inventori obat berbasis batch kedaluwarsa (FEFO) dan
              penentuan prioritas pengadaan obat secara objektif berdasarkan lima kriteria penelitian.
            </p>

            <div className="mt-8 space-y-4 border-t border-slate-100 pt-6">
              <div className="flex items-start gap-3">
                <PackageCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Pengelolaan Batch &amp; FEFO</h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Pengeluaran stok otomatis memprioritaskan batch dengan tanggal kedaluwarsa terdekat dan mencegah stok negatif.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <BarChart3 className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Perhitungan TOPSIS 8 Tahap</h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Menampilkan matriks keputusan, normalisasi, terbobot, solusi ideal, hingga peringkat prioritas pengadaan.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Kontrol Akses Berbasis Role</h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Pemisahan izin antara Admin (kelola pengguna &amp; bobot kriteria) dan Petugas / Apoteker.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 text-xs text-slate-500">
            Data Master Obat Apotek Andhika Farma · PostgreSQL &amp; Autentikasi Terverifikasi
          </div>
        </MotionCard>

        <MotionCard
          index={1}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-center"
        >
          <div className="mb-6">
            <BrandLogo size="lg" />
            <AnimatedHeading
              as="h2"
              text="Masuk ke Sistem"
              delay={0.12}
              className="mt-4 text-xl font-bold text-slate-900"
            />
            <p className="mt-1.5 text-sm text-slate-600">
              Gunakan akun Google Anda untuk mengakses dashboard apotek sesuai role yang terdaftar.
            </p>
          </div>

          {authError && (
            <div className="mb-5 p-3.5 rounded-lg border border-red-200 bg-red-50 flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={signingIn}
            className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2.5 cursor-pointer whitespace-nowrap"
          >
            <svg className="w-4 h-4 bg-white rounded-full p-0.5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>{signingIn ? 'Memproses Masuk...' : 'Masuk dengan Google'}</span>
          </button>

          <div className="mt-6 pt-5 border-t border-slate-100 space-y-2 text-xs text-slate-500">
            <p className="font-medium text-slate-700">Pembagian Hak Akses:</p>
            <p>Admin · Akses penuh, kelola pengguna, ubah bobot TOPSIS, laporan.</p>
            <p>Petugas / Apoteker · Operasional obat, stok FEFO, eksekusi TOPSIS &amp; laporan.</p>
          </div>
        </MotionCard>
      </div>
    </div>
  );
}
