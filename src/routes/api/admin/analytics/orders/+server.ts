import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { tickets } from '$lib/server/db/schema';
import { eq, and, gte, lte, lt, desc, inArray } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import {
	requireAdmin,
	getPaginationParams,
	processPagination,
	handleServerError
} from '$lib/server/api';

export const GET: RequestHandler = async ({ locals, url }) => {
	const auth = await requireAdmin(locals, {
		adminStatus: 403
	});
	if (!auth.authorized) {
		return auth.response!;
	}

	try {
		const ticketReference = url.searchParams.get('ticketReference');
		const startDateParam = url.searchParams.get('startDate');
		const endDateParam = url.searchParams.get('endDate');
		const statusParam = url.searchParams.get('status');

		const { limit, cursor } = getPaginationParams(url, 15);

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

		const { hasNextPage, nextCursor } = processPagination(orderRecords, limit);

		return json({
			success: true,
			data: {
				orders: orderRecords,
				pagination: { nextCursor, hasNextPage }
			}
		});
	} catch (error) {
		return handleServerError(error, 'Failed to stream analytical orders');
	}
};
