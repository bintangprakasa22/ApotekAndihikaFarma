import * as XLSX from 'xlsx';

export function formatRupiah(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatNumber(value: number | null | undefined, maxDecimals = 2): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '0';
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: maxDecimals,
  }).format(num);
}

export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '-';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '-';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function exportToExcel(
  rows: Record<string, unknown>[],
  sheetName: string,
  fileName: string,
) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}
