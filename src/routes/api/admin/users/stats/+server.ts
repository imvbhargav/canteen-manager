import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { count, eq, not, sum } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { requireUser, handleServerError } from '$lib/server/api';

export const GET: RequestHandler = async ({ locals }) => {
	const userAuth = requireUser(locals);
	if (!userAuth.authenticated) {
		return userAuth.response!;
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
		return handleServerError(error, 'Failed to fetch user dashboard stats');
	}
};
