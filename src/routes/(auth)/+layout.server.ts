import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, setHeaders }) => {
  // Prevent browser from caching the login page state
  setHeaders({
    'cache-control': 'no-cache, no-store, must-revalidate',
    'pragma': 'no-cache',
    'expires': '0'
  });

  if (locals.user) {
    throw redirect(302, '/');
  }
};