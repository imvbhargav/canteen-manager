import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, userSessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { hashPin, generateSessionToken, hashSessionToken } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { name, rollNumber, pin, deviceIdentifier = 'Web App' } = await request.json();

		if (!name || !rollNumber || !pin) {
			return json({ success: false, error: 'All fields are required' }, { status: 400 });
		}

		if (pin.length !== 4) {
			return json({ success: false, error: 'PIN must be exactly 4 digits' }, { status: 400 });
		}

		// 1. Check for existing user by Roll Number only to prevent duplicates
		const existingUser = await db.query.users.findFirst({
			where: eq(users.rollNumber, rollNumber)
		});

		if (existingUser) {
			return json({ success: false, error: 'Roll Number already registered' }, { status: 409 });
		}

		// 2. Generate readable Student ID based on the current year and roll number
		// Example: STU-2026-10445
		const currentYear = new Date().getFullYear();
		const generatedStudentId = `STU-${currentYear}-${rollNumber}`;

		// 3. Hash the PIN securely using the utility from auth.ts
		const hashedPin = hashPin(pin);

		// 4. Create the user in the database inside a transaction
		const result = await db.transaction(async (tx) => {
			const [newUser] = await tx
				.insert(users)
				.values({
					name,
					studentId: generatedStudentId.toUpperCase(),
					rollNumber: rollNumber.toUpperCase(),
					pinHash: hashedPin,
					balance: '0.00', // Initialize with zero balance
					isActive: true
				})
				.returning();

			// 5. Generate and store session
			const sessionToken = generateSessionToken();
			const tokenHash = hashSessionToken(sessionToken);

			await tx.insert(userSessions).values({
				userId: newUser.id,
				deviceIdentifier,
				tokenHash,
				isRevoked: false,
				expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
			});

			return { user: newUser, sessionToken };
		});

		// 6. Set the secure HttpOnly cookie
		cookies.set('session_id', result.sessionToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 60 * 60 * 24 * 7
		});

		return json({ success: true, message: 'Account created successfully' });
	} catch (error: unknown) {
		console.error('Registration error:', error);
		return json({ success: false, error: 'Failed to create account' }, { status: 500 });
	}
};
