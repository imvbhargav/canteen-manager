import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, menuItems } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, setHeaders }) => {
	// Prevent browser from caching this HTML page
	setHeaders({
		'cache-control': 'no-cache, no-store, must-revalidate',
		pragma: 'no-cache',
		expires: '0'
	});

	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const user = await db.query.users.findFirst({
		where: eq(users.id, locals.user.id),
		columns: {
			name: true,
			balance: true,
			role: true,
			accountNumber: true,
			referenceKey: true
		}
	});

	if (!user) {
		throw redirect(302, '/login');
	}

	// Intercept Admins and send them to their console immediately
	if (user.role === 'ADMIN') {
		throw redirect(302, '/admin');
	}

	// Only standard students proceed to fetch the menu
	const menu = await db.query.menuItems.findMany({
		where: and(eq(menuItems.isArchived, false), eq(menuItems.inStock, true)),
		orderBy: (menuItems, { asc }) => [asc(menuItems.category), asc(menuItems.name)]
	});

	return {
		wallet: {
			name: user.name,
			accountNumber: user.accountNumber,
			referenceKey: user.referenceKey,
			balance: Number(user.balance)
		},
		menuItems: menu.map((item) => ({
			id: item.id,
			name: item.name,
			description: item.description,
			price: Number(item.price),
			category: item.category,
			inStock: item.inStock,
			dietary: item.dietary
		}))
	};
};
