import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { eq, desc } from 'drizzle-orm';
import { counters, users } from '$lib/server/db/schema';

// Reusable non-destructive authorization helper
const authorizeRequest = async (
	request: Request,
	locals: App.Locals
): Promise<{ authorized: boolean; status: number; error?: string }> => {
	const engineToken = request.headers.get('X-Engine-Token');
	const isEngine =
		engineToken &&
		engineToken === '38d6960a32cda66ce327d44d358755f706420303e11825a34eca38544a07e2c7';

	if (!isEngine) {
		if (!locals.user) {
			return { authorized: false, status: 401, error: 'Unauthorized: Missing session context' };
		}

		const adminCheck = await db.query.users.findFirst({
			where: eq(users.id, locals.user.id),
			columns: { role: true }
		});

		if (!adminCheck || adminCheck.role !== 'ADMIN') {
			return { authorized: false, status: 403, error: 'Unauthorized: Admin privileges required' };
		}
	}

	return { authorized: true, status: 200 };
};

// GET: Fetch all active counters for the Android App dropdown
export const GET: RequestHandler = async ({ request, locals }) => {
	const auth = await authorizeRequest(request, locals);
	if (!auth.authorized) {
		return json({ success: false, error: auth.error }, { status: auth.status });
	}

	try {
		const activeCounters = await db
			.select()
			.from(counters)
			.where(eq(counters.isActive, true))
			.orderBy(desc(counters.counterNumber));

		return json({ success: true, data: activeCounters });
	} catch (error) {
		console.error('Failed to fetch counters:', error);
		return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
	}
};

// POST: Add a new counter (Used by Admin Web Dashboard and Android App Discovery Setup)
export const POST: RequestHandler = async ({ request, locals }) => {
	// Guard the creation route explicitly with the shared token setup
	const auth = await authorizeRequest(request, locals);
	if (!auth.authorized) {
		return json({ success: false, error: auth.error }, { status: auth.status });
	}

	try {
		const body = await request.json();
		const { counterNumber, displayName, printerType, printerAddress } = body;

		if (!counterNumber || !displayName) {
			return json({ success: false, error: 'Missing required fields' }, { status: 400 });
		}

		const newCounter = await db
			.insert(counters)
			.values({
				counterNumber,
				displayName,
				printerType: printerType || 'NONE',
				printerAddress: printerAddress || null
			})
			.returning();

		return json({ success: true, data: newCounter[0] }, { status: 201 });
	} catch (error: unknown) {
		console.error('Failed to create counter:', error);

		const pgError = error as { code?: string };
		if (pgError.code === '23505') {
			return json({ success: false, error: 'Counter number already exists' }, { status: 409 });
		}

		return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
	}
};
