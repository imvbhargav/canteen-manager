import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { engines } from '$lib/server/db/schema';
import { eq, ne, and } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request }) => {
	const { engineId, priority } = await request.json();

	if (!engineId || priority === undefined) {
		return json({ success: false, error: 'Missing engine configuration metrics' }, { status: 400 });
	}

	try {
		return await db.transaction(async (tx) => {
			// Look for any other engine currently claiming to be ON
			const currentActiveEngine = await tx.query.engines.findFirst({
				where: and(eq(engines.isOn, true), ne(engines.id, engineId))
			});

			if (currentActiveEngine) {
				const FIVE_MINUTES_IN_MS = 5 * 60 * 1000;
				const lastPingTime = new Date(currentActiveEngine.lastPingedAt).getTime();
				const isCurrentEngineAlive = Date.now() - lastPingTime < FIVE_MINUTES_IN_MS;

				// Condition A: Active engine is alive AND has a higher or equal priority
				if (isCurrentEngineAlive && currentActiveEngine.priority > priority) {
					tx.rollback(); // Explicitly cancel transaction operations
					return json(
						{
							success: false,
							error: `Registration rejected: Higher priority engine (${currentActiveEngine.id}) is actively running.`
						},
						{ status: 409 }
					);
				}
			}

			// Condition B: Either no active engine exists, it timed out, or its priority is lower.
			// Turn off ALL other engine slots globally
			await tx.update(engines).set({ isOn: false }).where(ne(engines.id, engineId));

			// Register or update this engine instance as the active singleton master
			await tx
				.insert(engines)
				.values({
					id: engineId,
					isOn: true,
					priority: priority,
					lastPingedAt: new Date()
				})
				.onConflictDoUpdate({
					target: engines.id,
					set: {
						isOn: true,
						priority: priority,
						lastPingedAt: new Date()
					}
				});

			return json({ success: true, message: 'Engine state claimed successfully.' });
		});
	} catch (err: unknown) {
		const error = err as { message: string };

		// Handle explicit rollbacks gracefully
		if (error?.message?.includes('Rollback')) {
			return json(
				{ success: false, error: 'A higher priority engine is dominating the cluster.' },
				{ status: 409 }
			);
		}
		return json(
			{ success: false, error: 'Internal engine synchronization failure.' },
			{ status: 500 }
		);
	}
};
