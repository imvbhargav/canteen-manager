import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { walletTransactions } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    return json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  const userId = locals.user.id;

  try {
    const history = await db.query.walletTransactions.findMany({
      where: eq(walletTransactions.userId, userId),
      orderBy: [desc(walletTransactions.createdAt)],
      limit: 50, // Pagination should be implemented here for prod
      columns: {
        id: true,
        type: true,
        amount: true,
        description: true,
        createdAt: true
      }
    });

    return json({ success: true, data: history });
  } catch (error) {
    console.error('Failed to fetch history:', error);
    return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
};