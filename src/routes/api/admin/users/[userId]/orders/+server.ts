import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { tickets } from '$lib/server/db/schema';
import { eq, and, lt, desc } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import {
	requireAdmin,
	getPaginationParams,
	processPagination,
	handleServerError
} from '$lib/server/api';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const auth = await requireAdmin(locals);
	if (!auth.authorized) {
		return auth.response!;
	}

	const { limit, cursor } = getPaginationParams(url, 10);

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

		const { hasNextPage, nextCursor } = processPagination(userTickets, limit);

		return json({
			success: true,
			data: { tickets: userTickets, pagination: { nextCursor, hasNextPage, limit } }
		});
	} catch (error) {
		return handleServerError(error, 'Failed to fetch orders');
	}
};
