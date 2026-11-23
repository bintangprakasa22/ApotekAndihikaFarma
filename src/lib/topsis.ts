export interface TopsisCriterionConfig {
  code: 'K1' | 'K2' | 'K3' | 'K4' | 'K5';
  name: string;
  originalType: 'benefit' | 'cost';
  calculationType: 'benefit' | 'cost';
  weight: number;
  description: string;
}

export interface TopsisCandidateInput {
  medicineId: number;
  medicinePlu: string;
  medicineName: string;
  unit: string;
  rawSales: number;
  rawStock: number;
  rawLeadTime: number;
  rawExpiryMonths: number;
  rawPurchasePrice: number;
  // Optional manual score overrides (if null/undefined, auto-computed from raw values)
  overrideK1?: number;
  overrideK2?: number;
  overrideK3?: number;
  overrideK4?: number;
  overrideK5?: number;
}

export interface TopsisAlternativeResult {
  medicineId: number;
  medicinePlu: string;
  medicineName: string;
  unit: string;
  rawSales: number;
  rawStock: number;
  rawLeadTime: number;
  rawExpiryMonths: number;
  rawPurchasePrice: number;
  scoreK1: number;
  scoreK2: number;
  scoreK3: number;
  scoreK4: number;
  scoreK5: number;
  normK1: number;
  normK2: number;
  normK3: number;
  normK4: number;
  normK5: number;
  weightedK1: number;
  weightedK2: number;
  weightedK3: number;
  weightedK4: number;
  weightedK5: number;
  distancePositive: number;
  distanceNegative: number;
  preferenceValue: number;
  rank: number;
  priorityLabel: string;
}

export interface TopsisCalculationOutput {
  criteria: TopsisCriterionConfig[];
  divisors: { K1: number; K2: number; K3: number; K4: number; K5: number };
  idealPositive: { K1: number; K2: number; K3: number; K4: number; K5: number };
  idealNegative: { K1: number; K2: number; K3: number; K4: number; K5: number };
  results: TopsisAlternativeResult[];
}

export const DEFAULT_TOPSIS_CRITERIA: TopsisCriterionConfig[] = [
  {
    code: 'K1',
    name: 'Jumlah Penjualan',
    originalType: 'benefit',
    calculationType: 'benefit',
    weight: 5,
    description: 'Volume penjualan/stok keluar obat pada periode analisis.',
  },
  {
    code: 'K2',
    name: 'Sisa Stok Fisik',
    originalType: 'cost',
    calculationType: 'benefit',
    weight: 5,
    description:
      'Jenis asli Cost sesuai penelitian; skor konversi tertinggi (stok paling kritis) diproses sebagai nilai prioritas Benefit agar tidak terjadi pembalikan ganda.',
  },
  {
    code: 'K3',
    name: 'Lead Time',
    originalType: 'benefit',
    calculationType: 'benefit',
    weight: 3,
    description: 'Lama waktu tunggu pengiriman dari supplier (hari).',
  },
  {
    code: 'K4',
    name: 'Masa Kedaluwarsa',
    originalType: 'benefit',
    calculationType: 'benefit',
    weight: 4,
    description: 'Sisa masa kedaluwarsa batch terdekat (bulan) untuk antisipasi penggantian stok.',
  },
  {
    code: 'K5',
    name: 'Harga Beli',
    originalType: 'benefit',
    calculationType: 'benefit',
    weight: 2,
    description: 'Harga beli satuan dari supplier (Rp); harga ekonomis mendapat skor prioritas lebih tinggi.',
  },
];

// Parameter skor 1-5 sesuai dokumen penelitian
export function scoreK1Sales(sales: number): number {
  if (sales > 500) return 5;
  if (sales >= 301) return 4;
  if (sales >= 151) return 3;
  if (sales >= 51) return 2;
  return 1;
}

export function scoreK2Stock(stock: number): number {
  if (stock <= 5) return 5;
  if (stock <= 20) return 4;
  if (stock <= 50) return 3;
  if (stock <= 100) return 2;
  return 1;
}

export function scoreK3LeadTime(days: number): number {
  if (days > 5) return 5;
  if (days >= 4) return 4;
  if (days >= 2) return 3;
  if (days >= 1) return 2;
  return 1; // Hari yang sama atau < 12 jam
}

export function scoreK4ExpiryMonths(months: number): number {
  if (months <= 3) return 5;
  if (months <= 6) return 4;
  if (months <= 12) return 3;
  if (months <= 24) return 2;
  return 1;
}

