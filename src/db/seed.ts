import { sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  categories,
  medicineBatches,
  medicines,
  notifications,
  stockMovements,
  suppliers,
  topsisCriteria,
  topsisResults,
  topsisRuns,
} from './schema.ts';
import { PDF_RAW_PART_1 } from './pdf-data-part1.ts';
import { PDF_RAW_PART_2 } from './pdf-data-part2.ts';
import { calculateTopsis, DEFAULT_TOPSIS_CRITERIA } from '../lib/topsis.ts';

let seedPromise: Promise<void> | null = null;

function classifyCategoryCode(name: string, unit: string): string {
  const n = name.toUpperCase();
  if (
    /AMOX|CEFIX|CEFAD|AZIT|CLINDA|METRON|FLOX|KETO|ACIC|ACIFAR|ACYCLO|ZORALIN|MICON|FUNG|TRICLO|RAMOX|SAMMOX|NOVAMOX|YUSIMOX|LOSTACEF|HELIXIM|ERLAMYC|GENOINT|SUPER TETRA|FASIPRIM|SULTRIMIX/.test(
      n,
    )
  ) {
    return 'KAT-02';
  }
  if (
    /ABOCATH|SPUIT|INFUSE|MASKER|HANDSCOEN|KASA|HANSAPLAST|LEUKOPLAST|PLASTER|PLESTER|THERMOMETER|BOTOL DOT|BREAST|KARET DOT|COTTON|KAPAS|CELANA SUNAT|SUTRA|FIESTA|TISSUE|TISU|TESTPACK|OVULATION|UNDERPAD|HYGROMETER|JELI|POT |RING PESARIUM|STICK |STRIP EASY|IUD |SUSU|BEBELOVE|SGM|ANMUM|PRENAGEN|TROPICANA/.test(
      n,
    )
  ) {
    return 'KAT-08';
  }
  if (
    /PARACETAMOL|SANMOL|BODREX|PARAMEX|OSKADON|POLDAN|ASAM MEF|IBUPROFEN|MEFINAL|MEFIX|MEFENTAN|CATAFLAM|DICLOF|MELOXICAM|PIROXICAM|NEURALGIN|ANASTAN|SOLASIC|TRIFASTAN|FARGETIK|MIRASIC|TEMPRA|TERMOREX|BYE BYE FEVER|KOOL FEVER/.test(
      n,
    )
  ) {
    return 'KAT-01';
  }
  if (
    /AMBROX|OBH|OBP|SILADEX|VICKS|HUFAGRIP|SALBUTAMOL|TEOSAL|BRONEX|LASERIN|MUCOS|EPEXOL|LASAL|ANAKONIDIN|KOMIX|DECOLSIN|NEOZEP|PROCOLD|ULTRAFLU|ALPARA|FLUCADEX|FLUANZA|SANA|ACTIFED|ANATON|MIXAGRIP|INTUNAL|STOP COLD|TRISELA|LERZIN|ALERZIN|CETIRIZIN/.test(
      n,
    )
  ) {
    return 'KAT-03';
  }
  if (
    /ANTASIDA|OMEPRA|LANSOPRA|MYLANTA|POLYSILANE|PROMAG|GASTRUCID|HUFAMAG|LAMBUCID|TRIOCID|SUCRALFAT|DIAPET|DIATABS|ENTROSTOP|RAMOLIT|DULCOLAX|LAXANA|LAXADINE|DOMIKADO|NORVOM|VOSEA|ODANOSTIN|LODIA|AKITA|ANTIDIA|SELEDIAR|OMEGDIAR|KANINA|KAOTIN/.test(
      n,
    )
  ) {
    return 'KAT-04';
  }
  if (
    /AMLODIP|CAPTOPRIL|SIMVASTATIN|METFORMIN|GLIMEPIRID|GLIBENCLAM|ALOFAR|PURINIC|CARDIPIN|ASPILET|SELVIM|SELVAS|RENABETIC|GLIKOS|GLUCODEX|NIFEDIPIN|PROPYLTHIO|ZENDALAT|NORELUT|PIL KB|DIANE|CYCLO|MICROGEST|ANDALAN LAKTASI/.test(
      n,
    )
  ) {
    return 'KAT-05';
  }
  if (
    /VIT|BECOM|CAVIPLEX|ENERVON|IMBOOST|CURCUMA|FOLAVIT|FOLAMIL|MADU|SARI KURMA|TOLAK ANGIN|ANTANGIN|SANGOBION|NEUROBION|NEUROSANBE|REDOXON|CDR|HORVITA|ARKAVIT|BIOLYSIN|APIALYS|FITKOM|VIDORAN|SAKATONIK|VEGETA|ADEM SARI|HERBAKOF|SILEX|KEJIBELING/.test(
      n,
    )
  ) {
    return 'KAT-06';
  }
  if (
    /BETADINE|CREAM|SALEP|GEL|BALM|BALSAM|BALSEM|MINYAK|MKP|INSTO|ROHTO|CENDO|ALLETROL|BRAITO|FORUMEN|OTILON|VITAL|CALADINE|HEROCYN|BEDAK|KALPANAX|COUNTERPAIN|HOT IN|SALONPAS|KOYO|FRESHCARE|PLOSSA|RIVANOL|ALKOHOL|BIOPLACENTON|THROMBOGEL|SYNALTEN|BETAMETHASONE|HYDROCORTISONE/.test(
      n,
    ) ||
    unit === 'TUBE' ||
    unit === 'POT'
  ) {
    return 'KAT-07';
  }
  return 'KAT-01';
}

