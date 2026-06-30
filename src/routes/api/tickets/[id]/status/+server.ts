import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { tickets } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { authorizeRequest } from '$lib/server/db/helpers/authorizeRequest';

// Allowed status changes
const VALID_STATUSES = ['PENDING', 'PRINTING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
type TicketStatus = (typeof VALID_STATUSES)[number];

export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const ticketId = params.id;
	if (!ticketId) {
		return json({ success: false, error: 'Missing ticket ID parameter' }, { status: 400 });
	}

	// Strict Request Identifier Validation
	const auth = await authorizeRequest(request, locals);
	if (!auth.authorized) {
		return json({ success: false, error: auth.error }, { status: auth.status });
	}

	try {
		const { status } = (await request.json()) as { status: unknown };

		// Validate input payload against PostgreSQL Enum
		if (!status || !VALID_STATUSES.includes(status as TicketStatus)) {
			return json(
				{ success: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
				{ status: 400 }
			);
		}

		// Find and verify ticket exists before altering state
		const existingTicket = await db.query.tickets.findFirst({
			where: eq(tickets.id, ticketId)
		});

		if (!existingTicket) {
			return json({ success: false, error: 'Ticket not found' }, { status: 404 });
		}

		// Check if the state is already mutated matching this request context
		if (existingTicket.status === status) {
			return json({
				success: true,
				message: 'Status already verified matching request state identifier.',
				data: {
					orderId: existingTicket.id,
					status: existingTicket.status,
					ticketReference: existingTicket.ticketReference
				}
			});
		}

		// Perform atomic update in the DB
		const [updatedTicket] = await db
			.update(tickets)
			.set({
				status: status as TicketStatus
			})
			.where(eq(tickets.id, ticketId))
			.returning();

		return json({
			success: true,
			data: {
				orderId: updatedTicket.id,
				status: updatedTicket.status,
				ticketReference: updatedTicket.ticketReference
			}
		});
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown exception';
		return json({ success: false, error: errorMessage }, { status: 500 });
	}
};
