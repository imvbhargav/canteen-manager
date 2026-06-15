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
	varchar
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const userRoleEnum = pgEnum('user_role', ['STUDENT', 'STAFF', 'ADMIN']);
export const otpStatusEnum = pgEnum('otp_status', ['PENDING', 'VERIFIED', 'EXPIRED']);
export const categoryEnum = pgEnum('menu_category', ['Breakfast', 'Lunch', 'Snacks', 'Beverages']);
export const dietaryEnum = pgEnum('dietary_type', ['veg', 'non-veg']);
export const ticketStatusEnum = pgEnum('ticket_status', [
	'PENDING',
	'READY',
	'COMPLETED',
	'CANCELLED'
]);
export const transactionTypeEnum = pgEnum('transaction_type', ['CREDIT', 'DEBIT']);
export const transactionRefEnum = pgEnum('transaction_reference_type', [
	'TOP_UP',
	'TICKET_PURCHASE',
	'REFUND',
	'ADJUSTMENT'
]);
export const paymentStatusEnum = pgEnum('payment_status', [
	'INITIATED',
	'PROCESSING',
	'SUCCESS',
	'FAILED',
	'REFUNDED'
]);
export const paymentProviderEnum = pgEnum('payment_provider', [
	'CASH',
	'RAZORPAY',
	'STRIPE',
	'UPI'
]);
export const counterStatusEnum = pgEnum('counter_status', ['ACTIVE', 'PRINTER_ISSUE', 'OFFLINE']);
export const ticketPrintStatusEnum = pgEnum('ticket_print_status', [
	'PENDING',
	'PRINTED',
	'FAILED'
]);
export const printerTypeEnum = pgEnum('printer_type', ['LAN', 'BT', 'USB', 'NONE']);

export const users = pgTable(
	'users',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		name: text('name').notNull(),

		// Generic Identification Columns
		accountNumber: text('account_number').notNull().unique(),
		referenceKey: text('reference_key').notNull().unique(),

		role: userRoleEnum('role').default('STUDENT').notNull(),
		balance: numeric('balance', { precision: 10, scale: 2 }).notNull().default('0.00'),
		pinHash: text('pin_hash'),
		isActive: boolean('is_active').default(true).notNull(),
		deactivationReason: text('deactivation_reason'),

		// Account expiry and validations
		credentialPhotoUrl: text('credential_photo_url'),
		batchYear: integer('batch_year').notNull().default(new Date().getFullYear()),
		expectedGraduationYear: integer('expected_graduation_year')
			.notNull()
			.default(new Date().getFullYear()),

		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		// Keeps your critical database-level safety check intact
		check('users_balance_check', sql`${table.balance} >= 0`)
	]
);

export const userSessions = pgTable('user_sessions', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	deviceIdentifier: text('device_identifier').notNull(),
	tokenHash: text('token_hash').notNull().unique(),
	isRevoked: boolean('is_revoked').default(false).notNull(),
	lastActiveAt: timestamp('last_active_at', { withTimezone: true }).defaultNow().notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
});

// Updated table for User-Level Rate Limiting
export const loginAttempts = pgTable('login_attempts', {
	id: uuid('id').defaultRandom().primaryKey(),
	ipAddress: varchar('ip_address', { length: 45 }).notNull(), // Kept for audit/security logs
	identifier: varchar('identifier', { length: 255 }).notNull(), // The targeted username/ID
	attemptedAt: timestamp('attempted_at').defaultNow().notNull()
});

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
		isArchived: boolean('is_archived').default(false).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [check('menu_items_price_check', sql`${table.price} >= 0`)]
);

