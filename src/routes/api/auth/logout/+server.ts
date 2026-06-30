import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userSessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { handleServerError } from '$lib/server/api';

export const POST: RequestHandler = async ({ locals, cookies }) => {
	const sessionId = locals.sessionId;

	try {
		if (sessionId) {
			// Revoke this exact session in the database
			await db.update(userSessions).set({ isRevoked: true }).where(eq(userSessions.id, sessionId));
		}

		// Always clear the cookie regardless
		cookies.delete('session_id', { path: '/' });

		return json({ success: true, message: 'Logged out successfully' });
	} catch (error: unknown) {
		return handleServerError(error, 'Logout error', 'Failed to logout');
	}
};
