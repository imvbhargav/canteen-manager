<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatCurrencyINR } from '$lib';
	import { appState } from '$lib/store.svelte';
	import { ArrowDownLeft, ArrowUpRight } from 'lucide-svelte';
	import SubPageHeader from '$lib/components/SubPageHeader.svelte';

	type Transaction = {
		id: string;
		type: 'credit' | 'debit';
		title: string;
		date: string;
		amount: number;
	};

	let transactions: Transaction[] = $state([]);
	let stats = $state({ totalAdded: 0, totalSpent: 0 });

	let isLoadingHistory = $state(true);
	let isLoadingMore = $state(false);

	let nextCursor: string | null = $state(null);
	let hasNextPage = $state(false);

	let remaining = $derived(appState.wallet?.balance || 0);

	async function fetchHistory(cursor: string | null = null) {
		const url = new URL('/api/wallet/history', window.location.origin);
		url.searchParams.set('limit', '15');
		if (cursor) url.searchParams.set('cursor', cursor);

		try {
			const res = await fetch(url.toString());
			const data = await res.json();

			if (data.success) {
				const formattedTx = data.data.transactions.map(
					(tx: {
						id: string;
						type: string;
						description: string;
						createdAt: Date | string;
						amount: number;
					}) => {
						const d = new Date(tx.createdAt);
						const dateStr = d.toLocaleDateString(undefined, {
							month: 'short',
							day: 'numeric',
							year: 'numeric'
						});
						const timeStr = d.toLocaleTimeString(undefined, {
							hour: 'numeric',
							minute: '2-digit'
						});

						return {
							id: tx.id,
							type: tx.type === 'CREDIT' ? 'credit' : 'debit',
							title: tx.description,
							date: `${dateStr} · ${timeStr}`,
							amount: Number(tx.amount)
						};
					}
				);

				if (cursor) {
					transactions = [...transactions, ...formattedTx];
				} else {
					transactions = formattedTx;
					stats = data.data.stats;
				}

				nextCursor = data.data.pagination.nextCursor;
				hasNextPage = data.data.pagination.hasNextPage;
			}
		} catch (err) {
			console.error('Failed to fetch history:', err);
		}
	}

	$effect(() => {
		isLoadingHistory = true;
		fetchHistory().finally(() => (isLoadingHistory = false));
	});

	function loadMore() {
		if (!nextCursor || isLoadingMore) return;
		isLoadingMore = true;
		fetchHistory(nextCursor).finally(() => (isLoadingMore = false));
	}
</script>

<svelte:head><title>History | MunchUp</title></svelte:head>

<div
	class="animate-in fade-in absolute inset-0 z-20 flex flex-col overflow-y-auto bg-background duration-300"
>
	<SubPageHeader title="History" backHref={resolve('/profile')} />

	<div class="space-y-5 px-5 pt-1">
		<div
			class="overflow-hidden rounded-3xl border border-muted/30 bg-card shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
		>
			<div class="border-b border-muted/20 bg-muted/10 p-5 text-center">
				<p class="text-[10px] font-bold tracking-[0.15em] text-foreground/50 uppercase">
					Remaining Balance
				</p>
				<p class="mt-1 font-mono text-[32px] font-black tracking-tight text-foreground">
					{formatCurrencyINR(remaining)}
				</p>
			</div>
			<div class="grid grid-cols-2 divide-x divide-muted/20">
				<div class="p-4 text-center">
					<p class="text-[10px] font-bold tracking-[0.15em] text-emerald-500 uppercase">
						Total Added
					</p>
					{#if isLoadingHistory}
						<div class="mx-auto mt-1.5 h-5 w-16 animate-pulse rounded-full bg-muted/50"></div>
					{:else}
						<p class="mt-0.5 font-mono text-[16px] font-bold text-foreground">
							{formatCurrencyINR(stats.totalAdded)}
						</p>
					{/if}
				</div>
				<div class="p-4 text-center">
					<p class="text-[10px] font-bold tracking-[0.15em] text-foreground/50 uppercase">
						Total Spent
					</p>
					{#if isLoadingHistory}
						<div class="mx-auto mt-1.5 h-5 w-16 animate-pulse rounded-full bg-muted/50"></div>
					{:else}
						<p class="mt-0.5 font-mono text-[16px] font-bold text-foreground">
							{formatCurrencyINR(stats.totalSpent)}
						</p>
					{/if}
				</div>
			</div>
		</div>

		<div>
			<h3 class="mb-3 px-1 text-[13px] font-bold tracking-wider text-foreground/40 uppercase">
				Recent Transactions
			</h3>
			<div
				class="overflow-hidden rounded-3xl border border-muted/30 bg-card shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
			>
				<div class="divide-y divide-muted/20">
					{#if isLoadingHistory && transactions.length === 0}
						{#each [1, 2, 3, 4, 5] as i (i)}
							<div class="flex animate-pulse items-center justify-between px-4 py-4">
								<div class="flex items-center gap-3">
									<div class="h-10 w-10 shrink-0 rounded-xl bg-muted/40"></div>
									<div class="min-w-0 space-y-2">
										<div class="h-3.5 w-32 rounded-full bg-muted/60"></div>
										<div class="h-2.5 w-20 rounded-full bg-muted/40"></div>
									</div>
								</div>
								<div class="h-3.5 w-16 shrink-0 rounded-full bg-muted/60"></div>
							</div>
						{/each}
					{:else if transactions.length > 0}
						{#each transactions as tx (tx.id)}
							<div
								class="flex items-center justify-between px-4 py-4 transition-colors active:bg-muted/30"
							>
								<div class="flex items-center gap-3">
									<div
										class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl {tx.type ===
										'credit'
											? 'bg-emerald-500/10 text-emerald-600'
											: 'bg-muted/50 text-foreground/50'}"
									>
										{#if tx.type === 'credit'}
											<ArrowDownLeft size={18} strokeWidth={2.5} />
										{:else}
											<ArrowUpRight size={18} strokeWidth={2.5} />
										{/if}
									</div>
									<div class="min-w-0">
										<p class="truncate text-[14px] font-semibold text-foreground">
											{tx.title}
										</p>
										<p
											class="mt-0.5 text-[10px] font-bold tracking-widest text-foreground/40 uppercase"
										>
											{tx.date}
										</p>
									</div>
								</div>
								<span
									class="shrink-0 pl-3 text-[14px] font-bold {tx.type === 'credit'
										? 'text-emerald-600'
										: 'text-foreground'}"
								>
									{tx.type === 'credit' ? '+' : '-'}<span class="font-mono"
										>{formatCurrencyINR(tx.amount)}</span
									>
								</span>
							</div>
						{/each}
					{:else}
						<div class="px-4 py-10 text-center">
							<p class="text-[13px] font-medium text-foreground/50">No recent transactions.</p>
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
						{isLoadingMore ? 'Loading...' : 'Load More'}
					</button>
				</div>
			{:else if !isLoadingHistory && transactions.length > 0}
				<p
					class="mt-4 text-center text-[10px] font-bold tracking-[0.15em] text-foreground/30 uppercase"
				>
					End of recent history
				</p>
			{/if}
		</div>
	</div>
</div>
