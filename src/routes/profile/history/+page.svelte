<script lang="ts">
	import { resolve } from '$app/paths';
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
						}) => ({
							id: tx.id,
							type: tx.type === 'CREDIT' ? 'credit' : 'debit',
							title: tx.description,
							date: new Date(tx.createdAt).toLocaleString(),
							amount: Number(tx.amount)
						})
					);
				}
			})
			.catch((err) => console.error(err))
			.finally(() => (isLoadingHistory = false));
	});
</script>

<svelte:head><title>History | Campus Wallet</title></svelte:head>

<div class="animate-in fade-in flex h-full flex-col duration-200">
	<header
		class="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background pt-1 pb-4"
	>
		<a
			href={resolve('/profile')}
			class="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			><ArrowLeft size={18} /></a
		>
		<div>
			<h2 class="text-base leading-none font-semibold tracking-tight text-foreground">History</h2>
		</div>
	</header>

	<div class="animate-in slide-in-from-right-2 flex-1 overflow-y-auto py-5 duration-300">
		<div class="divide-y divide-border border border-border bg-card">
			{#if isLoadingHistory}
				{#each [1, 2, 3, 4, 5] as i (i)}
					<div class="flex animate-pulse items-center justify-between px-4 py-4">
						<div class="flex items-center gap-3">
							<div class="h-9 w-9 shrink-0 border border-border bg-muted"></div>
							<div class="min-w-0 space-y-2">
								<div class="h-3.5 w-32 bg-muted/80"></div>
								<div class="h-2.5 w-20 bg-muted/50"></div>
							</div>
						</div>
						<div class="h-3.5 w-16 shrink-0 bg-muted/80"></div>
					</div>
				{/each}
			{:else if transactions.length > 0}
				{#each transactions as tx (tx.id)}
					<div class="flex items-center justify-between px-4 py-4">
						<div class="flex items-center gap-3">
							<div
								class="flex h-9 w-9 shrink-0 items-center justify-center border border-border bg-muted"
							>
								{#if tx.type === 'credit'}<ArrowDownLeft size={15} class="text-emerald-400" />
								{:else}<ArrowUpRight size={15} class="text-muted-foreground" />{/if}
							</div>
							<div class="min-w-0">
								<p class="truncate text-sm font-medium text-foreground">{tx.title}</p>
								<p
									class="mt-0.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase"
								>
									{tx.date}
								</p>
							</div>
						</div>
						<span
							class="shrink-0 pl-3 font-mono text-sm {tx.type === 'credit'
								? 'text-emerald-400'
								: 'text-foreground'}"
							>{tx.type === 'credit' ? '+' : '-'}₹{tx.amount.toFixed(2)}</span
						>
					</div>
				{/each}
			{:else}
				<div class="px-4 py-6 text-center">
					<p class="text-xs font-light text-muted-foreground">No recent transactions.</p>
				</div>
			{/if}
		</div>
		<p
			class="mt-6 text-center font-mono text-[10px] tracking-widest text-muted-foreground uppercase"
		>
			End of recent history
		</p>
	</div>
</div>
