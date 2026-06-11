import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) return json({ success: false, error: 'Unauthorized' }, { status: 401 });

	// Verify Admin Role
	const adminCheck = await db.query.users.findFirst({
		where: eq(users.id, locals.user.id),
		columns: { role: true }
	});
	if (!adminCheck || adminCheck.role !== 'ADMIN')
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });

	try {
		const targetUser = await db.query.users.findFirst({
			where: eq(users.id, params.userId),
			columns: {
				id: true,
				studentId: true,
				name: true,
				rollNumber: true,
				balance: true,
				isActive: true,
				createdAt: true
			}
		});

		if (!targetUser) return json({ success: false, error: 'User not found' }, { status: 404 });

		return json({ success: true, data: targetUser });
	} catch (error) {
		console.error('Failed to fetch user:', error);
		return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
	}
};
