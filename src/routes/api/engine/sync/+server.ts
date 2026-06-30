import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { tickets } from '$lib/server/db/schema';
import { gt, gte, inArray } from 'drizzle-orm';
import { verifyEngineToken, handleServerError } from '$lib/server/api';

export const POST: RequestHandler = async ({ request }) => {
	if (!verifyEngineToken(request)) {
		return json({ success: false, error: 'Unauthorized hub execution access' }, { status: 401 });
	}

	try {
		const { lastSeenOrderId, missingOrderIds } = await request.json();

		let conditions;

		// Map client-side array 'missingOrderIds' straight to your db 'ticketReference' strings
		if (Array.isArray(missingOrderIds) && missingOrderIds.length > 0) {
			conditions = inArray(tickets.ticketReference, missingOrderIds);
		} else if (lastSeenOrderId) {
			// Because ticketReference is structured as a alphanumeric sequence (YYMMDDAXXXX),
			// string-based comparison operators (gt) will accurately compare sequential order keys.
			conditions = gt(tickets.ticketReference, lastSeenOrderId);
		} else {
			// Default Fallback: Fetch everything generated today
			const startOfToday = new Date();
			startOfToday.setHours(0, 0, 0, 0);
			conditions = gte(tickets.createdAt, startOfToday);
		}

		const orderRecords = await db.query.tickets.findMany({
			where: conditions,
			with: {
				items: {
					with: {
						menuItem: { columns: { name: true } }
					}
				}
			}
		});

		// Map structural Drizzle models into your mobile App's client-side 'Ticket' interface format
		const formattedTickets = orderRecords.map((o) => ({
			orderId: o.ticketReference || '', // ticketReference fulfills the missing sequential orderId role
			counterId: o.counterId,
			ticketReference: o.ticketReference || '',
			netTotal: String(o.totalAmount),
			createdAt: o.createdAt.toISOString(),
			status: o.status || 'PENDING', // Leaves it safe to allow a 10-minute retry manual print execution window locally
			items: o.items.map((i) => {
				// Safely calculate line item total safely using float parsing contextually
				const computedTotal = (
					parseInt(String(i.quantity), 10) * parseFloat(String(i.unitPrice))
				).toFixed(2);
				return {
					name: i.menuItem?.name || 'Unknown Item',
					quantity: i.quantity,
					unitPrice: String(i.unitPrice),
					itemTotal: computedTotal
				};
			})
		}));

		return json({
			success: true,
			data: formattedTickets
		});
	} catch (error) {
		return handleServerError(
			error,
			'[API-SYNC-ERROR] Failed parsing recovery payload',
			'Internal pipeline sync failure'
		);
	}
};
