import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, manualOrderOtps } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ locals, request }) => {
	// Guard: Ensure requester is an Admin
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

	// Fixed: Expect "userId" instead of "studentId" to match front-end context
	const { userId } = await request.json();
	if (!userId) {
		return json({ success: false, error: 'User ID is required' }, { status: 400 });
	}

	try {
		// Query directly by primary database ID key
		const targetUser = await db.query.users.findFirst({
			where: eq(users.id, userId)
		});

		if (!targetUser || !targetUser.isActive) {
			return json({ success: false, error: 'Active student not found' }, { status: 404 });
		}

		// Generate a secure 6-digit OTP string
		const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
		const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // Valid for 5 minutes

		await db.insert(manualOrderOtps).values({
			userId: targetUser.id,
			otpCode,
			status: 'PENDING',
			expiresAt
		});

		return json({
			success: true,
			otpCode,
			expiresAt: expiresAt.toISOString(),
			targetUser: {
				name: targetUser.name,
				rollNumber: targetUser.accountNumber
			}
		});
	} catch (error) {
		console.error('Failed to generate manual OTP:', error);
		return json({ success: false, error: 'Internal server error' }, { status: 500 });
	}
};
