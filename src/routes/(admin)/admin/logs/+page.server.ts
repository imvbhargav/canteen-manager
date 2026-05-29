import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { desc } from 'drizzle-orm';
import { tickets } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) {
        redirect(302, '/login');
    }

    const orderLogs = await db.query.tickets.findMany({
        orderBy: [desc(tickets.id)],
        limit: 100,
        with: {
            user: true,
            counter: true,
            items: {
                with: {
                    menuItem: true
                }
            }
        }
    });

    // Fetch all physical counters from the database dynamically
    const allCounters = await db.query.counters.findMany({
        where: (counters, { eq }) => eq(counters.status, 'ACTIVE')
    });

    return { 
        orderLogs, 
        counters: allCounters 
    };
};