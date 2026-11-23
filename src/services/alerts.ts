import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { auditLogs, medicineBatches, medicines, notifications } from '../db/schema.ts';

export async function recordAuditLog(params: {
  userUid: string;
  userEmail: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId?: string | number;
  details?: Record<string, unknown>;
}) {
  try {
    await db.insert(auditLogs).values({
      userUid: params.userUid,
      userEmail: params.userEmail,
      userRole: params.userRole,
      action: params.action,
      entityType: params.entityType,
      entityId: String(params.entityId ?? ''),
      details: params.details ?? {},
    });
  } catch (error) {
    console.error('Failed to record audit log:', error);
  }
}

export async function syncMedicineNotifications(medicineId: number) {
  try {
    const medRows = await db
      .select()
      .from(medicines)
      .where(eq(medicines.id, medicineId))
      .limit(1);

    if (medRows.length === 0) return;
    const med = medRows[0];

    // Clear unread system-generated alerts for this medicine so they reflect latest state
    await db
      .delete(notifications)
      .where(and(eq(notifications.medicineId, medicineId), eq(notifications.isRead, false)));

    const alertsToInsert: {
      medicineId: number;
      type: string;
      title: string;
      message: string;
    }[] = [];

    if (med.stock <= 0) {
      alertsToInsert.push({
        medicineId: med.id,
        type: 'out_of_stock',
        title: `Stok Habis: ${med.name}`,
        message: `Obat ${med.name} (PLU ${med.pluCode}) memiliki stok 0 ${med.unit}. Segera lakukan pengadaan.`,
      });
    } else if (med.stock <= med.minStock) {
      alertsToInsert.push({
        medicineId: med.id,
        type: 'low_stock',
        title: `Stok Menipis: ${med.name}`,
        message: `Sisa stok ${med.stock} ${med.unit} berada di bawah/sama dengan batas minimum (${med.minStock} ${med.unit}).`,
      });
    }

    // Check active batches for near expiry (<= 90 days) or expired
    const batches = await db
      .select()
      .from(medicineBatches)
      .where(eq(medicineBatches.medicineId, medicineId));

    const now = new Date();
    const threshold90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    for (const batch of batches) {
      if (batch.remainingQty <= 0) continue;
      const exp = new Date(batch.expiredDate);
      if (exp < now) {
        alertsToInsert.push({
          medicineId: med.id,
          type: 'expired',
          title: `Batch Kedaluwarsa: ${med.name}`,
          message: `Batch ${batch.batchNumber} (${batch.remainingQty} ${med.unit}) telah melewati tanggal kedaluwarsa ${batch.expiredDate}.`,
        });
        break;
      } else if (exp <= threshold90) {
        alertsToInsert.push({
          medicineId: med.id,
          type: 'near_expiry',
          title: `Mendekati Kedaluwarsa: ${med.name}`,
          message: `Batch ${batch.batchNumber} (${batch.remainingQty} ${med.unit}) akan kedaluwarsa pada ${batch.expiredDate}.`,
        });
        break;
      }
    }

    if (alertsToInsert.length > 0) {
      await db.insert(notifications).values(alertsToInsert);
    }
  } catch (error) {
    console.error('Failed to sync notifications for medicine:', medicineId, error);
  }
}
