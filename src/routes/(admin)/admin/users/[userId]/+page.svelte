<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { formatCurrencyINR } from '$lib';
	import {
		ArrowLeft,
		Wallet,
		CheckCircle2,
		Loader2,
		AlertCircle,
		ReceiptText,
		Clock,
		Utensils,
		XCircle,
		ArrowDownLeft,
		ArrowUpRight
	} from 'lucide-svelte';

	// --- TypeScript Interfaces ---
	type UserProfile = {
		id: string;
		studentId: string;
		name: string;
		rollNumber: string;
		balance: string | number;
		isActive: boolean;
		createdAt: string;
	};

	type OrderItem = {
		id: string;
		quantity: number;
		unitPrice: string;
		menuItem?: { name: string; dietary: 'veg' | 'non-veg' };
	};

	type Order = {
		id: string;
		ticketReference: string;
		totalAmount: string | number;
		status: 'PENDING' | 'READY' | 'COMPLETED' | 'CANCELLED';
		createdAt: string;
		items: OrderItem[];
		formattedDate?: string;
		totalItems?: number;
	};

	type Transaction = {
		id: string;
		type: 'CREDIT' | 'DEBIT';
		amount: string | number;
		description: string;
		createdAt: string;
		formattedDate?: string;
	};
	// -----------------------------

	const userId = $page.params.userId;

	let targetUser: UserProfile | null = $state(null);
	let isLoadingUser: boolean = $state(true);
	let activeTab: 'ORDERS' | 'TXNS' | 'TOPUP' = $state('ORDERS');

	// Orders State
	let orders: Order[] = $state([]);
	let isLoadingOrders: boolean = $state(false);
	let ordersNextCursor: string | null = $state(null);
	let ordersHasNextPage: boolean = $state(false);

	// Transactions State
	let transactions: Transaction[] = $state([]);
	let isLoadingTxns: boolean = $state(false);
	let txnsNextCursor: string | null = $state(null);
	let txnsHasNextPage: boolean = $state(false);

	// Wallet Topup State
	let topupAmount = $state('');
	let topupProvider = $state('CASH');
	let topupTxnId = $state('');
	let isTopupSubmitting: boolean = $state(false);
	let topupSuccessMsg: string = $state('');
	let topupErrorMsg: string = $state('');

	onMount(() => {
		fetchUserDetails();
		fetchOrders();
		fetchTransactions();
	});

	async function fetchUserDetails() {
		try {
			const res = await fetch(`/api/admin/users/${userId}`);
			const data = await res.json();
			if (data.success) targetUser = data.data;
		} catch (err) {
			console.error(err);
		} finally {
			isLoadingUser = false;
		}
	}

	async function fetchOrders(cursor: string | null = null) {
		isLoadingOrders = true;
		try {
			const url = new URL(`/api/admin/users/${userId}/orders`, window.location.origin);
			if (cursor) url.searchParams.set('cursor', cursor);

			const res = await fetch(url.toString());
			const data = await res.json();

			if (data.success) {
				const formatted = data.data.tickets.map((t: Order) => {
					const d = new Date(t.createdAt);
					return {
						...t,
						formattedDate: `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`,
						totalItems: t.items.reduce((acc: number, item: OrderItem) => acc + item.quantity, 0)
					};
				});

				if (cursor) orders = [...orders, ...formatted];
				else orders = formatted;

				ordersNextCursor = data.data.pagination.nextCursor;
				ordersHasNextPage = data.data.pagination.hasNextPage;
			}
		} catch (err) {
			console.error(err);
		} finally {
			isLoadingOrders = false;
		}
	}

	async function fetchTransactions(cursor: string | null = null) {
		isLoadingTxns = true;
		try {
			const url = new URL(`/api/admin/users/${userId}/transactions`, window.location.origin);
			if (cursor) url.searchParams.set('cursor', cursor);

			const res = await fetch(url.toString());
			const data = await res.json();

			if (data.success) {
				const formatted = data.data.transactions.map((tx: Transaction) => {
					const d = new Date(tx.createdAt);
					return {
						...tx,
						formattedDate: `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`,
						amount: Number(tx.amount)
					};
				});

				if (cursor) transactions = [...transactions, ...formatted];
				else transactions = formatted;

				txnsNextCursor = data.data.pagination.nextCursor;
				txnsHasNextPage = data.data.pagination.hasNextPage;
			}
		} catch (err) {
			console.error(err);
		} finally {
			isLoadingTxns = false;
		}
	}

	async function handleWalletTopup(e: Event) {
		e.preventDefault();
		if (!targetUser) return;

		isTopupSubmitting = true;
		topupErrorMsg = '';
		topupSuccessMsg = '';

		try {
			const res = await fetch('/api/wallet/topup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					identifier: targetUser.studentId,
					amount: Number(topupAmount),
					provider: topupProvider,
					providerTxnId: topupTxnId || crypto.randomUUID()
				})
			});

			const data = await res.json();

			if (res.ok && data.success) {
				topupSuccessMsg = `Credited ${data.studentName}. New Balance: ₹${data.newBalance}`;
				topupAmount = '';
				topupTxnId = '';
				targetUser.balance = data.newBalance;

				fetchTransactions();

				setTimeout(() => (topupSuccessMsg = ''), 5000);
			} else {
				topupErrorMsg = data.error || 'Failed to process top-up';
			}
		} catch {
			topupErrorMsg = 'Network error occurred';
		} finally {
			isTopupSubmitting = false;
		}
	}

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

	function getInitials(name: string) {
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.substring(0, 2);
	}
