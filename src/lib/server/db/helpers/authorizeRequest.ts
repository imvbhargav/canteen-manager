import { eq } from 'drizzle-orm';
import { db } from '..';
import { users } from '../schema';

// Reusable non-destructive authorization helper
export const authorizeRequest = async (
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
