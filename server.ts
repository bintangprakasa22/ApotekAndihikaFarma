import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import {
  auditLogs,
  categories,
  medicineBatches,
  medicines,
  notifications,
  profiles,
  stockMovements,
  suppliers,
  topsisCriteria,
  topsisResults,
  topsisRuns,
} from './src/db/schema.ts';
import { ensureDatabaseSeeded } from './src/db/seed.ts';
import { AuthRequest, requireAuth, requireRole } from './src/middleware/auth.ts';
import {
  calculateTopsis,
  DEFAULT_TOPSIS_CRITERIA,
  scoreK1Sales,
  scoreK2Stock,
  scoreK3LeadTime,
  scoreK4ExpiryMonths,
  scoreK5PurchasePrice,
  TopsisCandidateInput,
  TopsisCriterionConfig,
} from './src/lib/topsis.ts';
import { processStockIn, processStockOut } from './src/services/inventory.ts';
import { recordAuditLog, syncMedicineNotifications } from './src/services/alerts.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '2mb' }));

// Health check (no eager DB probe)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Apotek Andhika Farma API' });
});

// Current user profile + lazy seed trigger
app.get('/api/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureDatabaseSeeded();
    const unreadRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(eq(notifications.isRead, false));

    res.json({
      profile: req.profile,
      unreadNotifications: unreadRes[0]?.count ?? 0,
    });
  } catch (error) {
    console.error('Error in GET /api/me:', error);
    res.status(500).json({ error: 'Gagal memuat profil pengguna.' });
  }
});

// Dashboard stats, 30-day chart, and recent activities
app.get('/api/dashboard', requireAuth, async (_req: AuthRequest, res) => {
  try {
    await ensureDatabaseSeeded();

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const plus90Str = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const [statsRow] = await db
      .select({
        totalMedicines: sql<number>`count(*)::int`,
        totalStock: sql<number>`coalesce(sum(${medicines.stock}), 0)::double precision`,
        outOfStockCount: sql<number>`count(*) filter (where ${medicines.stock} <= 0)::int`,
        lowStockCount: sql<number>`count(*) filter (where ${medicines.stock} > 0 and ${medicines.stock} <= ${medicines.minStock})::int`,
        nearExpiryCount: sql<number>`count(*) filter (where ${medicines.nearestExpiredDate} is not null and ${medicines.nearestExpiredDate} <= ${plus90Str} and ${medicines.stock} > 0)::int`,
      })
      .from(medicines);

    const [txCountRow] = await db
      .select({ totalTransactions: sql<number>`count(*)::int` })
      .from(stockMovements);

    // Chart data: 14 hari terakhir
    const since14 = new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000);
    since14.setHours(0, 0, 0, 0);

    const mvRows = await db
      .select({
        movementType: stockMovements.movementType,
        quantity: stockMovements.quantity,
        movementDate: stockMovements.movementDate,
      })
      .from(stockMovements)
      .where(gte(stockMovements.movementDate, since14));

    const dailyMap = new Map<string, { date: string; label: string; stockIn: number; stockOut: number }>();
    for (let i = 0; i < 14; i++) {
      const d = new Date(since14.getTime() + i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      dailyMap.set(key, { date: key, label, stockIn: 0, stockOut: 0 });
    }

    for (const mv of mvRows) {
      const key = new Date(mv.movementDate).toISOString().slice(0, 10);
      const bucket = dailyMap.get(key);
      if (bucket) {
        if (mv.movementType === 'in') bucket.stockIn += mv.quantity;
        else if (mv.movementType === 'out') bucket.stockOut += mv.quantity;
      }
    }

    const recentMovements = await db
      .select({
        id: stockMovements.id,
        medicineId: stockMovements.medicineId,
        medicinePlu: medicines.pluCode,
        medicineName: medicines.name,
        unit: medicines.unit,
        movementType: stockMovements.movementType,
        referenceType: stockMovements.referenceType,
        quantity: stockMovements.quantity,
        stockAfter: stockMovements.stockAfter,
        userName: stockMovements.userName,
        notes: stockMovements.notes,
        movementDate: stockMovements.movementDate,
      })
      .from(stockMovements)
      .innerJoin(medicines, eq(stockMovements.medicineId, medicines.id))
      .orderBy(desc(stockMovements.movementDate), desc(stockMovements.id))
      .limit(8);

    const urgentMedicines = await db
      .select({
        id: medicines.id,
        pluCode: medicines.pluCode,
        name: medicines.name,
        unit: medicines.unit,
        stock: medicines.stock,
        minStock: medicines.minStock,
        nearestExpiredDate: medicines.nearestExpiredDate,
      })
      .from(medicines)
      .where(
        or(
          lte(medicines.stock, medicines.minStock),
          and(
            sql`${medicines.nearestExpiredDate} is not null`,
            lte(medicines.nearestExpiredDate, plus90Str),
          ),
        ),
      )
      .orderBy(asc(medicines.stock), asc(medicines.nearestExpiredDate))
      .limit(8);

    const latestTopsis = await db
      .select()
      .from(topsisRuns)
      .orderBy(desc(topsisRuns.createdAt))
      .limit(1);

    let topPriorities: (typeof topsisResults.$inferSelect)[] = [];
    if (latestTopsis.length > 0) {
      topPriorities = await db
        .select()
        .from(topsisResults)
        .where(eq(topsisResults.runId, latestTopsis[0].id))
        .orderBy(asc(topsisResults.rank))
        .limit(5);
    }

    res.json({
      stats: {
        totalMedicines: statsRow?.totalMedicines ?? 0,
        totalStock: Math.round((statsRow?.totalStock ?? 0) * 100) / 100,
        lowStockCount: statsRow?.lowStockCount ?? 0,
        outOfStockCount: statsRow?.outOfStockCount ?? 0,
        nearExpiryCount: statsRow?.nearExpiryCount ?? 0,
        totalTransactions: txCountRow?.totalTransactions ?? 0,
      },
      today: todayStr,
      chartData: Array.from(dailyMap.values()),
      recentMovements,
      urgentMedicines,
      latestTopsisRun: latestTopsis[0] ?? null,
      topPriorities,
    });
  } catch (error) {
    console.error('Error in GET /api/dashboard:', error);
    res.status(500).json({ error: 'Gagal memuat statistik dashboard.' });
  }
});

