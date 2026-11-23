import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const profiles = pgTable(
  'profiles',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull(),
    fullName: text('full_name').notNull(),
    role: text('role').notNull().default('petugas'), // 'admin' | 'petugas'
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('profiles_email_idx').on(table.email), index('profiles_role_idx').on(table.role)],
);

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address').default('').notNull(),
  phone: text('phone').default('').notNull(),
  email: text('email').default('').notNull(),
  leadTimeDays: integer('lead_time_days').notNull().default(2),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const medicines = pgTable(
  'medicines',
  {
    id: serial('id').primaryKey(),
    pluCode: text('plu_code').notNull().unique(),
    name: text('name').notNull(),
    categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
    supplierId: integer('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
    unit: text('unit').notNull().default('TABLET'),
    purchasePrice: doublePrecision('purchase_price').notNull().default(0),
    sellingPrice: doublePrecision('selling_price').notNull().default(0),
    prescriptionPrice: doublePrecision('prescription_price').notNull().default(0),
    stock: doublePrecision('stock').notNull().default(0),
    minStock: integer('min_stock').notNull().default(10),
    nearestExpiredDate: date('nearest_expired_date'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('medicines_name_idx').on(table.name),
    index('medicines_category_idx').on(table.categoryId),
    index('medicines_supplier_idx').on(table.supplierId),
    index('medicines_stock_idx').on(table.stock),
  ],
);

export const medicineBatches = pgTable(
  'medicine_batches',
  {
    id: serial('id').primaryKey(),
    medicineId: integer('medicine_id')
      .references(() => medicines.id, { onDelete: 'cascade' })
      .notNull(),
    supplierId: integer('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
    batchNumber: text('batch_number').notNull(),
    expiredDate: date('expired_date').notNull(),
    initialQty: doublePrecision('initial_qty').notNull().default(0),
    remainingQty: doublePrecision('remaining_qty').notNull().default(0),
    purchasePrice: doublePrecision('purchase_price').notNull().default(0),
    receivedAt: timestamp('received_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('batches_medicine_idx').on(table.medicineId),
    index('batches_expired_idx').on(table.expiredDate),
  ],
);

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: serial('id').primaryKey(),
    medicineId: integer('medicine_id')
      .references(() => medicines.id, { onDelete: 'cascade' })
      .notNull(),
    batchId: integer('batch_id').references(() => medicineBatches.id, { onDelete: 'set null' }),
    userUid: text('user_uid').notNull(),
    userName: text('user_name').notNull().default('Sistem'),
    movementType: text('movement_type').notNull(), // 'in' | 'out' | 'adjustment'
    referenceType: text('reference_type').notNull().default('penjualan'), // 'pembelian' | 'penjualan' | 'penyesuaian' | 'awal'
    quantity: doublePrecision('quantity').notNull(),
    stockBefore: doublePrecision('stock_before').notNull().default(0),
    stockAfter: doublePrecision('stock_after').notNull().default(0),
    unitPrice: doublePrecision('unit_price').notNull().default(0),
    notes: text('notes').default('').notNull(),
    movementDate: timestamp('movement_date').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('movements_medicine_idx').on(table.medicineId),
    index('movements_type_idx').on(table.movementType),
    index('movements_date_idx').on(table.movementDate),
  ],
);

export const topsisCriteria = pgTable('topsis_criteria', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // K1..K5
  name: text('name').notNull(),
  originalType: text('original_type').notNull(), // 'benefit' | 'cost'
  calculationType: text('calculation_type').notNull(), // 'benefit' | 'cost'
  weight: doublePrecision('weight').notNull(),
  description: text('description').default('').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const topsisRuns = pgTable(
  'topsis_runs',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    createdByUid: text('created_by_uid').notNull(),
    createdByName: text('created_by_name').notNull(),
    weightsSnapshot: jsonb('weights_snapshot').notNull(),
    idealPositive: jsonb('ideal_positive').notNull(),
    idealNegative: jsonb('ideal_negative').notNull(),
    totalAlternatives: integer('total_alternatives').notNull().default(0),
    notes: text('notes').default('').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('topsis_runs_created_idx').on(table.createdAt)],
);

export const topsisResults = pgTable(
  'topsis_results',
  {
    id: serial('id').primaryKey(),
    runId: integer('run_id')
      .references(() => topsisRuns.id, { onDelete: 'cascade' })
      .notNull(),
    medicineId: integer('medicine_id')
      .references(() => medicines.id, { onDelete: 'cascade' })
      .notNull(),
    medicinePlu: text('medicine_plu').notNull(),
    medicineName: text('medicine_name').notNull(),
    unit: text('unit').notNull().default('TABLET'),
    rawSales: doublePrecision('raw_sales').notNull().default(0),
    rawStock: doublePrecision('raw_stock').notNull().default(0),
    rawLeadTime: doublePrecision('raw_lead_time').notNull().default(0),
    rawExpiryMonths: doublePrecision('raw_expiry_months').notNull().default(12),
    rawPurchasePrice: doublePrecision('raw_purchase_price').notNull().default(0),
    scoreK1: integer('score_k1').notNull(),
    scoreK2: integer('score_k2').notNull(),
    scoreK3: integer('score_k3').notNull(),
    scoreK4: integer('score_k4').notNull(),
    scoreK5: integer('score_k5').notNull(),
    normK1: doublePrecision('norm_k1').notNull(),
    normK2: doublePrecision('norm_k2').notNull(),
    normK3: doublePrecision('norm_k3').notNull(),
    normK4: doublePrecision('norm_k4').notNull(),
    normK5: doublePrecision('norm_k5').notNull(),
    weightedK1: doublePrecision('weighted_k1').notNull(),
    weightedK2: doublePrecision('weighted_k2').notNull(),
    weightedK3: doublePrecision('weighted_k3').notNull(),
    weightedK4: doublePrecision('weighted_k4').notNull(),
    weightedK5: doublePrecision('weighted_k5').notNull(),
    distancePositive: doublePrecision('distance_positive').notNull(),
    distanceNegative: doublePrecision('distance_negative').notNull(),
    preferenceValue: doublePrecision('preference_value').notNull(),
    rank: integer('rank').notNull(),
    priorityLabel: text('priority_label').notNull(),
  },
  (table) => [
    index('topsis_results_run_idx').on(table.runId),
    index('topsis_results_rank_idx').on(table.rank),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    medicineId: integer('medicine_id').references(() => medicines.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'low_stock' | 'out_of_stock' | 'near_expiry' | 'expired' | 'system'
    title: text('title').notNull(),
    message: text('message').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('notifications_read_idx').on(table.isRead)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    userUid: text('user_uid').notNull(),
    userEmail: text('user_email').notNull(),
    userRole: text('user_role').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').default('').notNull(),
    details: jsonb('details').notNull().default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('audit_logs_created_idx').on(table.createdAt)],
);

// Relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  medicines: many(medicines),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  medicines: many(medicines),
  batches: many(medicineBatches),
}));

