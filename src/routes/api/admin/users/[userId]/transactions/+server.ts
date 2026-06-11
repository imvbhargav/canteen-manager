import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { walletTransactions, users } from '$lib/server/db/schema';
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

	const limitParam = parseInt(url.searchParams.get('limit') || '15', 10);
	const limit = limitParam > 0 && limitParam <= 50 ? limitParam : 15;
	const cursor = url.searchParams.get('cursor');

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

		let nextCursor: string | null = null;
		let hasNextPage = false;

		if (transactions.length > limit) {
			hasNextPage = true;
			transactions.pop();
			const lastItem = transactions[transactions.length - 1];
			nextCursor = lastItem.createdAt.toISOString();
		}

		return json({
			success: true,
			data: { transactions, pagination: { nextCursor, hasNextPage, limit } }
		});
	} catch (error) {
		console.error('Failed to fetch transactions:', error);
		return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
	}
};
