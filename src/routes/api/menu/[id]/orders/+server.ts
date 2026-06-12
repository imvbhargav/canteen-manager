import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { eq, and, gte, lte, lt, sql, desc } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { menuItems, ticketItems, tickets, users } from '$lib/server/db/schema';

export const GET: RequestHandler = async ({ params, url }) => {
	const { id: menuItemId } = params;

	if (!menuItemId) throw error(400, 'Menu item ID is missing');

	const rangeParam = url.searchParams.get('range') || '30d';
	const startParam = url.searchParams.get('startDate');
	const endParam = url.searchParams.get('endDate');
	const cursor = url.searchParams.get('cursor'); // ISO timestamp
	const limitParam = parseInt(url.searchParams.get('limit') || '20', 10);
	const limit = limitParam > 0 && limitParam <= 50 ? limitParam : 20;

	// ── Verify item exists ────────────────────────────────────────
	const item = await db.query.menuItems.findFirst({
		where: eq(menuItems.id, menuItemId),
		columns: { id: true }
	});
	if (!item) throw error(404, 'Menu item not found');

	// ── Build date filter on tickets.createdAt ────────────────────
	type SQL = ReturnType<typeof sql>;

	let dateCondition: SQL | ReturnType<typeof and> | ReturnType<typeof gte> = sql`true`;

	if (rangeParam === 'today') {
		dateCondition = gte(tickets.createdAt, sql`current_date`);
	} else if (rangeParam === '7d') {
		dateCondition = gte(tickets.createdAt, sql`now() - interval '7 days'`);
	} else if (rangeParam === '30d') {
		dateCondition = gte(tickets.createdAt, sql`now() - interval '30 days'`);
	} else if (rangeParam === 'custom' && startParam && endParam) {
		dateCondition = and(
			gte(sql`(${tickets.createdAt} AT TIME ZONE 'Asia/Kolkata')::date`, sql`${startParam}::date`),
			lte(sql`(${tickets.createdAt} AT TIME ZONE 'Asia/Kolkata')::date`, sql`${endParam}::date`)
		)!;
	}
	// rangeParam === 'all' → dateCondition stays sql`true`

	// ── Cursor condition (keyset pagination, newest-first) ────────
	const cursorCondition = cursor ? lt(tickets.createdAt, new Date(cursor)) : sql`true`;

	// ── Status filter (same as analytics endpoint) ────────────────
	const statusCondition = sql`${tickets.status} IN ('COMPLETED', 'READY', 'PENDING')`;

	try {
		// We query ticketItems filtered by menuItemId, join to tickets + users.
		// Using raw query via db.select for multi-table join with all conditions.
		const rows = await db
			.select({
				// Ticket fields
				ticketId: tickets.id,
				ticketReference: tickets.ticketReference,
				totalAmount: tickets.totalAmount,
				status: tickets.status,
				createdAt: tickets.createdAt,
				// Line-item fields (specific to this menu item in the ticket)
				quantity: ticketItems.quantity,
				unitPrice: ticketItems.unitPrice,
				// Buyer fields
				buyerName: users.name,
				buyerStudentId: users.studentId,
				buyerRollNumber: users.rollNumber
			})
			.from(ticketItems)
			.innerJoin(tickets, eq(ticketItems.ticketId, tickets.id))
			.innerJoin(users, eq(tickets.userId, users.id))
			.where(
				and(eq(ticketItems.menuItemId, menuItemId), statusCondition, dateCondition, cursorCondition)
			)
			.orderBy(desc(tickets.createdAt))
			.limit(limit + 1); // fetch one extra to determine hasNextPage

		let hasNextPage = false;
		let nextCursor: string | null = null;

		if (rows.length > limit) {
			hasNextPage = true;
			rows.pop();
			nextCursor = rows[rows.length - 1].createdAt.toISOString();
		}

		return json({
			success: true,
			data: {
				orders: rows,
				pagination: { nextCursor, hasNextPage }
			}
		});
	} catch (err) {
		console.error('Item orders API error:', err);
		return json({ success: false, error: 'Failed to load orders' }, { status: 500 });
	}
};
