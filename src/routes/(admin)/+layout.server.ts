import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

interface AdminLayoutData {
  adminData: {
    name: string;
    adminId: string;
    role: 'STUDENT' | 'STAFF' | 'ADMIN';
  };
}

export const load: LayoutServerLoad = async ({ locals, setHeaders }): Promise<AdminLayoutData> => {
  setHeaders({
    'cache-control': 'no-cache, no-store, must-revalidate',
    'pragma': 'no-cache',
    'expires': '0'
  });

  if (!locals.user) {
    throw redirect(302, '/login');
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, locals.user.id),
    columns: {
      studentId: true,
      name: true,
      role: true
    }
  });

  if (!user) {
    throw redirect(302, '/login');
  }

  if (user.role !== 'ADMIN') {
    throw redirect(302, '/');
  }

  return {
    adminData: {
      name: user.name,
      adminId: user.studentId,
      role: user.role
    }
  };
};