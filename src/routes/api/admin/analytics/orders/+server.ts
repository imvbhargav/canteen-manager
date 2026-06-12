import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { tickets, users } from '$lib/server/db/schema';
import { eq, and, gte, lte, lt, desc } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	// Admin Check
	if (!locals.user) return json({ success: false, error: 'Unauthorized' }, { status: 401 });

	const adminCheck = await db.query.users.findFirst({
		where: eq(users.id, locals.user.id),
		columns: { role: true }
	});
	if (!adminCheck || adminCheck.role !== 'ADMIN') {
		return json({ success: false, error: 'Unauthorized' }, { status: 403 });
	}

	try {
		// Date parsing parameters
		const startDateParam = url.searchParams.get('startDate');
		const endDateParam = url.searchParams.get('endDate');
		const cursor = url.searchParams.get('cursor'); // Expected to be an ISO timestamp

		const limitParam = parseInt(url.searchParams.get('limit') || '15', 10);
		const limit = limitParam > 0 && limitParam <= 50 ? limitParam : 15;

		if (!startDateParam || !endDateParam) {
			return json({ success: false, error: 'Missing date boundary values' }, { status: 400 });
		}

		// Base filter setup
		let conditions = and(
			gte(tickets.createdAt, new Date(startDateParam)),
			lte(tickets.createdAt, new Date(endDateParam))
		);

		// Append cursor condition if paginating
		if (cursor) {
			conditions = and(conditions, lt(tickets.createdAt, new Date(cursor)));
		}

		const orderRecords = await db.query.tickets.findMany({
			where: conditions,
			orderBy: [desc(tickets.createdAt)],
			limit: limit + 1, // Fetch an extra record to determine next page
			with: {
				user: {
					columns: { name: true, studentId: true, rollNumber: true }
				},
				items: {
					with: {
						menuItem: { columns: { name: true, dietary: true } }
					}
				}
			}
		});

		let nextCursor: string | null = null;
		let hasNextPage = false;

		if (orderRecords.length > limit) {
			hasNextPage = true;
			orderRecords.pop(); // Remove the extra check element
			const lastItem = orderRecords[orderRecords.length - 1];
			nextCursor = lastItem.createdAt.toISOString();
		}

		return json({
			success: true,
			data: {
				orders: orderRecords,
				pagination: { nextCursor, hasNextPage }
			}
		});
	} catch (error) {
		console.error('Failed to stream analytical orders:', error);
		return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
	}
};
