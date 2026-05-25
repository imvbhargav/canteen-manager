import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, tickets, ticketItems, walletTransactions, menuItems } from '$lib/server/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto'; // FIX 1: Import randomUUID directly
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
    return json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  const userId = locals.user.id; 
  
  const { cart } = await request.json() as { cart: { id: string; quantity: number }[] };

  if (!cart || cart.length === 0) {
    return json({ success: false, error: 'Cart is empty' }, { status: 400 });
  }

  try {
    // 1. Fetch real prices from DB (Never trust client prices)
    const itemIds = cart.map(item => item.id);
    const dbItems = await db.query.menuItems.findMany({
      where: inArray(menuItems.id, itemIds)
    });

    // 2. Calculate authoritative total
    let serverTotal = 0;
    const validatedItems = cart.map(cartItem => {
      const dbItem = dbItems.find(i => i.id === cartItem.id);
      if (!dbItem || !dbItem.inStock) throw new Error(`Item ${cartItem.id} unavailable`);
      
      const price = Number(dbItem.price);
      serverTotal += price * cartItem.quantity;
      
      return {
        menuItemId: dbItem.id,
        quantity: cartItem.quantity,
        unitPrice: price.toFixed(2)
      };
    });

    // 3. Execute ACID Transaction
    const result = await db.transaction(async (tx) => {
      // 3a. Verify & Deduct Balance (Will throw if balance goes negative due to DB constraint)
      const [updatedUser] = await tx.update(users)
        .set({ balance: sql`${users.balance} - ${serverTotal}` })
        .where(eq(users.id, userId))
        .returning({ newBalance: users.balance });

      // 3b. Create Ticket
      const ticketRef = `NEX-${Math.floor(10000 + Math.random() * 90000)}`;
      const [newTicket] = await tx.insert(tickets)
        .values({
          userId,
          ticketReference: ticketRef,
          totalAmount: serverTotal.toFixed(2),
          status: 'PENDING'
        })
        .returning();

      // 3c. Insert Ticket Items
      await tx.insert(ticketItems).values(
        validatedItems.map(item => ({
          ticketId: newTicket.id,
          ...item
        }))
      );

      // 3d. Record Immutable Ledger Entry
      await tx.insert(walletTransactions).values({
        userId,
        type: 'DEBIT',
        amount: serverTotal.toFixed(2),
        balanceAfter: updatedUser.newBalance,
        referenceType: 'TICKET_PURCHASE',
        ticketId: newTicket.id,
        description: 'Canteen Checkout',
        idempotencyKey: randomUUID(), // FIX 1: Use the directly imported function
      });

      return newTicket;
    });

    return json({ success: true, data: result });
  } catch (error: unknown) { // FIX 2: Change 'any' to 'unknown'
    console.error('Checkout failed:', error);
    
    // Safely extract the error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    // Handle DB constraint violation (Insufficient funds)
    if (errorMessage.includes('users_balance_check')) {
      return json({ success: false, error: 'Insufficient funds' }, { status: 402 });
    }
    
    return json({ success: false, error: errorMessage || 'Checkout failed' }, { status: 500 });
  }
};