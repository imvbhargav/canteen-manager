import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { menuItems } from '$lib/server/db/schema';

export const GET: RequestHandler = async () => {
  try {
    const activeMenu = await db.query.menuItems.findMany({
      where: eq(menuItems.isArchived, false),
      orderBy: (menuItems, { asc }) => [asc(menuItems.category), asc(menuItems.name)],
    });

    return json({ success: true, data: activeMenu });
  } catch (error) {
    console.error('Failed to fetch menu:', error);
    return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
};