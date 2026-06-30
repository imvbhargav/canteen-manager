import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, userSessions, loginAttempts } from '$lib/server/db/schema';
import { eq, or, and, sql, count } from 'drizzle-orm';
import { generateSessionToken, hashSessionToken, verifyPin } from '$lib/server/auth';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { handleServerError } from '$lib/server/api';

// Rate Limiting Configuration
const MAX_ATTEMPTS = 5;
const LOCKOUT_HOURS = 1;

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	try {
		// Parse Request
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

		// Normalize identifier right away to prevent bypasses like 'student123' vs 'STUDENT123'
		const normalizedIdentifier = identifier.toUpperCase();
		const clientIp = getClientAddress();

		// Check User-Level Rate Limit
		const recentAttempts = await db
			.select({ value: count() })
			.from(loginAttempts)
			.where(
				and(
					eq(loginAttempts.identifier, normalizedIdentifier),
					sql`${loginAttempts.attemptedAt} > NOW() - INTERVAL '${sql.raw(`${LOCKOUT_HOURS} hour`)}'`
				)
			);

		const attemptCount = recentAttempts[0]?.value ?? 0;

		if (attemptCount >= MAX_ATTEMPTS) {
			return json(
				{
					success: false,
					error: 'Too many failed attempts on this account. Please try again in an hour.'
				},
				{ status: 429, headers: { 'Retry-After': String(LOCKOUT_HOURS * 60 * 60) } }
			);
		}

		// Log this attempt immediately (captures the brute force signature)
		await db.insert(loginAttempts).values({
			ipAddress: clientIp,
			identifier: normalizedIdentifier
		});

		// Validate User against Database
		const user = await db.query.users.findFirst({
			where: or(
				eq(users.accountNumber, normalizedIdentifier),
				eq(users.referenceKey, normalizedIdentifier)
			),
			columns: {
				id: true,
				pinHash: true,
				isActive: true,
				role: true,
				name: true,
				referenceKey: true,
				deactivationReason: true
			}
		});

		if (!user || !user.pinHash) {
			return json(
				{ success: false, error: 'Invalid credentials or account disabled' },
				{ status: 401 }
			);
		}

		if (!user.isActive) {
			return json(
				{
					success: false,
					error: `Account deactivated`,
					isDeactivated: true,
					reason: user.deactivationReason || 'No specific reason provided.'
				},
				{ status: 401 }
			);
		}

		const isValid = verifyPin(pin.toUpperCase(), user.pinHash);

		if (!isValid) {
			return json({ success: false, error: 'Invalid credentials' }, { status: 401 });
		}

		// Clear history on successful login so they have a fresh slate next time
		await db.delete(loginAttempts).where(eq(loginAttempts.identifier, normalizedIdentifier));

		// Create Session
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
			data: { name: user.name, id: user.referenceKey },
			role: user.role,
			message: 'Logged in successfully'
		});
	} catch (err) {
		return handleServerError(err, 'Login error');
	}
};
