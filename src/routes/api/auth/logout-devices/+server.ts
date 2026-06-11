import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userSessions } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user || !locals.sessionId) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;

	try {
		await db
			.update(userSessions)
			.set({ isRevoked: true })
			.where(and(eq(userSessions.userId, userId)));

		return json({
			success: true,
			message: 'Successfully signed out of all other devices.'
		});
	} catch (error) {
		console.error('Device logout failed:', error);
		return json(
			{
				success: false,
				error: 'Failed to sign out of other devices'
			},
			{ status: 500 }
		);
	}
};
