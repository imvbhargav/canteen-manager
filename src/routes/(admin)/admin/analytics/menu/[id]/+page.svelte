<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import {
		ArrowLeft,
		ShoppingBag,
		Users,
		IndianRupee,
		Loader2,
		Receipt,
		Trophy,
		CalendarDays,
		ScrollText,
		ChevronDown,
		Clock,
		CheckCircle2,
		Circle,
		BarChart3
	} from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import { SvelteDate } from 'svelte/reactivity';
	import { formatCurrencyINR } from '$lib';

	// ── Types ──────────────────────────────────────────────────────
	interface AnalyticsSummary {
		totalQuantity: number;
		totalRevenue: string;
		totalOrders: number;
		uniqueCustomers: number;
		avgOrderValue: string;
	}

	interface TimelineStat {
		date: string;
		quantity: number;
		revenue: string;
	}

	interface ItemMeta {
		name: string;
		category: string;
		price: string;
		isArchived: boolean;
	}

	interface OrderRow {
		ticketId: string;
		ticketReference: string;
		totalAmount: string;
		status: 'PENDING' | 'READY' | 'COMPLETED' | 'CANCELLED';
		createdAt: string;
		quantity: number;
		unitPrice: string;
		buyerName: string;
		buyerStudentId: string;
		buyerRollNumber: string;
	}

	type RangeKey = 'today' | '7d' | '30d' | 'all' | 'custom';
	type TabKey = 'overview' | 'orders';

	const RANGES: { key: RangeKey; label: string }[] = [
		{ key: 'today', label: 'Today' },
		{ key: '7d', label: '7 days' },
		{ key: '30d', label: '30 days' },
		{ key: 'all', label: 'All time' },
		{ key: 'custom', label: 'Custom' }
	];

	// ── Tab state ──────────────────────────────────────────────────
	let activeTab: TabKey = $state('overview');

	// ── Range state ────────────────────────────────────────────────
	let currentRange: RangeKey = $state('30d');

	const today = new Date();
	const prior14 = new SvelteDate(today);
	prior14.setDate(today.getDate() - 13);
	const fmt = (d: Date) => d.toISOString().slice(0, 10);

	let startDate: string = $state(fmt(prior14));
	let endDate: string = $state(fmt(today));
	let pendingStart: string = $state(fmt(prior14));
	let pendingEnd: string = $state(fmt(today));

	// ── Analytics state ────────────────────────────────────────────
	let isLoading: boolean = $state(true);
	let errorMsg: string = $state('');
	let meta: ItemMeta | null = $state(null);
	let summary: AnalyticsSummary | null = $state(null);
	let timelineList: TimelineStat[] = $state([]);

	// ── Orders state ───────────────────────────────────────────────
	let orders: OrderRow[] = $state([]);
	let ordersLoading: boolean = $state(false);
	let ordersError: string = $state('');
	let nextCursor: string | null = $state(null);
	let hasNextPage: boolean = $state(false);
	// Track whether orders have been fetched for the current range yet
	let ordersFetched: boolean = $state(false);

	const menuItemId = page.params.id;

	// ── Helpers ─────────────────────────────────────────────────

	function topDays(list: TimelineStat[], n = 5): TimelineStat[] {
		return list
			.slice()
			.sort((a, b) => Number(b.revenue) - Number(a.revenue))
			.slice(0, n);
	}

	function bestDay(list: TimelineStat[]): TimelineStat | null {
		if (!list.length) return null;
		return list.reduce((best, d) => (Number(d.revenue) > Number(best.revenue) ? d : best));
	}

	function formatDate(iso: string): string {
		const [y, m, d] = iso.split('-');
		const months = [
			'Jan',
			'Feb',
			'Mar',
			'Apr',
			'May',
			'Jun',
			'Jul',
			'Aug',
			'Sep',
			'Oct',
			'Nov',
			'Dec'
		];
		return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
	}

	function formatDateShort(iso: string): string {
		const [, m, d] = iso.split('-');
		const months = [
			'Jan',
			'Feb',
			'Mar',
			'Apr',
			'May',
			'Jun',
			'Jul',
			'Aug',
			'Sep',
			'Oct',
			'Nov',
			'Dec'
		];
		return `${months[parseInt(m) - 1]} ${parseInt(d)}`;
	}

	function formatDateTime(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleString('en-IN', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: true,
			timeZone: 'Asia/Kolkata'
		});
	}

	function rangeParams(range: RangeKey, sd: string, ed: string): string {
		let p = `range=${range}`;
		if (range === 'custom') p += `&startDate=${sd}&endDate=${ed}`;
		return p;
	}

	// ── Analytics fetch ────────────────────────────────────────────
	async function loadAnalytics(range: RangeKey, sd?: string, ed?: string): Promise<void> {
		isLoading = true;
		errorMsg = '';
		// Invalidate orders for the new range
		orders = [];
		nextCursor = null;
		hasNextPage = false;
		ordersError = '';
		ordersFetched = false;

		try {
			const qs = rangeParams(range, sd ?? startDate, ed ?? endDate);
			const res = await fetch(`/api/menu/${menuItemId}/analytics?${qs}`);
			const data = await res.json();
			if (res.ok && data.success) {
				meta = data.meta;
				summary = data.summary;
				timelineList = data.timeline;
			} else {
				errorMsg = data.error || 'Failed to load analytics.';
			}
		} catch {
			errorMsg = 'Network error. Please try again.';
		} finally {
			isLoading = false;
		}

		// If the orders tab is already open, fetch immediately
		if (activeTab === 'orders') {
			await loadOrders(range, sd ?? startDate, ed ?? endDate, null, true);
		}
	}

	// ── Orders fetch ───────────────────────────────────────────────
	async function loadOrders(
		range: RangeKey,
		sd: string,
		ed: string,
		cursor: string | null,
		replace = false
	): Promise<void> {
		ordersLoading = true;
		ordersError = '';
		try {
			let qs = rangeParams(range, sd, ed);
			if (cursor) qs += `&cursor=${encodeURIComponent(cursor)}`;
			qs += '&limit=20';

			const res = await fetch(`/api/menu/${menuItemId}/orders?${qs}`);
			const data = await res.json();
			if (res.ok && data.success) {
				const incoming: OrderRow[] = data.data.orders;
				orders = replace ? incoming : [...orders, ...incoming];
				nextCursor = data.data.pagination.nextCursor;
				hasNextPage = data.data.pagination.hasNextPage;
				ordersFetched = true;
			} else {
				ordersError = data.error || 'Failed to load orders.';
			}
		} catch {
			ordersError = 'Network error loading orders.';
		} finally {
			ordersLoading = false;
		}
	}

	function loadMoreOrders(): void {
		if (!hasNextPage || ordersLoading || !nextCursor) return;
		loadOrders(currentRange, startDate, endDate, nextCursor, false);
	}

	// ── Tab switch ─────────────────────────────────────────────────
	function switchTab(tab: TabKey): void {
		activeTab = tab;
		// Lazy-load orders on first visit to the tab for this range
		if (tab === 'orders' && !ordersFetched && !ordersLoading) {
			loadOrders(currentRange, startDate, endDate, null, true);
		}
	}

	// ── Range change ───────────────────────────────────────────────
	function handleRangeChange(r: RangeKey): void {
		currentRange = r;
		if (r !== 'custom') loadAnalytics(r);
	}

	function applyCustomRange(): void {
		if (!pendingStart || !pendingEnd || pendingStart > pendingEnd) return;
		startDate = pendingStart;
		endDate = pendingEnd;
		loadAnalytics('custom', startDate, endDate);
	}

	onMount(() => loadAnalytics(currentRange));
