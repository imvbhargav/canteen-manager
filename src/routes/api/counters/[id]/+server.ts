import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { counters, counterStatusLogs } from '$lib/server/db/schema';
import { handleServerError } from '$lib/server/api';

// PATCH: Update counter status or printer details
export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const { id } = params;

		if (!id) {
			return json({ success: false, error: 'Counter ID is required' }, { status: 400 });
		}

		const body = await request.json();

		// Extract updateable fields
		const { status, printerType, printerAddress, deviceIdentifier, isActive } = body;

		// Optional: If you want to log status changes to the counterStatusLogs table
		if (status) {
			const currentCounter = await db.select().from(counters).where(eq(counters.id, id)).limit(1);
			if (currentCounter.length > 0 && currentCounter[0].status !== status) {
				await db.insert(counterStatusLogs).values({
					counterId: id,
					previousStatus: currentCounter[0].status,
					newStatus: status,
					reason: body.reason || 'Status updated via API'
				});
			}
		}

		const updatedCounter = await db
			.update(counters)
			.set({
				...(status && { status }),
				...(printerType && { printerType }),
				...(printerAddress !== undefined && { printerAddress }),
				...(deviceIdentifier !== undefined && { deviceIdentifier }),
				...(isActive !== undefined && { isActive }),
				updatedAt: new Date()
			})
			.where(eq(counters.id, id))
			.returning();

		if (updatedCounter.length === 0) {
			return json({ success: false, error: 'Counter not found' }, { status: 404 });
		}

		return json({ success: true, data: updatedCounter[0] });
	} catch (error) {
		return handleServerError(error, `Failed to update counter ${params?.id}`);
	}
};
