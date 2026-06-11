import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { and, lt, desc, or, ilike } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	// Basic auth check (You might want to explicitly check locals.user.role === 'ADMIN' here)
	if (!locals.user) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	const limitParam = parseInt(url.searchParams.get('limit') || '15', 10);
	const limit = limitParam > 0 && limitParam <= 50 ? limitParam : 15;
	const cursor = url.searchParams.get('cursor');
	const search = url.searchParams.get('search');

	try {
		const conditions = [];

		// Apply Search Filter
		if (search) {
			const searchPattern = `%${search}%`;
			conditions.push(
				or(
					ilike(users.name, searchPattern),
					ilike(users.rollNumber, searchPattern),
					ilike(users.studentId, searchPattern)
				)
			);
		}

		// Apply Cursor Pagination
		if (cursor) {
			conditions.push(lt(users.createdAt, new Date(cursor)));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const userRecords = await db.query.users.findMany({
			where: whereClause,
			orderBy: [desc(users.createdAt)],
			limit: limit + 1,
			columns: {
				id: true,
				studentId: true,
				name: true,
				rollNumber: true,
				role: true,
				balance: true,
				isActive: true,
				createdAt: true
			}
		});

		let nextCursor: string | null = null;
		let hasNextPage = false;

		if (userRecords.length > limit) {
			hasNextPage = true;
			userRecords.pop();
			const lastItem = userRecords[userRecords.length - 1];
			nextCursor = lastItem.createdAt.toISOString();
		}

		return json({
			success: true,
			data: {
				users: userRecords,
				pagination: { nextCursor, hasNextPage, limit }
			}
		});
	} catch (error) {
		console.error('Failed to fetch users:', error);
		return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
	}
};
