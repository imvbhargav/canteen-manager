import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { requireAdmin, handleServerError } from '$lib/server/api';

export const GET: RequestHandler = async ({ locals, params }) => {
	const auth = await requireAdmin(locals);
	if (!auth.authorized) {
		return auth.response!;
	}

	try {
		const targetUser = await db.query.users.findFirst({
			where: eq(users.id, params.userId)
		});

		if (!targetUser) return json({ success: false, error: 'User not found' }, { status: 404 });

		return json({ success: true, data: targetUser });
	} catch (error) {
		return handleServerError(error, 'Failed to fetch user');
	}
};
