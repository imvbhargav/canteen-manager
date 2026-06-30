import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { walletTransactions } from '$lib/server/db/schema';
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

	const { limit, cursor } = getPaginationParams(url, 15);

	try {
		let whereClause = eq(walletTransactions.userId, params.userId);
		if (cursor) {
			whereClause = and(whereClause, lt(walletTransactions.createdAt, new Date(cursor)))!;
		}

		const transactions = await db.query.walletTransactions.findMany({
			where: whereClause,
			orderBy: [desc(walletTransactions.createdAt)],
			limit: limit + 1
		});

		const { hasNextPage, nextCursor } = processPagination(transactions, limit);

		return json({
			success: true,
			data: { transactions, pagination: { nextCursor, hasNextPage, limit } }
		});
	} catch (error) {
		return handleServerError(error, 'Failed to fetch transactions');
	}
};
