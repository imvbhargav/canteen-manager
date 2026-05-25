import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userSessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, cookies }) => {
  const sessionId = locals.sessionId;

  try {
    if (sessionId) {
      // Revoke this exact session in the database
      await db.update(userSessions)
        .set({ isRevoked: true })
        .where(eq(userSessions.id, sessionId));
    }

    // Always clear the cookie regardless
    cookies.delete('session_id', { path: '/' });

    return json({ success: true, message: 'Logged out successfully' });
  } catch (error: unknown) {
    console.error('Logout error:', error);
    return json({ success: false, error: 'Failed to logout' }, { status: 500 });
  }
};