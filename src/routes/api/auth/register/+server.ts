import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, userSessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { hashPin, generateSessionToken, hashSessionToken } from '$lib/server/auth';
import { IMAGE_STORAGE_PROVIDER, R2_PUBLIC_DOMAIN } from '$env/static/private';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const {
			name,
			accountNumber,
			pin,
			credentialImage,
			batch,
			deviceIdentifier = 'Web App'
		} = await request.json();

		if (!name || !accountNumber || !pin || !credentialImage) {
			return json(
				{ success: false, error: 'All fields including ID verification are required' },
				{ status: 400 }
			);
		}

		const cleanAccount = accountNumber.trim().toUpperCase();
		const cleanPin = pin.trim().toUpperCase();

		const alphanumericRegex = /^[A-Z0-9]+$/;
		if (!alphanumericRegex.test(cleanAccount)) {
			return json(
				{ success: false, error: 'Account Number must contain only letters and numbers' },
				{ status: 400 }
			);
		}
		if (cleanPin.length !== 5 || !alphanumericRegex.test(cleanPin)) {
			return json(
				{ success: false, error: 'PIN must be exactly 5 alphanumeric characters' },
				{ status: 400 }
			);
		}

		const existingUser = await db.query.users.findFirst({
			where: eq(users.accountNumber, cleanAccount)
		});

		if (existingUser) {
			return json({ success: false, error: 'Account Number already registered' }, { status: 409 });
		}

		// Parse Batch Year strings (e.g., "2022 - 2026")
		let parsedBatchStart = new Date().getFullYear();
		let parsedBatchEnd = parsedBatchStart + 4;
		if (batch && batch.includes('-')) {
			const parts = batch.split('-').map((p: string) => parseInt(p.trim(), 10));
			if (!isNaN(parts[0])) parsedBatchStart = parts[0];
			if (!isNaN(parts[1])) parsedBatchEnd = parts[1];
		}

		const generatedReferenceKey = `${name
			.replace(/[^a-zA-Z]/g, '')
			.slice(0, 3)
			.toUpperCase()}${cleanAccount}`;
		const hashedPin = hashPin(cleanPin);

		let finalCredentialUrl = credentialImage;
		if (IMAGE_STORAGE_PROVIDER === 'R2') {
			finalCredentialUrl = `${R2_PUBLIC_DOMAIN.replace(/\/$/, '')}/${credentialImage}`;
		}

		const result = await db.transaction(async (tx) => {
			const [newUser] = await tx
				.insert(users)
				.values({
					name: name.trim(),
					referenceKey: generatedReferenceKey,
					accountNumber: cleanAccount,
					pinHash: hashedPin,
					credentialPhotoUrl: finalCredentialUrl,
					batchYear: parsedBatchStart,
					expectedGraduationYear: parsedBatchEnd,
					isActive: false,
					deactivationReason: 'verification'
				})
				.returning();

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

		cookies.set('session_id', result.sessionToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 60 * 60 * 24 * 7
		});

		return json({ success: true, message: 'Account registered and awaiting admin activation' });
	} catch (error: unknown) {
		console.error('Registration error:', error);
		return json({ success: false, error: 'Failed to create account' }, { status: 500 });
	}
};
