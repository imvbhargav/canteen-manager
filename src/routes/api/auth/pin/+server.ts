import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { hashPin } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	// Ensure user is authenticated
	if (!locals.user) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { currentPin, newPin } = await request.json();

		// Validate input format
		if (!currentPin || !newPin || currentPin.length !== 4 || newPin.length !== 4) {
			return json({ success: false, error: 'PINs must be exactly 4 digits' }, { status: 400 });
		}

		const userId = locals.user.id;

		// Fetch user from the database to verify the old PIN
		const user = await db.query.users.findFirst({
			where: eq(users.id, userId)
		});

		if (!user) {
			return json({ success: false, error: 'User not found' }, { status: 404 });
		}

		// Verify the current PIN
		// Assuming `hashPin` is a deterministic hash (like SHA-256) based on your registration code.
		// If you are using bcrypt/argon2, you should import and use a `verifyPin` function instead.
		const hashedCurrentPin = hashPin(currentPin);

		if (user.pinHash !== hashedCurrentPin) {
			return json({ success: false, error: 'Incorrect current PIN' }, { status: 403 });
		}

		// 5. Hash and update the new PIN
		const hashedNewPin = hashPin(newPin);

		await db.update(users).set({ pinHash: hashedNewPin }).where(eq(users.id, userId));

		return json({ success: true, message: 'PIN updated successfully' });
	} catch (error: unknown) {
		console.error('Failed to update PIN:', error);
		return json({ success: false, error: 'Internal server error' }, { status: 500 });
	}
};
