import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, userSessions } from '$lib/server/db/schema';
import { eq, or } from 'drizzle-orm';
import { generateSessionToken, hashSessionToken, verifyPin } from '$lib/server/auth';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const {
			identifier,
			pin,
			deviceIdentifier = 'Web App'
		} = (await request.json()) as {
			identifier: string;
			pin: string;
			deviceIdentifier?: string;
		};

		if (!identifier || !pin) {
			return json({ success: false, error: 'Missing credentials' }, { status: 400 });
		}

		const normalizedIdentifier = identifier.toUpperCase();
		const user = await db.query.users.findFirst({
			where: or(
				eq(users.studentId, normalizedIdentifier),
				eq(users.rollNumber, normalizedIdentifier)
			),
			columns: {
				id: true,
				pinHash: true,
				isActive: true,
				role: true,
				name: true,
				rollNumber: true
			}
		});

		if (!user || !user.pinHash || !user.isActive) {
			return json(
				{ success: false, error: 'Invalid credentials or account disabled' },
				{ status: 401 }
			);
		}

		const isValid = verifyPin(pin, user.pinHash);

		if (!isValid) {
			return json({ success: false, error: 'Invalid credentials' }, { status: 401 });
		}

		const sessionToken = generateSessionToken();
		const tokenHash = hashSessionToken(sessionToken);

		await db.insert(userSessions).values({
			userId: user.id,
			deviceIdentifier,
			tokenHash,
			isRevoked: false,
			expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
		});

		cookies.set('session_id', sessionToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev,
			maxAge: 60 * 60 * 24 * 7
		});

		return json({
			success: true,
			data: { name: user.name, roll: user.rollNumber },
			role: user.role,
			message: 'Logged in successfully'
		});
	} catch {
		return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
	}
};
