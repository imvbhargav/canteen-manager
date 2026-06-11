import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { walletTransactions } from '$lib/server/db/schema';
import { eq, and, lt, desc, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;

	// Parse Pagination Params
	const limitParam = parseInt(url.searchParams.get('limit') || '15', 10);
	const limit = limitParam > 0 && limitParam <= 50 ? limitParam : 15;
	const cursor = url.searchParams.get('cursor');

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
		let nextCursor: string | null = null;
		let hasNextPage = false;

		if (transactions.length > limit) {
			hasNextPage = true;
			transactions.pop(); // Remove the extra checking item
			const lastItem = transactions[transactions.length - 1];
			nextCursor = lastItem.createdAt.toISOString();
		}

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
		console.error('Failed to fetch history:', error);
		return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
	}
};
