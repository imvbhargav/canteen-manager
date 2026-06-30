import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { walletTransactions } from '$lib/server/db/schema';
import { eq, and, lt, desc, sql } from 'drizzle-orm';
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

	// Parse Pagination Params
	const { limit, cursor } = getPaginationParams(url, 15);

	try {
		// Fetch Aggregate Statistics (Total Added, Total Spent)
		const statsQuery = await db
			.select({
				type: walletTransactions.type,
				total: sql<number>`sum(${walletTransactions.amount})`
			})
			.from(walletTransactions)
			.where(eq(walletTransactions.userId, userId))
			.groupBy(walletTransactions.type);

		let totalAdded = 0;
		let totalSpent = 0;

		for (const row of statsQuery) {
			if (row.type === 'CREDIT') totalAdded = Number(row.total);
			if (row.type === 'DEBIT') totalSpent = Number(row.total);
		}

		// Build Cursor Pagination Condition
		let whereClause = eq(walletTransactions.userId, userId);
		if (cursor) {
			whereClause = and(whereClause, lt(walletTransactions.createdAt, new Date(cursor)))!;
		}

		// Fetch Transactions
		const transactions = await db.query.walletTransactions.findMany({
			where: whereClause,
			orderBy: [desc(walletTransactions.createdAt)],
			limit: limit + 1, // Request 1 extra to check for next page
			columns: {
				id: true,
				type: true,
				amount: true,
				description: true,
				createdAt: true
			}
		});

		// Resolve Next Cursor
		const { hasNextPage, nextCursor } = processPagination(transactions, limit);

		return json({
			success: true,
			data: {
				stats: { totalAdded, totalSpent },
				transactions,
				pagination: {
					nextCursor,
					hasNextPage,
					limit
				}
			}
		});
	} catch (error) {
		return handleServerError(error, 'Failed to fetch history');
	}
};
