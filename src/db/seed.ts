import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  auditLogs,
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
import {
  NOV_2026_DAILY_MOVEMENTS_RAW,
  NOV_2026_LATEST_STATE_RAW,
  NOV_2026_NEW_MEDICINES_RAW,
  NOV_2026_SYNC_ACTION,
} from './november-stock-data.ts';
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
    /AMBROX|OBH|OBP|SILADEX|VICKS|HUFAGRIP|SALBUTAMOL|TEOSAL|BRONEX|LASERIN|MUCOS|EPEXOL|LASAL|ANAKONIDIN|KOMIX|DECOLSIN|NEOZEP|PROCOLD|ULTRAFLU|ALPARA|FLUCADEX|FLUANZA|SANA|ACTIFED|ANATON|MIXAGRIP|INTUNAL|STOP COLD|TRISELA|LERZIN|ALERZIN|CETIRIZIN|ZEVAKS/.test(
      n,
    )
  ) {
    return 'KAT-03';
  }
  if (
    /ANTASIDA|OMEPRA|LANSOPRA|MYLANTA|POLYSILANE|PROMAG|GASTRUCID|HUFAMAG|LAMBUCID|TRIOCID|SUCRALFAT|DIAPET|DIATABS|ENTROSTOP|RAMOLIT|DULCOLAX|LAXANA|LAXADINE|DOMIKADO|NORVOM|VOSEA|ODANOSTIN|LODIA|AKITA|ANTIDIA|SELEDIAR|OMEGDIAR|KANINA|KAOTIN|SCOPMA/.test(
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
    /VIT|BECOM|CAVIPLEX|ENERVON|IMBOOST|CURCUMA|FOLAVIT|FOLAMIL|MADU|SARI KURMA|TOLAK ANGIN|ANTANGIN|SANGOBION|NEUROBION|NEUROSANBE|REDOXON|CDR|HORVITA|ARKAVIT|BIOLYSIN|APIALYS|FITKOM|VIDORAN|SAKATONIK|VEGETA|ADEM SARI|HERBAKOF|SILEX|KEJIBELING|CEREBROFORT/.test(
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

interface ParsedDailyMovement {
  dateStr: string;
  pluCode: string;
  movementType: 'in' | 'out';
  referenceType: string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  notes: string;
}

function parseDailyMovementsRaw(): ParsedDailyMovement[] {
  return NOV_2026_DAILY_MOVEMENTS_RAW.split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [dateStr, pluCode, movementType, referenceType, qtyStr, beforeStr, afterStr, notes] =
        line.split('|');
      return {
        dateStr,
        pluCode,
        movementType: movementType === 'in' ? 'in' : 'out',
        referenceType,
        quantity: parseFloat(qtyStr),
        stockBefore: parseFloat(beforeStr),
        stockAfter: parseFloat(afterStr),
        notes: notes || 'Penyesuaian Laporan Stok Harian',
      };
    });
}

function parseLatestStateRaw(): Map<string, { stock: number; purchasePrice: number }> {
  const map = new Map<string, { stock: number; purchasePrice: number }>();
  for (const line of NOV_2026_LATEST_STATE_RAW.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const [plu, stockStr, priceStr] = t.split('|');
    map.set(plu, {
      stock: parseFloat(stockStr) || 0,
      purchasePrice: parseFloat(priceStr) || 0,
    });
  }
  return map;
}

function buildTopsisFromData(
  medList: {
    id: number;
    pluCode: string;
    name: string;
    unit: string;
    stock: number;
    minStock: number;
    purchasePrice: number;
    sellingPrice: number;
    nearestExpiredDate: string | null;
    supplierId: number | null;
  }[],
  supplierLeadTimeMap: Map<number, number>,
  salesByMedId: Map<number, number>,
  refDate: Date,
) {
  // Prioritize medicines with highest real turnover + low/zero stock for procurement DSS
  const ranked = [...medList]
    .filter((m) => (salesByMedId.get(m.id) || 0) > 0 || m.stock <= m.minStock)
    .sort((a, b) => {
      const sa = salesByMedId.get(a.id) || 0;
      const sb = salesByMedId.get(b.id) || 0;
      return sb - sa || a.stock - b.stock;
    })
    .slice(0, 25);

  const candidates = ranked.map((med) => {
    const expMonths = med.nearestExpiredDate
      ? Math.max(
          1,
          Math.round(
            (new Date(med.nearestExpiredDate).getTime() - refDate.getTime()) /
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
      rawSales: Number((salesByMedId.get(med.id) || 0).toFixed(2)),
      rawStock: med.stock,
      rawLeadTime: (med.supplierId ? supplierLeadTimeMap.get(med.supplierId) : undefined) ?? 2,
      rawExpiryMonths: expMonths,
      rawPurchasePrice: effectivePrice,
    };
  });

  if (candidates.length < 2) return null;
  return calculateTopsis(candidates, DEFAULT_TOPSIS_CRITERIA);
}

const PRIORITY_KEYWORDS = [
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

function buildCombinedSeedMovements(
  medList: {
    id: number;
    pluCode: string;
    name: string;
    unit: string;
    stock: number;
    purchasePrice: number;
    sellingPrice: number;
  }[],
  batchByMedId: Map<number, number>,
) {
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
  const salesByMed = new Map<number, number>();

  // 1. Historical movements before 20 Nov 2026 (26 Oct - 19 Nov 2026) so pre-20 chart & 30-day history stay intact
  const pre20Anchor = new Date('2026-11-20T10:00:00.000Z');
  const sampleMeds = medList
    .filter((m) => PRIORITY_KEYWORDS.some((kw) => m.name.toUpperCase().includes(kw)))
    .slice(0, 60);

  for (let idx = 0; idx < sampleMeds.length; idx++) {
    const med = sampleMeds[idx];
    const batchId = batchByMedId.get(med.id) ?? null;

    const daysAgoIn = (idx % 25) + 1; // 26 Oct .. 19 Nov 2026
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
      notes: 'Penerimaan faktur PBF rutin (periode pra-20 Nov)',
      movementDate: new Date(pre20Anchor.getTime() - daysAgoIn * 24 * 60 * 60 * 1000),
    });

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

    salesByMed.set(med.id, (salesByMed.get(med.id) || 0) + totalSales);

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
      movementDate: new Date(pre20Anchor.getTime() - ((idx % 10) + 1) * 24 * 60 * 60 * 1000),
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
      movementDate: new Date(pre20Anchor.getTime() - ((idx % 16) + 2) * 24 * 60 * 60 * 1000),
    });
  }

  // 2. Daily movements parsed from PDF reports 20, 21, 22, 23 November 2026
  const medByPlu = new Map(medList.map((m) => [m.pluCode, m]));
  const parsedMovements = parseDailyMovementsRaw();

  for (let i = 0; i < parsedMovements.length; i++) {
    const mv = parsedMovements[i];
    const med = medByPlu.get(mv.pluCode);
    if (!med) continue;

    // On 20 Nov baseline snapshot, bulk multi-week opname gaps (>100 units) are recorded as
    // stock-opname 'adjustment' so the daily chart bars remain scaled cleanly alongside 21-23 Nov.
    const isBulkBaselineOpname = mv.dateStr === '2026-11-20' && mv.quantity > 100;
    const movementType = isBulkBaselineOpname ? 'adjustment' : mv.movementType;
    const referenceType = isBulkBaselineOpname ? 'penyesuaian' : mv.referenceType;
    const notes = isBulkBaselineOpname
      ? `Penyesuaian stok opname kumulatif s.d. Laporan Stok 20 Nov 2026 (${mv.movementType === 'in' ? '+' : '-'}${mv.quantity})`
      : mv.notes;

    const unitPrice =
      mv.movementType === 'in'
        ? med.purchasePrice > 0
          ? med.purchasePrice
          : Math.round(med.sellingPrice * 0.78)
        : med.sellingPrice > 0
          ? med.sellingPrice
          : med.purchasePrice;

    if (movementType === 'out') {
      salesByMed.set(med.id, (salesByMed.get(med.id) || 0) + mv.quantity);
    }

    const baseTs = new Date(`${mv.dateStr}T10:00:00.000Z`).getTime();
    movementRows.push({
      medicineId: med.id,
      batchId: batchByMedId.get(med.id) ?? null,
      userUid: 'system-seed',
      userName: 'Laporan Stok Harian',
      movementType,
      referenceType,
      quantity: mv.quantity,
      stockBefore: mv.stockBefore,
      stockAfter: mv.stockAfter,
      unitPrice,
      notes,
      movementDate: new Date(baseTs + (i % 1800) * 1000),
    });
  }

  return { movementRows, salesByMed };
}

