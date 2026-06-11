import type { Handle } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userSessions } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { hashSessionToken } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get('session_id');

	if (!sessionToken) {
		event.locals.user = null;
		event.locals.sessionId = null;
		return resolve(event);
	}

	const tokenHash = hashSessionToken(sessionToken);

	const sessionRecord = await db.query.userSessions.findFirst({
		where: and(
			eq(userSessions.tokenHash, tokenHash),
			eq(userSessions.isRevoked, false),
			eq(userSessions.expiresAt, new Date())
		),
		with: {
			user: {
				columns: { id: true, studentId: true, name: true, isActive: true }
			}
		}
	});

	if (sessionRecord && sessionRecord.user && sessionRecord.user.isActive) {
		event.locals.user = {
			id: sessionRecord.user.id,
			studentId: sessionRecord.user.studentId,
			name: sessionRecord.user.name
		};
		event.locals.sessionId = sessionRecord.id;
	} else {
		event.locals.user = null;
		event.locals.sessionId = null;
		event.cookies.delete('session_id', { path: '/' });
	}

	return resolve(event);
};
