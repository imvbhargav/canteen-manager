import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { menuItems, ticketItems, tickets } from '$lib/server/db/schema';

export const GET: RequestHandler = async ({ params, url }) => {
	const { id: menuItemId } = params;
	const range = url.searchParams.get('range') || '30d';
	const startDate = url.searchParams.get('startDate');
	const endDate = url.searchParams.get('endDate');

	if (!menuItemId) {
		throw error(400, 'Menu item ID is missing');
	}

	try {
		const itemExists = await db.query.menuItems.findFirst({
			where: eq(menuItems.id, menuItemId)
		});

		if (!itemExists) {
			throw error(404, 'Menu item not found');
		}

		let dateFilter = sql`true`;

		if (range === 'today') {
			dateFilter = gte(tickets.createdAt, sql`current_date`);
		} else if (range === '7d') {
			dateFilter = gte(tickets.createdAt, sql`now() - interval '7 days'`);
		} else if (range === '30d') {
			dateFilter = gte(tickets.createdAt, sql`now() - interval '30 days'`);
		} else if (range === 'custom' && startDate && endDate) {
			// startDate and endDate are YYYY-MM-DD strings from the date picker
			dateFilter = and(
				gte(sql`(${tickets.createdAt} AT TIME ZONE 'Asia/Kolkata')::date`, sql`${startDate}::date`),
				lte(sql`(${tickets.createdAt} AT TIME ZONE 'Asia/Kolkata')::date`, sql`${endDate}::date`)
			)!;
		}
		// range === 'all' → dateFilter stays sql`true`

		const statusFilter = sql`${tickets.status} IN ('COMPLETED', 'PRINTING')`;

		const statsResult = await db
			.select({
				totalQuantity: sql<number>`coalesce(sum(${ticketItems.quantity})::int, 0)`,
				totalRevenue: sql<string>`coalesce(sum(${ticketItems.quantity} * ${ticketItems.unitPrice})::numeric, 0.00)`,
				totalOrders: sql<number>`count(distinct ${ticketItems.ticketId})::int`,
				uniqueCustomers: sql<number>`count(distinct ${tickets.userId})::int`
			})
			.from(ticketItems)
			.innerJoin(tickets, eq(ticketItems.ticketId, tickets.id))
			.where(and(eq(ticketItems.menuItemId, menuItemId), statusFilter, dateFilter));

		const dailyTimeline = await db
			.select({
				date: sql<string>`to_char(${tickets.createdAt} AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')`,
				quantity: sql<number>`sum(${ticketItems.quantity})::int`,
				revenue: sql<string>`sum(${ticketItems.quantity} * ${ticketItems.unitPrice})::numeric`
			})
			.from(ticketItems)
			.innerJoin(tickets, eq(ticketItems.ticketId, tickets.id))
			.where(and(eq(ticketItems.menuItemId, menuItemId), statusFilter, dateFilter))
			.groupBy(sql`to_char(${tickets.createdAt} AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')`)
			.orderBy(sql`to_char(${tickets.createdAt} AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')`);

		const summary = statsResult[0] || {
			totalQuantity: 0,
			totalRevenue: '0.00',
			totalOrders: 0,
			uniqueCustomers: 0
		};

		// Compute avg revenue per order server-side for convenience
		const avgOrderValue =
			Number(summary.totalOrders) > 0
				? (Number(summary.totalRevenue) / Number(summary.totalOrders)).toFixed(2)
				: '0.00';

		return json({
			success: true,
			meta: {
				name: itemExists.name,
				category: itemExists.category,
				price: itemExists.price,
				isArchived: itemExists.isArchived
			},
			summary: {
				...summary,
				avgOrderValue
			},
			timeline: dailyTimeline
		});
	} catch (err) {
		console.error('Analytics error:', err);
		return json({ success: false, error: 'Failed to load analytics' }, { status: 500 });
	}
};
