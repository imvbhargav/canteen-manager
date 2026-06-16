import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	users,
	tickets,
	ticketItems,
	walletTransactions,
	menuItems,
	counters
} from '$lib/server/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { decryptCounterData } from '$lib/crypto';
import Pusher from 'pusher';
import { generateTicketReference } from '$lib';

const pusher: Pusher = new Pusher({
	appId: env.PUSHER_APP_ID as string,
	key: env.PUSHER_KEY as string,
	secret: env.PUSHER_SECRET as string,
	cluster: env.PUSHER_CLUSTER as string,
	useTLS: true
});

interface CartItem {
	id: string;
	quantity: number;
}

interface ValidatedItem {
	menuItemId: string;
	name: string;
	quantity: number;
	unitPrice: string;
	itemTotal: string;
}

interface ReceiptItem {
	name: string;
	quantity: number;
	unitPrice: string;
	itemTotal: string;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	const userId: string = locals.user.id;

	const { cart, securePayload } = (await request.json()) as {
		cart: CartItem[];
		securePayload: string;
	};

	if (!cart || cart.length === 0) {
		return json({ success: false, error: 'Cart is empty' }, { status: 400 });
	}

	if (!securePayload) {
		return json({ success: false, error: 'Missing QR scan data' }, { status: 400 });
	}

	try {
		// Decrypt payload to extract counter ID
		const counterId: string | null = decryptCounterData(securePayload);
		if (!counterId) {
			return json({ success: false, error: 'Invalid or tampered QR code' }, { status: 400 });
		}

		// Fetch counter state from DB
		const counter = await db.query.counters.findFirst({
			where: eq(counters.id, counterId)
		});

		if (!counter) {
			return json({ success: false, error: 'Counter not found' }, { status: 404 });
		}

		// Handle structural or functional master switch status
		if (!counter.isActive) {
			return json(
				{ success: false, error: `Counter ${counter.displayName} is deactivated.` },
				{ status: 400 }
			);
		}

		// Handle nuanced counter statuses explicitly based on enum definitions
		if (counter.status !== 'ACTIVE') {
			let reason = 'This counter is currently unavailable';
			if (counter.status === 'OFFLINE') {
				reason = `Counter ${counter.displayName} is currently offline.`;
			} else if (counter.status === 'PRINTER_ISSUE') {
				reason = `Counter ${counter.displayName} is facing hardware/printer problems.`;
			}

			return json({ success: false, error: reason }, { status: 400 });
		}

		const itemIds: string[] = cart.map((item: CartItem) => item.id);
		const dbItems = await db.query.menuItems.findMany({
			where: inArray(menuItems.id, itemIds)
		});

		let serverTotal: number = 0;

		const validatedItems: ValidatedItem[] = cart.map((cartItem: CartItem) => {
			const dbItem = dbItems.find((i) => i.id === cartItem.id);
			if (!dbItem || !dbItem.inStock) {
				throw new Error(`Item ${cartItem.id} unavailable`);
			}

			const price: number = Number(dbItem.price);
			serverTotal += price * cartItem.quantity;

			return {
				menuItemId: dbItem.id,
				name: dbItem.name,
				quantity: cartItem.quantity,
				unitPrice: price.toFixed(2),
				itemTotal: (price * cartItem.quantity).toFixed(2)
			};
		});

		const result = await db.transaction(async (tx) => {
			const [updatedUser] = await tx
				.update(users)
				.set({ balance: sql`${users.balance} - ${serverTotal}` })
				.where(eq(users.id, userId))
				.returning({ newBalance: users.balance });

			const ticketRef: string = generateTicketReference();

			const [newTicket] = await tx
				.insert(tickets)
				.values({
					userId,
					counterId: counterId,
					ticketReference: ticketRef,
					totalAmount: serverTotal.toFixed(2),
					status: 'PENDING',
					printStatus: 'PENDING'
				})
				.returning();

			await tx.insert(ticketItems).values(
				validatedItems.map((item: ValidatedItem) => ({
					ticketId: newTicket.id,
					menuItemId: item.menuItemId,
					quantity: item.quantity,
					unitPrice: item.unitPrice
				}))
			);

			await tx.insert(walletTransactions).values({
				userId,
				type: 'DEBIT',
				amount: serverTotal.toFixed(2),
				balanceAfter: updatedUser.newBalance,
				referenceType: 'TICKET_PURCHASE',
				ticketId: newTicket.id,
				description: 'Canteen Checkout',
				idempotencyKey: randomUUID()
			});

			return newTicket;
		});

		const receiptItems: ReceiptItem[] = validatedItems.map((item: ValidatedItem) => ({
			name: item.name,
			quantity: item.quantity,
			unitPrice: item.unitPrice,
			itemTotal: item.itemTotal
		}));

		await pusher.trigger([`counter-${counterId}`, 'admin-orders'], 'NEW_ORDER', {
			orderId: result.id,
			counterId: counterId,
			ticketReference: result.ticketReference,
			netTotal: serverTotal.toFixed(2),
			items: receiptItems
		});

		return json({
			success: true,
			data: {
				...result,
				ticketReference: result.ticketReference
			}
		});
	} catch (error: unknown) {
		const errorMessage: string = error instanceof Error ? error.message : 'Unknown error occurred';

		if (errorMessage.includes('users_balance_check')) {
			return json({ success: false, error: 'Insufficient funds' }, { status: 402 });
		}

		return json({ success: false, error: errorMessage || 'Checkout failed' }, { status: 500 });
	}
};
