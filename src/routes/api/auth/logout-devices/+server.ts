import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userSessions } from '$lib/server/db/schema';
import { and, eq, not } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
  const userId = "ENTER_USER_UUID_HERE";
  
  // The token of the device currently making the request
  const currentSessionToken = cookies.get('session_id') || ''; 

  try {
    // Revoke all sessions EXCEPT the current one
    await db.update(userSessions)
      .set({ isRevoked: true })
      .where(
        and(
          eq(userSessions.userId, userId),
          not(eq(userSessions.tokenHash, currentSessionToken)) // Requires hashed token in DB
        )
      );

    return json({ success: true, message: 'All other devices signed out.' });
  } catch (error) {
    console.error('Device logout failed:', error);
    return json({ success: false, error: 'Failed to manage devices' }, { status: 500 });
  }
};