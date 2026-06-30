import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// 1. Engine token verification constant and helper
export const ENGINE_TOKEN = '38d6960a32cda66ce327d44d358755f706420303e11825a34eca38544a07e2c7';

export function verifyEngineToken(request: Request): boolean {
	return request.headers.get('X-Engine-Token') === ENGINE_TOKEN;
}

// 2. Auth guard options interface
export interface AuthGuardOptions {
	userError?: string;
	userStatus?: number;
	adminError?: string;
	adminStatus?: number;
}

// 3. User authentication guard helper
export function requireUser(locals: App.Locals, options: AuthGuardOptions = {}) {
	const userError = options.userError ?? 'Unauthorized';
	const userStatus = options.userStatus ?? 401;

	if (!locals.user || !locals.user.id) {
		return {
			authenticated: false,
			response: json({ success: false, error: userError }, { status: userStatus }),
			user: null
		};
	}
	return {
		authenticated: true,
		response: null,
		user: locals.user
	};
}

// 4. Admin authorization guard helper
export async function requireAdmin(locals: App.Locals, options: AuthGuardOptions = {}) {
	const userAuth = requireUser(locals, options);
	if (!userAuth.authenticated || !userAuth.user) {
		return {
			authorized: false,
			response: userAuth.response,
			user: null
		};
	}

	const adminCheck = await db.query.users.findFirst({
		where: eq(users.id, userAuth.user.id),
		columns: { role: true }
	});

	if (!adminCheck || adminCheck.role !== 'ADMIN') {
		const adminError = options.adminError ?? options.userError ?? 'Unauthorized';
		const adminStatus = options.adminStatus ?? 401;
		return {
			authorized: false,
			response: json({ success: false, error: adminError }, { status: adminStatus }),
			user: null
		};
	}

	return {
		authorized: true,
		response: null,
		user: userAuth.user
	};
}

// 5. Pagination parameter extraction helper
export function getPaginationParams(url: URL, defaultLimit = 15, maxLimit = 50) {
	const limitParam = parseInt(url.searchParams.get('limit') || String(defaultLimit), 10);
	const limit = limitParam > 0 && limitParam <= maxLimit ? limitParam : defaultLimit;
	const cursor = url.searchParams.get('cursor');
	return { limit, cursor };
}

// 6. Pagination list processing helper
export function processPagination<T extends { createdAt: Date | string }>(
	items: T[],
	limit: number,
	cursorKey: keyof T = 'createdAt'
) {
	let nextCursor: string | null = null;
	let hasNextPage = false;

	if (items.length > limit) {
		hasNextPage = true;
		items.pop();
		const lastItem = items[items.length - 1];
		const cursorVal = lastItem[cursorKey];
		if (cursorVal instanceof Date) {
			nextCursor = cursorVal.toISOString();
		} else {
			nextCursor = String(cursorVal);
		}
	}

	return {
		hasNextPage,
		nextCursor
	};
}

// 7. Engine heartbeat check helper
export function isEngineAlive(lastPingedAt: Date | string | null | undefined): boolean {
	if (!lastPingedAt) return false;
	const FIVE_MINUTES_IN_MS = 5 * 60 * 1000;
	const lastPingTime = new Date(lastPingedAt).getTime();
	return Date.now() - lastPingTime < FIVE_MINUTES_IN_MS;
}

// 8. Server error response wrapper helper
export function handleServerError(
	error: unknown,
	contextMessage: string,
	userErrorMessage = 'Internal Server Error'
) {
	console.error(`${contextMessage}:`, error);
	return json({ success: false, error: userErrorMessage }, { status: 500 });
}

// 9. Checkout & manual verify database constraint error wrapper
export function handleCheckoutError(
	error: unknown,
	fallbackStatus = 500,
	fallbackMessage = 'Checkout failed'
) {
	console.error(fallbackMessage, error);
	const errorMessage = error instanceof Error ? error.message : String(error);

	if (errorMessage.includes('users_balance_check')) {
		return json({ success: false, error: 'Insufficient funds' }, { status: 402 });
	}
	if (errorMessage.includes('Item is currently out of stock')) {
		return json(
			{ success: false, error: 'An item in your cart went out of stock' },
			{ status: 409 }
		);
	}

	return json(
		{ success: false, error: errorMessage || fallbackMessage },
		{ status: fallbackStatus }
	);
}
