import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, loginAttempts } from '$lib/server/db/schema'; // Import loginAttempts
import { eq, and, sql, count } from 'drizzle-orm';
import { hashPin, verifyPin } from '$lib/server/auth';
import type { RequestHandler } from './$types';

// Rate Limiting Configuration
const MAX_ATTEMPTS = 5;
const LOCKOUT_HOURS = 1;

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
	// Ensure user is authenticated
	if (!locals.user) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const userId = locals.user.id;
		const clientIp = getClientAddress();

		// Create a unique identifier for this specific action
		const actionIdentifier = `PIN_CHANGE_${userId}`;

		// Check Rate Limit
		const recentAttempts = await db
			.select({ value: count() })
			.from(loginAttempts)
			.where(
				and(
					eq(loginAttempts.identifier, actionIdentifier),
					sql`${loginAttempts.attemptedAt} > NOW() - INTERVAL '${sql.raw(`${LOCKOUT_HOURS} hour`)}'`
				)
			);

		const attemptCount = recentAttempts[0]?.value ?? 0;

		if (attemptCount >= MAX_ATTEMPTS) {
			return json(
				{ success: false, error: 'Too many failed PIN attempts. Please try again in an hour.' },
				{ status: 429, headers: { 'Retry-After': String(LOCKOUT_HOURS * 60 * 60) } }
			);
		}

		// Parse and Validate Input
		const { currentPin, newPin } = await request.json();

		if (!currentPin || !newPin || currentPin.length !== 4 || newPin.length !== 4) {
			return json({ success: false, error: 'PINs must be exactly 4 digits' }, { status: 400 });
		}

		// Log this attempt immediately (before checking if it's correct)
		await db.insert(loginAttempts).values({
			ipAddress: clientIp,
			identifier: actionIdentifier
		});

		// Fetch user to verify the old PIN
		const user = await db.query.users.findFirst({
			where: eq(users.id, userId)
		});

		if (!user || !user.pinHash || !user.isActive) {
			return json(
				{ success: false, error: 'Invalid credentials or account disabled' },
				{ status: 401 }
			);
		}

		// Verify the current PIN
		const isValid = verifyPin(currentPin, user.pinHash);

		if (!isValid) {
			return json({ success: false, error: 'Incorrect current PIN' }, { status: 403 });
		}

		// Clear the attempts history on success (so they have a fresh slate next time)
		await db.delete(loginAttempts).where(eq(loginAttempts.identifier, actionIdentifier));

		// Hash and update the new PIN
		const hashedNewPin = hashPin(newPin);

		await db.update(users).set({ pinHash: hashedNewPin }).where(eq(users.id, userId));

		return json({ success: true, message: 'PIN updated successfully' });
	} catch (error: unknown) {
		console.error('Failed to update PIN:', error);
		return json({ success: false, error: 'Internal server error' }, { status: 500 });
	}
};