export const medicinesRelations = relations(medicines, ({ one, many }) => ({
  category: one(categories, {
    fields: [medicines.categoryId],
    references: [categories.id],
  }),
  supplier: one(suppliers, {
    fields: [medicines.supplierId],
    references: [suppliers.id],
  }),
  batches: many(medicineBatches),
  movements: many(stockMovements),
}));

export const medicineBatchesRelations = relations(medicineBatches, ({ one }) => ({
  medicine: one(medicines, {
    fields: [medicineBatches.medicineId],
    references: [medicines.id],
  }),
  supplier: one(suppliers, {
    fields: [medicineBatches.supplierId],
    references: [suppliers.id],
  }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  medicine: one(medicines, {
    fields: [stockMovements.medicineId],
    references: [medicines.id],
  }),
  batch: one(medicineBatches, {
    fields: [stockMovements.batchId],
    references: [medicineBatches.id],
  }),
}));

export const topsisRunsRelations = relations(topsisRuns, ({ many }) => ({
  results: many(topsisResults),
}));

export const topsisResultsRelations = relations(topsisResults, ({ one }) => ({
  run: one(topsisRuns, {
    fields: [topsisResults.runId],
    references: [topsisRuns.id],
  }),
  medicine: one(medicines, {
    fields: [topsisResults.medicineId],
    references: [medicines.id],
  }),
}));
