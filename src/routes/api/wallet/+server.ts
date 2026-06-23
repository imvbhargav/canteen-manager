import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
	const user = await db.query.users.findFirst({
		where: eq(users.id, locals.user.id),
		columns: { balance: true }
	});
	return json({ balance: user?.balance ?? 0 });
};
