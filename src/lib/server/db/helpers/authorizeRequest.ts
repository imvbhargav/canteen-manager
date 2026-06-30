import { verifyEngineToken, requireAdmin } from '$lib/server/api';

// Reusable non-destructive authorization helper
export const authorizeRequest = async (
	request: Request,
	locals: App.Locals
): Promise<{ authorized: boolean; status: number; error?: string }> => {
	if (!verifyEngineToken(request)) {
		const auth = await requireAdmin(locals, {
			userError: 'Unauthorized: Missing session context',
			userStatus: 401,
			adminError: 'Unauthorized: Admin privileges required',
			adminStatus: 403
		});
		if (!auth.authorized) {
			return {
				authorized: false,
				status: auth.response!.status,
				error:
					auth.response!.status === 401
						? 'Unauthorized: Missing session context'
						: 'Unauthorized: Admin privileges required'
			};
		}
	}

	return { authorized: true, status: 200 };
};
