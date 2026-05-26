import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, userSessions } from '$lib/server/db/schema';
import { eq, or } from 'drizzle-orm';
import { generateSessionToken, hashSessionToken, verifyPin } from '$lib/server/auth';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    // Replaced studentId with a generic identifier
    const { identifier, pin, deviceIdentifier = 'Web App' } = await request.json();

    if (!identifier || !pin) {
      return json({ success: false, error: 'Missing credentials' }, { status: 400 });
    }

    // 1. Find User by checking both studentId and rollNumber
    const user = await db.query.users.findFirst({
      where: or(
        eq(users.studentId, identifier),
        eq(users.rollNumber, identifier)
      )
    });

    if (!user || !user.pinHash || !user.isActive) {
      return json({ success: false, error: 'Invalid credentials or account disabled' }, { status: 401 });
    }

    // 2. Verify PIN
    const isValid = verifyPin(pin, user.pinHash);
    
    if (!isValid) {
      return json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    // 3. Create Session
    const sessionToken = generateSessionToken();
    const tokenHash = hashSessionToken(sessionToken);

    await db.insert(userSessions).values({
      userId: user.id,
      deviceIdentifier,
      tokenHash,
      isRevoked: false
    });

    // 4. Set Secure Cookie
    cookies.set('session_id', sessionToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: !dev,
      maxAge: 60 * 60 * 24 * 7
    });

    return json({ success: true, message: 'Logged in successfully' });
  } catch (error: unknown) {
    console.error('Login error:', error);
    return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
};