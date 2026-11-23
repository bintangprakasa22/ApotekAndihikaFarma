import { asc, eq, gt, and } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { medicineBatches, medicines, stockMovements } from '../db/schema.ts';
import { recordAuditLog, syncMedicineNotifications } from './alerts.ts';

export interface StockInPayload {
  medicineId: number;
  supplierId?: number | null;
  batchNumber: string;
  expiredDate: string;
  quantity: number;
  purchasePrice: number;
  notes?: string;
  userUid: string;
  userEmail: string;
  userName: string;
  userRole: string;
}

export interface StockOutPayload {
  medicineId: number;
  quantity: number;
  referenceType?: 'penjualan' | 'penyesuaian';
  notes?: string;
  userUid: string;
  userEmail: string;
  userName: string;
  userRole: string;
}

async function recalculateNearestExpiry(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], medicineId: number) {
  const activeBatches = await tx
    .select()
    .from(medicineBatches)
    .where(and(eq(medicineBatches.medicineId, medicineId), gt(medicineBatches.remainingQty, 0)))
    .orderBy(asc(medicineBatches.expiredDate));

  return activeBatches.length > 0 ? activeBatches[0].expiredDate : null;
}

export async function processStockIn(payload: StockInPayload) {
  if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) {
    throw new Error('Jumlah stok masuk harus lebih dari 0.');
  }
  if (!payload.batchNumber.trim()) {
    throw new Error('Nomor batch wajib diisi.');
  }
  if (!payload.expiredDate) {
    throw new Error('Tanggal kedaluwarsa batch wajib diisi.');
  }

  const result = await db.transaction(async (tx) => {
    const medRows = await tx
      .select()
      .from(medicines)
      .where(eq(medicines.id, payload.medicineId))
      .limit(1);

    if (medRows.length === 0) {
      throw new Error('Data obat tidak ditemukan.');
    }

    const med = medRows[0];
    const stockBefore = med.stock;
    const stockAfter = Number((stockBefore + payload.quantity).toFixed(2));
    const unitPrice = payload.purchasePrice > 0 ? payload.purchasePrice : med.purchasePrice;

    const [createdBatch] = await tx
      .insert(medicineBatches)
      .values({
        medicineId: med.id,
        supplierId: payload.supplierId ?? med.supplierId ?? null,
        batchNumber: payload.batchNumber.trim().toUpperCase(),
        expiredDate: payload.expiredDate,
        initialQty: payload.quantity,
        remainingQty: payload.quantity,
        purchasePrice: unitPrice,
      })
      .returning();

    const [movement] = await tx
      .insert(stockMovements)
      .values({
        medicineId: med.id,
        batchId: createdBatch.id,
        userUid: payload.userUid,
        userName: payload.userName,
        movementType: 'in',
        referenceType: 'pembelian',
        quantity: payload.quantity,
        stockBefore,
        stockAfter,
        unitPrice,
        notes: payload.notes?.trim() || `Stok masuk batch ${createdBatch.batchNumber}`,
      })
      .returning();

    const nearestExpiredDate = await recalculateNearestExpiry(tx, med.id);

    const [updatedMedicine] = await tx
      .update(medicines)
      .set({
        stock: stockAfter,
        purchasePrice: unitPrice > 0 ? unitPrice : med.purchasePrice,
        supplierId: payload.supplierId ?? med.supplierId,
        nearestExpiredDate,
        updatedAt: new Date(),
      })
      .where(eq(medicines.id, med.id))
      .returning();

    return { medicine: updatedMedicine, batch: createdBatch, movement };
  });

  await syncMedicineNotifications(payload.medicineId);
  await recordAuditLog({
    userUid: payload.userUid,
    userEmail: payload.userEmail,
    userRole: payload.userRole,
    action: 'STOCK_IN',
    entityType: 'medicine',
    entityId: payload.medicineId,
    details: {
      pluCode: result.medicine.pluCode,
      medicineName: result.medicine.name,
      batchNumber: result.batch.batchNumber,
      expiredDate: result.batch.expiredDate,
      quantity: payload.quantity,
      stockAfter: result.medicine.stock,
    },
  });

  return result;
}

