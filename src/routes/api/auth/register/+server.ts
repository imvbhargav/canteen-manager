import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, userSessions } from '$lib/server/db/schema';
import { eq, or } from 'drizzle-orm';
import { hashPin, generateSessionToken, hashSessionToken } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const { name, studentId, rollNumber, pin, deviceIdentifier = 'Web App' } = await request.json();

    if (!name || !studentId || !rollNumber || !pin) {
      return json({ success: false, error: 'All fields are required' }, { status: 400 });
    }

    if (pin.length !== 4) {
      return json({ success: false, error: 'PIN must be exactly 4 digits' }, { status: 400 });
    }

    // 1. Check for existing user to prevent duplicates
    const existingUser = await db.query.users.findFirst({
      where: or(
        eq(users.studentId, studentId),
        eq(users.rollNumber, rollNumber)
      )
    });

    if (existingUser) {
      return json({ success: false, error: 'Student ID or Roll Number already registered' }, { status: 409 });
    }

    // 2. Hash the PIN securely using the utility from auth.ts
    const hashedPin = hashPin(pin);

    // 3. Create the user in the database inside a transaction
    const result = await db.transaction(async (tx) => {
      const [newUser] = await tx.insert(users).values({
        name,
        studentId,
        rollNumber,
        pinHash: hashedPin,
        balance: '0.00', // Initialize with zero balance
        isActive: true
      }).returning();

      // 4. Generate and store session
      const sessionToken = generateSessionToken();
      const tokenHash = hashSessionToken(sessionToken);

      await tx.insert(userSessions).values({
        userId: newUser.id,
        deviceIdentifier,
        tokenHash,
        isRevoked: false
      });

      return { user: newUser, sessionToken };
    });

    // 5. Set the secure HttpOnly cookie
    cookies.set('session_id', result.sessionToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    return json({ success: true, message: 'Account created successfully' });
  } catch (error: unknown) {
    console.error('Registration error:', error);
    return json({ success: false, error: 'Failed to create account' }, { status: 500 });
  }
};