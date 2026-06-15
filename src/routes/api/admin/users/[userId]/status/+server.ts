import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user || !locals.user.id) {
		return json(
			{ success: false, error: 'Unauthorized configuration profile context' },
			{ status: 401 }
		);
	}

	try {
		const { userId } = params;
		const { isActive, name, accountNumber, deactivationReason, batchYear, expectedGraduationYear } =
			await request.json();

		if (typeof isActive !== 'boolean') {
			return json(
				{ success: false, error: 'Target status state parameter required' },
				{ status: 400 }
			);
		}

		const adminCheck = await db.query.users.findFirst({
			where: eq(users.id, locals.user.id),
			columns: { role: true }
		});

		if (!adminCheck || adminCheck.role !== 'ADMIN') {
			return json(
				{ success: false, error: 'Access denied. Administrative authorization required.' },
				{ status: 403 }
			);
		}

		const existingUser = await db.query.users.findFirst({
			where: eq(users.id, userId)
		});

		if (!existingUser) {
			return json(
				{ success: false, error: 'User target registration record missing' },
				{ status: 404 }
			);
		}

		if (isActive) {
			if (!name || !accountNumber || !batchYear || !expectedGraduationYear) {
				return json(
					{
						success: false,
						error: 'All parameters including batch timeline markers are required for activation.'
					},
					{ status: 400 }
				);
			}

			const parsedBatchYear = parseInt(batchYear);
			const parsedGraduationYear = parseInt(expectedGraduationYear);

			if (
				isNaN(parsedBatchYear) ||
				isNaN(parsedGraduationYear) ||
				parsedBatchYear > parsedGraduationYear
			) {
				return json(
					{
						success: false,
						error: 'Invalid batch selection or graduation timeline parameters matching error.'
					},
					{ status: 400 }
				);
			}

			const cleanAccount = accountNumber.trim().toUpperCase();

			if (cleanAccount !== existingUser.accountNumber) {
				const conflict = await db.query.users.findFirst({
					where: eq(users.accountNumber, cleanAccount)
				});
				if (conflict) {
					return json(
						{ success: false, error: 'Account number identifier collision across ledger' },
						{ status: 409 }
					);
				}
			}

			const newReferenceKey = `${name
				.replace(/[^a-zA-Z]/g, '')
				.slice(0, 3)
				.toUpperCase()}${cleanAccount}`;

			const [updatedUser] = await db
				.update(users)
				.set({
					name: name.trim(),
					accountNumber: cleanAccount,
					referenceKey: newReferenceKey,
					batchYear: parsedBatchYear,
					expectedGraduationYear: parsedGraduationYear,
					isActive: true,
					deactivationReason: null,
					updatedAt: new Date()
				})
				.where(eq(users.id, userId))
				.returning();

			return json({ success: true, data: updatedUser });
		} else {
			if (Number(existingUser.balance) !== 0) {
				return json(
					{
						success: false,
						error: `Cannot deactivate account. Active wallet balance remaining: ${formatCurrencyINR(Number(existingUser.balance))}. Clear funds first.`
					},
					{ status: 400 }
				);
			}

			if (!deactivationReason || deactivationReason.trim().length < 4) {
				return json(
					{ success: false, error: 'A valid structural deactivation context argument is required' },
					{ status: 400 }
				);
			}

			const [updatedUser] = await db
				.update(users)
				.set({
					isActive: false,
					deactivationReason: deactivationReason.trim(),
					updatedAt: new Date()
				})
				.where(eq(users.id, userId))
				.returning();

			return json({ success: true, data: updatedUser });
		}
	} catch (error) {
		console.error('Status alternation processing hazard encountered:', error);
		return json(
			{ success: false, error: 'Internal system modification runtime exception' },
			{ status: 500 }
		);
	}
};

function formatCurrencyINR(amount: number): string {
	return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
}
