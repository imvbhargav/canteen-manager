<script lang="ts">
	import { appState } from '$lib/store.svelte';
	import { goto } from '$app/navigation';
	import {
		UtensilsCrossed,
		Wallet,
		QrCode,
		Plus,
		ArrowUpRight,
		ArrowDownLeft
	} from 'lucide-svelte';
	import { resolve } from '$app/paths';

	type Transaction = {
		id: string;
		type: 'credit' | 'debit';
		title: string;
		date: string;
		amount: number;
	};
	let recentTransactions: Transaction[] = $state([]);
	let isLoadingTransactions: boolean = $state(true);

	$effect(() => {
		isLoadingTransactions = true;
		fetch('/api/wallet/history')
			.then((res) => res.json())
			.then((result) => {
				if (result.success) {
					recentTransactions = result.data.map(
						(tx: {
							id: string;
							type: string;
							description: string;
							createdAt: Date;
							amount: number;
						}) => {
							const d = new Date(tx.createdAt);
							const dateStr = d.toLocaleDateString(undefined, { weekday: 'short' });
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
			.catch((err) => console.error('Failed to fetch transactions:', err))
			.finally(() => (isLoadingTransactions = false));
	});

	function cancelOrder() {
		appState.activeTicket = null;
		goto(resolve('/menu'));
	}
</script>

<svelte:head><title>Dashboard | BPS Canteen</title></svelte:head>

{#if appState.wallet}
	<div class="animate-in fade-in space-y-5 duration-300">
		<header class="mb-6 flex items-start justify-between px-4 py-1">
			<div>
				<div class="mb-0.5 flex items-center gap-2">
					<span class="font-mono text-[10px] tracking-widest text-muted-foreground uppercase"
						>Banashakari Campus</span
					>
				</div>
				<h1 class="font-black uppercase">BPS Canteen</h1>
			</div>
			<div class="mt-1 flex items-center gap-1.5">
				<div class="h-1.5 w-1.5 rounded-full bg-emerald-400"></div>
				<span class="font-mono text-[10px] tracking-wider text-muted-foreground uppercase"
					>Live</span
				>
			</div>
		</header>

		<div class="px-4 space-y-5">
			{#if appState.activeTicket}
				<div class="overflow-hidden border border-border bg-card">
					<div class="flex items-center justify-between border-b border-border px-5 py-3">
						<div class="flex items-center gap-2">
							<div class="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400"></div>
							<span class="label-mono text-foreground/70">Pending Order</span>
						</div>
						<span class="font-mono text-[10px] tracking-wider text-amber-400 uppercase"
							>Not yet charged</span
						>
					</div>

					<div class="space-y-2.5 px-5 py-4">
						{#each appState.activeTicket.items as item (item.menuItem.id)}
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2.5">
									<span class="w-5 text-right font-mono text-[10px] text-muted-foreground"
										>{item.quantity}×</span
									>
									<span class="text-sm text-foreground">{item.menuItem.name}</span>
								</div>
								<span class="font-mono text-sm text-muted-foreground"
									>₹{item.menuItem.price * item.quantity}</span
								>
							</div>
						{/each}
					</div>

					<div class="flex items-center justify-between border-t border-border px-5 py-3">
						<span class="label-mono">Due on collection</span>
						<span class="font-mono font-medium text-foreground">₹{appState.activeTicket.total}</span
						>
					</div>

					<div class="mt-1 grid grid-cols-2 gap-2 px-5 pb-4">
						<button
							onclick={cancelOrder}
							class="border border-destructive/30 py-2.5 text-xs font-medium tracking-wide text-destructive transition-all hover:bg-destructive/5 active:scale-[0.98]"
						>
							Cancel Order
						</button>
						<a
							href={resolve('/ticket')}
							class="flex items-center justify-center gap-2 bg-foreground py-2.5 text-xs font-medium tracking-wide text-background transition-all active:scale-[0.98]"
						>
							<QrCode size={13} /> Scan to Collect
						</a>
					</div>
				</div>
			{:else}
				<a
					href={resolve('/menu')}
					class="group relative flex w-full items-center justify-between overflow-hidden bg-foreground p-6 text-background transition-all active:scale-[0.99]"
				>
					<div class="text-left">
						<p class="label-mono mb-1.5 text-background/50">Kitchen is open</p>
						<h2 class="text-xl font-semibold tracking-tight">Order Food</h2>
						<p class="mt-0.5 text-sm font-light text-background/60">Browse live menu →</p>
					</div>
					<UtensilsCrossed
						size={36}
						strokeWidth={1}
						class="opacity-20 transition-opacity group-hover:opacity-30"
					/>
				</a>
			{/if}

			<div class="relative overflow-hidden border border-border bg-card p-4">
				<div
					class="absolute top-0 right-0 left-0 h-px bg-linear-to-r from-transparent via-foreground/20 to-transparent"
				></div>
				<div class="mb-4 flex items-start justify-between">
					<div class="label-mono flex items-center gap-1.5"><Wallet size={11} /> Campus Wallet</div>
					<a
						href={resolve('/topup')}
						class="flex items-center gap-1 border border-border px-2.5 py-1.5 font-mono text-[10px] tracking-wider text-foreground uppercase transition-colors hover:bg-muted"
					>
						<Plus size={10} /> Add Funds
					</a>
				</div>
				<div class="mb-1">
					<span class="mr-1 font-mono text-sm text-muted-foreground">₹</span>
					<span class="text-4xl font-semibold tracking-tight text-foreground"
						>{appState.wallet.balance.toFixed(2)}</span
					>
				</div>
				<p class="label-mono">{appState.wallet.studentId} · {appState.wallet.name}</p>
			</div>

			<div>
				<div class="mb-3 flex items-center justify-between">
					<span class="label-mono">Recent Activity</span>
					<a
						href={resolve('/profile/history')}
						class="label-mono text-foreground/50 transition-colors hover:text-foreground"
						>View All →</a
					>
				</div>
				<div class="divide-y divide-border border border-border bg-card">
					{#if isLoadingTransactions}
						{#each [1, 2, 3] as i (i)}
							<div class="flex animate-pulse items-center justify-between px-4 py-3.5">
								<div class="flex items-center gap-3">
									<div class="flex h-8 w-8 shrink-0 items-center justify-center bg-muted"></div>
									<div class="min-w-0 space-y-2">
										<div class="h-3.5 w-24 bg-muted/80"></div>
										<div class="h-2 w-16 bg-muted/50"></div>
									</div>
								</div>
								<div class="h-3.5 w-12 shrink-0 bg-muted/80"></div>
							</div>
						{/each}
					{:else if recentTransactions.length > 0}
						{#each recentTransactions.slice(0, 3) as tx (tx.id)}
							<div class="flex items-center justify-between px-4 py-3.5">
								<div class="flex items-center gap-3">
									<div class="flex h-8 w-8 shrink-0 items-center justify-center bg-muted">
										{#if tx.type === 'credit'}<ArrowDownLeft size={14} class="text-emerald-400" />
										{:else}<ArrowUpRight size={14} class="text-muted-foreground" />{/if}
									</div>
									<div class="min-w-0">
										<p class="truncate text-sm font-medium text-foreground">{tx.title}</p>
										<p class="label-mono mt-0.5">{tx.date}</p>
									</div>
								</div>
								<span
									class="shrink-0 pl-3 font-mono text-sm {tx.type === 'credit'
										? 'text-emerald-400'
										: 'text-foreground'}"
								>
									{tx.type === 'credit' ? '+' : '-'}₹{tx.amount.toFixed(2)}
								</span>
							</div>
						{/each}
					{:else}
						<div class="px-4 py-6 text-center">
							<p class="text-xs font-light text-muted-foreground">No recent transactions.</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
