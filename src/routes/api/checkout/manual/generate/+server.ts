import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, manualOrderOtps, engines } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { requireAdmin, isEngineAlive, handleServerError } from '$lib/server/api';

export const POST: RequestHandler = async ({ locals, request }) => {
	const auth = await requireAdmin(locals);
	if (!auth.authorized) {
		return auth.response!;
	}

	const { userId } = (await request.json()) as { userId: string };
	if (!userId) {
		return json({ success: false, error: 'User ID is required' }, { status: 400 });
	}

	try {
		// Fetch target user details and active engine configuration concurrently
		const [targetUser, activeEngine] = await Promise.all([
			db.query.users.findFirst({
				where: eq(users.id, userId)
			}),
			db.query.engines.findFirst({
				where: eq(engines.isOn, true)
			})
		]);

		// Identity Guard
		if (!targetUser || !targetUser.isActive) {
			return json({ success: false, error: 'Active student not found' }, { status: 404 });
		}

		// Global Engine Heartbeat Validation Guard
		if (!activeEngine || !isEngineAlive(activeEngine.lastPingedAt)) {
			return json(
				{
					success: false,
					error: 'Action rejected: No active order processing engine is online right now.'
				},
				{ status: 400 }
			);
		}

		// 3. Complete Generation Parameters
		const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
		const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

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
		return handleServerError(error, 'Failed to generate manual OTP', 'Internal server error');
	}
};
