import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { tickets, ticketItems, menuItems, users } from '$lib/server/db/schema';
import { eq, and, gte, lte, not, sql, desc } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return json({ success: false, error: 'Unauthorized' }, { status: 401 });

	const adminCheck = await db.query.users.findFirst({
		where: eq(users.id, locals.user.id),
		columns: { role: true }
	});

	if (!adminCheck || adminCheck.role !== 'ADMIN') {
		return json({ success: false, error: 'Unauthorized' }, { status: 403 });
	}

	try {
		const now = new Date();
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(now.getDate() - 30);

		const startDateParam = url.searchParams.get('startDate');
		const endDateParam = url.searchParams.get('endDate');

		const startDate = startDateParam ? new Date(startDateParam) : thirtyDaysAgo;
		const endDate = endDateParam ? new Date(endDateParam) : now;

		const periodMs = endDate.getTime() - startDate.getTime();
		const prevStartDate = new Date(startDate.getTime() - periodMs);
		const prevEndDate = new Date(startDate.getTime() - 1);

		// Smart Grouping + Window Size
		// < 1 day  → none (today: intraday heatmap)
		// < 14 days → day-wise,  window = 7 (one week per page)
		// < 60 days → week-wise, window = 4 (one month per page)
		// ≥ 60 days → month-wise, window = 3 (one quarter per page)
		const diffDays = Math.ceil(periodMs / (1000 * 60 * 60 * 24));
		let groupBy: 'none' | 'day' | 'week' | 'month';
		let windowSize: number;

		if (diffDays <= 1) {
			groupBy = 'none';
			windowSize = 0;
		} else if (diffDays < 14) {
			groupBy = 'day';
			windowSize = 7;
		} else if (diffDays < 60) {
			groupBy = 'week';
			windowSize = 4;
		} else {
			groupBy = 'month';
			windowSize = 3;
		}

		const baseFilter = and(
			gte(tickets.createdAt, startDate),
			lte(tickets.createdAt, endDate),
			not(eq(tickets.status, 'CANCELLED'))
		);

		const prevPeriodFilter = and(
			gte(tickets.createdAt, prevStartDate),
			lte(tickets.createdAt, prevEndDate),
			not(eq(tickets.status, 'CANCELLED'))
		);

		// --- QUERY A: Current Period Summary ---
		const summaryPromise = db
			.select({
				totalRevenue: sql<string>`COALESCE(SUM(${tickets.totalAmount}), 0)::numeric`,
				totalOrders: sql<number>`COUNT(${tickets.id})::integer`,
				avgOrderValue: sql<string>`COALESCE(AVG(${tickets.totalAmount}), 0)::numeric`,
				avgItemsPerOrder: sql<string>`COALESCE(
                    (SELECT AVG(summary.total_qty) FROM (
                        SELECT SUM(ti.quantity) as total_qty 
                        FROM ${ticketItems} ti 
                        INNER JOIN ${tickets} t ON ti.ticket_id = t.id
                        WHERE t.created_at BETWEEN ${startDate.toISOString()}::timestamp AND ${endDate.toISOString()}::timestamp AND t.status != 'CANCELLED'
                        GROUP BY ti.ticket_id
                    ) summary), 
                    0
                )::numeric`
			})
			.from(tickets)
			.where(baseFilter);

		// --- QUERY B: Previous Period Summary ---
		const prevSummaryPromise = db
			.select({
				totalRevenue: sql<string>`COALESCE(SUM(${tickets.totalAmount}), 0)::numeric`,
				totalOrders: sql<number>`COUNT(${tickets.id})::integer`
			})
			.from(tickets)
			.where(prevPeriodFilter);

		// --- QUERY C: Time-Series (Only generated if not a single-day query) ---
		const timeSeriesPromise =
			groupBy !== 'none'
				? db
						.select({
							period: sql<string>`to_char(date_trunc(${sql.raw(`'${groupBy}'`)}, ${tickets.createdAt}), 'YYYY-MM-DD')`,
							revenue: sql<string>`COALESCE(SUM(${tickets.totalAmount}), 0)::numeric`,
							orders: sql<number>`COUNT(${tickets.id})::integer`
						})
						.from(tickets)
						.where(baseFilter)
						.groupBy(sql`date_trunc(${sql.raw(`'${groupBy}'`)}, ${tickets.createdAt})`)
						.orderBy(sql`date_trunc(${sql.raw(`'${groupBy}'`)}, ${tickets.createdAt})`)
				: Promise.resolve([]);

		// --- QUERY D: Peak Hours Distribution ---
		const peakHoursPromise = db
			.select({
				hour: sql<number>`EXTRACT(HOUR FROM ${tickets.createdAt})::integer`,
				orders: sql<number>`COUNT(${tickets.id})::integer`,
				revenue: sql<string>`COALESCE(SUM(${tickets.totalAmount}), 0)::numeric`
			})
			.from(tickets)
			.where(baseFilter)
			.groupBy(sql`EXTRACT(HOUR FROM ${tickets.createdAt})`)
			.orderBy(sql`EXTRACT(HOUR FROM ${tickets.createdAt})`);

		// --- QUERY E: Category Revenue Breakdown ---
		const categoryBreakdownPromise = db
			.select({
				category: menuItems.category,
				quantitySold: sql<number>`COALESCE(SUM(${ticketItems.quantity}), 0)::integer`,
				revenue: sql<string>`COALESCE(SUM(${ticketItems.quantity} * ${ticketItems.unitPrice}), 0)::numeric`,
				orderCount: sql<number>`COUNT(DISTINCT ${tickets.id})::integer`
			})
			.from(ticketItems)
			.innerJoin(tickets, eq(ticketItems.ticketId, tickets.id))
			.innerJoin(menuItems, eq(ticketItems.menuItemId, menuItems.id))
			.where(baseFilter)
			.groupBy(menuItems.category)
			.orderBy(desc(sql`SUM(${ticketItems.quantity} * ${ticketItems.unitPrice})`));

		// --- QUERY F: Order Status Distribution ---
		const statusDistributionPromise = db
			.select({
				status: tickets.status,
				count: sql<number>`COUNT(${tickets.id})::integer`
			})
			.from(tickets)
			.where(and(gte(tickets.createdAt, startDate), lte(tickets.createdAt, endDate)))
			.groupBy(tickets.status)
			.orderBy(desc(sql`COUNT(${tickets.id})`));

		// --- QUERY G: Top Selling Items ---
		const itemAnalyticsPromise = db
			.select({
				id: menuItems.id,
				name: menuItems.name,
				category: menuItems.category,
				quantitySold: sql<number>`COALESCE(SUM(${ticketItems.quantity}), 0)::integer`,
				revenueGenerated: sql<string>`COALESCE(SUM(${ticketItems.quantity} * ${ticketItems.unitPrice}), 0)::numeric`,
				avgUnitPrice: sql<string>`COALESCE(AVG(${ticketItems.unitPrice}), 0)::numeric`
			})
			.from(ticketItems)
			.innerJoin(tickets, eq(ticketItems.ticketId, tickets.id))
			.innerJoin(menuItems, eq(ticketItems.menuItemId, menuItems.id))
			.where(baseFilter)
			.groupBy(menuItems.id)
			.orderBy(desc(sql`SUM(${ticketItems.quantity})`));

		const [
			summaryResult,
			prevSummaryResult,
			timeSeriesResult,
			peakHoursResult,
			categoryBreakdownResult,
			statusDistributionResult,
			itemAnalyticsResult
		] = await Promise.all([
			summaryPromise,
			prevSummaryPromise,
			timeSeriesPromise,
			peakHoursPromise,
			categoryBreakdownPromise,
			statusDistributionPromise,
			itemAnalyticsPromise
		]);

		const currRevenue = Number(summaryResult[0]?.totalRevenue ?? 0);
		const prevRevenue = Number(prevSummaryResult[0]?.totalRevenue ?? 0);
		const currOrders = summaryResult[0]?.totalOrders ?? 0;
		const prevOrders = prevSummaryResult[0]?.totalOrders ?? 0;

		const revenueGrowth =
			prevRevenue > 0 ? ((currRevenue - prevRevenue) / prevRevenue) * 100 : null;
		const ordersGrowth = prevOrders > 0 ? ((currOrders - prevOrders) / prevOrders) * 100 : null;

		return json({
			success: true,
			data: {
				summary: {
					...summaryResult[0],
					revenueGrowth,
					ordersGrowth
				},
				groupBy,
				windowSize,
				timeSeries: timeSeriesResult,
				peakHours: peakHoursResult,
				categoryBreakdown: categoryBreakdownResult,
				statusDistribution: statusDistributionResult,
				itemAnalytics: itemAnalyticsResult
			}
		});
	} catch (error) {
		console.error('Analytics Fetch Error:', error);
		return json({ success: false, error: 'Failed to generate analytics' }, { status: 500 });
	}
};
