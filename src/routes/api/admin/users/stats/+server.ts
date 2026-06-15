import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { count, eq, not, sum } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	try {
		// Query both aggregates simultaneously
		const [stats] = await db
			.select({
				totalUsers: count(users.id),
				totalBalance: sum(users.balance)
			})
			.from(users)
			.where(not(eq(users.role, 'ADMIN')));

		return json({
			success: true,
			data: {
				totalUsers: stats?.totalUsers ?? 0,
				// sum() returns a string or null from PostgreSQL/MySQL, safe fallback to '0'
				totalBalance: stats?.totalBalance ?? '0'
			}
		});
	} catch (error) {
		console.error('Failed to fetch user dashboard stats:', error);
		return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
	}
};
