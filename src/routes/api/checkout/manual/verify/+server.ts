import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { manualOrderOtps, tickets, ticketItems, menuItems, counters } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';
import { eq, and, gt, inArray } from 'drizzle-orm';
import { requireUser, handleCheckoutError } from '$lib/server/api';

interface CartItem {
	menuItemId: string;
	quantity: number;
}

interface ValidatedItem {
	menuItemId: string;
	quantity: number;
	unitPrice: string;
}

export const POST: RequestHandler = async ({ locals, request }) => {
	const userAuth = requireUser(locals);
	if (!userAuth.authenticated) {
		return userAuth.response!;
	}

	const activeUserId = userAuth.user!.id;

	const { otpCode, items } = (await request.json()) as {
		otpCode: string;
		items: CartItem[];
	};

	if (!otpCode || !items || items.length === 0) {
		return json({ success: false, error: 'Missing required order details' }, { status: 400 });
	}

	try {
		// Gather validation records and target items concurrently outside the transaction
		const menuIds = items.map((i) => i.menuItemId);
		const [validOtp, activeCounter, dbItems] = await Promise.all([
			db.query.manualOrderOtps.findFirst({
				where: and(
					eq(manualOrderOtps.otpCode, otpCode),
					eq(manualOrderOtps.userId, activeUserId),
					eq(manualOrderOtps.status, 'PENDING'),
					gt(manualOrderOtps.expiresAt, new Date())
				)
			}),
			db.query.counters.findFirst({
				where: eq(counters.status, 'ACTIVE') // Standardized check based on trigger configurations
			}),
			db.query.menuItems.findMany({
				where: inArray(menuItems.id, menuIds)
			})
		]);

		if (!validOtp) {
			return json({ success: false, error: 'Invalid or expired OTP' }, { status: 400 });
		}
		if (!activeCounter) {
			return json(
				{ success: false, error: 'No operational checkout counters found to fulfill this order.' },
				{ status: 400 }
			);
		}

		let totalAmount = 0;
		const validatedItems: ValidatedItem[] = items.map((item) => {
			const dbItem = dbItems.find((dbI) => dbI.id === item.menuItemId);
			if (!dbItem || !dbItem.inStock || dbItem.isArchived) {
				throw new Error(`Item ${item.menuItemId} is unavailable.`);
			}

			const price = Number(dbItem.price);
			totalAmount += price * item.quantity;

			return {
				menuItemId: dbItem.id,
				quantity: item.quantity,
				unitPrice: price.toFixed(2)
			};
		});

		// Slimmed down transaction processing
		const newTicket = await db.transaction(async (tx) => {
			// ticketReference is completely omitted; generated natively by trigger before insertion
			const [ticket] = await tx
				.insert(tickets)
				.values({
					userId: activeUserId,
					counterId: activeCounter.id,
					totalAmount: totalAmount.toFixed(2),
					status: 'PENDING'
				})
				.returning();

			await tx.insert(ticketItems).values(
				validatedItems.map((i) => ({
					ticketId: ticket.id,
					menuItemId: i.menuItemId,
					quantity: i.quantity,
					unitPrice: i.unitPrice
				}))
			);

			await tx
				.update(manualOrderOtps)
				.set({ status: 'VERIFIED', updatedAt: new Date() })
				.where(eq(manualOrderOtps.id, validOtp.id));

			return ticket;
		});

		return json({
			success: true,
			message: 'Order verified and processed successfully',
			ticket: {
				id: newTicket.id,
				reference: newTicket.ticketReference, // Returned automatically by Postgres via returning()
				total: newTicket.totalAmount
			}
		});
	} catch (error: unknown) {
		return handleCheckoutError(error, 400, 'Manual order processing failed');
	}
};
