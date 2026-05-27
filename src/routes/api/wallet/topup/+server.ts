import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { eq, or, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { users, payments, walletTransactions } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ request }) => {
  // Now expecting 'identifier' instead of 'userId'
  const { identifier, amount, providerTxnId, provider } = await request.json();

  if (!identifier) return json({ success: false, error: 'Student ID or Roll Number required' }, { status: 400 });
  if (amount <= 0) return json({ success: false, error: 'Invalid amount' }, { status: 400 });

  try {
    // 1. Look up the user by Student ID or Roll Number
    const targetUser = await db.query.users.findFirst({
      where: or(
        eq(users.studentId, identifier),
        eq(users.rollNumber, identifier)
      ),
      columns: { id: true, name: true, balance: true }
    });

    if (!targetUser) {
      return json({ success: false, error: 'Student not found. Check ID/Roll Number.' }, { status: 404 });
    }

    const userId = targetUser.id; // We found the internal UUID

    // 2. Process the financial transaction
    const result = await db.transaction(async (tx) => {
      const [paymentRecord] = await tx.insert(payments).values({
        userId,
        amount: Number(amount).toFixed(2),
        provider: provider || 'CASH',
        providerTxnId,
        status: 'SUCCESS'
      }).returning();

      const [updatedUser] = await tx.update(users)
        .set({ balance: sql`${users.balance} + ${amount}` })
        .where(eq(users.id, userId))
        .returning({ newBalance: users.balance });

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

    // Return the student's name as well so the Admin knows they credited the right person
    return json({ success: true, newBalance: result, studentName: targetUser.name });
    
  } catch (error) {
    console.error('Top-up failed:', error);
    return json({ success: false, error: 'Top-up processing failed' }, { status: 500 });
  }
};