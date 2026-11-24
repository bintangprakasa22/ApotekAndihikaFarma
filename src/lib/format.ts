const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const numberFormatters = new Map<number, Intl.NumberFormat>();

function getNumberFormatter(maxDecimals: number): Intl.NumberFormat {
  let fmt = numberFormatters.get(maxDecimals);
  if (!fmt) {
    fmt = new Intl.NumberFormat('id-ID', {
      maximumFractionDigits: maxDecimals,
    });
    numberFormatters.set(maxDecimals, fmt);
  }
  return fmt;
}

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatRupiah(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return 'Rp 0';
  return rupiahFormatter.format(num);
}

export function formatNumber(value: number | null | undefined, maxDecimals = 2): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '0';
  return getNumberFormatter(maxDecimals).format(num);
}

export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '-';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return dateFormatter.format(d);
}

export function formatDateTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '-';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return dateTimeFormatter.format(d);
}

export async function exportToExcel(
  rows: Record<string, unknown>[],
  sheetName: string,
  fileName: string,
) {
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}
