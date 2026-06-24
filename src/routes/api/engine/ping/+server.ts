import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { engines } from '$lib/server/db/schema';
import { eq, ne, and } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request }) => {
	const engineToken = request.headers.get('X-Engine-Token');
	if (engineToken !== '38d6960a32cda66ce327d44d358755f706420303e11825a34eca38544a07e2c7') {
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
		} catch {
			return json(
				{ success: false, error: 'Internal shutdown processing failure.' },
				{ status: 500 }
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
				const FIVE_MINUTES_IN_MS = 5 * 60 * 1000;
				const lastPingTime = new Date(currentActiveEngine.lastPingedAt).getTime();
				const isCurrentEngineAlive = Date.now() - lastPingTime < FIVE_MINUTES_IN_MS;

				if (isCurrentEngineAlive && currentActiveEngine.priority > priority) {
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
		return json(
			{ success: false, error: 'Internal engine synchronization failure.' },
			{ status: 500 }
		);
	}
};
