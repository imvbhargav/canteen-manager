import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, menuItems } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(302, '/login');
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, locals.user.id),
    columns: {
      studentId: true,
      name: true,
      rollNumber: true,
      balance: true
    }
  });

  if (!user) {
    throw redirect(302, '/login');
  }

  const menu = await db.query.menuItems.findMany({
    where: eq(menuItems.isArchived, false),
    orderBy: (menuItems, { asc }) => [asc(menuItems.category), asc(menuItems.name)]
  });

  return {
    wallet: {
      studentId: user.studentId,
      name: user.name,
      rollNumber: user.rollNumber,
      balance: Number(user.balance)
    },
    menuItems: menu.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: Number(item.price),
      category: item.category,
      inStock: item.inStock,
      dietary: item.dietary
    }))
  };
};