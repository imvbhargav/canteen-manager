import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { requireAdmin, handleServerError } from '$lib/server/api';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const auth = await requireAdmin(locals, {
		userError: 'Unauthorized configuration profile context',
		userStatus: 401,
		adminError: 'Access denied. Administrative authorization required.',
		adminStatus: 403
	});
	if (!auth.authorized) {
		return auth.response!;
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
		return handleServerError(
			error,
			'Status alternation processing hazard encountered',
			'Internal system modification runtime exception'
		);
	}
};

function formatCurrencyINR(amount: number): string {
	return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
}
