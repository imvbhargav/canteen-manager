import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { eq, or, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { users, payments, walletTransactions } from '$lib/server/db/schema';
import { verifyPin } from '$lib/server/auth';

type PaymentProvider = 'CASH' | 'RAZORPAY' | 'STRIPE' | 'UPI';

interface TransactionRequest {
	identifier: string;
	amount: number;
	providerTxnId?: string;
	provider?: PaymentProvider;
	action: 'CREDIT' | 'DEBIT';
	pin: string;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || !locals.user.id) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	const requestData = (await request.json()) as TransactionRequest;
	const { identifier, amount, providerTxnId, provider, action, pin } = requestData;

	if (!pin) return json({ success: false, error: 'Admin PIN is required' }, { status: 400 });
	if (!identifier)
		return json({ success: false, error: 'Student ID or Roll Number required' }, { status: 400 });
	if (amount <= 0) return json({ success: false, error: 'Invalid amount' }, { status: 400 });
	if (action !== 'CREDIT' && action !== 'DEBIT')
		return json({ success: false, error: 'Invalid action' }, { status: 400 });

	try {
		const adminData = await db.query.users.findFirst({
			where: eq(users.id, locals.user.id),
			columns: { role: true, pinHash: true }
		});

		if (!adminData || adminData.role !== 'ADMIN') {
			return json(
				{ success: false, error: 'Unauthorized. Admin access required.' },
				{ status: 403 }
			);
		}

		if (!adminData.pinHash || !verifyPin(pin, adminData.pinHash)) {
			return json({ success: false, error: 'Invalid Admin PIN' }, { status: 403 });
		}

		const targetUser = await db.query.users.findFirst({
			where: or(eq(users.studentId, identifier), eq(users.rollNumber, identifier)),
			columns: { id: true, name: true, balance: true }
		});

		if (!targetUser) {
			return json(
				{ success: false, error: 'Student not found. Check ID/Roll Number.' },
				{ status: 404 }
			);
		}

		if (action === 'DEBIT' && Number(targetUser.balance) < amount) {
			return json(
				{ success: false, error: 'Insufficient wallet balance for deduction.' },
				{ status: 400 }
			);
		}

		const userId: string = targetUser.id;

		const result: string | null = await db.transaction(async (tx) => {
			const [paymentRecord] = await tx
				.insert(payments)
				.values({
					userId,
					amount: Number(amount).toFixed(2),
					provider: provider || 'CASH',
					providerTxnId,
					status: 'SUCCESS'
				})
				.returning();

			const balanceModifier =
				action === 'CREDIT' ? sql`${users.balance} + ${amount}` : sql`${users.balance} - ${amount}`;

			const [updatedUser] = await tx
				.update(users)
				.set({ balance: balanceModifier })
				.where(eq(users.id, userId))
				.returning({ newBalance: users.balance });

			await tx.insert(walletTransactions).values({
				userId,
				type: action,
				amount: Number(amount).toFixed(2),
				balanceAfter: updatedUser.newBalance,
				referenceType: action === 'CREDIT' ? 'TOP_UP' : 'REFUND',
				paymentId: paymentRecord.id,
				description:
					action === 'CREDIT'
						? `Wallet Top-up via ${provider || 'CASH'}`
						: `Wallet Deduction by Admin`,
				idempotencyKey: providerTxnId || crypto.randomUUID()
			});

			return updatedUser.newBalance;
		});

		const actionText: string = action === 'CREDIT' ? 'Credited' : 'Deducted';

		return json({
			success: true,
			newBalance: result,
			studentName: targetUser.name,
			message: `Successfully ${actionText}`
		});
	} catch {
		return json({ success: false, error: 'Transaction processing failed' }, { status: 500 });
	}
};
