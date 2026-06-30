import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/api';

export const GET: RequestHandler = async ({ locals }) => {
	const userAuth = requireUser(locals);
	if (!userAuth.authenticated) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	const user = await db.query.users.findFirst({
		where: eq(users.id, userAuth.user!.id),
		columns: { balance: true }
	});
	return json({ balance: user?.balance ?? 0 });
};
