import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { menuItems } from '$lib/server/db/schema';

interface MenuPayload {
  id: string;
  name: string;
  description: string;
  price: number | string;
  category: 'Breakfast' | 'Lunch' | 'Snacks' | 'Beverages';
  dietary: 'veg' | 'non-veg';
  inStock: boolean;
  isArchived: boolean;
}

export const GET: RequestHandler = async ({ url }) => {
  try {
    const includeArchived = url.searchParams.get('includeArchived') === 'true';

    const activeMenu = await db.query.menuItems.findMany({
      where: includeArchived ? undefined : eq(menuItems.isArchived, false),
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

    if (!body.name || !body.description || body.price == null || !body.category || !body.dietary) {
      return json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const insertedItem = await db.insert(menuItems).values({
      name: body.name,
      description: body.description,
      price: String(body.price),
      category: body.category,
      dietary: body.dietary,
      inStock: body.inStock ?? true,
      isArchived: false
    }).returning();

    return json({ success: true, data: insertedItem[0] }, { status: 201 });
  } catch {
    return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
};

export const PATCH: RequestHandler = async ({ request }) => {
  try {
    const body = (await request.json()) as Partial<MenuPayload>;

    if (!body.id) {
      return json({ success: false, error: 'Item ID is required for updating' }, { status: 400 });
    }

    const updatedItem = await db.update(menuItems)
      .set({
        ...(body.name != null && { name: body.name }),
        ...(body.description != null && { description: body.description }),
        ...(body.price != null && { price: String(body.price) }),
        ...(body.category != null && { category: body.category }),
        ...(body.dietary != null && { dietary: body.dietary }),
        ...(body.inStock !== undefined && { inStock: body.inStock }),
        ...(body.isArchived !== undefined && { isArchived: body.isArchived }),
      })
      .where(eq(menuItems.id, body.id))
      .returning();

    if (!updatedItem.length) {
      return json({ success: false, error: 'Item not found' }, { status: 404 });
    }

    return json({ success: true, data: updatedItem[0] });
  } catch {
    return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
};