export function scoreK5PurchasePrice(price: number): number {
  if (price <= 10000) return 5;
  if (price <= 25000) return 4;
  if (price <= 50000) return 3;
  if (price <= 100000) return 2;
  return 1;
}

export function getPriorityLabel(preferenceValue: number): string {
  if (preferenceValue >= 0.65) return 'Prioritas Tinggi (Segera Pesan)';
  if (preferenceValue >= 0.4) return 'Prioritas Sedang (Jadwalkan)';
  return 'Prioritas Rendah (Pantau)';
}

function round6(num: number): number {
  return Math.round(num * 1_000_000) / 1_000_000;
}

export function calculateTopsis(
  candidates: TopsisCandidateInput[],
  criteriaList: TopsisCriterionConfig[],
): TopsisCalculationOutput {
  if (candidates.length === 0) {
    throw new Error('Minimal diperlukan 1 obat kandidat untuk menjalankan perhitungan TOPSIS.');
  }

  const criteriaMap = new Map(criteriaList.map((c) => [c.code, c]));
  const c1 = criteriaMap.get('K1') || DEFAULT_TOPSIS_CRITERIA[0];
  const c2 = criteriaMap.get('K2') || DEFAULT_TOPSIS_CRITERIA[1];
  const c3 = criteriaMap.get('K3') || DEFAULT_TOPSIS_CRITERIA[2];
  const c4 = criteriaMap.get('K4') || DEFAULT_TOPSIS_CRITERIA[3];
  const c5 = criteriaMap.get('K5') || DEFAULT_TOPSIS_CRITERIA[4];

  // Tahap 1: Matriks Keputusan (X) - skor 1-5
  const scored = candidates.map((item) => {
    const clampScore = (val: number) => Math.max(1, Math.min(5, Math.round(val)));
    return {
      ...item,
      scoreK1: item.overrideK1 ? clampScore(item.overrideK1) : scoreK1Sales(item.rawSales),
      scoreK2: item.overrideK2 ? clampScore(item.overrideK2) : scoreK2Stock(item.rawStock),
      scoreK3: item.overrideK3 ? clampScore(item.overrideK3) : scoreK3LeadTime(item.rawLeadTime),
      scoreK4: item.overrideK4 ? clampScore(item.overrideK4) : scoreK4ExpiryMonths(item.rawExpiryMonths),
      scoreK5: item.overrideK5 ? clampScore(item.overrideK5) : scoreK5PurchasePrice(item.rawPurchasePrice),
    };
  });

  // Pembagi normalisasi: sqrt(sum(x_ij^2))
  const divisors = {
    K1: Math.sqrt(scored.reduce((acc, r) => acc + r.scoreK1 ** 2, 0)) || 1,
    K2: Math.sqrt(scored.reduce((acc, r) => acc + r.scoreK2 ** 2, 0)) || 1,
    K3: Math.sqrt(scored.reduce((acc, r) => acc + r.scoreK3 ** 2, 0)) || 1,
    K4: Math.sqrt(scored.reduce((acc, r) => acc + r.scoreK4 ** 2, 0)) || 1,
    K5: Math.sqrt(scored.reduce((acc, r) => acc + r.scoreK5 ** 2, 0)) || 1,
  };

  // Tahap 2 & 3: Normalisasi (R) dan Normalisasi Terbobot (Y)
  const weightedRows = scored.map((r) => {
    const normK1 = r.scoreK1 / divisors.K1;
    const normK2 = r.scoreK2 / divisors.K2;
    const normK3 = r.scoreK3 / divisors.K3;
    const normK4 = r.scoreK4 / divisors.K4;
    const normK5 = r.scoreK5 / divisors.K5;

    return {
      ...r,
      normK1: round6(normK1),
      normK2: round6(normK2),
      normK3: round6(normK3),
      normK4: round6(normK4),
      normK5: round6(normK5),
      weightedK1: round6(normK1 * c1.weight),
      weightedK2: round6(normK2 * c2.weight),
      weightedK3: round6(normK3 * c3.weight),
      weightedK4: round6(normK4 * c4.weight),
      weightedK5: round6(normK5 * c5.weight),
    };
  });

  // Tahap 4 & 5: Solusi Ideal Positif (A+) dan Negatif (A-)
  // Catatan metodologis: K2 (Sisa Stok Fisik) mempertahankan jenis asli Cost pada metadata,
  // namun calculationType-nya adalah 'benefit' karena skor konversi 5 = stok paling kritis (<=5).
  const pickIdeal = (vals: number[], calcType: 'benefit' | 'cost') => {
    const maxVal = Math.max(...vals);
    const minVal = Math.min(...vals);
    return calcType === 'benefit' ? { pos: maxVal, neg: minVal } : { pos: minVal, neg: maxVal };
  };

  const i1 = pickIdeal(weightedRows.map((r) => r.weightedK1), c1.calculationType);
  const i2 = pickIdeal(weightedRows.map((r) => r.weightedK2), c2.calculationType);
  const i3 = pickIdeal(weightedRows.map((r) => r.weightedK3), c3.calculationType);
  const i4 = pickIdeal(weightedRows.map((r) => r.weightedK4), c4.calculationType);
  const i5 = pickIdeal(weightedRows.map((r) => r.weightedK5), c5.calculationType);

  const idealPositive = {
    K1: round6(i1.pos),
    K2: round6(i2.pos),
    K3: round6(i3.pos),
    K4: round6(i4.pos),
    K5: round6(i5.pos),
  };

  const idealNegative = {
    K1: round6(i1.neg),
    K2: round6(i2.neg),
    K3: round6(i3.neg),
    K4: round6(i4.neg),
    K5: round6(i5.neg),
  };

  // Tahap 6 & 7: Jarak D+, D- dan Nilai Preferensi (V)
  const evaluated = weightedRows.map((r) => {
    const dPos = Math.sqrt(
      (r.weightedK1 - idealPositive.K1) ** 2 +
        (r.weightedK2 - idealPositive.K2) ** 2 +
        (r.weightedK3 - idealPositive.K3) ** 2 +
        (r.weightedK4 - idealPositive.K4) ** 2 +
        (r.weightedK5 - idealPositive.K5) ** 2,
    );
    const dNeg = Math.sqrt(
      (r.weightedK1 - idealNegative.K1) ** 2 +
        (r.weightedK2 - idealNegative.K2) ** 2 +
        (r.weightedK3 - idealNegative.K3) ** 2 +
        (r.weightedK4 - idealNegative.K4) ** 2 +
        (r.weightedK5 - idealNegative.K5) ** 2,
    );
    const denom = dPos + dNeg;
    const pref = denom === 0 ? 0 : dNeg / denom;

    return {
      ...r,
      distancePositive: round6(dPos),
      distanceNegative: round6(dNeg),
      preferenceValue: round6(pref),
    };
  });

  // Tahap 8: Ranking Prioritas Pengadaan (tertinggi ke terendah)
  evaluated.sort((a, b) => {
    if (b.preferenceValue !== a.preferenceValue) return b.preferenceValue - a.preferenceValue;
    if (b.scoreK2 !== a.scoreK2) return b.scoreK2 - a.scoreK2;
    return b.scoreK1 - a.scoreK1;
  });

  const results: TopsisAlternativeResult[] = evaluated.map((row, idx) => ({
    medicineId: row.medicineId,
    medicinePlu: row.medicinePlu,
    medicineName: row.medicineName,
    unit: row.unit,
    rawSales: row.rawSales,
    rawStock: row.rawStock,
    rawLeadTime: row.rawLeadTime,
    rawExpiryMonths: row.rawExpiryMonths,
    rawPurchasePrice: row.rawPurchasePrice,
    scoreK1: row.scoreK1,
    scoreK2: row.scoreK2,
    scoreK3: row.scoreK3,
    scoreK4: row.scoreK4,
    scoreK5: row.scoreK5,
    normK1: row.normK1,
    normK2: row.normK2,
    normK3: row.normK3,
    normK4: row.normK4,
    normK5: row.normK5,
    weightedK1: row.weightedK1,
    weightedK2: row.weightedK2,
    weightedK3: row.weightedK3,
    weightedK4: row.weightedK4,
    weightedK5: row.weightedK5,
    distancePositive: row.distancePositive,
    distanceNegative: row.distanceNegative,
    preferenceValue: row.preferenceValue,
    rank: idx + 1,
    priorityLabel: getPriorityLabel(row.preferenceValue),
  }));

  return {
    criteria: [c1, c2, c3, c4, c5],
    divisors: {
      K1: round6(divisors.K1),
      K2: round6(divisors.K2),
      K3: round6(divisors.K3),
      K4: round6(divisors.K4),
      K5: round6(divisors.K5),
    },
    idealPositive,
    idealNegative,
    results,
  };
}