function defaultMinStock(unit: string): number {
  switch (unit.toUpperCase()) {
    case 'TABLET':
      return 50;
    case 'BOTOL':
      return 5;
    case 'TUBE':
    case 'POT':
      return 4;
    case 'BOX':
    case 'PACK':
      return 3;
    default:
      return 10;
  }
}

function addDaysIso(baseDate: Date, days: number): string {
  const d = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

async function runSeed() {
  const existingCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(medicines);

  if ((existingCount[0]?.count ?? 0) > 0) {
    return;
  }

  console.log('Seeding Apotek Andhika Farma database from PDF dataset...');

  // 1. Seed Categories
  const categoryData = [
    { code: 'KAT-01', name: 'Analgesik & Antipiretik', description: 'Obat pereda nyeri, demam, dan antiinflamasi.' },
    { code: 'KAT-02', name: 'Antibiotik & Antiinfeksi', description: 'Obat antibiotik, antijamur, dan antivirus.' },
    { code: 'KAT-03', name: 'Saluran Pernapasan & Flu', description: 'Obat batuk, flu, asma, dan antihistamin.' },
    { code: 'KAT-04', name: 'Saluran Pencernaan', description: 'Obat maag, antasida, diare, mual, dan laksatif.' },
    { code: 'KAT-05', name: 'Kronis, Metabolik & KB', description: 'Obat hipertensi, diabetes, kolesterol, asam urat, dan kontrasepsi.' },
    { code: 'KAT-06', name: 'Vitamin, Suplemen & Herbal', description: 'Multivitamin, suplemen daya tahan tubuh, madu, dan jamu herbal.' },
    { code: 'KAT-07', name: 'Topikal, Mata & Antiseptik', description: 'Salep, krim kulit, tetes mata/telinga, balsam, dan minyak gosok.' },
    { code: 'KAT-08', name: 'Alkes, Ibu & Bayi', description: 'Alat kesehatan habis pakai, perlengkapan bayi, susu, dan lain-lain.' },
  ];

  const insertedCategories = await db
    .insert(categories)
    .values(categoryData)
    .onConflictDoNothing()
    .returning();

  const allCategories =
    insertedCategories.length > 0 ? insertedCategories : await db.select().from(categories);
  const categoryMap = new Map(allCategories.map((c) => [c.code, c.id]));

  // 2. Seed Suppliers (Lead time bervariasi 0-6 hari sesuai parameter K3 TOPSIS)
  const supplierData = [
    {
      name: 'PT Bina San Prima (BSP)',
      address: 'Jl. Kesehatan Raya No. 18, Bandung',
      phone: '022-7201455',
      email: 'order@binasanprima.co.id',
      leadTimeDays: 1,
    },
    {
      name: 'PT Enseval Putera Megatrading',
      address: 'Jl. Pulo Lentut No. 10, Kawasan Industri Pulogadung',
      phone: '021-46822422',
      email: 'distribusi@enseval.com',
      leadTimeDays: 2,
    },
    {
      name: 'PT Kimia Farma Trading & Distribution',
      address: 'Jl. Budi Utomo No. 1, Jakarta Pusat',
      phone: '021-3849251',
      email: 'cs.kftd@kimiafarma.co.id',
      leadTimeDays: 3,
    },
    {
      name: 'PT Anugrah Argon Medica (AAM)',
      address: 'Jl. Boulevard Bintaro Jaya Sektor 7, Tangerang',
      phone: '021-7454222',
      email: 'sales@anugrah-argon.com',
      leadTimeDays: 4,
    },
    {
      name: 'PT Merapi Utama Pharma',
      address: 'Jl. Kaliurang KM 6.5, Sleman, Yogyakarta',
      phone: '0274-882910',
      email: 'pengadaan@merapiutamapharma.co.id',
      leadTimeDays: 6,
    },
    {
      name: 'Distributor Lokal Andhika Express',
      address: 'Jl. Raya Margonda No. 88, Depok',
      phone: '021-7752109',
      email: 'express@andhikamedika.id',
      leadTimeDays: 0,
    },
  ];

  const existingSuppliers = await db.select().from(suppliers);
  const allSuppliers =
    existingSuppliers.length > 0
      ? existingSuppliers
      : await db.insert(suppliers).values(supplierData).returning();

  // 3. Seed TOPSIS Criteria
  await db
    .insert(topsisCriteria)
    .values(
      DEFAULT_TOPSIS_CRITERIA.map((c) => ({
        code: c.code,
        name: c.name,
        originalType: c.originalType,
        calculationType: c.calculationType,
        weight: c.weight,
        description: c.description,
      })),
    )
    .onConflictDoNothing();

  // 4. Parse & Insert all PDF rows (normalizing negative stock -> 0)
  const rawLines = `${PDF_RAW_PART_1}\n${PDF_RAW_PART_2}`
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const now = new Date();
  const seenPlu = new Set<string>();
  const medicineInsertRows: {
    pluCode: string;
    name: string;
    categoryId: number | null;
    supplierId: number | null;
    unit: string;
    purchasePrice: number;
    sellingPrice: number;
    prescriptionPrice: number;
    stock: number;
    minStock: number;
    nearestExpiredDate: string | null;
  }[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const parts = rawLines[i].split('|');
    if (parts.length < 7) continue;

    const pluCode = parts[0].trim();
    if (!pluCode || seenPlu.has(pluCode)) continue;
    seenPlu.add(pluCode);

    const name = parts[1].trim();
    const unit = parts[2].trim() || 'TABLET';
    const rawStock = parseFloat(parts[3]);
    const normalizedStock = Number.isFinite(rawStock) && rawStock > 0 ? rawStock : 0;
    const purchasePrice = parseFloat(parts[4]) || 0;
    const sellingPrice = parseFloat(parts[5]) || 0;
    const prescriptionPrice = parseFloat(parts[6]) || sellingPrice;

    const catCode = classifyCategoryCode(name, unit);
    const categoryId = categoryMap.get(catCode) ?? null;
    const supplier = allSuppliers[i % allSuppliers.length];

    // Beri tanggal kedaluwarsa realistis untuk item berstok
    let nearestExpiredDate: string | null = null;
    if (normalizedStock > 0) {
      const mod = i % 10;
      const daysAhead =
        mod === 0 ? 45 : mod === 1 ? 75 : mod <= 3 ? 150 : mod <= 6 ? 300 : mod <= 8 ? 520 : 810;
      nearestExpiredDate = addDaysIso(now, daysAhead + (i % 25));
    }

    medicineInsertRows.push({
      pluCode,
      name,
      categoryId,
      supplierId: supplier?.id ?? null,
      unit,
      purchasePrice,
      sellingPrice,
      prescriptionPrice,
      stock: normalizedStock,
      minStock: defaultMinStock(unit),
      nearestExpiredDate,
    });
  }

  // Chunk insert medicines (200 per batch)
  const insertedMedicines: (typeof medicines.$inferSelect)[] = [];
  for (let i = 0; i < medicineInsertRows.length; i += 200) {
    const chunk = medicineInsertRows.slice(i, i + 200);
    const res = await db
      .insert(medicines)
      .values(chunk)
      .onConflictDoNothing()
      .returning();
    insertedMedicines.push(...res);
  }

  // 5. Seed initial medicine_batches for stocked medicines
  const batchRows: {
    medicineId: number;
    supplierId: number | null;
    batchNumber: string;
    expiredDate: string;
    initialQty: number;
    remainingQty: number;
    purchasePrice: number;
    receivedAt: Date;
  }[] = [];

  const stockedMeds = insertedMedicines.filter((m) => m.stock > 0);
  for (let i = 0; i < stockedMeds.length; i++) {
    const med = stockedMeds[i];
    const exp1 = med.nearestExpiredDate || addDaysIso(now, 240);
    // Untuk ~45 item awal dengan stok >= 10, buat 2 batch agar prinsip FEFO langsung terlihat
    if (i < 45 && med.stock >= 10) {
      const q1 = Math.floor(med.stock * 0.4);
      const q2 = Number((med.stock - q1).toFixed(2));
      const exp2 = addDaysIso(new Date(exp1), 210);
      batchRows.push({
        medicineId: med.id,
        supplierId: med.supplierId,
        batchNumber: `AF-${med.pluCode.slice(-4)}A`,
        expiredDate: exp1,
        initialQty: q1,
        remainingQty: q1,
        purchasePrice: med.purchasePrice,
        receivedAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      });
      batchRows.push({
        medicineId: med.id,
        supplierId: med.supplierId,
        batchNumber: `AF-${med.pluCode.slice(-4)}B`,
        expiredDate: exp2,
        initialQty: q2,
        remainingQty: q2,
        purchasePrice: med.purchasePrice,
        receivedAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
      });
    } else {
      batchRows.push({
        medicineId: med.id,
        supplierId: med.supplierId,
        batchNumber: `AF-${med.pluCode.slice(-4)}A`,
        expiredDate: exp1,
        initialQty: med.stock,
        remainingQty: med.stock,
        purchasePrice: med.purchasePrice,
        receivedAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      });
    }
  }

  const insertedBatches: (typeof medicineBatches.$inferSelect)[] = [];
  for (let i = 0; i < batchRows.length; i += 250) {
    const chunk = batchRows.slice(i, i + 250);
    const res = await db.insert(medicineBatches).values(chunk).returning();
    insertedBatches.push(...res);
  }

  const batchByMedId = new Map<number, number>();
  for (const b of insertedBatches) {
    if (!batchByMedId.has(b.medicineId)) batchByMedId.set(b.medicineId, b.id);
  }

  // 6. Seed realistic 30-day stock movements for key pharmacy items (so charts & TOPSIS K1 are alive!)
  const movementRows: {
    medicineId: number;
    batchId: number | null;
    userUid: string;
    userName: string;
    movementType: string;
    referenceType: string;
    quantity: number;
    stockBefore: number;
    stockAfter: number;
    unitPrice: number;
    notes: string;
    movementDate: Date;
  }[] = [];

  const priorityKeywords = [
    'PARACETAMOL',
    'AMOXICILLIN',
    'AMLODIPIN',
    'SANMOL',
    'BODREX',
    'ANTASIDA',
    'CETIRIZINE',
    'OMEPRAZOLE',
    'ASAM MEFENAMAT',
    'IBUPROFEN',
    'METFORMIN',
    'SIMVASTATIN',
    'CAPTOPRIL',
    'CEFADROXYL',
    'CEFIXIME',
    'OBH',
    'BETADINE',
    'VITAMIN C',
    'TOLAK ANGIN',
    'ANTANGIN',
    'DEXAHARSEN',
    'GRANTUSIF',
    'LERZIN',
    'SALBUTAMOL',
    'PROMAG',
    'MYLANTA',
    'DIAPET',
    'HUFAGRIP',
    'SILADEX',
    'FLOXIFAR',
  ];

  const featuredMeds = insertedMedicines.filter((m) =>
    priorityKeywords.some((kw) => m.name.toUpperCase().includes(kw)),
  );
  const sampleMeds = featuredMeds.slice(0, 60);

  for (let idx = 0; idx < sampleMeds.length; idx++) {
    const med = sampleMeds[idx];
    const batchId = batchByMedId.get(med.id) ?? null;

    // Transaksi stok masuk dalam 30 hari terakhir
    const daysAgoIn = (idx % 25) + 4;
    const qtyIn = med.unit === 'TABLET' ? 120 + (idx % 5) * 60 : 10 + (idx % 6) * 5;
    movementRows.push({
      medicineId: med.id,
      batchId,
      userUid: 'system-seed',
      userName: 'Sistem Awal Apotek',
      movementType: 'in',
      referenceType: 'pembelian',
      quantity: qtyIn,
      stockBefore: Math.max(0, med.stock - qtyIn),
      stockAfter: med.stock,
      unitPrice: med.purchasePrice > 0 ? med.purchasePrice : Math.round(med.sellingPrice * 0.78),
      notes: 'Penerimaan faktur PBF rutin',
      movementDate: new Date(now.getTime() - daysAgoIn * 24 * 60 * 60 * 1000),
    });

    // 2 transaksi penjualan dalam 30 hari terakhir (bervariasi untuk skor K1 1-5)
    const salesTier = idx % 5;
    const totalSales =
      salesTier === 0
        ? 560
        : salesTier === 1
          ? 380
          : salesTier === 2
            ? 210
            : salesTier === 3
              ? 95
              : 32;
    const partA = Math.round(totalSales * 0.55);
    const partB = totalSales - partA;

    movementRows.push({
      medicineId: med.id,
      batchId,
      userUid: 'system-seed',
      userName: 'Apoteker Jaga',
      movementType: 'out',
      referenceType: 'penjualan',
      quantity: partA,
      stockBefore: med.stock + partA,
      stockAfter: med.stock,
      unitPrice: med.sellingPrice,
      notes: 'Penjualan resep & non-resep periode berjalan',
      movementDate: new Date(now.getTime() - ((idx % 14) + 1) * 24 * 60 * 60 * 1000),
    });

    movementRows.push({
      medicineId: med.id,
      batchId,
      userUid: 'system-seed',
      userName: 'Apoteker Jaga',
      movementType: 'out',
      referenceType: 'penjualan',
      quantity: partB,
      stockBefore: med.stock + totalSales,
      stockAfter: med.stock + partA,
      unitPrice: med.sellingPrice,
      notes: 'Penjualan harian kasir apotek',
      movementDate: new Date(now.getTime() - ((idx % 20) + 2) * 24 * 60 * 60 * 1000),
    });
  }

  for (let i = 0; i < movementRows.length; i += 200) {
    await db.insert(stockMovements).values(movementRows.slice(i, i + 200));
  }

  // 7. Seed initial notifications (max 35 most urgent alerts)
  const alertRows: { medicineId: number; type: string; title: string; message: string }[] = [];
  const threshold90 = addDaysIso(now, 90);

  for (const med of insertedMedicines) {
    if (alertRows.length >= 35) break;
    if (med.stock <= 0) {
      alertRows.push({
        medicineId: med.id,
        type: 'out_of_stock',
        title: `Stok Habis: ${med.name}`,
        message: `Obat ${med.name} (PLU ${med.pluCode}) stok 0 ${med.unit}. Perlu pengadaan segera.`,
      });
    } else if (med.stock <= med.minStock) {
      alertRows.push({
        medicineId: med.id,
        type: 'low_stock',
        title: `Stok Menipis: ${med.name}`,
        message: `Sisa stok ${med.stock} ${med.unit} (batas minimum ${med.minStock} ${med.unit}).`,
      });
    } else if (med.nearestExpiredDate && med.nearestExpiredDate <= threshold90) {
      alertRows.push({
        medicineId: med.id,
        type: 'near_expiry',
        title: `Mendekati Kedaluwarsa: ${med.name}`,
        message: `Batch terdekat akan kedaluwarsa pada ${med.nearestExpiredDate}. Terapkan prioritas FEFO.`,
      });
    }
  }

  if (alertRows.length > 0) {
    await db.insert(notifications).values(alertRows);
  }

  // 8. Seed 1 initial TOPSIS historical run for 20 featured critical medicines
  const supplierMap = new Map(allSuppliers.map((s) => [s.id, s]));
  const salesByMed = new Map<number, number>();
  for (const mv of movementRows) {
    if (mv.movementType === 'out') {
      salesByMed.set(mv.medicineId, (salesByMed.get(mv.medicineId) || 0) + mv.quantity);
    }
  }

  const topsisCandidates = sampleMeds.slice(0, 20).map((med) => {
    const sup = med.supplierId ? supplierMap.get(med.supplierId) : undefined;
    const expMonths = med.nearestExpiredDate
      ? Math.max(
          1,
          Math.round(
            (new Date(med.nearestExpiredDate).getTime() - now.getTime()) /
              (30 * 24 * 60 * 60 * 1000),
          ),
        )
      : 12;
    const effectivePrice =
      med.purchasePrice > 0 ? med.purchasePrice : Math.round(med.sellingPrice * 0.78);

    return {
      medicineId: med.id,
      medicinePlu: med.pluCode,
      medicineName: med.name,
      unit: med.unit,
      rawSales: salesByMed.get(med.id) || 0,
      rawStock: med.stock,
      rawLeadTime: sup?.leadTimeDays ?? 2,
      rawExpiryMonths: expMonths,
      rawPurchasePrice: effectivePrice,
    };
  });

  if (topsisCandidates.length > 0) {
    const calc = calculateTopsis(topsisCandidates, DEFAULT_TOPSIS_CRITERIA);
    const periodStart = addDaysIso(now, -30);
    const periodEnd = now.toISOString().slice(0, 10);

    const [run] = await db
      .insert(topsisRuns)
      .values({
        title: 'Analisis Prioritas Pengadaan Awal (30 Hari Terakhir)',
        periodStart,
        periodEnd,
        createdByUid: 'system-seed',
        createdByName: 'Sistem Apotek Andhika Farma',
        weightsSnapshot: Object.fromEntries(calc.criteria.map((c) => [c.code, c.weight])),
        idealPositive: calc.idealPositive,
        idealNegative: calc.idealNegative,
        totalAlternatives: calc.results.length,
        notes: 'Perhitungan awal otomatis berdasarkan data stok PDF, batch FEFO, dan transaksi penjualan 30 hari.',
      })
      .returning();

    await db.insert(topsisResults).values(
      calc.results.map((r) => ({
        runId: run.id,
        medicineId: r.medicineId,
        medicinePlu: r.medicinePlu,
        medicineName: r.medicineName,
        unit: r.unit,
        rawSales: r.rawSales,
        rawStock: r.rawStock,
        rawLeadTime: r.rawLeadTime,
        rawExpiryMonths: r.rawExpiryMonths,
        rawPurchasePrice: r.rawPurchasePrice,
        scoreK1: r.scoreK1,
        scoreK2: r.scoreK2,
        scoreK3: r.scoreK3,
        scoreK4: r.scoreK4,
        scoreK5: r.scoreK5,
        normK1: r.normK1,
        normK2: r.normK2,
        normK3: r.normK3,
        normK4: r.normK4,
        normK5: r.normK5,
        weightedK1: r.weightedK1,
        weightedK2: r.weightedK2,
        weightedK3: r.weightedK3,
        weightedK4: r.weightedK4,
        weightedK5: r.weightedK5,
        distancePositive: r.distancePositive,
        distanceNegative: r.distanceNegative,
        preferenceValue: r.preferenceValue,
        rank: r.rank,
        priorityLabel: r.priorityLabel,
      })),
    );
  }

  console.log(`Seeded ${insertedMedicines.length} medicines from PDF successfully.`);
}

export async function ensureDatabaseSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}
