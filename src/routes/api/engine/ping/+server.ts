import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { engines } from '$lib/server/db/schema';
import { eq, ne, and } from 'drizzle-orm';
import { verifyEngineToken, isEngineAlive, handleServerError } from '$lib/server/api';

export const POST: RequestHandler = async ({ request }) => {
	if (!verifyEngineToken(request)) {
		return json({ success: false, error: 'Unauthorized hub execution access' }, { status: 401 });
	}

	const { engineId, priority, status } = await request.json();

	if (!engineId) {
		return json({ success: false, error: 'Missing engine configuration metrics' }, { status: 400 });
	}

	// Manual Engine Disconnet
	if (status === 'OFF') {
		try {
			await db
				.update(engines)
				.set({ isOn: false, lastPingedAt: new Date() })
				.where(eq(engines.id, engineId));

			return json({ success: true, message: 'Engine state detached successfully.' });
		} catch (error) {
			return handleServerError(
				error,
				'Engine disconnect failed',
				'Internal shutdown processing failure.'
			);
		}
	}

	// Regular Incoming Heartbead / Registration
	if (priority === undefined) {
		return json(
			{ success: false, error: 'Missing priority metric for active registration' },
			{ status: 400 }
		);
	}

	try {
		return await db.transaction(async (tx) => {
			const currentActiveEngine = await tx.query.engines.findFirst({
				where: and(eq(engines.isOn, true), ne(engines.id, engineId))
			});

			if (currentActiveEngine) {
				if (
					isEngineAlive(currentActiveEngine.lastPingedAt) &&
					currentActiveEngine.priority > priority
				) {
					tx.rollback();
					return json(
						{
							success: false,
							error: `Registration rejected: Higher priority engine (${currentActiveEngine.id}) is actively running.`
						},
						{ status: 409 }
					);
				}
			}

			await tx.update(engines).set({ isOn: false }).where(ne(engines.id, engineId));

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
		if (error?.message?.includes('Rollback')) {
			return json(
				{ success: false, error: 'A higher priority engine is dominating the cluster.' },
				{ status: 409 }
			);
		}
		return handleServerError(
			err,
			'Engine registration/heartbeat failed',
			'Internal engine synchronization failure.'
		);
	}
};
