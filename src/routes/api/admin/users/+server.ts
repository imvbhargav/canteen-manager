import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { and, lt, desc, or, ilike, not, eq } from 'drizzle-orm';
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

	const { limit, cursor } = getPaginationParams(url, 15);
	const search = url.searchParams.get('search');
	const status = url.searchParams.get('status');

	try {
		const conditions = [];

		// Apply Search Filter
		if (search) {
			const searchPattern = `%${search}%`;
			conditions.push(
				or(
					ilike(users.name, searchPattern),
					ilike(users.accountNumber, searchPattern),
					ilike(users.referenceKey, searchPattern)
				)
			);
		}

		// Apply Status Filter Conditions
		if (status === 'active') {
			conditions.push(eq(users.isActive, true));
		} else if (status === 'inactive') {
			conditions.push(eq(users.isActive, false));
		}

		// Apply Cursor Pagination
		if (cursor) {
			conditions.push(lt(users.createdAt, new Date(cursor)));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const userRecords = await db.query.users.findMany({
			// Ensure status filtering plays nice with excluding other admins
			where: and(whereClause, not(eq(users.role, 'ADMIN'))),
			orderBy: [desc(users.createdAt)],
			limit: limit + 1,
			columns: {
				id: true,
				name: true,
				referenceKey: true,
				accountNumber: true,
				role: true,
				balance: true,
				isActive: true,
				createdAt: true
			}
		});

		const { hasNextPage, nextCursor } = processPagination(userRecords, limit);

		return json({
			success: true,
			data: {
				users: userRecords,
				pagination: { nextCursor, hasNextPage, limit }
			}
		});
	} catch (error) {
		return handleServerError(error, 'Failed to fetch users');
	}
};
