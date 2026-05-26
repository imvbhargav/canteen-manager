import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from '../api/auth/$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) {
    throw redirect(302, '/');
  }
};