</script>

<svelte:head><title>User Details | MunchUp Admin</title></svelte:head>

<div class="animate-in fade-in absolute inset-0 z-20 flex flex-col bg-background duration-300">
	<header
		class="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 bg-background/15 px-5 backdrop-blur-md"
	>
		<button
			onclick={() => goto(resolve('/admin/users'))}
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-foreground transition-transform active:scale-90"
		>
			<ArrowLeft size={18} strokeWidth={2.5} />
		</button>
		<h2 class="flex-1 text-[20px] font-bold tracking-tight text-foreground">User Overview</h2>
	</header>

	<div class="flex-1 space-y-6 px-5 pt-2 pb-10">
		{#if isLoadingUser}
			<div class="h-32 w-full animate-pulse rounded-3xl bg-muted/40"></div>
		{:else if targetUser}
			<div
				class="relative overflow-hidden rounded-3xl border border-muted/30 bg-card p-5 shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
			>
				<div class="flex items-center gap-4">
					<div
						class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[16px] font-bold text-primary"
					>
						{getInitials(targetUser.name)}
					</div>
					<div class="min-w-0 flex-1">
						<h1 class="truncate text-[18px] font-bold text-foreground">{targetUser.name}</h1>
						<p
							class="mt-0.5 truncate font-mono text-[11px] font-bold tracking-widest text-foreground/40 uppercase"
						>
							{targetUser.rollNumber} • {targetUser.studentId}
						</p>
					</div>
				</div>

				<div
					class="mt-5 flex items-center justify-between rounded-xl border border-muted/20 bg-muted/10 p-4"
				>
					<div>
						<p class="text-[10px] font-bold tracking-[0.15em] text-foreground/50 uppercase">
							Current Balance
						</p>
						<p class="mt-1 font-mono text-[24px] font-black tracking-tight text-foreground">
							{formatCurrencyINR(Number(targetUser.balance))}
						</p>
					</div>
					<button
						onclick={() => (activeTab = 'TOPUP')}
						class="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[12px] font-bold text-background transition-transform active:scale-95"
					>
						<Wallet size={14} strokeWidth={2.5} /> Add Funds
					</button>
				</div>
			</div>
		{/if}

		<div class="flex gap-2 rounded-full bg-muted/20 p-1.5">
			<button
				onclick={() => (activeTab = 'ORDERS')}
				class="flex-1 rounded-full py-2 text-[12px] font-bold transition-all {activeTab === 'ORDERS'
					? 'bg-background text-foreground shadow-sm'
					: 'text-foreground/50 hover:text-foreground'}"
			>
				Orders
			</button>
			<button
				onclick={() => (activeTab = 'TXNS')}
				class="flex-1 rounded-full py-2 text-[12px] font-bold transition-all {activeTab === 'TXNS'
					? 'bg-background text-foreground shadow-sm'
					: 'text-foreground/50 hover:text-foreground'}"
			>
				Transactions
			</button>
			<button
				onclick={() => (activeTab = 'TOPUP')}
				class="flex-1 rounded-full py-2 text-[12px] font-bold transition-all {activeTab === 'TOPUP'
					? 'bg-background text-foreground shadow-sm'
					: 'text-foreground/50 hover:text-foreground'}"
			>
				Top-Up
			</button>
		</div>

		{#if activeTab === 'ORDERS'}
			<div class="space-y-3">
				{#if orders.length > 0}
					<div
						class="divide-y divide-muted/20 overflow-hidden rounded-3xl border border-muted/30 bg-card shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
					>
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
					</div>
					{#if ordersHasNextPage}
						<button
							onclick={() => fetchOrders(ordersNextCursor)}
							disabled={isLoadingOrders}
							class="mt-2 w-full rounded-full bg-muted/50 py-2.5 text-[12px] font-bold text-foreground transition-all active:scale-95 disabled:opacity-50"
						>
							{isLoadingOrders ? 'Loading...' : 'Load More Orders'}
						</button>
					{/if}
				{:else if !isLoadingOrders}
					<div class="rounded-2xl border border-muted/25 bg-card py-10 text-center">
						<p class="text-[13px] font-medium text-foreground/50">No orders found.</p>
					</div>
				{/if}
			</div>
		{:else if activeTab === 'TXNS'}
			<div class="space-y-3">
				{#if transactions.length > 0}
					<div
						class="divide-y divide-muted/20 overflow-hidden rounded-3xl border border-muted/30 bg-card shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
					>
						{#each transactions as tx (tx.id)}
							<div class="flex items-center justify-between px-4 py-4">
								<div class="flex items-center gap-3">
									<div
										class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl {tx.type ===
										'CREDIT'
											? 'bg-emerald-500/10 text-emerald-600'
											: 'bg-muted/50 text-foreground/50'}"
									>
										{#if tx.type === 'CREDIT'}
											<ArrowDownLeft size={18} strokeWidth={2.5} />
										{:else}
											<ArrowUpRight size={18} strokeWidth={2.5} />
										{/if}
									</div>
									<div class="min-w-0">
										<p class="truncate text-[14px] font-semibold text-foreground">
											{tx.description}
										</p>
										<p
											class="mt-0.5 text-[10px] font-bold tracking-widest text-foreground/40 uppercase"
										>
											{tx.formattedDate}
										</p>
									</div>
								</div>
								<span
									class="shrink-0 pl-3 text-[14px] font-bold {tx.type === 'CREDIT'
										? 'text-emerald-600'
										: 'text-foreground'}"
								>
									{tx.type === 'CREDIT' ? '+' : '-'}<span class="font-mono"
										>{formatCurrencyINR(Number(tx.amount))}</span
									>
								</span>
							</div>
						{/each}
					</div>
					{#if txnsHasNextPage}
						<button
							onclick={() => fetchTransactions(txnsNextCursor)}
							disabled={isLoadingTxns}
							class="mt-2 w-full rounded-full bg-muted/50 py-2.5 text-[12px] font-bold text-foreground transition-all active:scale-95 disabled:opacity-50"
						>
							{isLoadingTxns ? 'Loading...' : 'Load More Transactions'}
						</button>
					{/if}
				{:else if !isLoadingTxns}
					<div class="rounded-2xl border border-muted/25 bg-card py-10 text-center">
						<p class="text-[13px] font-medium text-foreground/50">No transactions found.</p>
					</div>
				{/if}
			</div>
		{:else if activeTab === 'TOPUP'}
			<form
				onsubmit={handleWalletTopup}
				class="space-y-5 rounded-3xl border border-muted/30 bg-card p-5 shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
			>
				{#if topupErrorMsg}
					<div
						class="flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-[13px] font-bold text-destructive"
					>
						<AlertCircle size={16} strokeWidth={2.5} class="shrink-0" />
						<span>{topupErrorMsg}</span>
					</div>
				{/if}

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label
							for="topupAmount"
							class="mb-2 block text-[10px] font-bold tracking-widest text-foreground/50 uppercase"
							>Amount (₹)</label
						>
						<input
							id="topupAmount"
							type="number"
							min="1"
							step="0.01"
							bind:value={topupAmount}
							required
							class="w-full rounded-[14px] border border-muted/40 bg-muted/10 px-4 py-3 text-[14px] font-bold text-foreground transition-colors outline-none placeholder:text-foreground/30 focus:border-foreground/50 focus:bg-card"
							placeholder="0.00"
						/>
					</div>

					<div>
						<label
							for="provider"
							class="mb-2 block text-[10px] font-bold tracking-widest text-foreground/50 uppercase"
							>Payment Method</label
						>
						<select
							id="provider"
							bind:value={topupProvider}
							class="w-full appearance-none rounded-[14px] border border-muted/40 bg-muted/10 px-4 py-3 text-[13px] font-bold text-foreground transition-colors outline-none focus:border-foreground/50 focus:bg-card"
						>
							<option value="CASH">Cash Deposit</option>
							<option value="UPI">UPI Transfer</option>
						</select>
					</div>
				</div>

				<div>
					<label
						for="txnId"
						class="mb-2 block text-[10px] font-bold tracking-widest text-foreground/50 uppercase"
						>Reference/Receipt No. (Optional)</label
					>
					<input
						id="txnId"
						type="text"
						bind:value={topupTxnId}
						class="w-full rounded-[14px] border border-muted/40 bg-muted/10 px-4 py-3 text-[14px] font-bold text-foreground transition-colors outline-none placeholder:text-foreground/30 focus:border-foreground/50 focus:bg-card"
						placeholder="Leave blank to auto-generate"
					/>
				</div>

				<button
					type="submit"
					disabled={isTopupSubmitting}
					class="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[13px] font-bold text-background transition-transform active:scale-[0.98] disabled:opacity-50"
				>
					{#if isTopupSubmitting}
						<Loader2 size={16} strokeWidth={2.5} class="animate-spin" /> Processing Ledger...
					{:else if topupSuccessMsg}
						<CheckCircle2 size={16} strokeWidth={2.5} /> Successfully Credited!
					{:else}
						<Wallet size={16} strokeWidth={2.5} /> Add Funds
					{/if}
				</button>
			</form>
		{/if}
	</div>
</div>
