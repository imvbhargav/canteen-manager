import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { tickets, users } from '$lib/server/db/schema';
import { eq, and, gte, lte, lt, desc, inArray } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return json({ success: false, error: 'Unauthorized' }, { status: 401 });

	const adminCheck = await db.query.users.findFirst({
		where: eq(users.id, locals.user.id),
		columns: { role: true }
	});
	if (!adminCheck || adminCheck.role !== 'ADMIN') {
		return json({ success: false, error: 'Unauthorized' }, { status: 403 });
	}

	try {
		const ticketReference = url.searchParams.get('ticketReference');
		const startDateParam = url.searchParams.get('startDate');
		const endDateParam = url.searchParams.get('endDate');
		const statusParam = url.searchParams.get('status');
		const cursor = url.searchParams.get('cursor');

		const limitParam = parseInt(url.searchParams.get('limit') || '15', 10);
		const limit = limitParam > 0 && limitParam <= 50 ? limitParam : 15;

		let conditions;

		if (ticketReference) {
			conditions = eq(tickets.ticketReference, ticketReference.toUpperCase());
		} else {
			if (!startDateParam || !endDateParam) {
				return json(
					{
						success: false,
						error: 'Missing date boundary values or a ticket reference'
					},
					{ status: 400 }
				);
			}

			const queryConditions = [
				gte(tickets.createdAt, new Date(startDateParam)),
				lte(tickets.createdAt, new Date(endDateParam))
			];

			if (statusParam) {
				const parsedStatuses = statusParam
					.split(',')
					.map(
						(s) =>
							s.trim().toUpperCase() as
								| 'PENDING'
								| 'PRINTING'
								| 'COMPLETED'
								| 'FAILED'
								| 'CANCELLED'
					)
					.filter((s) => ['PENDING', 'PRINTING', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(s));

				if (parsedStatuses.length > 0) {
					queryConditions.push(inArray(tickets.status, parsedStatuses));
				}
			}

			if (cursor) {
				queryConditions.push(lt(tickets.createdAt, new Date(cursor)));
			}

			conditions = and(...queryConditions);
		}

		const orderRecords = await db.query.tickets.findMany({
			where: conditions,
			orderBy: [desc(tickets.createdAt)],
			limit: limit + 1,
			with: {
				user: {
					columns: { name: true, referenceKey: true, accountNumber: true }
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
			orderRecords.pop();
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