async function syncNovemberStockSnapshots(): Promise<void> {
  const alreadySynced = await db
    .select({ id: auditLogs.id })
    .from(auditLogs)
    .where(eq(auditLogs.action, NOV_2026_SYNC_ACTION))
    .limit(1);

  if (alreadySynced.length > 0) {
    return;
  }

  console.log('Menjalankan sinkronisasi Laporan Stok 20-23 November 2026...');

  const refDate = new Date('2026-11-23T10:00:00.000Z');
  const allCategories = await db.select().from(categories);
  const categoryMap = new Map(allCategories.map((c) => [c.code, c.id]));
  const allSuppliers = await db.select().from(suppliers).orderBy(asc(suppliers.id));
  const supplierLeadTimeMap = new Map(allSuppliers.map((s) => [s.id, s.leadTimeDays]));

  // 1. Insert 4 new PLUs if they don't exist yet
  const newItemLines = NOV_2026_NEW_MEDICINES_RAW.split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const newInsertRows = newItemLines.map((line, idx) => {
    const [pluCode, name, unit, stockStr, purchaseStr, sellingStr, rxStr] = line.split('|');
    const stock = parseFloat(stockStr) || 0;
    const purchasePrice = parseFloat(purchaseStr) || 0;
    const sellingPrice = parseFloat(sellingStr) || 0;
    const prescriptionPrice = parseFloat(rxStr) || sellingPrice;
    const catCode = classifyCategoryCode(name, unit);
    const supplier = allSuppliers[idx % Math.max(1, allSuppliers.length)];
    return {
      pluCode,
      name,
      categoryId: categoryMap.get(catCode) ?? null,
      supplierId: supplier?.id ?? null,
      unit,
      purchasePrice,
      sellingPrice,
      prescriptionPrice,
      stock,
      minStock: defaultMinStock(unit),
      nearestExpiredDate: stock > 0 ? addDaysIso(refDate, 360 + idx * 30) : null,
    };
  });

  if (newInsertRows.length > 0) {
    await db.insert(medicines).values(newInsertRows).onConflictDoNothing();
  }

  // 2. Load current medicines & batches
  const currentMeds = await db.select().from(medicines).orderBy(asc(medicines.id));
  const currentBatches = await db
    .select()
    .from(medicineBatches)
    .orderBy(asc(medicineBatches.expiredDate), asc(medicineBatches.id));

  const batchesByMedId = new Map<number, (typeof currentBatches)[number][]>();
  for (const b of currentBatches) {
    const list = batchesByMedId.get(b.medicineId) || [];
    list.push(b);
    batchesByMedId.set(b.medicineId, list);
  }

  const latestStateMap = parseLatestStateRaw();

  await db.transaction(async (tx) => {
    const medUpdates: {
      id: number;
      stock: number;
      purchasePrice: number;
      nearestExpiredDate: string | null;
    }[] = [];

    const zeroBatchMedIds: number[] = [];
    const batchQtyUpdates: { id: number; remainingQty: number; initialQty?: number; purchasePrice?: number }[] = [];
    const newBatchesToInsert: {
      medicineId: number;
      supplierId: number | null;
      batchNumber: string;
      expiredDate: string;
      initialQty: number;
      remainingQty: number;
      purchasePrice: number;
      receivedAt: Date;
    }[] = [];

    for (let idx = 0; idx < currentMeds.length; idx++) {
      const med = currentMeds[idx];
      const target = latestStateMap.get(med.pluCode);
      if (!target) continue;

      const targetStock = target.stock;
      const targetPrice = target.purchasePrice > 0 ? target.purchasePrice : med.purchasePrice;
      const medBatches = batchesByMedId.get(med.id) || [];

      let nextNearestExp: string | null = med.nearestExpiredDate;

      if (targetStock <= 0) {
        nextNearestExp = null;
        if (medBatches.some((b) => b.remainingQty > 0)) {
          zeroBatchMedIds.push(med.id);
        }
      } else {
        const currentBatchSum = Number(
          medBatches.reduce((sum, b) => sum + b.remainingQty, 0).toFixed(2),
        );

        if (medBatches.length === 0) {
          const expDate = med.nearestExpiredDate || addDaysIso(refDate, 240 + (idx % 180));
          nextNearestExp = expDate;
          newBatchesToInsert.push({
            medicineId: med.id,
            supplierId: med.supplierId,
            batchNumber: `AF-${med.pluCode.slice(-4)}A`,
            expiredDate: expDate,
            initialQty: targetStock,
            remainingQty: targetStock,
            purchasePrice: targetPrice,
            receivedAt: new Date('2026-11-20T10:00:00.000Z'),
          });
        } else if (Math.abs(currentBatchSum - targetStock) > 1e-4) {
          if (targetStock > currentBatchSum) {
            const diff = Number((targetStock - currentBatchSum).toFixed(2));
            // Add diff to latest batch (or last batch) so earlier expiry stays intact
            const targetBatch = medBatches[medBatches.length - 1];
            const nextRem = Number((targetBatch.remainingQty + diff).toFixed(2));
            batchQtyUpdates.push({
              id: targetBatch.id,
              remainingQty: nextRem,
              initialQty: Math.max(targetBatch.initialQty, nextRem),
              purchasePrice: targetPrice > 0 ? targetPrice : targetBatch.purchasePrice,
            });
            targetBatch.remainingQty = nextRem;
          } else {
            // Deduct FEFO order across batches
            let toDeduct = Number((currentBatchSum - targetStock).toFixed(2));
            for (const b of medBatches) {
              if (toDeduct <= 0) break;
              if (b.remainingQty <= 0) continue;
              const take = Math.min(b.remainingQty, toDeduct);
              const nextRem = Number((b.remainingQty - take).toFixed(2));
              batchQtyUpdates.push({
                id: b.id,
                remainingQty: nextRem,
                purchasePrice: targetPrice > 0 ? targetPrice : b.purchasePrice,
              });
              b.remainingQty = nextRem;
              toDeduct = Number((toDeduct - take).toFixed(2));
            }
          }
          const active = medBatches.find((b) => b.remainingQty > 0);
          nextNearestExp = active ? active.expiredDate : null;
        } else {
          const active = medBatches.find((b) => b.remainingQty > 0);
          nextNearestExp = active ? active.expiredDate : med.nearestExpiredDate;
        }
      }

      if (
        Math.abs(med.stock - targetStock) > 1e-4 ||
        Math.abs(med.purchasePrice - targetPrice) > 0.005 ||
        med.nearestExpiredDate !== nextNearestExp
      ) {
        medUpdates.push({
          id: med.id,
          stock: targetStock,
          purchasePrice: targetPrice,
          nearestExpiredDate: nextNearestExp,
        });
        med.stock = targetStock;
        med.purchasePrice = targetPrice;
        med.nearestExpiredDate = nextNearestExp;
      }
    }

    // Batch update medicines via VALUES table (single fast round-trip per chunk)
    for (let i = 0; i < medUpdates.length; i += 250) {
      const chunk = medUpdates.slice(i, i + 250);
      const valuesSql = sql.join(
        chunk.map(
          (u) =>
            sql`(${u.id}::int, ${u.stock}::double precision, ${u.purchasePrice}::double precision, ${u.nearestExpiredDate}::date)`,
        ),
        sql`, `,
      );
      await tx.execute(sql`
        UPDATE medicines AS m
        SET stock = v.stock,
            purchase_price = v.purchase_price,
            nearest_expired_date = v.nearest_expired_date,
            updated_at = NOW()
        FROM (VALUES ${valuesSql}) AS v(id, stock, purchase_price, nearest_expired_date)
        WHERE m.id = v.id
      `);
    }

    if (zeroBatchMedIds.length > 0) {
      for (let i = 0; i < zeroBatchMedIds.length; i += 250) {
        await tx
          .update(medicineBatches)
          .set({ remainingQty: 0 })
          .where(inArray(medicineBatches.medicineId, zeroBatchMedIds.slice(i, i + 250)));
      }
    }

    for (let i = 0; i < batchQtyUpdates.length; i += 250) {
      const chunk = batchQtyUpdates.slice(i, i + 250);
      const valuesSql = sql.join(
        chunk.map(
          (b) =>
            sql`(${b.id}::int, ${b.remainingQty}::double precision, ${b.initialQty ?? null}::double precision, ${b.purchasePrice ?? null}::double precision)`,
        ),
        sql`, `,
      );
      await tx.execute(sql`
        UPDATE medicine_batches AS mb
        SET remaining_qty = v.remaining_qty,
            initial_qty = COALESCE(v.initial_qty, mb.initial_qty),
            purchase_price = COALESCE(v.purchase_price, mb.purchase_price)
        FROM (VALUES ${valuesSql}) AS v(id, remaining_qty, initial_qty, purchase_price)
        WHERE mb.id = v.id
      `);
    }

    if (newBatchesToInsert.length > 0) {
      for (let i = 0; i < newBatchesToInsert.length; i += 200) {
        await tx.insert(medicineBatches).values(newBatchesToInsert.slice(i, i + 200));
      }
    }

    // Refresh primary batch map after batch adjustments
    const finalBatches = await tx
      .select({ id: medicineBatches.id, medicineId: medicineBatches.medicineId })
      .from(medicineBatches)
      .orderBy(asc(medicineBatches.expiredDate), asc(medicineBatches.id));
    const batchByMedId = new Map<number, number>();
    for (const b of finalBatches) {
      if (!batchByMedId.has(b.medicineId)) batchByMedId.set(b.medicineId, b.id);
    }

    // Replace synthetic system-seed movements with pre-20 Nov history + 20-23 Nov 2026 PDF movements
    await tx.delete(stockMovements).where(eq(stockMovements.userUid, 'system-seed'));

    const { movementRows: mvInsertRows, salesByMed: salesByMedId } = buildCombinedSeedMovements(
      currentMeds,
      batchByMedId,
    );

    for (let i = 0; i < mvInsertRows.length; i += 200) {
      await tx.insert(stockMovements).values(mvInsertRows.slice(i, i + 200));
    }

    // Refresh unread notifications based on updated Nov 23 stock
    await tx.delete(notifications).where(eq(notifications.isRead, false));
    const threshold90 = addDaysIso(refDate, 90);
    const alertRows: { medicineId: number; type: string; title: string; message: string }[] = [];
    for (const med of currentMeds) {
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
      await tx.insert(notifications).values(alertRows);
    }

    // Update initial system-seed TOPSIS run if no user-created runs exist
    const existingRuns = await tx.select().from(topsisRuns);
    const onlySystemSeedRun =
      existingRuns.length === 0 || existingRuns.every((r) => r.createdByUid === 'system-seed');

    if (onlySystemSeedRun) {
      await tx.delete(topsisRuns).where(eq(topsisRuns.createdByUid, 'system-seed'));
      const calc = buildTopsisFromData(currentMeds, supplierLeadTimeMap, salesByMedId, refDate);
      if (calc) {
        const [run] = await tx
          .insert(topsisRuns)
          .values({
            title: 'Analisis Prioritas Pengadaan (Periode s.d. 23 Nov 2026)',
            periodStart: '2026-10-26',
            periodEnd: '2026-11-23',
            createdByUid: 'system-seed',
            createdByName: 'Sistem Apotek Andhika Farma',
            weightsSnapshot: Object.fromEntries(calc.criteria.map((c) => [c.code, c.weight])),
            idealPositive: calc.idealPositive,
            idealNegative: calc.idealNegative,
            totalAlternatives: calc.results.length,
            notes: 'Perhitungan otomatis berdasarkan histori transaksi pra-20 Nov dan Laporan Stok 20, 21, 22, dan 23 November 2026.',
          })
          .returning();

        await tx.insert(topsisResults).values(
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
    }

    // Record idempotent completion marker
    await tx.insert(auditLogs).values({
      userUid: 'system-sync',
      userEmail: 'system@apotekandhikafarma.id',
      userRole: 'admin',
      action: NOV_2026_SYNC_ACTION,
      entityType: 'system',
      entityId: '2026-11-23',
      details: {
        updatedMedicines: medUpdates.length,
        insertedMovements: mvInsertRows.length,
        dates: ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23'],
        latestTotalStock: 172249.5,
      },
    });
  });

  console.log('Sinkronisasi Laporan Stok 20-23 November 2026 selesai.');
}

async function runSeed() {
  const existingCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(medicines);

  if ((existingCount[0]?.count ?? 0) > 0) {
    await syncNovemberStockSnapshots();
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
  const supplierLeadTimeMap = new Map(allSuppliers.map((s) => [s.id, s.leadTimeDays]));

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

  // 4. Parse & Insert all PDF rows (already reconciled up to 23 November 2026)
  const rawLines = `${PDF_RAW_PART_1}\n${PDF_RAW_PART_2}`
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const now = new Date('2026-11-23T10:00:00.000Z');
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

  // 6. Seed combined pre-20 Nov history + daily stock movements from 20, 21, 22, 23 November 2026 PDFs
  const { movementRows, salesByMed } = buildCombinedSeedMovements(insertedMedicines, batchByMedId);

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

  // 8. Seed initial TOPSIS run from combined sales & Nov 23 stock
  const calc = buildTopsisFromData(insertedMedicines, supplierLeadTimeMap, salesByMed, now);
  if (calc) {
    const [run] = await db
      .insert(topsisRuns)
      .values({
        title: 'Analisis Prioritas Pengadaan (Periode s.d. 23 Nov 2026)',
        periodStart: '2026-10-26',
        periodEnd: '2026-11-23',
        createdByUid: 'system-seed',
        createdByName: 'Sistem Apotek Andhika Farma',
        weightsSnapshot: Object.fromEntries(calc.criteria.map((c) => [c.code, c.weight])),
        idealPositive: calc.idealPositive,
        idealNegative: calc.idealNegative,
        totalAlternatives: calc.results.length,
        notes: 'Perhitungan otomatis berdasarkan histori transaksi pra-20 Nov dan Laporan Stok 20, 21, 22, dan 23 November 2026.',
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

  // Record sync marker so syncNovemberStockSnapshots skips immediately on fresh seeds
  await db.insert(auditLogs).values({
    userUid: 'system-sync',
    userEmail: 'system@apotekandhikafarma.id',
    userRole: 'admin',
    action: NOV_2026_SYNC_ACTION,
    entityType: 'system',
    entityId: '2026-11-23',
    details: {
      seededMedicines: insertedMedicines.length,
      insertedMovements: movementRows.length,
      dates: ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23'],
      latestTotalStock: 172249.5,
    },
  });

  console.log(`Seeded ${insertedMedicines.length} medicines and ${movementRows.length} daily movements successfully.`);
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