</script>

<svelte:head>
	<title>{meta ? `${meta.name} — Analytics` : 'Analytics'} | Admin</title>
</svelte:head>

<div class="min-h-screen bg-background pb-20 text-foreground">
	<!-- ── Sticky header ────────────────────────────────────────── -->
	<header class="sticky top-0 z-20 border-b border-muted/20 bg-background/80 backdrop-blur-md">
		<div class="flex h-14 items-center gap-3 px-4">
			<a
				href={resolve('/admin')}
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/40 text-foreground/60 transition-all hover:bg-muted/70 active:scale-90"
			>
				<ArrowLeft size={15} strokeWidth={2.5} />
			</a>
			<div class="min-w-0 flex-1">
				{#if meta}
					<p class="truncate text-[13px] font-bold tracking-tight">{meta.name}</p>
					<p class="text-[10px] font-semibold tracking-widest text-foreground/40 uppercase">
						Analytics
					</p>
				{:else}
					<p class="text-[13px] font-bold tracking-tight">Analytics</p>
				{/if}
			</div>
		</div>

		<!-- Range pills -->
		<div class="flex scrollbar-none gap-1 overflow-x-auto px-4 pb-3">
			{#each RANGES as r (r.key)}
				<button
					onclick={() => handleRangeChange(r.key)}
					class="shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-bold tracking-wider uppercase transition-all
						{currentRange === r.key
						? 'bg-foreground text-background'
						: 'bg-muted/30 text-foreground/50 hover:bg-muted/50 hover:text-foreground/80'}"
				>
					{r.label}
				</button>
			{/each}
		</div>
	</header>

	<!-- ── Page body ─────────────────────────────────────────────── -->
	<div class="flex flex-col gap-3 px-4 pt-4">
		<!-- ── Custom date picker ──────────────────────────────────── -->
		{#if currentRange === 'custom'}
			<div class="space-y-3 rounded-2xl border border-muted/30 bg-card p-4">
				<p class="text-[11px] font-bold tracking-widest text-foreground/40 uppercase">
					Select date range
				</p>
				<div class="grid grid-cols-2 gap-2">
					<div class="space-y-1">
						<label
							for="start-date"
							class="block text-[10px] font-bold tracking-wider text-foreground/40 uppercase"
							>From</label
						>
						<input
							id="start-date"
							type="date"
							bind:value={pendingStart}
							max={pendingEnd}
							class="w-full rounded-xl border border-muted/40 bg-muted/20 px-3 py-2 text-[13px] font-semibold text-foreground scheme-dark outline-none focus:border-foreground/40"
						/>
					</div>
					<div class="space-y-1">
						<label
							for="end-date"
							class="block text-[10px] font-bold tracking-wider text-foreground/40 uppercase"
							>To</label
						>
						<input
							id="end-date"
							type="date"
							bind:value={pendingEnd}
							min={pendingStart}
							max={fmt(today)}
							class="w-full rounded-xl border border-muted/40 bg-muted/20 px-3 py-2 text-[13px] font-semibold text-foreground scheme-dark outline-none focus:border-foreground/40"
						/>
					</div>
				</div>
				<button
					onclick={applyCustomRange}
					disabled={!pendingStart || !pendingEnd || pendingStart > pendingEnd}
					class="w-full rounded-xl bg-foreground py-2.5 text-[12px] font-bold tracking-widest text-background uppercase transition-all active:scale-[0.98] disabled:opacity-40"
				>
					Apply range
				</button>
			</div>
		{/if}

		<!-- ── First-load spinner ──────────────────────────────────── -->
		{#if isLoading && !meta}
			<div class="flex flex-col items-center justify-center gap-3 py-24">
				<Loader2 size={26} strokeWidth={2} class="animate-spin text-foreground/30" />
				<p class="text-[11px] font-bold tracking-widest text-foreground/30 uppercase">Loading…</p>
			</div>

			<!-- ── Error ───────────────────────────────────────────────── -->
		{:else if errorMsg}
			<div class="rounded-2xl border border-destructive/20 bg-destructive/10 p-5 text-center">
				<p class="text-[13px] font-semibold text-destructive">{errorMsg}</p>
			</div>
		{:else}
			<!-- ── Item card ────────────────────────────────────────── -->
			<div class="rounded-2xl border border-muted/25 bg-card p-4">
				<div class="flex items-end justify-between gap-3">
					<div class="min-w-0">
						<div class="mb-1.5 flex flex-wrap items-center gap-1.5">
							<span
								class="rounded-md bg-primary/10 px-2 py-0.5 text-[9px] font-bold tracking-widest text-primary uppercase"
							>
								{meta?.category}
							</span>
							{#if meta?.isArchived}
								<span
									class="rounded-md bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold tracking-widest text-amber-500 uppercase"
								>
									Archived
								</span>
							{/if}
						</div>
						<h2 class="text-2xl leading-tight font-black tracking-tight">
							{meta?.name}
						</h2>
					</div>
					<div class="shrink-0 text-right">
						<p class="text-[9px] font-bold tracking-widest text-foreground/40 uppercase">Price</p>
						<p class="font-mono text-xl font-bold">₹{meta?.price}</p>
					</div>
				</div>
			</div>

			<!-- ── Tab switcher ──────────────────────────────────────── -->
			<div class="grid grid-cols-2 gap-1.5 rounded-2xl border border-accent/10 bg-accent/5 p-1.5">
				<button
					onclick={() => switchTab('overview')}
					class="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-bold tracking-wider uppercase transition-all
						{activeTab === 'overview'
						? 'bg-primary text-background shadow-sm'
						: 'text-foreground/40 hover:text-foreground/60'}"
				>
					<BarChart3 size={12} strokeWidth={2.5} />
					Overview
				</button>
				<button
					onclick={() => switchTab('orders')}
					class="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-bold tracking-wider uppercase transition-all
						{activeTab === 'orders'
						? 'bg-primary text-background shadow-sm'
						: 'text-foreground/40 hover:text-foreground/60'}"
				>
					<ScrollText size={12} strokeWidth={2.5} />
					Orders
				</button>
			</div>

			<!-- ══════════════════════════════════════════════════════ -->
			<!-- TAB: OVERVIEW                                          -->
			<!-- ══════════════════════════════════════════════════════ -->
			{#if activeTab === 'overview'}
				<!-- Stat grid (2 × 2) -->
				{#if isLoading}
					<div class="grid grid-cols-2 gap-3">
						{#each [0, 1, 2, 3] as _ (_)}
							<div class="h-24 animate-pulse rounded-2xl bg-muted/20"></div>
						{/each}
					</div>
				{:else}
					<div class="grid grid-cols-2 gap-3">
						<div
							class="flex flex-col justify-between rounded-2xl border border-muted/20 bg-card p-4 py-3.5"
						>
							<div class="flex items-center justify-between gap-1">
								<span class="text-[10px] font-bold tracking-wider text-foreground/40 uppercase"
									>Gross sales</span
								>
								<IndianRupee size={12} strokeWidth={2.5} class="shrink-0 text-emerald-500" />
							</div>
							<div class="mt-3">
								<p class="font-mono text-[22px] leading-none font-bold tracking-tight">
									{formatCurrencyINR(Number(summary?.totalRevenue ?? 0))}
								</p>
								<p class="mt-1 font-mono text-[10px] text-foreground/35">
									{formatCurrencyINR(Number(summary?.totalRevenue ?? 0))}
								</p>
							</div>
						</div>

						<div
							class="flex flex-col justify-between rounded-2xl border border-muted/20 bg-card p-4 py-3.5"
						>
							<div class="flex items-center justify-between gap-1">
								<span class="text-[10px] font-bold tracking-wider text-foreground/40 uppercase"
									>Units sold</span
								>
								<ShoppingBag size={12} strokeWidth={2.5} class="shrink-0 text-primary" />
							</div>
							<div class="mt-3">
								<p class="font-mono text-[22px] leading-none font-bold tracking-tight">
									{summary?.totalQuantity ?? 0}
								</p>
								<p class="mt-1 text-[10px] text-foreground/35">items ordered</p>
							</div>
						</div>

						<div
							class="flex flex-col justify-between rounded-2xl border border-muted/20 bg-card p-4 py-3.5"
						>
							<div class="flex items-center justify-between gap-1">
								<span class="text-[10px] font-bold tracking-wider text-foreground/40 uppercase"
									>Customers</span
								>
								<Users size={12} strokeWidth={2.5} class="shrink-0 text-blue-500" />
							</div>
							<div class="mt-3">
								<p class="font-mono text-[22px] leading-none font-bold tracking-tight">
									{summary?.uniqueCustomers ?? 0}
								</p>
								<p class="mt-1 text-[10px] text-foreground/35">unique buyers</p>
							</div>
						</div>

						<div
							class="flex flex-col justify-between rounded-2xl border border-muted/20 bg-card p-4 py-3.5"
						>
							<div class="flex items-center justify-between gap-1">
								<span class="text-[10px] font-bold tracking-wider text-foreground/40 uppercase"
									>Avg / order</span
								>
								<Receipt size={12} strokeWidth={2.5} class="shrink-0 text-purple-500" />
							</div>
							<div class="mt-3">
								<p class="font-mono text-[22px] leading-none font-bold tracking-tight">
									{formatCurrencyINR(Number(summary?.avgOrderValue ?? 0))}
								</p>
								<p class="mt-1 font-mono text-[10px] text-foreground/35">
									{summary?.totalOrders ?? 0} invoices
								</p>
							</div>
						</div>
					</div>
				{/if}

				<!-- Best day -->
				{@const best = bestDay(timelineList)}
				{@const top = topDays(timelineList, 5)}

				{#if best}
					<div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
						<div class="mb-3 flex items-center gap-1.5">
							<Trophy size={11} strokeWidth={2.5} class="text-emerald-500" />
							<span class="text-[10px] font-bold tracking-widest text-emerald-500 uppercase"
								>Best day</span
							>
						</div>
						<div class="flex items-end justify-between gap-2">
							<div>
								<p class="font-mono text-[26px] leading-none font-bold tracking-tight">
									{formatCurrencyINR(Number(best.revenue))}
								</p>
								<p class="mt-1.5 text-[11px] font-semibold text-foreground/50">
									{formatDate(best.date)}
								</p>
							</div>
							<div class="text-right">
								<p class="font-mono text-[20px] leading-none font-bold tracking-tight">
									{best.quantity}
								</p>
								<p class="mt-1.5 text-[11px] font-semibold text-foreground/50">units sold</p>
							</div>
						</div>
					</div>
				{/if}

				<!-- Top days -->
				{#if top.length > 0}
					<div class="space-y-2">
						<div class="flex items-center gap-1.5 px-1">
							<CalendarDays size={11} strokeWidth={2.5} class="text-foreground/30" />
							<h3 class="text-[11px] font-bold tracking-widest text-foreground/40 uppercase">
								Top {top.length} day{top.length === 1 ? '' : 's'}
							</h3>
						</div>
						{#each top as day, i (day.date)}
							<div
								class="flex items-center gap-3 rounded-xl border border-muted/15 bg-card px-4 py-3"
							>
								<span
									class="w-4 shrink-0 text-center font-mono text-[11px] font-bold text-foreground/25"
									>{i + 1}</span
								>
								<span class="flex-1 text-[13px] font-bold text-foreground/80"
									>{formatDateShort(day.date)}</span
								>
								<span class="font-mono text-[12px] text-foreground/40">{day.quantity}×</span>
								<span class="w-16 text-right font-mono text-[13px] font-bold text-foreground">
									{formatCurrencyINR(Number(day.revenue))}
								</span>
							</div>
						{/each}
					</div>
				{:else if !isLoading}
					<div class="rounded-2xl border border-muted/20 bg-card py-10 text-center">
						<p class="text-[13px] font-semibold text-foreground/40">No orders in this period</p>
						<p class="mt-1 text-[11px] text-foreground/25">Try a wider date range</p>
					</div>
				{/if}

				<!-- ══════════════════════════════════════════════════════ -->
				<!-- TAB: ORDERS                                            -->
				<!-- ══════════════════════════════════════════════════════ -->
			{:else if activeTab === 'orders'}
				<!-- Skeleton -->
				{#if ordersLoading && orders.length === 0}
					{#each [0, 1, 2, 3, 4] as _ (_)}
						<div class="h-18 animate-pulse rounded-xl bg-muted/20"></div>
					{/each}

					<!-- Error -->
				{:else if ordersError && orders.length === 0}
					<div class="rounded-2xl border border-destructive/20 bg-destructive/10 p-5 text-center">
						<p class="text-[13px] font-semibold text-destructive">{ordersError}</p>
					</div>

					<!-- Empty -->
				{:else if ordersFetched && orders.length === 0}
					<div class="rounded-2xl border border-muted/20 bg-card py-12 text-center">
						<p class="text-[13px] font-semibold text-foreground/40">No orders in this period</p>
						<p class="mt-1 text-[11px] text-foreground/25">Try a wider date range</p>
					</div>
				{:else}
					<!-- Order rows -->
					<div class="space-y-2">
						{#each orders as order (order.ticketId)}
							{@const lineTotal = Number(order.unitPrice) * order.quantity}
							<div class="rounded-xl border border-muted/15 bg-card">
								<!-- Top row -->
								<div class="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											{#if order.status === 'COMPLETED'}
												<CheckCircle2
													size={11}
													strokeWidth={2.5}
													class="shrink-0 text-emerald-500"
												/>
											{:else if order.status === 'READY'}
												<Circle size={11} strokeWidth={2.5} class="shrink-0 text-blue-500" />
											{:else}
												<Clock size={11} strokeWidth={2.5} class="shrink-0 text-amber-500" />
											{/if}
											<span class="truncate font-mono text-[12px] font-bold text-foreground/70">
												#{order.ticketReference}
											</span>
										</div>
										<p class="mt-0.5 truncate pl-4.75 text-[11px] font-medium text-foreground/40">
											{order.buyerName}<span class="font-mono text-foreground/25">
												· {order.buyerRollNumber}</span
											>
										</p>
									</div>
									<div class="shrink-0 text-right">
										<p class="font-mono text-[14px] leading-none font-bold text-foreground">
											{formatCurrencyINR(lineTotal)}
										</p>
										<p class="mt-0.5 font-mono text-[10px] text-foreground/35">
											{order.quantity}× {formatCurrencyINR(Number(order.unitPrice))}
										</p>
									</div>
								</div>
								<!-- Bottom row -->
								<div class="flex items-center justify-between border-t border-muted/10 px-4 py-2">
									<span class="text-[10px] font-medium text-foreground/30">
										{formatDateTime(order.createdAt)}
									</span>
									<span
										class="rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-widest uppercase
										{order.status === 'COMPLETED'
											? 'bg-emerald-500/10 text-emerald-500'
											: order.status === 'READY'
												? 'bg-blue-500/10 text-blue-500'
												: order.status === 'PENDING'
													? 'bg-amber-500/10 text-amber-500'
													: 'bg-muted/20 text-foreground/40'}"
									>
										{order.status}
									</span>
								</div>
							</div>
						{/each}

						<!-- Load more -->
						{#if hasNextPage}
							<button
								onclick={loadMoreOrders}
								disabled={ordersLoading}
								class="flex w-full items-center justify-center gap-2 rounded-xl border border-muted/20 bg-card py-3 text-[11px] font-bold tracking-widest text-foreground/50 uppercase transition-all hover:bg-muted/10 active:scale-[0.99] disabled:opacity-50"
							>
								{#if ordersLoading}
									<Loader2 size={13} strokeWidth={2.5} class="animate-spin" />
									Loading…
								{:else}
									<ChevronDown size={13} strokeWidth={2.5} />
									Load more
								{/if}
							</button>
						{:else if ordersLoading}
							<div class="flex justify-center py-3">
								<Loader2 size={16} strokeWidth={2} class="animate-spin text-foreground/30" />
							</div>
						{/if}
					</div>
				{/if}
			{/if}
			<!-- /tabs -->
		{/if}
	</div>
</div>
