import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userSessions } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { requireUser, handleServerError } from '$lib/server/api';

export const POST: RequestHandler = async ({ locals }) => {
	const userAuth = requireUser(locals);
	if (!userAuth.authenticated) {
		return userAuth.response!;
	}

	const userId = userAuth.user!.id;

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
		return handleServerError(error, 'Device logout failed', 'Failed to sign out of other devices');
	}
};
