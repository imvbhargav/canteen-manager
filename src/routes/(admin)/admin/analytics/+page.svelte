<script lang="ts">
	import { onMount } from 'svelte';
	import {
		TrendingUp,
		TrendingDown,
		Receipt,
		Loader2,
		AlertCircle,
		RefreshCw,
		BarChart3,
		Utensils,
		Clock,
		Tag,
		ShoppingBag,
		Minus,
		User
	} from 'lucide-svelte';
	import { formatCurrencyINR } from '$lib';
	import { SvelteDate, SvelteURLSearchParams } from 'svelte/reactivity';
	import AppLogo from '$lib/components/AppLogo.svelte';

	// --- Types ---
	interface Summary {
		totalRevenue: string;
		totalOrders: number;
		avgOrderValue: string;
		avgItemsPerOrder: string;
		revenueGrowth: number | null;
		ordersGrowth: number | null;
	}
	interface TimeSeriesData {
		period: string;
		revenue: string;
		orders: number;
	}
	interface PeakHourData {
		hour: number;
		orders: number;
		revenue: string;
	}
	interface CategoryData {
		category: string;
		quantitySold: number;
		revenue: string;
		orderCount: number;
	}
	interface StatusData {
		status: string;
		count: number;
	}
	interface ItemAnalyticsData {
		id: string;
		name: string;
		category: string;
		quantitySold: number;
		revenueGenerated: string;
		avgUnitPrice: string;
	}
	interface AnalyticsResponse {
		summary: Summary;
		groupBy: 'none' | 'day' | 'week' | 'month';
		timeSeries: TimeSeriesData[];
		peakHours: PeakHourData[];
		categoryBreakdown: CategoryData[];
		statusDistribution: StatusData[];
		itemAnalytics: ItemAnalyticsData[];
	}

	interface OrderItem {
		id: string;
		quantity: number;
		unitPrice: string;
		menuItem: { name: string; dietary: 'veg' | 'non-veg' };
	}
	interface OrderFeedRecord {
		id: string;
		ticketReference: string;
		totalAmount: string;
		status: string;
		createdAt: string;
		user: { name: string; studentId: string; rollNumber: string };
		items: OrderItem[];
	}

	type Preset = '1d' | '7d' | '30d' | '90d' | 'custom';
	type ActiveTab = 'METRICS' | 'ORDERS_LIST';

	const PRESETS: { key: Preset; label: string }[] = [
		{ key: '1d', label: 'Today' },
		{ key: '7d', label: '7 days' },
		{ key: '30d', label: '30 days' },
		{ key: '90d', label: '90 days' },
		{ key: 'custom', label: 'Custom' }
	];

	function getDateString(daysAgo: number): string {
		const d = new SvelteDate();
		d.setDate(d.getDate() - daysAgo);
		return d.toISOString().split('T')[0];
	}

	function datesForPreset(preset: Preset): { start: string; end: string } {
		const end = getDateString(0);
		switch (preset) {
			case '1d':
				return { start: getDateString(0), end };
			case '7d':
				return { start: getDateString(6), end };
			case '30d':
				return { start: getDateString(29), end };
			case '90d':
				return { start: getDateString(89), end };
			default:
				return { start: customStart, end: customEnd };
		}
	}

	// --- State ---
	let isLoading = $state(true);
	let errorMessage = $state('');
	let data = $state<AnalyticsResponse | null>(null);
	let activeTab = $state<ActiveTab>('METRICS');

	let feedOrders = $state<OrderFeedRecord[]>([]);
	let isFetchingOrdersFeed = $state(false);
	let nextCursor = $state<string | null>(null);
	let hasNextPage = $state(false);

	let activePreset = $state<Preset>('30d');

	let customStart = $state(getDateString(29));
	let customEnd = $state(getDateString(0));

	let effectiveStart = $derived(
		activePreset === 'custom' ? customStart : datesForPreset(activePreset).start
	);
	let effectiveEnd = $derived(
		activePreset === 'custom' ? customEnd : datesForPreset(activePreset).end
	);

	// --- Chart derived ---
	let maxRevenue = $derived(
		data?.timeSeries?.length
			? Math.max(...data.timeSeries.map((d: TimeSeriesData) => Number(d.revenue)))
			: 0
	);
	let maxHourOrders = $derived(
		data?.peakHours?.length ? Math.max(...data.peakHours.map((h: PeakHourData) => h.orders)) : 0
	);
	let totalCategoryRevenue = $derived(
		data?.categoryBreakdown?.reduce((acc: number, c: CategoryData) => acc + Number(c.revenue), 0) ??
			0
	);
	let totalItemRevenue = $derived(
		data?.itemAnalytics?.reduce(
			(acc: number, i: ItemAnalyticsData) => acc + Number(i.revenueGenerated),
			0
		) ?? 0
	);

	onMount(() => {
		executeTabSyncLoad();
	});

	function executeTabSyncLoad() {
		if (activeTab === 'METRICS') {
			fetchAnalytics();
		} else {
			fetchOrdersFeed(true);
		}
	}

	async function fetchAnalytics() {
		isLoading = true;
		errorMessage = '';
		try {
			const params = new URLSearchParams({
				startDate: `${effectiveStart}T00:00:00Z`,
				endDate: `${effectiveEnd}T23:59:59Z`
			});
			const res = await fetch(`/api/admin/analytics?${params.toString()}`);
			const json = await res.json();
			if (res.ok && json.success) {
				data = json.data;
			} else {
				errorMessage = json.error || 'Failed to load analytics data.';
			}
		} catch {
			errorMessage = 'A network error occurred.';
		} finally {
			isLoading = false;
		}
	}

	async function fetchOrdersFeed(clearCurrent = true, cursor: string | null = null) {
		isFetchingOrdersFeed = true;
		if (clearCurrent) {
			feedOrders = [];
			nextCursor = null;
			hasNextPage = false;
		}

		try {
			const params = new SvelteURLSearchParams({
				startDate: `${effectiveStart}T00:00:00Z`,
				endDate: `${effectiveEnd}T23:59:59Z`,
				limit: '15'
			});
			if (cursor) params.set('cursor', cursor);

			const res = await fetch(`/api/admin/analytics/orders?${params.toString()}`);
			const json = await res.json();

			if (res.ok && json.success) {
				if (clearCurrent) {
					feedOrders = json.data.orders;
				} else {
					feedOrders = [...feedOrders, ...json.data.orders];
				}
				nextCursor = json.data.pagination.nextCursor;
				hasNextPage = json.data.pagination.hasNextPage;
			}
		} catch (err) {
			console.error('Failed to pull analytical orders stream', err);
		} finally {
			isFetchingOrdersFeed = false;
		}
	}

	function changeTab(tab: ActiveTab) {
		activeTab = tab;
		executeTabSyncLoad();
	}

	function selectPreset(p: Preset) {
		activePreset = p;
		if (p !== 'custom') executeTabSyncLoad();
	}

	function applyCustomRange() {
		executeTabSyncLoad();
	}

	function formatDateLabel(dateString: string, group: string) {
		const parts = dateString.split('-');
		if (parts.length < 3) return dateString;
		const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
		if (group === 'month')
			return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	function formatTimestamp(isoString: string): string {
		const d = new Date(isoString);
		return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	}

	function formatHour(h: number): string {
		if (h === 0) return '12a';
		if (h < 12) return `${h}a`;
		if (h === 12) return '12p';
		return `${h - 12}p`;
	}

	function formatGrowth(val: number | null): string {
		if (val === null) return '—';
		return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
	}

	function growthPositive(val: number | null) {
		return val !== null && val > 0;
	}
	function growthNegative(val: number | null) {
		return val !== null && val < 0;
	}

	const STATUS_STYLES: Record<string, { dot: string; label: string; text: string; bg: string }> = {
		COMPLETED: {
			dot: 'bg-emerald-500',
			label: 'Completed',
			text: 'text-emerald-600',
			bg: 'bg-emerald-500/10'
		},
		PENDING: {
			dot: 'bg-amber-400',
			label: 'Pending',
			text: 'text-amber-600',
			bg: 'bg-amber-500/10'
		},
		PROCESSING: {
			dot: 'bg-blue-400',
			label: 'Processing',
			text: 'text-blue-600',
			bg: 'bg-blue-500/10'
		},
		CANCELLED: {
			dot: 'bg-red-400',
			label: 'Cancelled',
			text: 'text-destructive',
			bg: 'bg-destructive/10'
		},
		READY: { dot: 'bg-violet-400', label: 'Ready', text: 'text-violet-600', bg: 'bg-violet-500/10' }
	};

	const CATEGORY_COLORS = [
		'bg-primary',
		'bg-emerald-500',
		'bg-violet-500',
		'bg-amber-400',
		'bg-rose-400',
		'bg-sky-400'
	];
</script>

<svelte:head><title>Analytics | Admin</title></svelte:head>

<div
	class="animate-in fade-in absolute inset-0 z-20 flex flex-col overflow-y-auto bg-background duration-300"
>
	<!-- Sticky Header -->
	<header class="sticky top-0 z-30 border-b border-muted/20 bg-background/90 backdrop-blur-md">
		<div
			class="flex h-16 shrink-0 items-center justify-between gap-3 bg-background/15 px-5 backdrop-blur-md"
		>
			<div>
				<AppLogo />
			</div>
			<div class="flex items-center justify-end gap-3">
				<div
					class="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-600"
				>
					<div class="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
					<span class="text-[9px] font-bold tracking-widest uppercase">Online</span>
				</div>

				<button
					onclick={executeTabSyncLoad}
					class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform active:scale-95"
				>
					<RefreshCw
						size={15}
						strokeWidth={2.5}
						class={isLoading || isFetchingOrdersFeed ? 'animate-spin' : ''}
					/>
				</button>
			</div>
		</div>

		<!-- Presets Filters -->
		<div class="flex scrollbar-none items-center gap-1.5 overflow-x-auto p-4">
			{#each PRESETS as p (p.key)}
				<button
					onclick={() => selectPreset(p.key)}
					class="shrink-0 rounded-xl px-3.5 py-1.5 text-[12px] font-bold transition-all {activePreset ===
					p.key
						? 'bg-foreground text-background'
						: 'bg-muted/20 text-foreground/50'}"
				>
					{p.label}
				</button>
			{/each}
		</div>

		<!-- Tab Controls -->
		<div class="flex gap-2 px-4 py-1.5">
			<button
				onclick={() => changeTab('METRICS')}
				class="flex-1 rounded-xl py-2 text-[12px] font-bold transition-all {activeTab === 'METRICS'
					? 'bg-primary text-background shadow-sm'
					: 'bg-muted/30 text-foreground/50'}"
			>
				Dashboard Overview
			</button>
			<button
				onclick={() => changeTab('ORDERS_LIST')}
				class="flex-1 rounded-xl py-2 text-[12px] font-bold transition-all {activeTab ===
				'ORDERS_LIST'
					? 'bg-primary text-background shadow-sm'
					: 'bg-muted/30 text-foreground/50'}"
			>
				Order Log Feed
			</button>
		</div>

		{#if activePreset === 'custom'}
			<div class="flex items-center gap-2 px-4 pb-3">
				<div class="flex min-w-70 flex-1 items-center gap-1.5 rounded-xl bg-muted/20 px-3 py-2">
					<input
						type="date"
						bind:value={customStart}
						class="min-w-0 flex-1 bg-transparent text-[12px] font-bold text-foreground outline-none"
					/>
					<span class="shrink-0 text-[10px] font-bold text-foreground/30">–</span>
					<input
						type="date"
						bind:value={customEnd}
						class="min-w-0 flex-1 bg-transparent text-[12px] font-bold text-foreground outline-none"
					/>
				</div>
				<button
					onclick={applyCustomRange}
					class="shrink-0 rounded-xl bg-primary px-4 py-2 text-[12px] font-bold text-primary-foreground transition-transform active:scale-95"
				>
					Apply
				</button>
			</div>
		{/if}
	</header>

	<!-- Content Area -->
	<div class="flex flex-col gap-4 px-4 py-4 pb-10">
		{#if activeTab === 'METRICS'}
			{#if errorMessage}
				<div
					class="flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-[13px] font-bold text-destructive"
				>
					<AlertCircle size={18} strokeWidth={2.5} />
					{errorMessage}
				</div>
			{/if}

			{#if isLoading && !data}
				<div class="flex h-52 items-center justify-center">
					<Loader2 size={30} strokeWidth={2.5} class="animate-spin text-primary" />
				</div>
			{:else if data}
				<!-- KPIs -->
				<div
					class="flex items-center justify-between rounded-2xl border border-muted/30 bg-card p-5 shadow-sm"
				>
					<div>
						<p class="mb-1 text-[10px] font-black tracking-widest text-foreground/40 uppercase">
							Total Revenue
						</p>
						<p class="font-mono text-[30px] leading-none font-black tracking-tight text-foreground">
							{formatCurrencyINR(Number(data.summary.totalRevenue))}
						</p>
						<div class="mt-2 flex items-center gap-1.5">
							{#if growthPositive(data.summary.revenueGrowth)}
								<TrendingUp size={12} strokeWidth={3} class="text-emerald-500" />
								<span class="text-[11px] font-bold text-emerald-500"
									>{formatGrowth(data.summary.revenueGrowth)} vs prior</span
								>
							{:else if growthNegative(data.summary.revenueGrowth)}
								<TrendingDown size={12} strokeWidth={3} class="text-red-400" />
								<span class="text-[11px] font-bold text-red-400"
									>{formatGrowth(data.summary.revenueGrowth)} vs prior</span
								>
							{:else}
								<Minus size={12} strokeWidth={3} class="text-foreground/25" />
								<span class="text-[11px] font-bold text-foreground/30">No prior period</span>
							{/if}
						</div>
					</div>
					<div
						class="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600"
					>
						<TrendingUp size={24} strokeWidth={2.5} />
					</div>
				</div>

				<div
					class="flex items-center justify-between rounded-2xl border border-muted/30 bg-card p-5 shadow-sm"
				>
					<div>
						<p class="mb-1 text-[10px] font-black tracking-widest text-foreground/40 uppercase">
							Total Orders
						</p>
						<p class="font-mono text-[30px] leading-none font-black tracking-tight text-foreground">
							{data.summary.totalOrders.toLocaleString()}
						</p>
						<div class="mt-2 flex items-center gap-1.5">
							{#if growthPositive(data.summary.ordersGrowth)}
								<TrendingUp size={12} strokeWidth={3} class="text-emerald-500" />
								<span class="text-[11px] font-bold text-emerald-500"
									>{formatGrowth(data.summary.ordersGrowth)} vs prior</span
								>
							{:else if growthNegative(data.summary.ordersGrowth)}
								<TrendingDown size={12} strokeWidth={3} class="text-red-400" />
								<span class="text-[11px] font-bold text-red-400"
									>{formatGrowth(data.summary.ordersGrowth)} vs prior</span
								>
							{:else}
								<Minus size={12} strokeWidth={3} class="text-foreground/25" />
								<span class="text-[11px] font-bold text-foreground/30">No prior period</span>
							{/if}
						</div>
					</div>
					<div
						class="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500"
					>
						<Receipt size={24} strokeWidth={2.5} />
					</div>
				</div>

				<div
					class="flex items-center justify-between rounded-2xl border border-muted/30 bg-card p-5 shadow-sm"
				>
					<div>
						<p class="mb-1 text-[10px] font-black tracking-widest text-foreground/40 uppercase">
							Avg Order Value
						</p>
						<p class="font-mono text-[30px] leading-none font-black tracking-tight text-foreground">
							{formatCurrencyINR(Number(data.summary.avgOrderValue))}
						</p>
						<p class="mt-2 text-[11px] font-bold text-foreground/35">
							{Number(data.summary.avgItemsPerOrder).toFixed(1)} items per order
						</p>
					</div>
					<div
						class="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-500"
					>
						<ShoppingBag size={24} strokeWidth={2.5} />
					</div>
				</div>

				<!-- SMART CONDITIONAL RENDER: Revenue Trend Section -->
				{#if data.groupBy !== 'none'}
					<div class="rounded-2xl border border-muted/30 bg-card p-4 shadow-sm">
						<div class="mb-4 flex items-center gap-2">
							<BarChart3 size={16} strokeWidth={2.5} class="text-primary" />
							<h3 class="text-[14px] font-black text-foreground">
								Revenue Trend ({data.groupBy} wise)
							</h3>
						</div>
						{#if data.timeSeries.length === 0}
							<div class="flex h-36 items-center justify-center rounded-xl bg-muted/10">
								<p class="text-[12px] font-bold text-foreground/30">No data available</p>
							</div>
						{:else}
							<div
								class="relative flex h-44 w-full scrollbar-none items-end gap-1.5 overflow-x-auto pb-6"
							>
								{#each data.timeSeries as point (point.period)}
									{@const heightPct =
										maxRevenue > 0 ? (Number(point.revenue) / maxRevenue) * 100 : 0}
									<div
										class="group relative flex h-full min-w-10 flex-1 flex-col items-center justify-end"
									>
										<div
											class="pointer-events-none absolute bottom-full z-10 mb-2 hidden flex-col items-center group-hover:flex"
										>
											<div
												class="rounded-xl bg-foreground px-2.5 py-1.5 text-center whitespace-nowrap shadow-xl"
											>
												<p class="font-mono text-[11px] font-bold text-background">
													{formatCurrencyINR(Number(point.revenue))}
												</p>
												<p class="text-[9px] font-bold text-background/60">{point.orders} orders</p>
											</div>
											<div
												class="h-0 w-0 border-x-[5px] border-t-[5px] border-x-transparent border-t-foreground"
											></div>
										</div>
										<div
											class="w-full cursor-default rounded-t-lg bg-primary/20 transition-all duration-500 hover:bg-primary"
											style="height: {Math.max(heightPct, 2)}%;"
										></div>
										<span class="absolute bottom-0 text-[8px] font-bold text-foreground/35"
											>{formatDateLabel(point.period, data.groupBy)}</span
										>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<!-- SMART CONDITIONAL RENDER: Peak Hours Section (Only shown for 1d / Today queries) -->
				{#if data.groupBy === 'none'}
					<div class="rounded-2xl border border-muted/30 bg-card p-4 shadow-sm">
						<div class="mb-4 flex items-center gap-2">
							<Clock size={16} strokeWidth={2.5} class="text-amber-500" />
							<h3 class="text-[14px] font-black text-foreground">Peak Intraday Run</h3>
						</div>
						{#if !data.peakHours || data.peakHours.length === 0}
							<p class="py-6 text-center text-[12px] font-bold text-foreground/30">
								No data available
							</p>
						{:else}
							<div class="space-y-3">
								<div class="grid grid-cols-12 gap-1">
									{#each Array.from({ length: 24 }, (_, i) => i) as h (h)}
										{@const entry = data.peakHours.find((p: PeakHourData) => p.hour === h)}
										{@const intensity =
											entry && maxHourOrders > 0 ? entry.orders / maxHourOrders : 0}
										<div
											class="group relative aspect-square rounded-md transition-all"
											style="background: color-mix(in oklch, var(--color-primary) {Math.round(
												intensity * 80 + (intensity > 0 ? 8 : 0)
											)}%, transparent);"
											title="{formatHour(h)}: {entry?.orders ?? 0} orders"
										>
											{#if entry && entry.orders > 0}
												<div
													class="pointer-events-none absolute inset-x-0 -top-8 z-10 hidden justify-center group-hover:flex"
												>
													<div
														class="rounded-lg bg-foreground px-1.5 py-0.5 whitespace-nowrap shadow-lg"
													>
														<p class="text-[9px] font-bold text-background">
															{formatHour(h)} · {entry.orders}
														</p>
													</div>
												</div>
											{/if}
										</div>
									{/each}
								</div>
								<div class="flex justify-between px-0.5 text-[9px] font-bold text-foreground/30">
									<span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>11p</span>
								</div>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Category Breakdown Section -->
				{#if data.categoryBreakdown && data.categoryBreakdown.length > 0}
					<div class="rounded-2xl border border-muted/30 bg-card p-4 shadow-sm">
						<div class="mb-4 flex items-center gap-2">
							<Tag size={16} strokeWidth={2.5} class="text-violet-500" />
							<h3 class="text-[14px] font-black text-foreground">By Category</h3>
						</div>
						<div class="space-y-4">
							{#each data.categoryBreakdown as cat, i (cat.category)}
								{@const pct =
									totalCategoryRevenue > 0 ? (Number(cat.revenue) / totalCategoryRevenue) * 100 : 0}
								<div>
									<div class="mb-1.5 flex items-center justify-between">
										<div class="flex items-center gap-2">
											<span
												class="h-2 w-2 rounded-full {CATEGORY_COLORS[i % CATEGORY_COLORS.length]}"
											></span>
											<span class="text-[13px] font-bold text-foreground capitalize"
												>{cat.category.toLowerCase()}</span
											>
										</div>
										<div class="flex items-center gap-3">
											<span class="text-[11px] font-bold text-foreground/40"
												>{cat.quantitySold} sold</span
											>
											<span class="font-mono text-[13px] font-black text-foreground"
												>{formatCurrencyINR(Number(cat.revenue))}</span
											>
										</div>
									</div>
									<div class="h-2 w-full overflow-hidden rounded-full bg-muted/30">
										<div
											class="h-full rounded-full transition-all duration-700 {CATEGORY_COLORS[
												i % CATEGORY_COLORS.length
											]}"
											style="width: {pct.toFixed(1)}%;"
										></div>
									</div>
									<p class="mt-1 text-right text-[9px] font-bold text-foreground/25">
										{pct.toFixed(1)}%
									</p>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Distribution Status Section -->
				{#if data.statusDistribution && data.statusDistribution.length > 0}
					{@const totalStatusCount = data.statusDistribution.reduce(
						(a: number, s: StatusData) => a + s.count,
						0
					)}
					<div class="rounded-2xl border border-muted/30 bg-card p-4 shadow-sm">
						<div class="mb-4 flex items-center gap-2">
							<Receipt size={16} strokeWidth={2.5} class="text-blue-500" />
							<h3 class="text-[14px] font-black text-foreground">Order Status</h3>
						</div>
						<div class="mb-4 flex h-3 w-full overflow-hidden rounded-full">
							{#each data.statusDistribution as s (s.status)}
								{@const style = STATUS_STYLES[s.status] ?? { dot: 'bg-muted', label: s.status }}
								<div
									class="{style.dot} h-full transition-all duration-700"
									style="width: {((s.count / totalStatusCount) * 100).toFixed(2)}%;"
									title="{style.label}: {s.count}"
								></div>
							{/each}
						</div>
						<div class="space-y-2">
							{#each data.statusDistribution as s (s.status)}
								{@const style = STATUS_STYLES[s.status] ?? { dot: 'bg-muted', label: s.status }}
								{@const pct = ((s.count / totalStatusCount) * 100).toFixed(1)}
								<div class="flex items-center justify-between rounded-xl bg-muted/15 px-4 py-2.5">
									<div class="flex items-center gap-2.5">
										<span class="h-2 w-2 rounded-full {style.dot}"></span>
										<span class="text-[13px] font-bold text-foreground">{style.label}</span>
									</div>
									<div class="flex items-baseline gap-1.5">
										<span class="font-mono text-[13px] font-black text-foreground">{s.count}</span>
										<span class="text-[10px] font-bold text-foreground/35">{pct}%</span>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Top Items Section -->
				<div class="rounded-2xl border border-muted/30 bg-card p-4 shadow-sm">
					<div class="mb-4 flex items-center gap-2">
						<Utensils size={16} strokeWidth={2.5} class="text-orange-500" />
						<h3 class="text-[14px] font-black text-foreground">Top Items</h3>
					</div>
					{#if data.itemAnalytics.length === 0}
						<p class="py-6 text-center text-[12px] font-bold text-foreground/30">
							No items sold in this period.
						</p>
					{:else}
						<div class="space-y-1">
							{#each data.itemAnalytics.slice(0, 10) as item, i (item.id)}
								{@const revShare =
									totalItemRevenue > 0
										? (Number(item.revenueGenerated) / totalItemRevenue) * 100
										: 0}
								<div class="rounded-xl px-3 py-3 transition-colors hover:bg-muted/10">
									<div class="mb-2 flex items-start justify-between gap-3">
										<div class="flex min-w-0 items-start gap-3">
											<span
												class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted/40 text-[9px] font-black text-foreground/50"
												>{i + 1}</span
											>
											<div class="min-w-0">
												<p class="truncate text-[13px] leading-tight font-bold text-foreground">
													{item.name}
												</p>
												<span
													class="text-[9px] font-bold tracking-widest text-foreground/35 uppercase"
													>{item.category}</span
												>
											</div>
										</div>
										<div class="shrink-0 text-right">
											<p class="font-mono text-[13px] font-black text-foreground">
												{formatCurrencyINR(Number(item.revenueGenerated))}
											</p>
											<p class="text-[9px] font-bold text-foreground/40">
												{item.quantitySold} sold · avg {formatCurrencyINR(
													Number(item.avgUnitPrice)
												)}
											</p>
										</div>
									</div>
									<div class="h-1 w-full overflow-hidden rounded-full bg-muted/20">
										<div
											class="h-full rounded-full bg-orange-400/70 transition-all duration-700"
											style="width: {revShare.toFixed(1)}%;"
										></div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		{:else if activeTab === 'ORDERS_LIST'}
			<!-- Order Log Feed Tab -->
			<div class="space-y-3">
				{#if feedOrders.length === 0 && !isFetchingOrdersFeed}
					<div class="rounded-2xl border border-muted/25 bg-card py-12 text-center">
						<p class="text-[13px] font-medium text-foreground/30">
							No orders registered during this timeframe.
						</p>
					</div>
				{:else}
					<div
						class="divide-y divide-muted/15 overflow-hidden rounded-2xl border border-muted/30 bg-card shadow-sm"
					>
						{#each feedOrders as order (order.id)}
							{@const style = STATUS_STYLES[order.status] ?? {
								text: 'text-foreground',
								bg: 'bg-muted'
							}}
							<div class="flex flex-col bg-card p-4">
								<div class="flex items-start justify-between gap-2">
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<span class="font-mono text-[14px] font-black text-foreground"
												>{order.ticketReference}</span
											>
											<span
												class="rounded px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase {style.bg} {style.text}"
												>{order.status}</span
											>
										</div>
										<div
											class="mt-1 flex items-center gap-1 text-[12px] font-bold text-foreground/60"
										>
											<User size={12} class="text-foreground/30" />
											<span class="truncate">{order.user.name}</span>
											<span class="font-normal text-foreground/30">({order.user.studentId})</span>
										</div>
									</div>
									<div class="shrink-0 text-right">
										<p class="font-mono text-[14px] font-black text-foreground">
											{formatCurrencyINR(Number(order.totalAmount))}
										</p>
										<p class="text-[9px] font-semibold tracking-wider text-foreground/35 uppercase">
											{formatTimestamp(order.createdAt)}
										</p>
									</div>
								</div>

								<div class="mt-2.5 ml-4 space-y-1 border-l border-muted/30 pl-2">
									{#each order.items as item (item.id)}
										<div
											class="flex items-center justify-between text-[11px] font-bold text-foreground/50"
										>
											<div class="flex items-center gap-1.5 truncate">
												<span class="font-mono text-foreground/30">{item.quantity}x</span>
												<div
													class="h-1.5 w-1.5 rounded-full {item.menuItem.dietary === 'veg'
														? 'bg-emerald-500'
														: 'bg-red-500'}"
												></div>
												<span class="truncate text-foreground/70">{item.menuItem.name}</span>
											</div>
											<span class="ml-2 shrink-0 font-mono text-foreground/40"
												>{formatCurrencyINR(Number(item.unitPrice) * item.quantity)}</span
											>
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</div>

					{#if hasNextPage}
						<button
							onclick={() => fetchOrdersFeed(false, nextCursor)}
							disabled={isFetchingOrdersFeed}
							class="w-full rounded-xl bg-muted/30 py-3 text-[12px] font-bold text-foreground transition-all active:scale-95 disabled:opacity-50"
						>
							{#if isFetchingOrdersFeed}
								<div class="flex items-center justify-center gap-1.5">
									<Loader2 size={14} class="animate-spin" /> Querying Next Batch...
								</div>
							{:else}
								Load Previous Orders
							{/if}
						</button>
					{/if}
				{/if}
			</div>
		{/if}
	</div>
</div>
