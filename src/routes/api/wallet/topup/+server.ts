import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { eq, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { users, payments, walletTransactions } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ request }) => {
  // In production, ensure this endpoint is highly secured/authenticated
  const { userId, amount, providerTxnId, provider } = await request.json();

  if (amount <= 0) return json({ success: false, error: 'Invalid amount' }, { status: 400 });

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Log the Payment Record
      const [paymentRecord] = await tx.insert(payments).values({
        userId,
        amount: Number(amount).toFixed(2),
        provider: provider || 'CASH',
        providerTxnId,
        status: 'SUCCESS'
      }).returning();

      // 2. Credit the Wallet
      const [updatedUser] = await tx.update(users)
        .set({ balance: sql`${users.balance} + ${amount}` })
        .where(eq(users.id, userId))
        .returning({ newBalance: users.balance });

      // 3. Write to Immutable Ledger
      await tx.insert(walletTransactions).values({
        userId,
        type: 'CREDIT',
        amount: Number(amount).toFixed(2),
        balanceAfter: updatedUser.newBalance,
        referenceType: 'TOP_UP',
        paymentId: paymentRecord.id,
        description: `Wallet Top-up via ${provider}`,
        idempotencyKey: providerTxnId || crypto.randomUUID(),
      });

      return updatedUser.newBalance;
    });

    return json({ success: true, newBalance: result });
  } catch (error) {
    console.error('Top-up failed:', error);
    return json({ success: false, error: 'Top-up processing failed' }, { status: 500 });
  }
};