export const counters = pgTable('counters', {
	id: uuid('id').defaultRandom().primaryKey(),
	counterNumber: integer('counter_number').notNull().unique(),
	displayName: text('display_name').notNull(),
	status: counterStatusEnum('status').default('ACTIVE').notNull(),

	printerType: printerTypeEnum('printer_type').default('NONE').notNull(),
	printerAddress: text('printer_address'),
	deviceIdentifier: text('device_identifier'),
	isActive: boolean('is_active').default(true).notNull(),

	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const counterStatusLogs = pgTable('counter_status_logs', {
	id: uuid('id').defaultRandom().primaryKey(),
	counterId: uuid('counter_id')
		.notNull()
		.references(() => counters.id, { onDelete: 'cascade' }),
	previousStatus: counterStatusEnum('previous_status'),
	newStatus: counterStatusEnum('new_status').notNull(),
	reason: text('reason'),
	changedAt: timestamp('changed_at', { withTimezone: true }).defaultNow().notNull()
});

export const tickets = pgTable(
	'tickets',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		ticketReference: text('ticket_reference').notNull().unique(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		counterId: uuid('counter_id')
			.notNull()
			.references(() => counters.id, { onDelete: 'restrict' }),
		totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
		status: ticketStatusEnum('status').default('PENDING').notNull(),
		printStatus: ticketPrintStatusEnum('print_status').default('PENDING').notNull(),
		printErrorReason: text('print_error_reason'), // e.g., "PAPER_OUT", "USB_DISCONNECTED"
		printedAt: timestamp('printed_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [check('tickets_total_check', sql`${table.totalAmount} >= 0`)]
);

export const ticketItems = pgTable(
	'ticket_items',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		ticketId: uuid('ticket_id')
			.notNull()
			.references(() => tickets.id, { onDelete: 'cascade' }),
		menuItemId: uuid('menu_item_id')
			.notNull()
			.references(() => menuItems.id, { onDelete: 'restrict' }),
		quantity: integer('quantity').notNull(),
		unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		check('ticket_items_qty_check', sql`${table.quantity} > 0`),
		check('ticket_items_unit_price_check', sql`${table.unitPrice} >= 0`)
	]
);

export const payments = pgTable(
	'payments',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
		provider: paymentProviderEnum('provider').notNull(),
		providerTxnId: text('provider_txn_id'),
		status: paymentStatusEnum('status').default('INITIATED').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [check('payments_amount_check', sql`${table.amount} > 0`)]
);

export const walletTransactions = pgTable(
	'wallet_transactions',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		type: transactionTypeEnum('type').notNull(),
		amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
		balanceAfter: numeric('balance_after', { precision: 10, scale: 2 }).notNull(),
		referenceType: transactionRefEnum('reference_type').notNull(),
		ticketId: uuid('ticket_id').references(() => tickets.id, { onDelete: 'restrict' }),
		paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'restrict' }),
		description: text('description').notNull(),
		idempotencyKey: text('idempotency_key').notNull().unique(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [check('wallet_txn_amount_check', sql`${table.amount} > 0`)]
);

export const manualOrderOtps = pgTable(
	'manual_order_otps',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		otpCode: varchar('otp_code', { length: 6 }).notNull().unique(), // Unique so admin can lookup by OTP
		status: otpStatusEnum('status').default('PENDING').notNull(),
		attempts: integer('attempts').default(0).notNull(), // Brute-force protection
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [check('manual_otp_attempts_check', sql`${table.attempts} <= 3`)]
);

export const manualOrderOtpsRelations = relations(manualOrderOtps, ({ one }) => ({
	user: one(users, { fields: [manualOrderOtps.userId], references: [users.id] })
}));

export const usersRelations = relations(users, ({ many }) => ({
	sessions: many(userSessions),
	tickets: many(tickets),
	payments: many(payments),
	walletTransactions: many(walletTransactions),
	manualOrderOtps: many(manualOrderOtps)
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
	user: one(users, { fields: [userSessions.userId], references: [users.id] })
}));

export const menuItemsRelations = relations(menuItems, ({ many }) => ({
	ticketItems: many(ticketItems)
}));

export const countersRelations = relations(counters, ({ many }) => ({
	tickets: many(tickets),
	statusLogs: many(counterStatusLogs)
}));

export const counterStatusLogsRelations = relations(counterStatusLogs, ({ one }) => ({
	counter: one(counters, { fields: [counterStatusLogs.counterId], references: [counters.id] })
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
	user: one(users, { fields: [tickets.userId], references: [users.id] }),
	counter: one(counters, { fields: [tickets.counterId], references: [counters.id] }),
	items: many(ticketItems),
	walletTransactions: many(walletTransactions)
}));

export const ticketItemsRelations = relations(ticketItems, ({ one }) => ({
	ticket: one(tickets, { fields: [ticketItems.ticketId], references: [tickets.id] }),
	menuItem: one(menuItems, { fields: [ticketItems.menuItemId], references: [menuItems.id] })
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
	user: one(users, { fields: [payments.userId], references: [users.id] }),
	walletTransactions: many(walletTransactions)
}));

export const walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
	user: one(users, { fields: [walletTransactions.userId], references: [users.id] }),
	ticket: one(tickets, { fields: [walletTransactions.ticketId], references: [tickets.id] }),
	payment: one(payments, { fields: [walletTransactions.paymentId], references: [payments.id] })
}));
