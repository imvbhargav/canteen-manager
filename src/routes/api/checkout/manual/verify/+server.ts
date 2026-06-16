import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	users,
	manualOrderOtps,
	tickets,
	ticketItems,
	walletTransactions,
	menuItems,
	counters
} from '$lib/server/db/schema';
import type { RequestHandler } from './$types';
import { eq, and, gt } from 'drizzle-orm';
import { generateTicketReference } from '$lib';

interface CartItem {
	menuItemId: string;
	quantity: number;
}

interface PreparedTicketItem {
	menuItemId: string;
	quantity: number;
	unitPrice: string;
}

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	const activeUserId = locals.user.id;

	// Fixed: Removed counterId from the incoming payload extraction
	const { otpCode, items } = (await request.json()) as {
		otpCode: string;
		items: CartItem[];
	};

	if (!otpCode || !items || items.length === 0) {
		return json({ success: false, error: 'Missing required order details' }, { status: 400 });
	}

	try {
		const validOtp = await db.query.manualOrderOtps.findFirst({
			where: and(
				eq(manualOrderOtps.otpCode, otpCode),
				eq(manualOrderOtps.userId, activeUserId),
				eq(manualOrderOtps.status, 'PENDING'),
				gt(manualOrderOtps.expiresAt, new Date())
			)
		});

		if (!validOtp) {
			return json({ success: false, error: 'Invalid or expired OTP' }, { status: 400 });
		}

		const newTicket = await db.transaction(async (tx) => {
			// 1. Fetch any single active fulfillment counter unit dynamically
			// Note: Replace 'counters.isActive' with the exact boolean key your schema uses (e.g., status: 'ACTIVE')
			const activeCounter = await tx.query.counters.findFirst({
				where: eq(counters.isActive, true)
			});

			if (!activeCounter) {
				throw new Error('No operational checkout counters found to fulfill this order.');
			}

			const userRecord = await tx.query.users.findFirst({
				where: eq(users.id, activeUserId)
			});
			if (!userRecord) throw new Error('User record not found');

			let totalAmount = 0;
			const itemsToInsert: PreparedTicketItem[] = [];

			for (const item of items) {
				const menuResult = await tx.query.menuItems.findFirst({
					where: eq(menuItems.id, item.menuItemId)
				});

				if (!menuResult || !menuResult.inStock || menuResult.isArchived) {
					throw new Error(`Item ${item.menuItemId} is unavailable.`);
				}

				const itemPrice = Number(menuResult.price);
				totalAmount += itemPrice * item.quantity;

				itemsToInsert.push({
					menuItemId: menuResult.id,
					quantity: item.quantity,
					unitPrice: menuResult.price
				});
			}

			const currentBalance = parseFloat(userRecord.balance);
			if (currentBalance < totalAmount) {
				throw new Error('Insufficient wallet balance.');
			}

			const updatedBalance = (currentBalance - totalAmount).toFixed(2);
			await tx
				.update(users)
				.set({ balance: updatedBalance, updatedAt: new Date() })
				.where(eq(users.id, activeUserId));

			const ticketReference: string = generateTicketReference();

			// 2. Insert ticket utilizing the dynamically resolved counter ID string
			const [ticket] = await tx
				.insert(tickets)
				.values({
					ticketReference,
					userId: activeUserId,
					counterId: activeCounter.id, // Dynamically sourced from database
					totalAmount: totalAmount.toFixed(2),
					status: 'PENDING',
					printStatus: 'PENDING'
				})
				.returning();

			const finalizedItems = itemsToInsert.map((i) => ({
				ticketId: ticket.id,
				menuItemId: i.menuItemId,
				quantity: i.quantity,
				unitPrice: i.unitPrice
			}));

			await tx.insert(ticketItems).values(finalizedItems);

			await tx.insert(walletTransactions).values({
				userId: activeUserId,
				type: 'DEBIT',
				amount: totalAmount.toFixed(2),
				balanceAfter: updatedBalance,
				referenceType: 'TICKET_PURCHASE',
				ticketId: ticket.id,
				description: `Manual order via counter fallback`,
				idempotencyKey: `manual-txn-${ticket.id}`
			});

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
				reference: newTicket.ticketReference,
				total: newTicket.totalAmount
			}
		});
	} catch (error: unknown) {
		console.error('Manual order processing failed:', error);
		const errorMessage = error instanceof Error ? error.message : 'Failed to process order';
		return json({ success: false, error: errorMessage }, { status: 400 });
	}
};
