import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { eq, desc } from 'drizzle-orm';
import { counters } from '$lib/server/db/schema';

// GET: Fetch all active counters for the Android App dropdown
export const GET: RequestHandler = async () => {
  try {
    const activeCounters = await db
      .select()
      .from(counters)
      .where(eq(counters.isActive, true))
      .orderBy(desc(counters.counterNumber));

    return json({ success: true, data: activeCounters });
  } catch (error) {
    console.error('Failed to fetch counters:', error);
    return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
};

// POST: Add a new counter (Used by your Admin Web Dashboard)
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { counterNumber, displayName, printerType, printerAddress } = body;

    if (!counterNumber || !displayName) {
      return json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const newCounter = await db.insert(counters).values({
      counterNumber,
      displayName,
      printerType: printerType || 'NONE',
      printerAddress: printerAddress || null,
    }).returning();

    return json({ success: true, data: newCounter[0] }, { status: 201 });
  } catch (error: unknown) {
    console.error('Failed to create counter:', error);
    
    // Safely type-cast the error to check for the Postgres error code
    const pgError = error as { code?: string };
    
    if (pgError.code === '23505') {
      return json({ success: false, error: 'Counter number already exists' }, { status: 409 });
    }
    
    return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
};