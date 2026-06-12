<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatCurrencyINR } from '$lib';
	import { ArrowLeft, ReceiptText, Clock, CheckCircle2, XCircle, Utensils } from 'lucide-svelte';

	type MenuItem = {
		id: string;
		name: string;
		description: string;
		price: string;
		category: string;
		inStock: boolean;
		dietary: string;
		isArchived: boolean;
	};

	type TicketItem = {
		id: string;
		quantity: number;
		unitPrice: string;
		menuItem: MenuItem;
	};

	type Ticket = {
		id: string;
		ticketReference: string;
		totalAmount: string;
		status: 'PENDING' | 'READY' | 'COMPLETED' | 'CANCELLED';
		createdAt: string;
		items: TicketItem[];
		formattedDate?: string;
		totalItems?: number;
	};

	type Stats = {
		total: number;
		PENDING: number;
		READY: number;
		COMPLETED: number;
		CANCELLED: number;
	};

	let orders: Ticket[] = $state([]);
	let stats: Stats = $state({ total: 0, PENDING: 0, READY: 0, COMPLETED: 0, CANCELLED: 0 });

	let isLoadingOrders = $state(true);
	let isLoadingMore = $state(false);

	let nextCursor: string | null = $state(null);
	let hasNextPage = $state(false);

	// Helper to get the correct icon and colors based on status
	function getStatusConfig(status: string) {
		switch (status) {
			case 'COMPLETED':
				return { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10' };
			case 'READY':
				return { icon: Utensils, color: 'text-blue-600', bg: 'bg-blue-500/10' };
			case 'PENDING':
				return { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-500/10' };
			case 'CANCELLED':
				return { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' };
			default:
				return { icon: ReceiptText, color: 'text-foreground/50', bg: 'bg-muted/50' };
		}
	}

	async function fetchOrders(cursor: string | null = null) {
		const url = new URL('/api/orders', window.location.origin);
		url.searchParams.set('limit', '10');
		if (cursor) url.searchParams.set('cursor', cursor);

		try {
			const res = await fetch(url.toString());
			const data = await res.json();

			if (data.success) {
				const formattedTickets = data.data.tickets.map((t: Ticket) => {
					const d = new Date(t.createdAt);
					return {
						...t,
						formattedDate: `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`,
						totalItems: t.items.reduce((acc, item) => acc + item.quantity, 0)
					};
				});

				if (cursor) {
					orders = [...orders, ...formattedTickets];
				} else {
					orders = formattedTickets;
					stats = data.data.stats;
				}

				nextCursor = data.data.pagination.nextCursor;
				hasNextPage = data.data.pagination.hasNextPage;
			}
		} catch (err) {
			console.error('Failed to fetch orders:', err);
		}
	}

	$effect(() => {
		isLoadingOrders = true;
		fetchOrders().finally(() => (isLoadingOrders = false));
	});

	function loadMore() {
		if (!nextCursor || isLoadingMore) return;
		isLoadingMore = true;
		fetchOrders(nextCursor).finally(() => (isLoadingMore = false));
	}
</script>

<svelte:head><title>Orders | MunchUp</title></svelte:head>

<div
	class="animate-in fade-in absolute inset-0 z-20 flex flex-col overflow-y-auto bg-background duration-300"
>
	<header
		class="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 bg-background/15 px-5 backdrop-blur-md"
	>
		<a
			href={resolve('/')}
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-foreground transition-transform active:scale-90"
		>
			<ArrowLeft size={18} strokeWidth={2.5} />
		</a>

		<h2 class="flex-1 text-[20px] font-bold tracking-tight text-foreground">My Orders</h2>

		<div class="flex w-20 justify-end"></div>
	</header>

	<div class="space-y-5 px-5 pt-1 pb-10">
		<div
			class="overflow-hidden rounded-3xl border border-muted/30 bg-card shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
		>
			<div class="border-b border-muted/20 bg-muted/10 p-5 text-center">
				<p class="text-[10px] font-bold tracking-[0.15em] text-foreground/50 uppercase">
					Total Lifetime Orders
				</p>
				{#if isLoadingOrders}
					<div class="mx-auto mt-2 h-8 w-16 animate-pulse rounded-full bg-muted/50"></div>
				{:else}
					<p class="mt-1 font-mono text-[32px] font-black tracking-tight text-foreground">
						{stats.total}
					</p>
				{/if}
			</div>
			<div class="grid grid-cols-2 divide-x divide-muted/20">
				<div class="p-4 text-center">
					<p class="text-[10px] font-bold tracking-[0.15em] text-emerald-500 uppercase">
						Completed
					</p>
					{#if isLoadingOrders}
						<div class="mx-auto mt-1.5 h-5 w-10 animate-pulse rounded-full bg-muted/50"></div>
					{:else}
						<p class="mt-0.5 font-mono text-[16px] font-bold text-foreground">
							{stats.COMPLETED}
						</p>
					{/if}
				</div>
				<div class="p-4 text-center">
					<p class="text-[10px] font-bold tracking-[0.15em] text-amber-500 uppercase">
						Pending / Ready
					</p>
					{#if isLoadingOrders}
						<div class="mx-auto mt-1.5 h-5 w-10 animate-pulse rounded-full bg-muted/50"></div>
					{:else}
						<p class="mt-0.5 font-mono text-[16px] font-bold text-foreground">
							{stats.PENDING + stats.READY}
						</p>
					{/if}
				</div>
			</div>
		</div>

		<div>
			<h3 class="mb-3 px-1 text-[13px] font-bold tracking-wider text-foreground/40 uppercase">
				Order History
			</h3>
			<div
				class="overflow-hidden rounded-3xl border border-muted/30 bg-card shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
			>
				<div class="divide-y divide-muted/20">
					{#if isLoadingOrders}
						{#each [1, 2, 3, 4, 5] as i (i)}
							<div class="flex animate-pulse items-center justify-between px-4 py-4">
								<div class="flex items-center gap-3">
									<div class="h-10 w-10 shrink-0 rounded-xl bg-muted/40"></div>
									<div class="min-w-0 space-y-2">
										<div class="h-3.5 w-32 rounded-full bg-muted/60"></div>
										<div class="h-2.5 w-20 rounded-full bg-muted/40"></div>
									</div>
								</div>
								<div class="h-4 w-16 shrink-0 rounded-full bg-muted/60"></div>
							</div>
						{/each}
					{:else if orders.length > 0}
						{#each orders as order (order.id)}
							{@const config = getStatusConfig(order.status)}
							<div class="flex flex-col px-4 py-4 transition-colors active:bg-muted/30">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-3">
										<div
											class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl {config.bg} {config.color}"
										>
											<config.icon size={18} strokeWidth={2.5} />
										</div>
										<div class="min-w-0">
											<p
												class="flex items-center gap-2 truncate text-[14px] font-semibold text-foreground"
											>
												{order.ticketReference}
												<span
													class="rounded-sm bg-muted px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-foreground/50 uppercase"
												>
													{order.totalItems} Items
												</span>
											</p>
											<p
												class="mt-0.5 text-[10px] font-bold tracking-widest text-foreground/40 uppercase"
											>
												{order.formattedDate}
											</p>
										</div>
									</div>
									<div class="flex shrink-0 flex-col items-end gap-1 pl-3">
										<span class="font-mono text-[14px] font-bold text-foreground">
											{formatCurrencyINR(Number(order.totalAmount))}
										</span>
										<span class="text-[9px] font-bold tracking-wider uppercase {config.color}">
											{order.status}
										</span>
									</div>
								</div>

								{#if order.items && order.items.length > 0}
									<div
										class="mt-3 ml-13 flex flex-col gap-2 border-t border-muted/20 pt-3 text-[13px]"
									>
										{#each order.items as item (item)}
											<div class="flex items-start justify-between text-foreground/70">
												<div class="flex items-start gap-2.5">
													<span class="font-bold text-foreground/40">{item.quantity}x</span>
													<div class="mt-0.5 flex items-center gap-1.5">
														{#if item.menuItem}
															<div
																class="flex h-3 w-3 shrink-0 items-center justify-center self-center rounded-[2px] border {item
																	.menuItem.dietary === 'veg'
																	? 'border-emerald-500/70'
																	: 'border-red-500/70'}"
															>
																<div
																	class="h-1.5 w-1.5 rounded-full {item.menuItem.dietary === 'veg'
																		? 'bg-emerald-500/70'
																		: 'bg-red-500/70'}"
																></div>
															</div>
															<span class="font-medium">{item.menuItem.name}</span>
														{:else}
															<span class="font-medium text-foreground/50">Unknown Item</span>
														{/if}
													</div>
												</div>
												<span class="mt-0.5 font-mono text-[12px]">
													{formatCurrencyINR(Number(item.unitPrice) * item.quantity)}
												</span>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					{:else}
						<div class="px-4 py-10 text-center">
							<p class="text-[13px] font-medium text-foreground/50">No orders found.</p>
						</div>
					{/if}
				</div>
			</div>

			{#if hasNextPage}
				<div class="mt-4 text-center">
					<button
						onclick={loadMore}
						disabled={isLoadingMore}
						class="rounded-full bg-muted/50 px-5 py-2 text-[12px] font-bold text-foreground transition-all active:scale-95 disabled:opacity-50"
					>
						{isLoadingMore ? 'Loading...' : 'Load More Orders'}
					</button>
				</div>
			{:else if !isLoadingOrders && orders.length > 0}
				<p
					class="mt-4 text-center text-[10px] font-bold tracking-[0.15em] text-foreground/30 uppercase"
				>
					End of order history
				</p>
			{/if}
		</div>
	</div>
</div>
