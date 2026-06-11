import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { tickets, users } from '$lib/server/db/schema';
import { eq, and, lt, desc } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.user) return json({ success: false, error: 'Unauthorized' }, { status: 401 });

	const adminCheck = await db.query.users.findFirst({
		where: eq(users.id, locals.user.id),
		columns: { role: true }
	});
	if (!adminCheck || adminCheck.role !== 'ADMIN')
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });

	const limitParam = parseInt(url.searchParams.get('limit') || '10', 10);
	const limit = limitParam > 0 && limitParam <= 50 ? limitParam : 10;
	const cursor = url.searchParams.get('cursor');

	try {
		let whereClause = eq(tickets.userId, params.userId);
		if (cursor) {
			whereClause = and(whereClause, lt(tickets.createdAt, new Date(cursor)))!;
		}

		const userTickets = await db.query.tickets.findMany({
			where: whereClause,
			orderBy: [desc(tickets.createdAt)],
			limit: limit + 1,
			with: {
				items: {
					with: { menuItem: true }
				}
			}
		});

		let nextCursor: string | null = null;
		let hasNextPage = false;

		if (userTickets.length > limit) {
			hasNextPage = true;
			userTickets.pop();
			const lastItem = userTickets[userTickets.length - 1];
			nextCursor = lastItem.createdAt.toISOString();
		}

		return json({
			success: true,
			data: { tickets: userTickets, pagination: { nextCursor, hasNextPage, limit } }
		});
	} catch (error) {
		console.error('Failed to fetch orders:', error);
		return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
	}
};
