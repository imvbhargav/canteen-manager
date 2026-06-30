import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { eq, and, gte, lte, lt, sql, desc, inArray } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { menuItems, ticketItems, tickets, users } from '$lib/server/db/schema';

export const GET: RequestHandler = async ({ params, url }) => {
	const { id: menuItemId } = params;

	if (!menuItemId) throw error(400, 'Menu item ID is missing');

	const rangeParam = url.searchParams.get('range') || '30d';
	const startParam = url.searchParams.get('startDate');
	const endParam = url.searchParams.get('endDate');
	const statusParam = url.searchParams.get('status');
	const cursor = url.searchParams.get('cursor'); // ISO timestamp
	const limitParam = parseInt(url.searchParams.get('limit') || '20', 10);
	const limit = limitParam > 0 && limitParam <= 50 ? limitParam : 20;

	// Verify item exists
	const item = await db.query.menuItems.findFirst({
		where: eq(menuItems.id, menuItemId),
		columns: { id: true }
	});
	if (!item) throw error(404, 'Menu item not found');

	// Build conditions array
	const queryConditions = [eq(ticketItems.menuItemId, menuItemId)];

	// Date Filters
	if (rangeParam === 'today') {
		queryConditions.push(gte(tickets.createdAt, sql`current_date`));
	} else if (rangeParam === '7d') {
		queryConditions.push(gte(tickets.createdAt, sql`now() - interval '7 days'`));
	} else if (rangeParam === '30d') {
		queryConditions.push(gte(tickets.createdAt, sql`now() - interval '30 days'`));
	} else if (rangeParam === 'custom' && startParam && endParam) {
		queryConditions.push(
			gte(sql`(${tickets.createdAt} AT TIME ZONE 'Asia/Kolkata')::date`, sql`${startParam}::date`),
			lte(sql`(${tickets.createdAt} AT TIME ZONE 'Asia/Kolkata')::date`, sql`${endParam}::date`)
		);
	}

	// Status Filter
	if (statusParam) {
		const parsedStatuses = statusParam
			.split(',')
			.map(
				(s) =>
					s.trim().toUpperCase() as 'PENDING' | 'PRINTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
			)
			.filter((s) => ['PENDING', 'PRINTING', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(s));

		if (parsedStatuses.length > 0) {
			queryConditions.push(inArray(tickets.status, parsedStatuses));
		}
	}

	// Cursor Pagination Condition
	if (cursor) {
		queryConditions.push(lt(tickets.createdAt, new Date(cursor)));
	}

	try {
		const rows = await db
			.select({
				ticketId: tickets.id,
				ticketReference: tickets.ticketReference,
				totalAmount: tickets.totalAmount,
				status: tickets.status,
				createdAt: tickets.createdAt,
				quantity: ticketItems.quantity,
				unitPrice: ticketItems.unitPrice,
				buyerName: users.name,
				buyerStudentId: users.referenceKey,
				buyerRollNumber: users.accountNumber
			})
			.from(ticketItems)
			.innerJoin(tickets, eq(ticketItems.ticketId, tickets.id))
			.innerJoin(users, eq(tickets.userId, users.id))
			.where(and(...queryConditions))
			.orderBy(desc(tickets.createdAt))
			.limit(limit + 1);

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