// ==================== CATEGORIES ====================
app.get('/api/categories', requireAuth, async (_req: AuthRequest, res) => {
  try {
    await ensureDatabaseSeeded();
    const rows = await db
      .select({
        id: categories.id,
        code: categories.code,
        name: categories.name,
        description: categories.description,
        createdAt: categories.createdAt,
        medicineCount: sql<number>`count(${medicines.id})::int`,
      })
      .from(categories)
      .leftJoin(medicines, eq(medicines.categoryId, categories.id))
      .groupBy(categories.id)
      .orderBy(asc(categories.code));

    res.json(rows);
  } catch (error) {
    console.error('Error in GET /api/categories:', error);
    res.status(500).json({ error: 'Gagal memuat data kategori.' });
  }
});

app.post('/api/categories', requireAuth, async (req: AuthRequest, res) => {
  try {
    const code = String(req.body.code || '').trim().toUpperCase();
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();

    if (!code || !name) {
      return res.status(400).json({ error: 'Kode dan nama kategori wajib diisi.' });
    }

    const [created] = await db
      .insert(categories)
      .values({ code, name, description })
      .returning();

    await recordAuditLog({
      userUid: req.profile!.uid,
      userEmail: req.profile!.email,
      userRole: req.profile!.role,
      action: 'CREATE_CATEGORY',
      entityType: 'category',
      entityId: created.id,
      details: { code, name },
    });

    res.status(201).json(created);
  } catch (error: unknown) {
    console.error('Error in POST /api/categories:', error);
    const msg =
      error instanceof Error && error.message.includes('unique')
        ? 'Kode kategori sudah digunakan.'
        : 'Gagal menambahkan kategori.';
    res.status(400).json({ error: msg });
  }
});

app.put('/api/categories/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const code = String(req.body.code || '').trim().toUpperCase();
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();

    if (!Number.isInteger(id) || !code || !name) {
      return res.status(400).json({ error: 'Data kategori tidak valid.' });
    }

    const [updated] = await db
      .update(categories)
      .set({ code, name, description })
      .where(eq(categories.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Kategori tidak ditemukan.' });
    res.json(updated);
  } catch (error) {
    console.error('Error in PUT /api/categories/:id:', error);
    res.status(400).json({ error: 'Gagal memperbarui kategori.' });
  }
});

app.delete('/api/categories/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID tidak valid.' });

    const [deleted] = await db.delete(categories).where(eq(categories.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: 'Kategori tidak ditemukan.' });

    await recordAuditLog({
      userUid: req.profile!.uid,
      userEmail: req.profile!.email,
      userRole: req.profile!.role,
      action: 'DELETE_CATEGORY',
      entityType: 'category',
      entityId: id,
      details: { name: deleted.name },
    });

    res.json({ deleted: true });
  } catch (error) {
    console.error('Error in DELETE /api/categories/:id:', error);
    res.status(500).json({ error: 'Gagal menghapus kategori.' });
  }
});

// ==================== SUPPLIERS ====================
app.get('/api/suppliers', requireAuth, async (_req: AuthRequest, res) => {
  try {
    await ensureDatabaseSeeded();
    const rows = await db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        address: suppliers.address,
        phone: suppliers.phone,
        email: suppliers.email,
        leadTimeDays: suppliers.leadTimeDays,
        createdAt: suppliers.createdAt,
        medicineCount: sql<number>`count(${medicines.id})::int`,
      })
      .from(suppliers)
      .leftJoin(medicines, eq(medicines.supplierId, suppliers.id))
      .groupBy(suppliers.id)
      .orderBy(asc(suppliers.name));

    res.json(rows);
  } catch (error) {
    console.error('Error in GET /api/suppliers:', error);
    res.status(500).json({ error: 'Gagal memuat data supplier.' });
  }
});

app.post('/api/suppliers', requireAuth, async (req: AuthRequest, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const address = String(req.body.address || '').trim();
    const phone = String(req.body.phone || '').trim();
    const email = String(req.body.email || '').trim();
    const leadTimeDays = Number(req.body.leadTimeDays ?? 2);

    if (!name) return res.status(400).json({ error: 'Nama supplier wajib diisi.' });
    if (!Number.isFinite(leadTimeDays) || leadTimeDays < 0) {
      return res.status(400).json({ error: 'Lead time pengiriman tidak boleh negatif.' });
    }

    const [created] = await db
      .insert(suppliers)
      .values({ name, address, phone, email, leadTimeDays: Math.round(leadTimeDays) })
      .returning();

    await recordAuditLog({
      userUid: req.profile!.uid,
      userEmail: req.profile!.email,
      userRole: req.profile!.role,
      action: 'CREATE_SUPPLIER',
      entityType: 'supplier',
      entityId: created.id,
      details: { name, leadTimeDays },
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Error in POST /api/suppliers:', error);
    res.status(400).json({ error: 'Gagal menambahkan supplier.' });
  }
});

app.put('/api/suppliers/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const name = String(req.body.name || '').trim();
    const address = String(req.body.address || '').trim();
    const phone = String(req.body.phone || '').trim();
    const email = String(req.body.email || '').trim();
    const leadTimeDays = Number(req.body.leadTimeDays ?? 2);

    if (!Number.isInteger(id) || !name || !Number.isFinite(leadTimeDays) || leadTimeDays < 0) {
      return res.status(400).json({ error: 'Data supplier tidak valid.' });
    }

    const [updated] = await db
      .update(suppliers)
      .set({ name, address, phone, email, leadTimeDays: Math.round(leadTimeDays) })
      .where(eq(suppliers.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Supplier tidak ditemukan.' });
    res.json(updated);
  } catch (error) {
    console.error('Error in PUT /api/suppliers/:id:', error);
    res.status(400).json({ error: 'Gagal memperbarui supplier.' });
  }
});

app.delete('/api/suppliers/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID tidak valid.' });

    const [deleted] = await db.delete(suppliers).where(eq(suppliers.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: 'Supplier tidak ditemukan.' });

    res.json({ deleted: true });
  } catch (error) {
    console.error('Error in DELETE /api/suppliers/:id:', error);
    res.status(500).json({ error: 'Gagal menghapus supplier.' });
  }
});

