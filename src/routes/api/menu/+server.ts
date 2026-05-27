import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { menuItems } from '$lib/server/db/schema';

interface MenuPayload {
  name: string;
  description: string;
  price: number | string;
  category: 'Breakfast' | 'Lunch' | 'Snacks' | 'Beverages';
  dietary: 'veg' | 'non-veg';
  inStock?: boolean;
}

export const GET: RequestHandler = async () => {
  try {
    const activeMenu = await db.query.menuItems.findMany({
      where: eq(menuItems.isArchived, false),
      orderBy: (menuItems, { asc }) => [asc(menuItems.category), asc(menuItems.name)],
    });

    return json({ success: true, data: activeMenu });
  } catch {
    return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = (await request.json()) as Partial<MenuPayload>;

    if (!body.name || !body.description || !body.price || !body.category || !body.dietary) {
      return json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const insertedItem = await db.insert(menuItems).values({
      name: body.name,
      description: body.description,
      price: String(body.price),
      category: body.category,
      dietary: body.dietary,
      inStock: body.inStock ?? true
    }).returning();

    return json({ success: true, data: insertedItem[0] }, { status: 201 });
  } catch {
    return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
};