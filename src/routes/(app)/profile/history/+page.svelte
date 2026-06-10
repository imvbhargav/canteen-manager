<script lang="ts">
	import { resolve } from '$app/paths';
	import { appState } from '$lib/store.svelte';
	import { ArrowLeft, ArrowDownLeft, ArrowUpRight } from 'lucide-svelte';

	type Transaction = {
		id: string;
		type: 'credit' | 'debit';
		title: string;
		date: string;
		amount: number;
	};

	let transactions: Transaction[] = $state([]);
	let isLoadingHistory = $state(true);

	let totalAdded = $derived(
		transactions.reduce((sum, tx) => (tx.type === 'credit' ? sum + tx.amount : sum), 0)
	);
	let totalSpent = $derived(
		transactions.reduce((sum, tx) => (tx.type === 'debit' ? sum + tx.amount : sum), 0)
	);
	let remaining = $derived(appState.wallet?.balance || 0);

	$effect(() => {
		fetch('/api/wallet/history')
			.then((res) => res.json())
			.then((data) => {
				if (data.success) {
					transactions = data.data.map(
						(tx: {
							id: string;
							type: string;
							description: string;
							createdAt: Date;
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
				}
			})
			.catch((err) => console.error(err))
			.finally(() => (isLoadingHistory = false));
	});
</script>

<svelte:head><title>History | MunchUp</title></svelte:head>

<div class="animate-in fade-in absolute inset-0 z-20 flex flex-col bg-background duration-300">
	<header
		class="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 bg-background/15 px-5 backdrop-blur-md"
	>
		<a
			href={resolve('/profile')}
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-foreground transition-transform active:scale-90"
		>
			<ArrowLeft size={18} strokeWidth={2.5} />
		</a>

		<h2 class="flex-1 text-[20px] font-bold tracking-tight text-foreground">History</h2>

		<div class="flex w-20 justify-end"></div>
	</header>

	<div class="space-y-5 px-5 pt-1">
		<!-- ── Summary Card ── -->
		<div
			class="overflow-hidden rounded-3xl border border-muted/30 bg-card shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
		>
			<div class="border-b border-muted/20 bg-muted/10 p-5 text-center">
				<p class="text-[10px] font-bold tracking-[0.15em] text-foreground/50 uppercase">
					Remaining Balance
				</p>
				<p class="mt-1 text-[32px] font-black tracking-tight text-foreground">
					₹{remaining.toFixed(2)}
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
						<p class="mt-0.5 text-[16px] font-bold text-foreground">
							₹{totalAdded.toFixed(2)}
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
						<p class="mt-0.5 text-[16px] font-bold text-foreground">
							₹{totalSpent.toFixed(2)}
						</p>
					{/if}
				</div>
			</div>
		</div>

		<!-- ── Transactions List ── -->
		<div>
			<h3 class="mb-3 px-1 text-[13px] font-bold tracking-wider text-foreground/40 uppercase">
				Recent Transactions
			</h3>
			<div
				class="overflow-hidden rounded-3xl border border-muted/30 bg-card shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
			>
				<div class="divide-y divide-muted/20">
					{#if isLoadingHistory}
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
									{tx.type === 'credit' ? '+' : '-'}₹{tx.amount.toFixed(2)}
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
			<p
				class="mt-4 text-center text-[10px] font-bold tracking-[0.15em] text-foreground/30 uppercase"
			>
				End of recent history
			</p>
		</div>
	</div>
</div>
