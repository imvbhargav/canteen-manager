import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { hashPin } from '$lib/server/auth'; // Sourced from your auth configuration utilities
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ locals, request }) => {
	// Guard: Ensure requester is logged in and is an Admin
	if (!locals.user) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	const adminCheck = await db.query.users.findFirst({
		where: eq(users.id, locals.user.id),
		columns: { role: true }
	});

	if (!adminCheck || adminCheck.role !== 'ADMIN') {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	// Extract the target student's user ID from the payload
	const { userId } = await request.json();
	if (!userId) {
		return json({ success: false, error: 'Target User ID is required' }, { status: 400 });
	}

	try {
		// Fetch the target student's record to read their roll number
		const targetUser = await db.query.users.findFirst({
			where: eq(users.id, userId),
			columns: { id: true, accountNumber: true, name: true }
		});

		if (!targetUser) {
			return json({ success: false, error: 'Student record not found' }, { status: 404 });
		}

		if (!targetUser.accountNumber || targetUser.accountNumber.trim().length < 5) {
			return json(
				{
					success: false,
					error: `Cannot reset PIN automatically. Student's roll number must be at least 5 characters long.`
				},
				{ status: 400 }
			);
		}

		// Extract the last 5 digits/characters of the roll number
		const sanitizedRoll = targetUser.accountNumber.trim();
		const rawDefaultPin = sanitizedRoll.slice(-5);

		// Securely hash the temporary fallback PIN string structure
		// Note: Make sure the target key matches your database schema column (pinHash vs pin)
		const newHashedPin = hashPin(rawDefaultPin);

		// Persist the update to the user row
		await db
			.update(users)
			.set({
				pinHash: newHashedPin,
				updatedAt: new Date()
			})
			.where(eq(users.id, targetUser.id));

		return json({
			success: true,
			message: `Successfully reset PIN for ${targetUser.name}.`,
			defaultPin: rawDefaultPin // Returns the RAW unhashed 5 digits so the Admin can read it to the student
		});
	} catch (error) {
		console.error('Admin PIN reset failed:', error);
		return json({ success: false, error: 'Internal server error' }, { status: 500 });
	}
};
