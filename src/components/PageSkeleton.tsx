import React from 'react';

export type PageSkeletonVariant =
  | 'dashboard'
  | 'master'
  | 'stock'
  | 'topsis'
  | 'reports'
  | 'users'
  | 'login';

function SkeletonBar({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-200/75 rounded animate-pulse ${className}`} />;
}

export function TableRowsSkeleton({
  cols,
  rows = 6,
}: {
  cols: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <tr key={rowIdx}>
          {Array.from({ length: cols }).map((__, colIdx) => (
            <td key={colIdx} className="py-3 px-4">
              <div
                className={`h-3.5 bg-slate-100 rounded animate-pulse ${
                  colIdx === 0
                    ? 'w-20'
                    : colIdx === 1
                      ? 'w-40'
                      : colIdx === cols - 1
                        ? 'w-16 ml-auto'
                        : 'w-24'
                }`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function ReportsTableSkeleton() {
  return (
    <div className="p-4 space-y-3">
      <div className="h-8 bg-slate-50 border border-slate-100 rounded-lg animate-pulse" />
      {Array.from({ length: 7 }).map((_, idx) => (
        <div key={idx} className="grid grid-cols-6 gap-4 py-2 border-b border-slate-100 last:border-0">
          <div className="h-3.5 bg-slate-100 rounded animate-pulse col-span-1" />
          <div className="h-3.5 bg-slate-200/70 rounded animate-pulse col-span-2" />
          <div className="h-3.5 bg-slate-100 rounded animate-pulse col-span-1" />
          <div className="h-3.5 bg-slate-100 rounded animate-pulse col-span-1" />
          <div className="h-3.5 bg-slate-100 rounded animate-pulse col-span-1" />
        </div>
      ))}
    </div>
  );
}

export function AlertsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {[0, 1, 2].map((card) => (
        <div key={card} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 space-y-2">
            <SkeletonBar className="h-4 w-40" />
            <SkeletonBar className="h-3 w-52 bg-slate-200/50" />
          </div>
          <div className="divide-y divide-slate-100 p-4 space-y-3">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center justify-between gap-3 pt-2 first:pt-0">
                <div className="space-y-1.5 flex-1">
                  <SkeletonBar className="h-3.5 w-3/4" />
                  <SkeletonBar className="h-2.5 w-1/3 bg-slate-100" />
                </div>
                <SkeletonBar className="h-4 w-14 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MedicinePickerSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="space-y-1.5 flex-1 min-w-0">
            <SkeletonBar className="h-3.5 w-3/4" />
            <SkeletonBar className="h-2.5 w-1/2 bg-slate-100" />
          </div>
          <div className="space-y-1 text-right shrink-0">
            <SkeletonBar className="h-3.5 w-10 ml-auto" />
            <SkeletonBar className="h-2.5 w-12 bg-slate-100 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NotificationListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <SkeletonBar className="h-3 w-16 bg-sky-100" />
            <SkeletonBar className="h-2.5 w-20 bg-slate-100" />
          </div>
          <SkeletonBar className="h-3.5 w-3/4" />
          <SkeletonBar className="h-3 w-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function TopsisDetailSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Memuat Hasil TOPSIS">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-2">
          <SkeletonBar className="h-4 w-64" />
          <SkeletonBar className="h-3 w-80 bg-slate-100" />
        </div>
        <div className="flex gap-2">
          <SkeletonBar className="h-8 w-24 rounded-lg bg-slate-100" />
          <SkeletonBar className="h-8 w-28 rounded-lg bg-emerald-100" />
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <SkeletonBar className="h-4 w-56" />
        </div>
        <ReportsTableSkeleton />
      </div>
    </div>
  );
}

function PageHeaderSkeleton({ withTabs = false }: { withTabs?: boolean }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
      <div className="space-y-2">
        <SkeletonBar className="h-6 w-64 sm:w-80" />
        <SkeletonBar className="h-3.5 w-72 sm:w-96 bg-slate-100" />
      </div>
      {withTabs ? (
        <div className="h-9 w-72 bg-white border border-slate-200 rounded-lg animate-pulse" />
      ) : (
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 bg-white border border-slate-200 rounded-lg animate-pulse" />
          <div className="h-9 w-32 bg-sky-100 rounded-lg animate-pulse" />
        </div>
      )}
    </div>
  );
}

export function PageSkeleton({ variant }: { variant: PageSkeletonVariant }) {
  if (variant === 'login') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-8 space-y-5 min-h-[420px]">
            <SkeletonBar className="h-3.5 w-52 bg-sky-100" />
            <SkeletonBar className="h-8 w-5/6" />
            <SkeletonBar className="h-4 w-full bg-slate-100" />
            <div className="pt-6 border-t border-slate-100 space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-1.5">
                  <SkeletonBar className="h-4 w-48" />
                  <SkeletonBar className="h-3 w-11/12 bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-center space-y-5 min-h-[420px]">
            <SkeletonBar className="h-12 w-12 rounded-xl" />
            <SkeletonBar className="h-6 w-40" />
            <SkeletonBar className="h-4 w-full bg-slate-100" />
            <SkeletonBar className="h-10 w-full rounded-lg bg-sky-100" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'dashboard') {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Memuat Dashboard">
        <PageHeaderSkeleton />
        {/* 6 KPI Statistik Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-28 bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between gap-2">
                <SkeletonBar className="h-3.5 w-24 bg-slate-100" />
                <SkeletonBar className="h-4 w-4 rounded-md bg-slate-200/80 shrink-0" />
              </div>
              <SkeletonBar className="h-7 w-16" />
              <SkeletonBar className="h-3 w-28 bg-slate-100" />
            </div>
          ))}
        </div>

        {/* Grafik 14 Hari + Obat Perlu Perhatian Segera Skeleton */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between min-h-[304px]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
              <div className="space-y-2">
                <SkeletonBar className="h-4 w-72 max-w-full" />
                <SkeletonBar className="h-3 w-56 max-w-full bg-slate-100" />
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <SkeletonBar className="h-3 w-16 bg-emerald-100" />
                <SkeletonBar className="h-3 w-16 bg-sky-100" />
              </div>
            </div>
            <div className="flex items-end gap-2.5 h-48 pt-6 px-2">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="flex-1 flex items-end justify-center gap-1 h-full">
                  <div
                    className="w-2.5 bg-emerald-100 rounded-t animate-pulse"
                    style={{ height: `${28 + ((i * 19) % 62)}%` }}
                  />
                  <div
                    className="w-2.5 bg-sky-100 rounded-t animate-pulse"
                    style={{ height: `${22 + ((i * 29) % 58)}%` }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
              <div className="space-y-1.5">
                <SkeletonBar className="h-4 w-40" />
                <SkeletonBar className="h-3 w-48 bg-slate-100" />
              </div>
              <SkeletonBar className="h-3.5 w-16 bg-sky-100" />
            </div>
            <div className="divide-y divide-slate-100 px-5 py-2 flex-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="py-3 flex justify-between items-center gap-3">
                  <div className="space-y-1.5 flex-1">
                    <SkeletonBar className="h-3.5 w-44 max-w-full" />
                    <SkeletonBar className="h-2.5 w-32 bg-slate-100" />
                  </div>
                  <div className="space-y-1 text-right shrink-0">
                    <SkeletonBar className="h-4 w-10 ml-auto" />
                    <SkeletonBar className="h-2.5 w-12 bg-slate-100 ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Transaksi Terbaru + Top 5 TOPSIS Skeleton */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="space-y-1.5">
                <SkeletonBar className="h-4 w-48" />
                <SkeletonBar className="h-3 w-40 bg-slate-100" />
              </div>
              <SkeletonBar className="h-3.5 w-16 bg-sky-100" />
            </div>
            <div className="divide-y divide-slate-100 px-5">
              {[0, 1, 2, 3, 4].map((row) => (
                <div key={row} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <SkeletonBar className="w-7 h-7 rounded-lg bg-slate-100 shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <SkeletonBar className="h-3.5 w-44 max-w-full" />
                      <SkeletonBar className="h-2.5 w-56 max-w-full bg-slate-100" />
                    </div>
                  </div>
                  <div className="space-y-1 shrink-0">
                    <SkeletonBar className="h-3.5 w-16 ml-auto" />
                    <SkeletonBar className="h-2.5 w-12 bg-slate-100 ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="space-y-1.5">
                <SkeletonBar className="h-4 w-56 max-w-full" />
                <SkeletonBar className="h-3 w-44 bg-slate-100" />
              </div>
              <SkeletonBar className="h-3.5 w-20 bg-sky-100" />
            </div>
            <div className="p-4 space-y-2.5">
              <div className="h-7 bg-slate-50 rounded animate-pulse" />
              {[0, 1, 2, 3, 4].map((row) => (
                <div key={row} className="grid grid-cols-5 gap-3 py-2 border-b border-slate-100 last:border-0">
                  <SkeletonBar className="h-3.5 w-8" />
                  <SkeletonBar className="h-3.5 w-full col-span-2" />
                  <SkeletonBar className="h-3.5 w-12 ml-auto" />
                  <SkeletonBar className="h-3.5 w-16 ml-auto bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'stock') {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Memuat Manajemen Stok">
        <PageHeaderSkeleton withTabs />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 space-y-2.5">
              <SkeletonBar className="h-3.5 w-24" />
              <div className="h-9 bg-slate-100 rounded-lg animate-pulse" />
            </div>
            <div className="divide-y divide-slate-100 p-4 space-y-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex justify-between items-center pt-2 first:pt-0">
                  <div className="space-y-1.5 flex-1">
                    <SkeletonBar className="h-3.5 w-44" />
                    <SkeletonBar className="h-2.5 w-28 bg-slate-100" />
                  </div>
                  <SkeletonBar className="h-4 w-12" />
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4 min-h-[340px]">
            <SkeletonBar className="h-5 w-52" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="h-14 bg-slate-50 rounded-lg animate-pulse" />
              <div className="h-14 bg-slate-50 rounded-lg animate-pulse" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="h-14 bg-slate-50 rounded-lg animate-pulse" />
              <div className="h-14 bg-slate-50 rounded-lg animate-pulse" />
              <div className="h-14 bg-slate-50 rounded-lg animate-pulse" />
            </div>
            <div className="h-14 bg-slate-50 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'topsis') {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Memuat SPK TOPSIS">
        <PageHeaderSkeleton withTabs />
        <div className="h-20 bg-sky-50/70 border border-sky-100 rounded-xl animate-pulse" />
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
            <SkeletonBar className="h-4 w-52" />
            <SkeletonBar className="h-8 w-28 rounded-lg" />
          </div>
          <div className="p-4 space-y-2.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 bg-slate-50 rounded animate-pulse" />
            ))}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="h-14 bg-slate-50 rounded-lg animate-pulse" />
            <div className="h-14 bg-slate-50 rounded-lg animate-pulse" />
            <div className="h-14 bg-slate-50 rounded-lg animate-pulse" />
          </div>
          <ReportsTableSkeleton />
        </div>
      </div>
    );
  }

  if (variant === 'reports') {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Memuat Laporan">
        <PageHeaderSkeleton />
        <div className="h-11 bg-white border border-slate-200 rounded-xl animate-pulse" />
        <div className="h-16 bg-white border border-slate-200 rounded-xl animate-pulse" />
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center">
            <SkeletonBar className="h-4 w-44" />
            <SkeletonBar className="h-3.5 w-20 bg-slate-100" />
          </div>
          <ReportsTableSkeleton />
        </div>
      </div>
    );
  }

  if (variant === 'users') {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Memuat Pengguna & Audit">
        <PageHeaderSkeleton />
        {[0, 1].map((block) => (
          <div key={block} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <SkeletonBar className="h-4 w-52" />
            </div>
            <ReportsTableSkeleton />
          </div>
        ))}
      </div>
    );
  }

  // Default: 'master'
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Memuat Master Data">
      <PageHeaderSkeleton withTabs />
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row gap-3 justify-between">
          <div className="flex flex-col sm:flex-row gap-2.5 flex-1">
            <div className="h-9 bg-slate-100 rounded-lg flex-1 max-w-sm animate-pulse" />
            <div className="h-9 w-36 bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-9 w-40 bg-slate-100 rounded-lg animate-pulse" />
          </div>
          <div className="h-9 w-32 bg-sky-100 rounded-lg animate-pulse" />
        </div>
        <ReportsTableSkeleton />
      </div>
    </div>
  );
}