// ==================== MEDICINES ====================
app.get('/api/medicines', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureDatabaseSeeded();
    const search = String(req.query.search || '').trim();
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
    const supplierId = req.query.supplierId ? Number(req.query.supplierId) : null;
    const status = String(req.query.status || 'all');
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(5, Number(req.query.limit || 20)));
    const offset = (page - 1) * limit;

    const plus90Str = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const conditions = [];
    if (search) {
      conditions.push(or(ilike(medicines.name, `%${search}%`), ilike(medicines.pluCode, `%${search}%`)));
    }
    if (categoryId && Number.isInteger(categoryId)) {
      conditions.push(eq(medicines.categoryId, categoryId));
    }
    if (supplierId && Number.isInteger(supplierId)) {
      conditions.push(eq(medicines.supplierId, supplierId));
    }
    if (status === 'out') {
      conditions.push(lte(medicines.stock, 0));
    } else if (status === 'low') {
      conditions.push(and(sql`${medicines.stock} > 0`, lte(medicines.stock, medicines.minStock)));
    } else if (status === 'near_expiry') {
      conditions.push(
        and(
          sql`${medicines.nearestExpiredDate} is not null`,
          lte(medicines.nearestExpiredDate, plus90Str),
          sql`${medicines.stock} > 0`,
        ),
      );
    } else if (status === 'normal') {
      conditions.push(sql`${medicines.stock} > ${medicines.minStock}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countRes] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(medicines)
      .where(whereClause);

    const total = countRes?.total ?? 0;

    const items = await db
      .select({
        id: medicines.id,
        pluCode: medicines.pluCode,
        name: medicines.name,
        categoryId: medicines.categoryId,
        categoryName: categories.name,
        supplierId: medicines.supplierId,
        supplierName: suppliers.name,
        supplierLeadTime: suppliers.leadTimeDays,
        unit: medicines.unit,
        purchasePrice: medicines.purchasePrice,
        sellingPrice: medicines.sellingPrice,
        prescriptionPrice: medicines.prescriptionPrice,
        stock: medicines.stock,
        minStock: medicines.minStock,
        nearestExpiredDate: medicines.nearestExpiredDate,
        updatedAt: medicines.updatedAt,
      })
      .from(medicines)
      .leftJoin(categories, eq(medicines.categoryId, categories.id))
      .leftJoin(suppliers, eq(medicines.supplierId, suppliers.id))
      .where(whereClause)
      .orderBy(asc(medicines.name))
      .limit(limit)
      .offset(offset);

    res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error('Error in GET /api/medicines:', error);
    res.status(500).json({ error: 'Gagal memuat daftar obat.' });
  }
});

app.get('/api/medicines/:id/batches', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID obat tidak valid.' });

    const rows = await db
      .select({
        id: medicineBatches.id,
        medicineId: medicineBatches.medicineId,
        supplierId: medicineBatches.supplierId,
        supplierName: suppliers.name,
        batchNumber: medicineBatches.batchNumber,
        expiredDate: medicineBatches.expiredDate,
        initialQty: medicineBatches.initialQty,
        remainingQty: medicineBatches.remainingQty,
        purchasePrice: medicineBatches.purchasePrice,
        receivedAt: medicineBatches.receivedAt,
      })
      .from(medicineBatches)
      .leftJoin(suppliers, eq(medicineBatches.supplierId, suppliers.id))
      .where(eq(medicineBatches.medicineId, id))
      .orderBy(asc(medicineBatches.expiredDate), asc(medicineBatches.id));

    res.json(rows);
  } catch (error) {
    console.error('Error in GET /api/medicines/:id/batches:', error);
    res.status(500).json({ error: 'Gagal memuat batch obat.' });
  }
});

app.post('/api/medicines', requireAuth, async (req: AuthRequest, res) => {
  try {
    const pluCode = String(req.body.pluCode || '').trim().toUpperCase();
    const name = String(req.body.name || '').trim();
    const categoryId = req.body.categoryId ? Number(req.body.categoryId) : null;
    const supplierId = req.body.supplierId ? Number(req.body.supplierId) : null;
    const unit = String(req.body.unit || 'TABLET').trim().toUpperCase();
    const purchasePrice = Number(req.body.purchasePrice ?? 0);
    const sellingPrice = Number(req.body.sellingPrice ?? 0);
    const prescriptionPrice = Number(req.body.prescriptionPrice ?? sellingPrice);
    const stock = Number(req.body.stock ?? 0);
    const minStock = Number(req.body.minStock ?? 10);
    const nearestExpiredDate = req.body.nearestExpiredDate ? String(req.body.nearestExpiredDate) : null;

    if (!pluCode || !name) {
      return res.status(400).json({ error: 'Kode obat (PLU) dan nama obat wajib diisi.' });
    }
    if (stock < 0 || minStock < 0 || purchasePrice < 0 || sellingPrice < 0) {
      return res.status(400).json({ error: 'Nilai stok dan harga tidak boleh negatif.' });
    }

    const created = await db.transaction(async (tx) => {
      const [med] = await tx
        .insert(medicines)
        .values({
          pluCode,
          name,
          categoryId,
          supplierId,
          unit,
          purchasePrice,
          sellingPrice,
          prescriptionPrice,
          stock,
          minStock,
          nearestExpiredDate,
        })
        .returning();

      if (stock > 0) {
        const expDate =
          nearestExpiredDate ||
          new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const [batch] = await tx
          .insert(medicineBatches)
          .values({
            medicineId: med.id,
            supplierId,
            batchNumber: `INIT-${pluCode}`,
            expiredDate: expDate,
            initialQty: stock,
            remainingQty: stock,
            purchasePrice,
          })
          .returning();

        await tx.insert(stockMovements).values({
          medicineId: med.id,
          batchId: batch.id,
          userUid: req.profile!.uid,
          userName: req.profile!.fullName,
          movementType: 'in',
          referenceType: 'awal',
          quantity: stock,
          stockBefore: 0,
          stockAfter: stock,
          unitPrice: purchasePrice,
          notes: 'Stok awal saat registrasi obat baru',
        });

        if (!nearestExpiredDate) {
          await tx
            .update(medicines)
            .set({ nearestExpiredDate: expDate })
            .where(eq(medicines.id, med.id));
        }
      }

      return med;
    });

    await syncMedicineNotifications(created.id);
    await recordAuditLog({
      userUid: req.profile!.uid,
      userEmail: req.profile!.email,
      userRole: req.profile!.role,
      action: 'CREATE_MEDICINE',
      entityType: 'medicine',
      entityId: created.id,
      details: { pluCode, name, stock },
    });

    res.status(201).json(created);
  } catch (error: unknown) {
    console.error('Error in POST /api/medicines:', error);
    const msg =
      error instanceof Error && error.message.includes('unique')
        ? 'Kode obat (PLU) sudah terdaftar.'
        : 'Gagal menambahkan data obat.';
    res.status(400).json({ error: msg });
  }
});

app.put('/api/medicines/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID obat tidak valid.' });

    const pluCode = String(req.body.pluCode || '').trim().toUpperCase();
    const name = String(req.body.name || '').trim();
    const categoryId = req.body.categoryId ? Number(req.body.categoryId) : null;
    const supplierId = req.body.supplierId ? Number(req.body.supplierId) : null;
    const unit = String(req.body.unit || 'TABLET').trim().toUpperCase();
    const purchasePrice = Number(req.body.purchasePrice ?? 0);
    const sellingPrice = Number(req.body.sellingPrice ?? 0);
    const prescriptionPrice = Number(req.body.prescriptionPrice ?? sellingPrice);
    const minStock = Number(req.body.minStock ?? 10);
    const nearestExpiredDate = req.body.nearestExpiredDate ? String(req.body.nearestExpiredDate) : null;

    if (!pluCode || !name) {
      return res.status(400).json({ error: 'Kode obat dan nama obat wajib diisi.' });
    }
    if (minStock < 0 || purchasePrice < 0 || sellingPrice < 0) {
      return res.status(400).json({ error: 'Nilai harga dan stok minimum tidak boleh negatif.' });
    }

    const [updated] = await db
      .update(medicines)
      .set({
        pluCode,
        name,
        categoryId,
        supplierId,
        unit,
        purchasePrice,
        sellingPrice,
        prescriptionPrice,
        minStock,
        nearestExpiredDate,
        updatedAt: new Date(),
      })
      .where(eq(medicines.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Data obat tidak ditemukan.' });

    await syncMedicineNotifications(updated.id);
    await recordAuditLog({
      userUid: req.profile!.uid,
      userEmail: req.profile!.email,
      userRole: req.profile!.role,
      action: 'UPDATE_MEDICINE',
      entityType: 'medicine',
      entityId: updated.id,
      details: { pluCode, name },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error in PUT /api/medicines/:id:', error);
    res.status(400).json({ error: 'Gagal memperbarui data obat.' });
  }
});

app.delete('/api/medicines/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID tidak valid.' });

    const [deleted] = await db.delete(medicines).where(eq(medicines.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: 'Obat tidak ditemukan.' });

    await recordAuditLog({
      userUid: req.profile!.uid,
      userEmail: req.profile!.email,
      userRole: req.profile!.role,
      action: 'DELETE_MEDICINE',
      entityType: 'medicine',
      entityId: id,
      details: { pluCode: deleted.pluCode, name: deleted.name },
    });

    res.json({ deleted: true });
  } catch (error) {
    console.error('Error in DELETE /api/medicines/:id:', error);
    res.status(500).json({ error: 'Gagal menghapus obat.' });
  }
});

// ==================== STOCK MOVEMENTS & FEFO ====================
app.get('/api/stock-movements', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureDatabaseSeeded();
    const search = String(req.query.search || '').trim();
    const type = String(req.query.type || 'all');
    const startDate = req.query.startDate ? String(req.query.startDate) : null;
    const endDate = req.query.endDate ? String(req.query.endDate) : null;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(5, Number(req.query.limit || 20)));
    const offset = (page - 1) * limit;

    const conditions = [];
    if (type === 'in' || type === 'out' || type === 'adjustment') {
      conditions.push(eq(stockMovements.movementType, type));
    }
    if (search) {
      conditions.push(
        or(
          ilike(medicines.name, `%${search}%`),
          ilike(medicines.pluCode, `%${search}%`),
          ilike(stockMovements.notes, `%${search}%`),
        ),
      );
    }
    if (startDate) {
      conditions.push(gte(stockMovements.movementDate, new Date(`${startDate}T00:00:00`)));
    }
    if (endDate) {
      conditions.push(lte(stockMovements.movementDate, new Date(`${endDate}T23:59:59`)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countRes] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(stockMovements)
      .innerJoin(medicines, eq(stockMovements.medicineId, medicines.id))
      .where(whereClause);

    const items = await db
      .select({
        id: stockMovements.id,
        medicineId: stockMovements.medicineId,
        medicinePlu: medicines.pluCode,
        medicineName: medicines.name,
        unit: medicines.unit,
        batchId: stockMovements.batchId,
        batchNumber: medicineBatches.batchNumber,
        batchExpiredDate: medicineBatches.expiredDate,
        movementType: stockMovements.movementType,
        referenceType: stockMovements.referenceType,
        quantity: stockMovements.quantity,
        stockBefore: stockMovements.stockBefore,
        stockAfter: stockMovements.stockAfter,
        unitPrice: stockMovements.unitPrice,
        userName: stockMovements.userName,
        notes: stockMovements.notes,
        movementDate: stockMovements.movementDate,
      })
      .from(stockMovements)
      .innerJoin(medicines, eq(stockMovements.medicineId, medicines.id))
      .leftJoin(medicineBatches, eq(stockMovements.batchId, medicineBatches.id))
      .where(whereClause)
      .orderBy(desc(stockMovements.movementDate), desc(stockMovements.id))
      .limit(limit)
      .offset(offset);

    const total = countRes?.total ?? 0;
    res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error('Error in GET /api/stock-movements:', error);
    res.status(500).json({ error: 'Gagal memuat riwayat pergerakan stok.' });
  }
});

app.post('/api/stock/in', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await processStockIn({
      medicineId: Number(req.body.medicineId),
      supplierId: req.body.supplierId ? Number(req.body.supplierId) : null,
      batchNumber: String(req.body.batchNumber || ''),
      expiredDate: String(req.body.expiredDate || ''),
      quantity: Number(req.body.quantity),
      purchasePrice: Number(req.body.purchasePrice || 0),
      notes: req.body.notes ? String(req.body.notes) : undefined,
      userUid: req.profile!.uid,
      userEmail: req.profile!.email,
      userName: req.profile!.fullName,
      userRole: req.profile!.role,
    });
    res.status(201).json(result);
  } catch (error: unknown) {
    console.error('Error in POST /api/stock/in:', error);
    const msg = error instanceof Error ? error.message : 'Gagal mencatat stok masuk.';
    res.status(400).json({ error: msg });
  }
});

app.post('/api/stock/out', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await processStockOut({
      medicineId: Number(req.body.medicineId),
      quantity: Number(req.body.quantity),
      referenceType: req.body.referenceType === 'penyesuaian' ? 'penyesuaian' : 'penjualan',
      notes: req.body.notes ? String(req.body.notes) : undefined,
      userUid: req.profile!.uid,
      userEmail: req.profile!.email,
      userName: req.profile!.fullName,
      userRole: req.profile!.role,
    });
    res.status(201).json(result);
  } catch (error: unknown) {
    console.error('Error in POST /api/stock/out:', error);
    const msg = error instanceof Error ? error.message : 'Gagal mencatat stok keluar.';
    res.status(400).json({ error: msg });
  }
});

// ==================== ALERTS & NOTIFICATIONS ====================
app.get('/api/alerts', requireAuth, async (_req: AuthRequest, res) => {
  try {
    await ensureDatabaseSeeded();
    const plus90Str = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const lowStock = await db
      .select({
        id: medicines.id,
        pluCode: medicines.pluCode,
        name: medicines.name,
        unit: medicines.unit,
        stock: medicines.stock,
        minStock: medicines.minStock,
      })
      .from(medicines)
      .where(and(sql`${medicines.stock} > 0`, lte(medicines.stock, medicines.minStock)))
      .orderBy(asc(medicines.stock))
      .limit(100);

    const outOfStock = await db
      .select({
        id: medicines.id,
        pluCode: medicines.pluCode,
        name: medicines.name,
        unit: medicines.unit,
        stock: medicines.stock,
        minStock: medicines.minStock,
      })
      .from(medicines)
      .where(lte(medicines.stock, 0))
      .orderBy(asc(medicines.name))
      .limit(100);

    const expiringBatches = await db
      .select({
        batchId: medicineBatches.id,
        medicineId: medicines.id,
        pluCode: medicines.pluCode,
        medicineName: medicines.name,
        unit: medicines.unit,
        batchNumber: medicineBatches.batchNumber,
        expiredDate: medicineBatches.expiredDate,
        remainingQty: medicineBatches.remainingQty,
      })
      .from(medicineBatches)
      .innerJoin(medicines, eq(medicineBatches.medicineId, medicines.id))
      .where(and(sql`${medicineBatches.remainingQty} > 0`, lte(medicineBatches.expiredDate, plus90Str)))
      .orderBy(asc(medicineBatches.expiredDate))
      .limit(100);

    const notifList = await db
      .select()
      .from(notifications)
      .orderBy(asc(notifications.isRead), desc(notifications.createdAt))
      .limit(50);

    res.json({
      lowStock,
      outOfStock,
      expiringBatches,
      notifications: notifList,
    });
  } catch (error) {
    console.error('Error in GET /api/alerts:', error);
    res.status(500).json({ error: 'Gagal memuat peringatan stok.' });
  }
});

app.patch('/api/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID tidak valid.' });
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
    res.json({ updated: true });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ error: 'Gagal memperbarui notifikasi.' });
  }
});

app.post('/api/notifications/read-all', requireAuth, async (_req: AuthRequest, res) => {
  try {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.isRead, false));
    res.json({ updated: true });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    res.status(500).json({ error: 'Gagal memperbarui notifikasi.' });
  }
});

// ==================== TOPSIS SPK ====================
app.get('/api/topsis/criteria', requireAuth, async (_req: AuthRequest, res) => {
  try {
    await ensureDatabaseSeeded();
    const rows = await db.select().from(topsisCriteria).orderBy(asc(topsisCriteria.code));
    res.json(rows);
  } catch (error) {
    console.error('Error in GET /api/topsis/criteria:', error);
    res.status(500).json({ error: 'Gagal memuat kriteria TOPSIS.' });
  }
});

// Pengaturan bobot hanya untuk Admin
app.put('/api/topsis/criteria', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const items = Array.isArray(req.body.criteria) ? req.body.criteria : [];
    if (items.length === 0) {
      return res.status(400).json({ error: 'Data kriteria tidak valid.' });
    }

    for (const item of items) {
      const weight = Number(item.weight);
      if (!item.code || !Number.isFinite(weight) || weight <= 0) {
        return res.status(400).json({ error: `Bobot untuk ${item.code} harus lebih dari 0.` });
      }
      await db
        .update(topsisCriteria)
        .set({ weight, updatedAt: new Date() })
        .where(eq(topsisCriteria.code, String(item.code)));
    }

    await recordAuditLog({
      userUid: req.profile!.uid,
      userEmail: req.profile!.email,
      userRole: req.profile!.role,
      action: 'UPDATE_TOPSIS_WEIGHTS',
      entityType: 'topsis_criteria',
      details: { criteria: items },
    });

    const updated = await db.select().from(topsisCriteria).orderBy(asc(topsisCriteria.code));
    res.json(updated);
  } catch (error) {
    console.error('Error in PUT /api/topsis/criteria:', error);
    res.status(500).json({ error: 'Gagal menyimpan bobot kriteria.' });
  }
});

app.get('/api/topsis/candidates', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureDatabaseSeeded();

    const now = new Date();
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const defaultEnd = now.toISOString().slice(0, 10);

    const periodStart = String(req.query.periodStart || defaultStart);
    const periodEnd = String(req.query.periodEnd || defaultEnd);
    const search = String(req.query.search || '').trim();
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
    const mode = String(req.query.mode || 'featured'); // 'featured' | 'critical' | 'search'
    const limit = Math.min(80, Math.max(5, Number(req.query.limit || 25)));

    // Agregasi penjualan pada periode yang dipilih
    const salesAgg = await db
      .select({
        medicineId: stockMovements.medicineId,
        totalOut: sql<number>`coalesce(sum(${stockMovements.quantity}), 0)::double precision`,
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.movementType, 'out'),
          gte(stockMovements.movementDate, new Date(`${periodStart}T00:00:00`)),
          lte(stockMovements.movementDate, new Date(`${periodEnd}T23:59:59`)),
        ),
      )
      .groupBy(stockMovements.medicineId);

    const salesMap = new Map(salesAgg.map((r) => [r.medicineId, r.totalOut]));

    const conditions = [];
    if (search) {
      conditions.push(or(ilike(medicines.name, `%${search}%`), ilike(medicines.pluCode, `%${search}%`)));
    }
    if (categoryId && Number.isInteger(categoryId)) {
      conditions.push(eq(medicines.categoryId, categoryId));
    }
    if (mode === 'critical') {
      conditions.push(lte(medicines.stock, medicines.minStock));
    } else if (mode === 'featured' && !search && !categoryId) {
      const activeIds = salesAgg.map((s) => s.medicineId);
      if (activeIds.length > 0) {
        conditions.push(
          or(inArray(medicines.id, activeIds.slice(0, 50)), lte(medicines.stock, medicines.minStock)),
        );
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const medRows = await db
      .select({
        id: medicines.id,
        pluCode: medicines.pluCode,
        name: medicines.name,
        unit: medicines.unit,
        stock: medicines.stock,
        minStock: medicines.minStock,
        purchasePrice: medicines.purchasePrice,
        sellingPrice: medicines.sellingPrice,
        nearestExpiredDate: medicines.nearestExpiredDate,
        leadTimeDays: suppliers.leadTimeDays,
        supplierName: suppliers.name,
        categoryName: categories.name,
      })
      .from(medicines)
      .leftJoin(suppliers, eq(medicines.supplierId, suppliers.id))
      .leftJoin(categories, eq(medicines.categoryId, categories.id))
      .where(whereClause)
      .orderBy(asc(medicines.stock), asc(medicines.name))
      .limit(limit);

    const candidates = medRows.map((m) => {
      const rawSales = Number((salesMap.get(m.id) || 0).toFixed(2));
      const rawStock = m.stock;
      const rawLeadTime = m.leadTimeDays ?? 2;
      const rawExpiryMonths = m.nearestExpiredDate
        ? Math.max(
            1,
            Math.round(
              (new Date(m.nearestExpiredDate).getTime() - now.getTime()) /
                (30 * 24 * 60 * 60 * 1000),
            ),
          )
        : 12;
      const isEstimatedPrice = m.purchasePrice <= 0;
      const rawPurchasePrice =
        m.purchasePrice > 0 ? m.purchasePrice : Math.round(m.sellingPrice * 0.78);

      return {
        medicineId: m.id,
        medicinePlu: m.pluCode,
        medicineName: m.name,
        unit: m.unit,
        categoryName: m.categoryName || '-',
        supplierName: m.supplierName || '-',
        rawSales,
        rawStock,
        rawLeadTime,
        rawExpiryMonths,
        rawPurchasePrice,
        isEstimatedPrice,
        scoreK1: scoreK1Sales(rawSales),
        scoreK2: scoreK2Stock(rawStock),
        scoreK3: scoreK3LeadTime(rawLeadTime),
        scoreK4: scoreK4ExpiryMonths(rawExpiryMonths),
        scoreK5: scoreK5PurchasePrice(rawPurchasePrice),
      };
    });

    // Sort by highest sales + lowest stock so most relevant appear first
    candidates.sort((a, b) => b.rawSales - a.rawSales || a.rawStock - b.rawStock);

    res.json({ periodStart, periodEnd, candidates });
  } catch (error) {
    console.error('Error in GET /api/topsis/candidates:', error);
    res.status(500).json({ error: 'Gagal memuat kandidat obat untuk TOPSIS.' });
  }
});

app.post('/api/topsis/run', requireAuth, async (req: AuthRequest, res) => {
  try {
    const title =
      String(req.body.title || '').trim() ||
      `Analisis Prioritas Pengadaan (${new Date().toLocaleDateString('id-ID')})`;
    const periodStart = String(req.body.periodStart || new Date().toISOString().slice(0, 10));
    const periodEnd = String(req.body.periodEnd || new Date().toISOString().slice(0, 10));
    const notes = String(req.body.notes || '').trim();
    const rawCandidates = Array.isArray(req.body.candidates) ? req.body.candidates : [];

    if (rawCandidates.length < 2) {
      return res.status(400).json({
        error: 'Pilih minimal 2 obat kandidat agar perbandingan matriks TOPSIS bermakna.',
      });
    }

    const dbCriteria = await db.select().from(topsisCriteria).orderBy(asc(topsisCriteria.code));
    const criteriaConfigs: TopsisCriterionConfig[] =
      dbCriteria.length === 5
        ? dbCriteria.map((c) => ({
            code: c.code as TopsisCriterionConfig['code'],
            name: c.name,
            originalType: c.originalType as 'benefit' | 'cost',
            calculationType: c.calculationType as 'benefit' | 'cost',
            weight: c.weight,
            description: c.description,
          }))
        : DEFAULT_TOPSIS_CRITERIA;

    const candidates: TopsisCandidateInput[] = rawCandidates.map((c: Record<string, unknown>) => ({
      medicineId: Number(c.medicineId),
      medicinePlu: String(c.medicinePlu || ''),
      medicineName: String(c.medicineName || ''),
      unit: String(c.unit || 'TABLET'),
      rawSales: Number(c.rawSales ?? 0),
      rawStock: Number(c.rawStock ?? 0),
      rawLeadTime: Number(c.rawLeadTime ?? 2),
      rawExpiryMonths: Number(c.rawExpiryMonths ?? 12),
      rawPurchasePrice: Number(c.rawPurchasePrice ?? 0),
      overrideK1: c.overrideK1 ? Number(c.overrideK1) : undefined,
      overrideK2: c.overrideK2 ? Number(c.overrideK2) : undefined,
      overrideK3: c.overrideK3 ? Number(c.overrideK3) : undefined,
      overrideK4: c.overrideK4 ? Number(c.overrideK4) : undefined,
      overrideK5: c.overrideK5 ? Number(c.overrideK5) : undefined,
    }));

    const output = calculateTopsis(candidates, criteriaConfigs);

    const savedRun = await db.transaction(async (tx) => {
      const [run] = await tx
        .insert(topsisRuns)
        .values({
          title,
          periodStart,
          periodEnd,
          createdByUid: req.profile!.uid,
          createdByName: req.profile!.fullName,
          weightsSnapshot: Object.fromEntries(output.criteria.map((c) => [c.code, c.weight])),
          idealPositive: output.idealPositive,
          idealNegative: output.idealNegative,
          totalAlternatives: output.results.length,
          notes,
        })
        .returning();

      const insertedResults = await tx
        .insert(topsisResults)
        .values(
          output.results.map((r) => ({
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
        )
        .returning();

      return { run, results: insertedResults };
    });

    await recordAuditLog({
      userUid: req.profile!.uid,
      userEmail: req.profile!.email,
      userRole: req.profile!.role,
      action: 'RUN_TOPSIS',
      entityType: 'topsis_run',
      entityId: savedRun.run.id,
      details: {
        title,
        totalAlternatives: output.results.length,
        topRankMedicine: output.results[0]?.medicineName,
      },
    });

    res.status(201).json({
      run: savedRun.run,
      results: output.results,
      criteria: output.criteria,
      divisors: output.divisors,
      idealPositive: output.idealPositive,
      idealNegative: output.idealNegative,
    });
  } catch (error: unknown) {
    console.error('Error in POST /api/topsis/run:', error);
    const msg = error instanceof Error ? error.message : 'Gagal menjalankan perhitungan TOPSIS.';
    res.status(400).json({ error: msg });
  }
});

app.get('/api/topsis/runs', requireAuth, async (_req: AuthRequest, res) => {
  try {
    await ensureDatabaseSeeded();
    const runs = await db
      .select()
      .from(topsisRuns)
      .orderBy(desc(topsisRuns.createdAt))
      .limit(50);
    res.json(runs);
  } catch (error) {
    console.error('Error in GET /api/topsis/runs:', error);
    res.status(500).json({ error: 'Gagal memuat riwayat perhitungan TOPSIS.' });
  }
});

app.get('/api/topsis/runs/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID run tidak valid.' });

    const runRows = await db.select().from(topsisRuns).where(eq(topsisRuns.id, id)).limit(1);
    if (runRows.length === 0) return res.status(404).json({ error: 'Riwayat TOPSIS tidak ditemukan.' });

    const run = runRows[0];
    const results = await db
      .select()
      .from(topsisResults)
      .where(eq(topsisResults.runId, id))
      .orderBy(asc(topsisResults.rank));

    const divisors = {
      K1: Math.round(Math.sqrt(results.reduce((a, r) => a + r.scoreK1 ** 2, 0)) * 1_000_000) / 1_000_000,
      K2: Math.round(Math.sqrt(results.reduce((a, r) => a + r.scoreK2 ** 2, 0)) * 1_000_000) / 1_000_000,
      K3: Math.round(Math.sqrt(results.reduce((a, r) => a + r.scoreK3 ** 2, 0)) * 1_000_000) / 1_000_000,
      K4: Math.round(Math.sqrt(results.reduce((a, r) => a + r.scoreK4 ** 2, 0)) * 1_000_000) / 1_000_000,
      K5: Math.round(Math.sqrt(results.reduce((a, r) => a + r.scoreK5 ** 2, 0)) * 1_000_000) / 1_000_000,
    };

    res.json({
      run,
      results,
      divisors,
      idealPositive: run.idealPositive,
      idealNegative: run.idealNegative,
    });
  } catch (error) {
    console.error('Error in GET /api/topsis/runs/:id:', error);
    res.status(500).json({ error: 'Gagal memuat detail hasil TOPSIS.' });
  }
});

app.delete('/api/topsis/runs/:id', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID tidak valid.' });
    await db.delete(topsisRuns).where(eq(topsisRuns.id, id));
    res.json({ deleted: true });
  } catch (error) {
    console.error('Error in DELETE /api/topsis/runs/:id:', error);
    res.status(500).json({ error: 'Gagal menghapus riwayat TOPSIS.' });
  }
});

// ==================== REPORTS ====================
app.get('/api/reports/:type', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureDatabaseSeeded();
    const type = String(req.params.type);
    const search = String(req.query.search || '').trim();
    const startDate = req.query.startDate ? String(req.query.startDate) : null;
    const endDate = req.query.endDate ? String(req.query.endDate) : null;
    const runId = req.query.runId ? Number(req.query.runId) : null;

    if (type === 'medicines') {
      const whereClause = search
        ? or(ilike(medicines.name, `%${search}%`), ilike(medicines.pluCode, `%${search}%`))
        : undefined;
      const rows = await db
        .select({
          id: medicines.id,
          pluCode: medicines.pluCode,
          name: medicines.name,
          categoryName: categories.name,
          supplierName: suppliers.name,
          unit: medicines.unit,
          purchasePrice: medicines.purchasePrice,
          sellingPrice: medicines.sellingPrice,
          stock: medicines.stock,
          minStock: medicines.minStock,
          nearestExpiredDate: medicines.nearestExpiredDate,
        })
        .from(medicines)
        .leftJoin(categories, eq(medicines.categoryId, categories.id))
        .leftJoin(suppliers, eq(medicines.supplierId, suppliers.id))
        .where(whereClause)
        .orderBy(asc(medicines.name));

      return res.json({ type, rows });
    }

    if (type === 'stock_in' || type === 'stock_out') {
      const mvType = type === 'stock_in' ? 'in' : 'out';
      const conditions = [eq(stockMovements.movementType, mvType)];
      if (search) {
        conditions.push(or(ilike(medicines.name, `%${search}%`), ilike(medicines.pluCode, `%${search}%`))!);
      }
      if (startDate) {
        conditions.push(gte(stockMovements.movementDate, new Date(`${startDate}T00:00:00`)));
      }
      if (endDate) {
        conditions.push(lte(stockMovements.movementDate, new Date(`${endDate}T23:59:59`)));
      }
      const rows = await db
        .select({
          id: stockMovements.id,
          movementDate: stockMovements.movementDate,
          pluCode: medicines.pluCode,
          medicineName: medicines.name,
          unit: medicines.unit,
          batchNumber: medicineBatches.batchNumber,
          referenceType: stockMovements.referenceType,
          quantity: stockMovements.quantity,
          stockBefore: stockMovements.stockBefore,
          stockAfter: stockMovements.stockAfter,
          unitPrice: stockMovements.unitPrice,
          userName: stockMovements.userName,
          notes: stockMovements.notes,
        })
        .from(stockMovements)
        .innerJoin(medicines, eq(stockMovements.medicineId, medicines.id))
        .leftJoin(medicineBatches, eq(stockMovements.batchId, medicineBatches.id))
        .where(and(...conditions))
        .orderBy(desc(stockMovements.movementDate));

      return res.json({ type, rows });
    }

    if (type === 'low_stock') {
      const conditions = [lte(medicines.stock, medicines.minStock)];
      if (search) {
        conditions.push(or(ilike(medicines.name, `%${search}%`), ilike(medicines.pluCode, `%${search}%`))!);
      }
      const rows = await db
        .select({
          id: medicines.id,
          pluCode: medicines.pluCode,
          name: medicines.name,
          categoryName: categories.name,
          supplierName: suppliers.name,
          unit: medicines.unit,
          stock: medicines.stock,
          minStock: medicines.minStock,
          purchasePrice: medicines.purchasePrice,
        })
        .from(medicines)
        .leftJoin(categories, eq(medicines.categoryId, categories.id))
        .leftJoin(suppliers, eq(medicines.supplierId, suppliers.id))
        .where(and(...conditions))
        .orderBy(asc(medicines.stock), asc(medicines.name));

      return res.json({ type, rows });
    }

    if (type === 'expiring') {
      const plus120Str = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const conditions = [
        sql`${medicineBatches.remainingQty} > 0`,
        lte(medicineBatches.expiredDate, endDate || plus120Str),
      ];
      if (startDate) {
        conditions.push(gte(medicineBatches.expiredDate, startDate));
      }
      if (search) {
        conditions.push(or(ilike(medicines.name, `%${search}%`), ilike(medicines.pluCode, `%${search}%`))!);
      }
      const rows = await db
        .select({
          id: medicineBatches.id,
          pluCode: medicines.pluCode,
          medicineName: medicines.name,
          unit: medicines.unit,
          batchNumber: medicineBatches.batchNumber,
          expiredDate: medicineBatches.expiredDate,
          remainingQty: medicineBatches.remainingQty,
          supplierName: suppliers.name,
        })
        .from(medicineBatches)
        .innerJoin(medicines, eq(medicineBatches.medicineId, medicines.id))
        .leftJoin(suppliers, eq(medicineBatches.supplierId, suppliers.id))
        .where(and(...conditions))
        .orderBy(asc(medicineBatches.expiredDate));

      return res.json({ type, rows });
    }

    if (type === 'topsis') {
      let targetRunId = runId;
      if (!targetRunId) {
        const latest = await db
          .select()
          .from(topsisRuns)
          .orderBy(desc(topsisRuns.createdAt))
          .limit(1);
        targetRunId = latest[0]?.id ?? null;
      }
      if (!targetRunId) return res.json({ type, run: null, rows: [] });

      const [run] = await db.select().from(topsisRuns).where(eq(topsisRuns.id, targetRunId)).limit(1);
      const conditions = [eq(topsisResults.runId, targetRunId)];
      if (search) {
        conditions.push(
          or(
            ilike(topsisResults.medicineName, `%${search}%`),
            ilike(topsisResults.medicinePlu, `%${search}%`),
          )!,
        );
      }
      const rows = await db
        .select()
        .from(topsisResults)
        .where(and(...conditions))
        .orderBy(asc(topsisResults.rank));

      return res.json({ type, run: run ?? null, rows });
    }

    return res.status(400).json({ error: 'Jenis laporan tidak dikenali.' });
  } catch (error) {
    console.error('Error in GET /api/reports/:type:', error);
    res.status(500).json({ error: 'Gagal memuat laporan.' });
  }
});

// ==================== USERS & AUDIT LOGS (ADMIN ONLY) ====================
app.get('/api/users', requireAuth, requireRole('admin'), async (_req: AuthRequest, res) => {
  try {
    const rows = await db.select().from(profiles).orderBy(asc(profiles.createdAt));
    res.json(rows);
  } catch (error) {
    console.error('Error in GET /api/users:', error);
    res.status(500).json({ error: 'Gagal memuat daftar pengguna.' });
  }
});

app.post('/api/users', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const fullName = String(req.body.fullName || '').trim();
    const role = req.body.role === 'admin' ? 'admin' : 'petugas';

    if (!email || !email.includes('@') || !fullName) {
      return res.status(400).json({ error: 'Email valid dan nama lengkap wajib diisi.' });
    }

    const existing = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email pengguna sudah terdaftar.' });
    }

    const [created] = await db
      .insert(profiles)
      .values({
        uid: `pending:${email}`,
        email,
        fullName,
        role,
        isActive: true,
      })
      .returning();

    await recordAuditLog({
      userUid: req.profile!.uid,
      userEmail: req.profile!.email,
      userRole: req.profile!.role,
      action: 'INVITE_USER',
      entityType: 'profile',
      entityId: created.id,
      details: { email, role },
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Error in POST /api/users:', error);
    res.status(400).json({ error: 'Gagal mendaftarkan pengguna.' });
  }
});

app.patch('/api/users/:id', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID tidak valid.' });

    const targetRows = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    if (targetRows.length === 0) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });

    const target = targetRows[0];
    const role = req.body.role === 'admin' ? 'admin' : req.body.role === 'petugas' ? 'petugas' : target.role;
    const isActive = typeof req.body.isActive === 'boolean' ? req.body.isActive : target.isActive;

    if (target.id === req.profile!.id && (!isActive || role !== 'admin')) {
      return res.status(400).json({
        error: 'Anda tidak dapat menonaktifkan atau menurunkan role akun Anda sendiri.',
      });
    }

    const [updated] = await db
      .update(profiles)
      .set({ role, isActive, updatedAt: new Date() })
      .where(eq(profiles.id, id))
      .returning();

    await recordAuditLog({
      userUid: req.profile!.uid,
      userEmail: req.profile!.email,
      userRole: req.profile!.role,
      action: 'UPDATE_USER_ROLE',
      entityType: 'profile',
      entityId: id,
      details: { email: updated.email, role: updated.role, isActive: updated.isActive },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error in PATCH /api/users/:id:', error);
    res.status(400).json({ error: 'Gagal memperbarui pengguna.' });
  }
});

app.get('/api/audit-logs', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 50)));
    const rows = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
    res.json(rows);
  } catch (error) {
    console.error('Error in GET /api/audit-logs:', error);
    res.status(500).json({ error: 'Gagal memuat audit log.' });
  }
});

async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Apotek Andhika Farma berjalan pada http://0.0.0.0:${PORT}`);
  });
}

startServer();
