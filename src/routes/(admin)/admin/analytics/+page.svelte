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
		User,
		Search,
		X,
		Edit2
	} from 'lucide-svelte';
	import { formatCurrencyINR } from '$lib';
	import { SvelteDate, SvelteURLSearchParams } from 'svelte/reactivity';
	import AppLogo from '$lib/components/AppLogo.svelte';
	import { resolve } from '$app/paths';

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
		windowSize: number;
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
		user: { name: string; referenceKey: string; accountNumber: string };
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

	let isLoading: boolean = $state(true);
	let errorMessage: string = $state('');
	let data: AnalyticsResponse | null = $state<AnalyticsResponse | null>(null);
	let activeTab: ActiveTab = $state<ActiveTab>('METRICS');

	let feedOrders: OrderFeedRecord[] = $state<OrderFeedRecord[]>([]);
	let isFetchingOrdersFeed: boolean = $state(false);
	let nextCursor: string | null = $state<string | null>(null);
	let hasNextPage: boolean = $state(false);

	let activePreset: Preset = $state<Preset>('30d');
	let searchTicketRef: string = $state('');

	let customStart: string = $state(getDateString(29));
	let customEnd: string = $state(getDateString(0));

	let effectiveStart: string = $derived(
		activePreset === 'custom' ? customStart : datesForPreset(activePreset).start
	);
	let effectiveEnd: string = $derived(
		activePreset === 'custom' ? customEnd : datesForPreset(activePreset).end
	);

	let tappedBarIndex: number = $state(-1);
	let tappedHour: number = $state(-1);

	let maxHourOrders: number = $derived(
		data?.peakHours?.length ? Math.max(...data.peakHours.map((h: PeakHourData) => h.orders)) : 0
	);
	let totalCategoryRevenue: number = $derived(
		data?.categoryBreakdown?.reduce((acc: number, c: CategoryData) => acc + Number(c.revenue), 0) ??
			0
	);
	let totalItemRevenue: number = $derived(
		data?.itemAnalytics?.reduce(
			(acc: number, i: ItemAnalyticsData) => acc + Number(i.revenueGenerated),
			0
		) ?? 0
	);

	let chartPage: number = $state(0);

	let totalChartPages: number = $derived.by((): number => {
		const series = data?.timeSeries ?? [];
		const win = data?.windowSize ?? series.length;
		if (!win || series.length === 0) return 1;
		return Math.ceil(series.length / win);
	});

	let displayTimeSeries: TimeSeriesData[] = $derived.by((): TimeSeriesData[] => {
		const series = data?.timeSeries ?? [];
		const win = data?.windowSize;
		if (!win || series.length === 0) return series;
		const pages = Math.ceil(series.length / win);
		const forwardPage = pages - 1 - chartPage;
		const start = forwardPage * win;
		return series.slice(start, start + win);
	});

	let displayMaxRevenue: number = $derived(
		displayTimeSeries.length
			? Math.max(...displayTimeSeries.map((d: TimeSeriesData) => Number(d.revenue)))
			: 0
	);

	let tappedHourEntry: PeakHourData | null = $derived(
		tappedHour >= 0
			? (data?.peakHours?.find((p: PeakHourData) => p.hour === tappedHour) ?? null)
			: null
	);

	let selectedOrderForUpdate: OrderFeedRecord | null = $state<OrderFeedRecord | null>(null);
	let isUpdatingStatus: boolean = $state(false);

	onMount(() => {
		executeTabSyncLoad();
	});

	function executeTabSyncLoad(): void {
		tappedBarIndex = -1;
		tappedHour = -1;
		chartPage = 0;
		if (activeTab === 'METRICS') {
			fetchAnalytics();
		} else {
			fetchOrdersFeed(true);
		}
	}

	async function fetchAnalytics(): Promise<void> {
		isLoading = true;
		errorMessage = '';
		try {
			const params = new SvelteURLSearchParams();
			if (searchTicketRef.trim()) {
				params.set('ticketReference', searchTicketRef.trim());
			} else {
				params.set('startDate', `${effectiveStart}T00:00:00Z`);
				params.set('endDate', `${effectiveEnd}T23:59:59Z`);
			}
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

	async function fetchOrdersFeed(
		clearCurrent: boolean = true,
		cursor: string | null = null
	): Promise<void> {
		isFetchingOrdersFeed = true;
		if (clearCurrent) {
			feedOrders = [];
			nextCursor = null;
			hasNextPage = false;
		}

		try {
			const params = new SvelteURLSearchParams({ limit: '15' });
			if (searchTicketRef.trim()) {
				params.set('ticketReference', searchTicketRef.trim());
			} else {
				params.set('startDate', `${effectiveStart}T00:00:00Z`);
				params.set('endDate', `${effectiveEnd}T23:59:59Z`);
			}
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
			console.error(err);
		} finally {
			isFetchingOrdersFeed = false;
		}
	}

	async function updateOrderStatus(
		orderId: string,
		newStatus: 'COMPLETED' | 'CANCELLED'
	): Promise<void> {
		isUpdatingStatus = true;
		try {
			const res = await fetch(resolve('/api/tickets/[id]/status', { id: orderId }), {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					'X-Engine-Token': '38d6960a32cda66ce327d44d358755f706420303e11825a34eca38544a07e2c7'
				},
				body: JSON.stringify({ status: newStatus })
			});
			const json = await res.json();
			if (res.ok && json.success) {
				feedOrders = feedOrders.map((o: OrderFeedRecord) =>
					o.id === orderId ? { ...o, status: newStatus } : o
				);
				selectedOrderForUpdate = null;
			}
		} catch (err) {
			console.error(err);
		} finally {
			isUpdatingStatus = false;
		}
	}

	function changeTab(tab: ActiveTab): void {
		activeTab = tab;
		executeTabSyncLoad();
	}

	function selectPreset(p: Preset): void {
		activePreset = p;
		if (p !== 'custom') executeTabSyncLoad();
	}

	function applyCustomRange(): void {
		executeTabSyncLoad();
	}

	function handleSearchKeyDown(e: KeyboardEvent): void {
		if (e.key === 'Enter') {
			if (searchTicketRef.trim() && activeTab !== 'ORDERS_LIST') {
				activeTab = 'ORDERS_LIST';
			}
			executeTabSyncLoad();
		}
	}

	function clearSearch(): void {
		searchTicketRef = '';
		executeTabSyncLoad();
	}

	function handleBarTap(index: number): void {
		tappedBarIndex = tappedBarIndex === index ? -1 : index;
	}

	function handleHourTap(h: number): void {
		tappedHour = tappedHour === h ? -1 : h;
	}

	function formatAxisLabel(dateString: string, group: string): string {
		if (group === 'week' || group === 'month') {
			const index =
				data?.timeSeries?.findIndex((p: TimeSeriesData) => p.period === dateString) ?? 0;
			return `${group === 'week' ? 'Week' : 'Month'} ${index + 1}`;
		}

		const parts = dateString.split('-');
		if (parts.length < 3) return dateString;
		const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	function formatDetailLabel(dateString: string, group: string): string {
		const parts = dateString.split('-');
		if (parts.length < 3) return dateString;

		const start = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
		const formatOpt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

		if (group === 'week') {
			const end = new SvelteDate(start);
			end.setDate(end.getDate() + 6);
			return `${start.toLocaleDateString(undefined, formatOpt)} - ${end.toLocaleDateString(undefined, formatOpt)}`;
		}

		if (group === 'month') {
			const end = new SvelteDate(start);
			end.setMonth(end.getMonth() + 1);
			return `${start.toLocaleDateString(undefined, formatOpt)} - ${end.toLocaleDateString(undefined, formatOpt)}`;
		}

		return start.toLocaleDateString(undefined, formatOpt);
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

	function growthPositive(val: number | null): boolean {
		return val !== null && val > 0;
	}

	function growthNegative(val: number | null): boolean {
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
		READY: {
			dot: 'bg-violet-400',
			label: 'Ready',
			text: 'text-violet-600',
			bg: 'bg-violet-500/10'
		},
		PRINTING: { dot: 'bg-cyan-400', label: 'Printing', text: 'text-cyan-600', bg: 'bg-cyan-500/10' }
	};

	const CATEGORY_COLORS: string[] = [
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

		<div class="flex items-center gap-2 px-4 pt-2 pb-1">
			<div
				class="flex flex-1 items-center gap-2 rounded-xl border border-muted/10 bg-muted/20 px-3 py-1.5 focus-within:border-primary/30"
			>
				<Search size={14} class="shrink-0 text-foreground/40" />
				<input
					type="text"
					placeholder="Search ticket reference..."
					bind:value={searchTicketRef}
					onkeydown={handleSearchKeyDown}
					class="min-w-0 flex-1 bg-transparent text-[12px] font-medium text-foreground outline-none placeholder:text-foreground/30"
				/>
				{#if searchTicketRef}
					<button onclick={clearSearch} class="text-foreground/40 hover:text-foreground">
						<X size={14} />
					</button>
				{/if}
			</div>
		</div>

		<div
			class="flex scrollbar-none items-center gap-1.5 overflow-x-auto p-4 opacity={searchTicketRef
				? 0.4
				: 1} class:pointer-events-none={searchTicketRef}"
		>
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

		<div class="mx-3 flex gap-2 rounded-2xl border border-accent/10 bg-accent/5 p-1.5">
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

		{#if activePreset === 'custom' && !searchTicketRef}
			<div class="flex items-center gap-2 px-4 pt-2 pb-3">
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
				{#if searchTicketRef}
					<div
						class="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-[12px] font-medium text-amber-700"
					>
						Showing scope analytics filtered exclusively for ticket <strong
							>{searchTicketRef}</strong
						>. Clear search to resume timeline metrics.
					</div>
				{/if}

				<div
					class="flex items-center justify-between rounded-2xl border border-muted/30 bg-card p-5 shadow-sm"
				>
					<div>
						<p class="mb-1 text-[10px] font-bold tracking-widest text-foreground/40 uppercase">
							Total Revenue
						</p>
						<p class="font-mono text-[30px] leading-none font-bold tracking-tight text-foreground">
							{formatCurrencyINR(Number(data.summary.totalRevenue))}
						</p>
						<div class="mt-2 flex items-center gap-1.5">
							{#if !searchTicketRef && growthPositive(data.summary.revenueGrowth)}
								<TrendingUp size={12} strokeWidth={3} class="text-emerald-500" />
								<span class="text-[11px] font-bold text-emerald-500"
									>{formatGrowth(data.summary.revenueGrowth)} vs prior</span
								>
							{:else if !searchTicketRef && growthNegative(data.summary.revenueGrowth)}
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
						<p class="mb-1 text-[10px] font-bold tracking-widest text-foreground/40 uppercase">
							Total Orders
						</p>
						<p class="font-mono text-[30px] leading-none font-bold tracking-tight text-foreground">
							{data.summary.totalOrders.toLocaleString()}
						</p>
						<div class="mt-2 flex items-center gap-1.5">
							{#if !searchTicketRef && growthPositive(data.summary.ordersGrowth)}
								<TrendingUp size={12} strokeWidth={3} class="text-emerald-500" />
								<span class="text-[11px] font-bold text-emerald-500"
									>{formatGrowth(data.summary.ordersGrowth)} vs prior</span
								>
							{:else if !searchTicketRef && growthNegative(data.summary.ordersGrowth)}
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
						<p class="mb-1 text-[10px] font-bold tracking-widest text-foreground/40 uppercase">
							Avg Order Value
						</p>
						<p class="font-mono text-[30px] leading-none font-bold tracking-tight text-foreground">
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

				{#if data.groupBy !== 'none'}
					{@const pages = totalChartPages}
					{@const series = displayTimeSeries}
					<div class="rounded-2xl border border-muted/30 bg-card p-4 shadow-sm">
						<div class="mb-3 flex items-center justify-between gap-2">
							<div class="flex items-center gap-2">
								<BarChart3 size={16} strokeWidth={2.5} class="text-primary" />
								<h3 class="text-[14px] font-bold text-foreground">
									Revenue Trend <span
										class="ml-1 text-[12px] font-semibold text-foreground/50 capitalize"
										>({data.groupBy === 'day'
											? 'Daily'
											: data.groupBy === 'week'
												? 'Weekly'
												: 'Monthly'})</span
									>
								</h3>
							</div>
							{#if pages > 1}
								<div class="flex items-center gap-1">
									<button
										type="button"
										onclick={() => {
											chartPage = Math.min(chartPage + 1, pages - 1);
											tappedBarIndex = -1;
										}}
										disabled={chartPage >= pages - 1}
										class="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/20 text-foreground/50 transition-all active:scale-95 disabled:opacity-25"
										aria-label="Older"
									>
										<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
											<path
												d="M7.5 2L3.5 6L7.5 10"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
										</svg>
									</button>
									<span class="min-w-8 text-center text-[10px] font-bold text-foreground/40">
										{chartPage + 1}/{pages}
									</span>
									<button
										type="button"
										onclick={() => {
											chartPage = Math.max(chartPage - 1, 0);
											tappedBarIndex = -1;
										}}
										disabled={chartPage <= 0}
										class="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/20 text-foreground/50 transition-all active:scale-95 disabled:opacity-25"
										aria-label="Newer"
									>
										<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
											<path
												d="M4.5 2L8.5 6L4.5 10"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
										</svg>
									</button>
								</div>
							{/if}
						</div>

						<div class="mb-3 h-10 rounded-xl bg-muted/15 px-3 py-2">
							{#if tappedBarIndex >= 0 && series[tappedBarIndex]}
								{@const pt = series[tappedBarIndex]}
								<div class="flex items-center justify-between">
									<span class="text-[11px] font-bold text-foreground/60">
										{formatDetailLabel(pt.period, data.groupBy)}
									</span>
									<div class="flex items-center gap-3">
										<span class="text-[11px] font-bold text-foreground/40">{pt.orders} orders</span>
										<span class="font-mono text-[13px] font-bold text-primary">
											{formatCurrencyINR(Number(pt.revenue))}
										</span>
									</div>
								</div>
							{:else}
								<p class="text-[11px] font-bold text-foreground/25">Tap a bar to see details</p>
							{/if}
						</div>

						{#if series.length === 0}
							<div class="flex h-36 items-center justify-center rounded-xl bg-muted/10">
								<p class="text-[12px] font-bold text-foreground/30">No data available</p>
							</div>
						{:else}
							<div class="relative flex h-40 w-full items-end gap-1.5 pb-6">
								{#each series as point, i (point.period)}
									{@const heightPct =
										displayMaxRevenue > 0 ? (Number(point.revenue) / displayMaxRevenue) * 100 : 0}
									{@const isTapped = tappedBarIndex === i}
									<button
										type="button"
										onclick={() => handleBarTap(i)}
										class="relative flex h-full flex-1 flex-col items-center justify-end focus:outline-none"
										aria-label="{formatDetailLabel(point.period, data.groupBy)}: {formatCurrencyINR(
											Number(point.revenue)
										)}"
									>
										<div
											class="w-full rounded-t-lg transition-all duration-300 {isTapped
												? 'bg-primary'
												: 'bg-primary/25'}"
											style="height: {Math.max(heightPct, 2)}%;"
										></div>
										<span
											class="absolute bottom-0 text-[8px] leading-none font-bold text-foreground/50"
										>
											{formatAxisLabel(point.period, data.groupBy)}
										</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				{#if data.groupBy === 'none'}
					<div class="rounded-2xl border border-muted/30 bg-card p-4 shadow-sm">
						<div class="mb-4 flex items-center gap-2">
							<Clock size={16} strokeWidth={2.5} class="text-amber-500" />
							<h3 class="text-[14px] font-bold text-foreground">Peak Intraday Run</h3>
						</div>
						{#if !data.peakHours || data.peakHours.length === 0}
							<p class="py-6 text-center text-[12px] font-bold text-foreground/30">
								No data available
							</p>
						{:else}
							<div class="space-y-3">
								<div class="h-10 rounded-xl bg-muted/15 px-3 py-2">
									{#if tappedHour >= 0}
										<div class="flex items-center justify-between">
											<span class="text-[11px] font-bold text-foreground/60">
												{formatHour(tappedHour)}
											</span>
											{#if tappedHourEntry}
												<div class="flex items-center gap-3">
													<span class="text-[11px] font-bold text-foreground/40"
														>{tappedHourEntry.orders} orders</span
													>
													<span class="font-mono text-[13px] font-bold text-amber-500">
														{formatCurrencyINR(Number(tappedHourEntry.revenue))}
													</span>
												</div>
											{:else}
												<span class="text-[11px] font-bold text-foreground/30"
													>No orders this hour</span
												>
											{/if}
										</div>
									{:else}
										<p class="text-[11px] font-bold text-foreground/25">
											Tap a cell to see details
										</p>
									{/if}
								</div>

								<div class="grid grid-cols-12 gap-1">
									{#each Array.from({ length: 24 }, (_, i) => i) as h (h)}
										{@const entry = data.peakHours.find((p: PeakHourData) => p.hour === h)}
										{@const intensity =
											entry && maxHourOrders > 0 ? entry.orders / maxHourOrders : 0}
										{@const isTapped = tappedHour === h}
										<button
											type="button"
											onclick={() => handleHourTap(h)}
											class="aspect-square rounded-md transition-all focus:outline-none {isTapped
												? 'ring-2 ring-amber-400 ring-offset-1'
												: ''}"
											style="background: color-mix(in oklch, var(--color-primary) {Math.round(
												intensity * 80 + (intensity > 0 ? 8 : 0)
											)}%, transparent);"
											aria-label="{formatHour(h)}: {entry?.orders ?? 0} orders"
										></button>
									{/each}
								</div>
								<div class="flex justify-between px-0.5 text-[9px] font-bold text-foreground/30">
									<span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>11p</span>
								</div>
							</div>
						{/if}
					</div>
				{/if}

				{#if data.categoryBreakdown && data.categoryBreakdown.length > 0}
					<div class="rounded-2xl border border-muted/30 bg-card p-4 shadow-sm">
						<div class="mb-4 flex items-center gap-2">
							<Tag size={16} strokeWidth={2.5} class="text-violet-500" />
							<h3 class="text-[14px] font-bold text-foreground">By Category</h3>
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
											<span class="font-mono text-[13px] font-bold text-foreground"
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

				{#if data.statusDistribution && data.statusDistribution.length > 0}
					{@const totalStatusCount = data.statusDistribution.reduce(
						(a: number, s: StatusData) => a + s.count,
						0
					)}
					<div class="rounded-2xl border border-muted/30 bg-card p-4 shadow-sm">
						<div class="mb-4 flex items-center gap-2">
							<Receipt size={16} strokeWidth={2.5} class="text-blue-500" />
							<h3 class="text-[14px] font-bold text-foreground">Order Status</h3>
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
										<span class="font-mono text-[13px] font-bold text-foreground">{s.count}</span>
										<span class="text-[10px] font-bold text-foreground/35">{pct}%</span>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<div class="rounded-2xl border border-muted/30 bg-card p-4 shadow-sm">
					<div class="mb-4 flex items-center gap-2">
						<Utensils size={16} strokeWidth={2.5} class="text-orange-500" />
						<h3 class="text-[14px] font-bold text-foreground">Top Items</h3>
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
								<div class="rounded-xl px-3 py-3 transition-colors active:bg-muted/10">
									<div class="mb-2 flex items-start justify-between gap-3">
										<div class="flex min-w-0 items-start gap-3">
											<span
												class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted/40 text-[9px] font-bold text-foreground/50"
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
											<p class="font-mono text-[13px] font-bold text-foreground">
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
			<div class="space-y-3">
				{#if searchTicketRef}
					<div
						class="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-[12px] font-medium text-amber-700"
					>
						<span>Showing search results for ticket: <strong>{searchTicketRef}</strong></span>
						<button
							onclick={clearSearch}
							class="text-[11px] font-bold tracking-wide text-amber-900 uppercase underline"
							>Clear</button
						>
					</div>
				{/if}

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
										<div class="flex flex-wrap items-center gap-2">
											<span class="font-mono text-[14px] font-bold text-foreground"
												>{order.ticketReference}</span
											>
											<span
												class="rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase {style.bg} {style.text}"
												>{order.status}</span
											>
											{#if order.status === 'PRINTING'}
												<button
													onclick={() => (selectedOrderForUpdate = order)}
													class="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary active:scale-95"
												>
													<Edit2 size={10} /> Update Status
												</button>
											{/if}
										</div>
										<div
											class="mt-1 flex items-center gap-1 text-[12px] font-bold text-foreground/60"
										>
											<User size={12} class="text-foreground/30" />
											<span class="truncate">{order.user.name}</span>
											<span class="font-normal text-foreground/70">({order.user.referenceKey})</span
											>
										</div>
									</div>
									<div class="shrink-0 text-right">
										<p class="font-mono text-[14px] font-bold text-foreground">
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

{#if selectedOrderForUpdate}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
	>
		<div class="w-full max-w-sm rounded-2xl border border-muted/30 bg-card p-5 shadow-lg">
			<h4 class="mb-1 text-[15px] font-bold text-foreground">Update Order Status</h4>
			<p class="mb-4 font-mono text-[12px] text-foreground/50">
				Ticket: {selectedOrderForUpdate.ticketReference}
			</p>

			<div class="mb-4 space-y-2">
				<button
					onclick={() => updateOrderStatus(selectedOrderForUpdate!.id, 'COMPLETED')}
					disabled={isUpdatingStatus}
					class="flex w-full items-center justify-between rounded-xl bg-emerald-500/10 px-4 py-2.5 text-left text-[13px] font-bold text-emerald-600 transition-colors hover:bg-emerald-500/20"
				>
					<span>Mark as Completed</span>
				</button>
				<button
					onclick={() => updateOrderStatus(selectedOrderForUpdate!.id, 'CANCELLED')}
					disabled={isUpdatingStatus}
					class="flex w-full items-center justify-between rounded-xl bg-destructive/10 px-4 py-2.5 text-left text-[13px] font-bold text-destructive transition-colors hover:bg-destructive/20"
				>
					<span>Cancel & Refund Order</span>
				</button>
			</div>

			{#if isUpdatingStatus}
				<div class="flex items-center justify-center py-2">
					<Loader2 size={20} class="animate-spin text-primary" />
				</div>
			{/if}

			<button
				onclick={() => (selectedOrderForUpdate = null)}
				disabled={isUpdatingStatus}
				class="w-full rounded-xl bg-muted/40 py-2 text-[12px] font-bold text-foreground transition-all hover:bg-muted/60"
			>
				Close
			</button>
		</div>
	</div>
{/if}
