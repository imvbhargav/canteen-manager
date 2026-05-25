import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  uuid,
  pgEnum,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ENUMS
export const categoryEnum = pgEnum('menu_category', ['Breakfast', 'Lunch', 'Snacks', 'Beverages']);
export const dietaryEnum = pgEnum('dietary_type', ['veg', 'non-veg']);
export const ticketStatusEnum = pgEnum('ticket_status', ['PENDING', 'READY', 'COMPLETED', 'CANCELLED']);

export const transactionTypeEnum = pgEnum('transaction_type', ['CREDIT', 'DEBIT']);
export const transactionRefEnum = pgEnum('transaction_reference_type', ['TOP_UP', 'TICKET_PURCHASE', 'REFUND', 'ADJUSTMENT']);

export const paymentStatusEnum = pgEnum('payment_status', ['INITIATED', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED']);
export const paymentProviderEnum = pgEnum('payment_provider', ['CASH', 'RAZORPAY', 'STRIPE', 'UPI']);

// CORE ENTITIES
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: text('student_id').notNull().unique(), 
    name: text('name').notNull(),
    rollNumber: text('roll_number').notNull().unique(),
    balance: numeric('balance', { precision: 10, scale: 2 }).notNull().default('0.00'),
    
    // Security (Mapped to UI)
    pinHash: text('pin_hash'), // Nullable initially until user sets it
    biometricsEnabled: boolean('biometrics_enabled').default(false).notNull(),
    
    // Notifications (Mapped to UI)
    notifyOrders: boolean('notify_orders').default(true).notNull(),
    notifyWallet: boolean('notify_wallet').default(true).notNull(),
    notifyPromo: boolean('notify_promo').default(false).notNull(),
    
    // Status
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ([
    check('users_balance_check', sql`${table.balance} >= 0`),
  ])
);

export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    deviceIdentifier: text('device_identifier').notNull(), // e.g., "iPhone 13 Pro - Safari"
    tokenHash: text('token_hash').notNull().unique(),
    isRevoked: boolean('is_revoked').default(false).notNull(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  }
);

export const menuItems = pgTable(
  'menu_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
    category: categoryEnum('category').notNull(),
    inStock: boolean('in_stock').default(true).notNull(),
    dietary: dietaryEnum('dietary').notNull(),
    isArchived: boolean('is_archived').default(false).notNull(), // Soft delete for enterprise
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ([
     check('menu_items_price_check', sql`${table.price} >= 0`),
  ])
);

// ORDERS & TICKETS
export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketReference: text('ticket_reference').notNull().unique(), // NEX-54213
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
    status: ticketStatusEnum('status').default('PENDING').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => (
    [check('tickets_total_check', sql`${table.totalAmount} >= 0`),
  ])
);

export const ticketItems = pgTable(
  'ticket_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
    menuItemId: uuid('menu_item_id').notNull().references(() => menuItems.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull(),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(), // Historical snapshot
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ([
    check('ticket_items_qty_check', sql`${table.quantity} > 0`),
    check('ticket_items_unit_price_check', sql`${table.unitPrice} >= 0`),
  ])
);

// FINANCIALS: PAYMENTS & WALLET LEDGER
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    provider: paymentProviderEnum('provider').notNull(),
    providerTxnId: text('provider_txn_id'), // External ID (Razorpay payment_id) or Receipt No. for CASH
    status: paymentStatusEnum('status').default('INITIATED').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ([
    check('payments_amount_check', sql`${table.amount} > 0`),
  ])
);

export const walletTransactions = pgTable(
  'wallet_transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    type: transactionTypeEnum('type').notNull(), // CREDIT (+), DEBIT (-)
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    
    // Audit Trail: What was the balance immediately after this transaction?
    balanceAfter: numeric('balance_after', { precision: 10, scale: 2 }).notNull(),
    
    // Context linking
    referenceType: transactionRefEnum('reference_type').notNull(),
    ticketId: uuid('ticket_id').references(() => tickets.id, { onDelete: 'restrict' }), // Populated if TICKET_PURCHASE or REFUND
    paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'restrict' }), // Populated if TOP_UP
    
    description: text('description').notNull(), // e.g., "Lunch Checkout", "Wallet Top-up"
    
    // Enterprise Idempotency: Prevents double-charging if a network request is retried
    idempotencyKey: text('idempotency_key').notNull().unique(), 
    
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ([
    check('wallet_txn_amount_check', sql`${table.amount} > 0`),
    // Partial indexes ensure lookups for idempotent requests are lightning-fast
  ])
);

// DRIZZLE RELATIONS
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(userSessions),
  tickets: many(tickets),
  payments: many(payments),
  walletTransactions: many(walletTransactions),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, { fields: [userSessions.userId], references: [users.id] }),
}));

export const menuItemsRelations = relations(menuItems, ({ many }) => ({
  ticketItems: many(ticketItems),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  user: one(users, { fields: [tickets.userId], references: [users.id] }),
  items: many(ticketItems),
  walletTransactions: many(walletTransactions), // Easily find the ledger entry for a ticket
}));

export const ticketItemsRelations = relations(ticketItems, ({ one }) => ({
  ticket: one(tickets, { fields: [ticketItems.ticketId], references: [tickets.id] }),
  menuItem: one(menuItems, { fields: [ticketItems.menuItemId], references: [menuItems.id] }),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  user: one(users, { fields: [payments.userId], references: [users.id] }),
  walletTransactions: many(walletTransactions), // Connects successful payments to the wallet credit
}));

export const walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  user: one(users, { fields: [walletTransactions.userId], references: [users.id] }),
  ticket: one(tickets, { fields: [walletTransactions.ticketId], references: [tickets.id] }),
  payment: one(payments, { fields: [walletTransactions.paymentId], references: [payments.id] }),
}));