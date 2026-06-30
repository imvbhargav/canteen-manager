import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { tickets } from '$lib/server/db/schema';
import { eq, and, lt, desc, count, inArray } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import {
	requireUser,
	getPaginationParams,
	processPagination,
	handleServerError
} from '$lib/server/api';

export const GET: RequestHandler = async ({ locals, url }) => {
	const userAuth = requireUser(locals);
	if (!userAuth.authenticated) {
		return userAuth.response!;
	}

	const userId = userAuth.user!.id;

	// Parse Pagination & Filter Params
	const { limit, cursor } = getPaginationParams(url, 10);
	const statuses = url.searchParams.getAll('status'); // e.g., ?status=PENDING&status=READY

	try {
		// Fetch Aggregate Statistics (Total, Pending, Success, Cancelled)
		const statsQuery = await db
			.select({
				status: tickets.status,
				count: count()
			})
			.from(tickets)
			.where(eq(tickets.userId, userId))
			.groupBy(tickets.status);

		const stats = {
			total: 0,
			PENDING: 0,
			READY: 0,
			COMPLETED: 0,
			CANCELLED: 0
		};

		for (const row of statsQuery) {
			stats[row.status as keyof typeof stats] = Number(row.count);
			stats.total += Number(row.count);
		}

		// Build Where Clause
		const filters = [eq(tickets.userId, userId)];

		if (statuses.length > 0) {
			// @ts-expect-error - mapping string to enum type safely
			filters.push(inArray(tickets.status, statuses));
		}

		if (cursor) {
			filters.push(lt(tickets.createdAt, new Date(cursor)));
		}

		// Fetch Tickets + Joined Items
		const userTickets = await db.query.tickets.findMany({
			where: and(...filters),
			orderBy: [desc(tickets.createdAt)],
			limit: limit + 1,
			with: {
				items: {
					with: {
						menuItem: true
					}
				}
			}
		});

		// Resolve Next Cursor
		const { hasNextPage, nextCursor } = processPagination(userTickets, limit);

		return json({
			success: true,
			data: {
				stats,
				tickets: userTickets,
				pagination: {
					nextCursor,
					hasNextPage,
					limit
				}
			}
		});
	} catch (error) {
		return handleServerError(error, 'Failed to fetch orders');
	}
};
