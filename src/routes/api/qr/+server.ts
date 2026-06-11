import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { counters } from '$lib/server/db/schema';
import qr from 'qr-image';
import type { RequestHandler } from './$types';
import { encryptCounterId } from '$lib/crypto';
import { eq } from 'drizzle-orm';
import { users } from '$lib/server/db/schema';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	const user = await db.query.users.findFirst({
		where: eq(users.id, locals.user.id),
		columns: {
			role: true
		}
	});

	if (!user || user.role !== 'ADMIN') {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	// Check if a specific counter ID was requested
	const counterId = url.searchParams.get('counterId');

	try {
		let activeCounters = [];

		if (counterId) {
			// Fetch single counter
			activeCounters = await db.select().from(counters).where(eq(counters.id, counterId));
		} else {
			// Fetch all counters
			activeCounters = await db.select().from(counters);
		}

		if (activeCounters.length === 0) {
			return json({ success: false, error: 'No counters found in the database.' }, { status: 404 });
		}

		const counterQrs = activeCounters.map((counter) => {
			const encryptedPayload = encryptCounterId(counter.id);

			// Generate PNG image buffer
			const qrBuffer = qr.imageSync(encryptedPayload, {
				type: 'png',
				margin: 4,
				ec_level: 'H' // High error correction
			});

			const qrDataBase64 = `data:image/png;base64,${qrBuffer.toString('base64')}`;
			const safeName = `counter-${counter.counterNumber}-${counter.displayName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;

			return {
				id: counter.id,
				counterNumber: counter.counterNumber,
				displayName: counter.displayName,
				fileName: safeName,
				qrImage: qrDataBase64
			};
		});

		return json({ success: true, counters: counterQrs });
	} catch (error: unknown) {
		console.error('Serverless QR generation failed:', error);
		return json({ success: false, error: 'Failed to generate counter QR codes' }, { status: 500 });
	}
};