export async function processStockOut(payload: StockOutPayload) {
  if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) {
    throw new Error('Jumlah stok keluar harus lebih dari 0.');
  }

  const result = await db.transaction(async (tx) => {
    const medRows = await tx
      .select()
      .from(medicines)
      .where(eq(medicines.id, payload.medicineId))
      .limit(1);

    if (medRows.length === 0) {
      throw new Error('Data obat tidak ditemukan.');
    }

    const med = medRows[0];
    if (med.stock < payload.quantity) {
      throw new Error(
        `Stok tidak mencukupi. Tersedia ${med.stock} ${med.unit}, diminta ${payload.quantity} ${med.unit}. Stok tidak boleh menjadi negatif.`,
      );
    }

    // FEFO: First Expired, First Out — urutkan batch aktif berdasarkan expired_date ASC
    const activeBatches = await tx
      .select()
      .from(medicineBatches)
      .where(and(eq(medicineBatches.medicineId, med.id), gt(medicineBatches.remainingQty, 0)))
      .orderBy(asc(medicineBatches.expiredDate), asc(medicineBatches.id));

    let remainingToDeduct = payload.quantity;
    let runningStock = med.stock;
    const allocations: { batchId: number | null; batchNumber: string; expiredDate: string; deductedQty: number }[] = [];
    const createdMovements = [];

    for (const batch of activeBatches) {
      if (remainingToDeduct <= 0) break;
      const deduct = Math.min(batch.remainingQty, remainingToDeduct);
      const newRemaining = Number((batch.remainingQty - deduct).toFixed(2));
      const nextStock = Number((runningStock - deduct).toFixed(2));

      await tx
        .update(medicineBatches)
        .set({ remainingQty: newRemaining })
        .where(eq(medicineBatches.id, batch.id));

      const [mv] = await tx
        .insert(stockMovements)
        .values({
          medicineId: med.id,
          batchId: batch.id,
          userUid: payload.userUid,
          userName: payload.userName,
          movementType: 'out',
          referenceType: payload.referenceType || 'penjualan',
          quantity: deduct,
          stockBefore: runningStock,
          stockAfter: nextStock,
          unitPrice: med.sellingPrice,
          notes:
            payload.notes?.trim() ||
            `Pengeluaran FEFO dari batch ${batch.batchNumber} (ED: ${batch.expiredDate})`,
        })
        .returning();

      createdMovements.push(mv);
      allocations.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        expiredDate: batch.expiredDate,
        deductedQty: deduct,
      });

      runningStock = nextStock;
      remainingToDeduct = Number((remainingToDeduct - deduct).toFixed(2));
    }

    // Jika ada selisih stok warisan tanpa batch, catat pengeluaran langsung namun tetap tervalidasi non-negatif
    if (remainingToDeduct > 0) {
      const nextStock = Number((runningStock - remainingToDeduct).toFixed(2));
      const [mv] = await tx
        .insert(stockMovements)
        .values({
          medicineId: med.id,
          batchId: null,
          userUid: payload.userUid,
          userName: payload.userName,
          movementType: 'out',
          referenceType: payload.referenceType || 'penjualan',
          quantity: remainingToDeduct,
          stockBefore: runningStock,
          stockAfter: nextStock,
          unitPrice: med.sellingPrice,
          notes: payload.notes?.trim() || 'Pengeluaran stok reguler',
        })
        .returning();
      createdMovements.push(mv);
      allocations.push({
        batchId: null,
        batchNumber: 'REGULER',
        expiredDate: med.nearestExpiredDate || '-',
        deductedQty: remainingToDeduct,
      });
      runningStock = nextStock;
    }

    const nearestExpiredDate = await recalculateNearestExpiry(tx, med.id);

    const [updatedMedicine] = await tx
      .update(medicines)
      .set({
        stock: Math.max(0, runningStock),
        nearestExpiredDate,
        updatedAt: new Date(),
      })
      .where(eq(medicines.id, med.id))
      .returning();

    return {
      medicine: updatedMedicine,
      allocations,
      movements: createdMovements,
    };
  });

  await syncMedicineNotifications(payload.medicineId);
  await recordAuditLog({
    userUid: payload.userUid,
    userEmail: payload.userEmail,
    userRole: payload.userRole,
    action: 'STOCK_OUT_FEFO',
    entityType: 'medicine',
    entityId: payload.medicineId,
    details: {
      pluCode: result.medicine.pluCode,
      medicineName: result.medicine.name,
      quantity: payload.quantity,
      allocations: result.allocations,
      stockAfter: result.medicine.stock,
    },
  });

  return result;
}
