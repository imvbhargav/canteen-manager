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
		ReceiptText,
		Clock,
		Utensils,
		XCircle,
		ArrowDownLeft,
		ArrowUpRight,
		KeyRound,
		QrCode,
		RefreshCw,
		ShieldCheck,
		ShieldAlert,
		ChevronRight,
		AlertCircle
	} from 'lucide-svelte';

	type UserProfile = {
		id: string;
		studentId: string;
		name: string;
		rollNumber: string;
		accountNumber: string;
		balance: string | number;
		isActive: boolean;
		credentialPhotoUrl: string | null;
		deactivationReason: string | null;
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

	type ApiResponse<T> = {
		success: boolean;
		error?: string;
		data: T;
	};

	type AdminUserResponse = ApiResponse<UserProfile>;

	type AdminOrdersResponse = ApiResponse<{
		tickets: Order[];
		pagination: {
			nextCursor: string | null;
			hasNextPage: boolean;
		};
	}>;

	type AdminTxnsResponse = ApiResponse<{
		transactions: Transaction[];
		pagination: {
			nextCursor: string | null;
			hasNextPage: boolean;
		};
	}>;

	type WalletTopupResponse = {
		success: boolean;
		error?: string;
		studentName: string;
		newBalance: string;
		message: string;
	};

	type QrGenerateResponse = {
		success: boolean;
		error?: string;
		otpCode: string;
	};

	type PinResetResponse = {
		success: boolean;
		error?: string;
		defaultPin: string;
	};

	const userId: string = $page.params.userId ?? '';

	let targetUser: UserProfile | null = $state(null);
	let isLoadingUser: boolean = $state(true);
	let activeTab: 'ORDERS' | 'TXNS' | 'FUNDS' = $state('ORDERS');

	let orders: Order[] = $state([]);
	let isLoadingOrders: boolean = $state(false);
	let ordersNextCursor: string | null = $state(null);
	let ordersHasNextPage: boolean = $state(false);

	let transactions: Transaction[] = $state([]);
	let isLoadingTxns: boolean = $state(false);
	let txnsNextCursor: string | null = $state(null);
	let txnsHasNextPage: boolean = $state(false);

	let fundAction: 'CREDIT' | 'DEBIT' = $state('CREDIT');
	let topupAmount: string = $state('');
	let topupProvider: string = $state('CASH');
	let topupTxnId: string = $state('');
	let adminPin: string = $state('');
	let isTopupSubmitting: boolean = $state(false);
	let topupSuccessMsg: string = $state('');
	let topupErrorMsg: string = $state('');

	let showOtpModal: boolean = $state(false);
	let isGeneratingOtp: boolean = $state(false);
	let otpError: string = $state('');
	let generatedOtp: string = $state('');

	let showResetModal: boolean = $state(false);
	let isResettingPin: boolean = $state(false);
	let resetStatusMessage: string = $state('');
	let returnedResetPin: string = $state('');

	onMount(() => {
		fetchUserDetails();
		fetchOrders();
		fetchTransactions();
	});

	async function fetchUserDetails(): Promise<void> {
		try {
			const res: Response = await fetch(`/api/admin/users/${userId}`);
			const data: AdminUserResponse = await res.json();
			if (data.success) {
				targetUser = data.data;
				if (targetUser && !targetUser.isActive && activeTab === 'FUNDS') {
					activeTab = 'ORDERS';
				}
			}
		} catch (err: unknown) {
			console.error(err);
		} finally {
			isLoadingUser = false;
		}
	}

	async function fetchOrders(cursor: string | null = null): Promise<void> {
		isLoadingOrders = true;
		try {
			const url: URL = new URL(`/api/admin/users/${userId}/orders`, window.location.origin);
			if (cursor) url.searchParams.set('cursor', cursor);
			const res: Response = await fetch(url.toString());
			const data: AdminOrdersResponse = await res.json();
			if (data.success) {
				const formatted: Order[] = data.data.tickets.map((t: Order) => {
					const d: Date = new Date(t.createdAt);
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
		} catch (err: unknown) {
			console.error(err);
		} finally {
			isLoadingOrders = false;
		}
	}

	async function fetchTransactions(cursor: string | null = null): Promise<void> {
		isLoadingTxns = true;
		try {
			const url: URL = new URL(`/api/admin/users/${userId}/transactions`, window.location.origin);
			if (cursor) url.searchParams.set('cursor', cursor);
			const res: Response = await fetch(url.toString());
			const data: AdminTxnsResponse = await res.json();
			if (data.success) {
				const formatted: Transaction[] = data.data.transactions.map((tx: Transaction) => {
					const d: Date = new Date(tx.createdAt);
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
		} catch (err: unknown) {
			console.error(err);
		} finally {
			isLoadingTxns = false;
		}
	}

	async function handleWalletFunds(e: Event): Promise<void> {
		e.preventDefault();
		if (!targetUser || !adminPin) {
			topupErrorMsg = 'Admin PIN is required';
			return;
		}
		isTopupSubmitting = true;
		topupErrorMsg = '';
		topupSuccessMsg = '';
		try {
			const res: Response = await fetch('/api/wallet/topup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					identifier: targetUser.accountNumber || targetUser.studentId,
					amount: Number(topupAmount),
					provider: topupProvider,
					providerTxnId: topupTxnId || crypto.randomUUID(),
					action: fundAction,
					pin: adminPin
				})
			});
			const data: WalletTopupResponse = await res.json();
			if (res.ok && data.success) {
				const actionVerb: string = fundAction === 'CREDIT' ? 'Credited' : 'Deducted from';
				topupSuccessMsg = `${actionVerb} ${data.studentName}. New Balance: ₹${data.newBalance}`;
				topupAmount = '';
				topupTxnId = '';
				adminPin = '';
				targetUser.balance = data.newBalance;
				fetchTransactions();
				setTimeout(() => (topupSuccessMsg = ''), 5000);
			} else {
				topupErrorMsg = data.error || 'Failed to process transaction';
			}
		} catch (err: unknown) {
			console.error(err);
			topupErrorMsg = 'Network error occurred';
		} finally {
			isTopupSubmitting = false;
		}
	}

	async function triggerManualOtpGeneration(): Promise<void> {
		showOtpModal = true;
		isGeneratingOtp = true;
		otpError = '';
		generatedOtp = '';
		try {
			const res: Response = await fetch('/api/checkout/manual/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: userId })
			});
			const data: QrGenerateResponse = await res.json();
			if (res.ok && data.success) {
				generatedOtp = data.otpCode;
			} else {
				// Captures "No active order processing engine is online right now" or other error states elegantly
				otpError = data.error || 'Failed to generate token';
			}
		} catch (err: unknown) {
			console.error(err);
			otpError = 'Network communication issue';
		} finally {
			isGeneratingOtp = false;
		}
	}

	function closeOtpModal(): void {
		showOtpModal = false;
		otpError = '';
		generatedOtp = '';
	}

	async function confirmUserPinReset(): Promise<void> {
		isResettingPin = true;
		resetStatusMessage = '';
		returnedResetPin = '';
		try {
			const res: Response = await fetch('/api/auth/pin/admin-reset', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: userId })
			});
			const data: PinResetResponse = await res.json();
			if (data.success) {
				resetStatusMessage = 'PIN cleared successfully';
				returnedResetPin = data.defaultPin;
			} else {
				resetStatusMessage = data.error || 'Failed to perform reset';
			}
		} catch (err: unknown) {
			console.error(err);
			resetStatusMessage = 'Error reaching database network';
		} finally {
			isResettingPin = false;
		}
	}

	function closeResetModal(): void {
		showResetModal = false;
		resetStatusMessage = '';
		returnedResetPin = '';
	}

	function getStatusConfig(status: string): {
		icon: typeof CheckCircle2;
		color: string;
		bg: string;
	} {
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

	<div class="flex-1 space-y-6 overflow-y-auto px-5 pt-2 pb-10">
		{#if isLoadingUser}
			<div
				class="relative overflow-hidden rounded-3xl border border-muted/30 bg-card p-5 shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
			>
				<div class="flex items-start justify-between gap-4">
					<div class="w-full max-w-40 space-y-2">
						<div class="h-5 w-4/5 animate-pulse rounded-md bg-muted/60"></div>
						<div class="h-3 w-3/5 animate-pulse rounded-md bg-muted/40"></div>
					</div>
					<div class="h-7 w-18 shrink-0 animate-pulse rounded-full bg-muted/50"></div>
				</div>

				<div
					class="mt-5 flex h-16.5 items-center justify-between rounded-xl border border-muted/20 bg-muted/10 p-4"
				>
					<div class="space-y-1.5">
						<div class="h-3 w-16 animate-pulse rounded bg-muted/40"></div>
						<div class="h-6 w-24 animate-pulse rounded-md bg-muted/60"></div>
					</div>
					<div class="h-8 w-32 animate-pulse rounded-full bg-muted/60"></div>
				</div>

				<div class="mt-4 flex gap-3 border-t border-muted/20 pt-4">
					<div class="h-10.5 flex-1 animate-pulse rounded-xl bg-muted/40"></div>
					<div class="h-10.5 w-28.5 animate-pulse rounded-xl bg-muted/40"></div>
				</div>
			</div>
		{:else if targetUser}
			<div
				class="relative overflow-hidden rounded-3xl border border-muted/30 bg-card p-5 shadow-[0_2px_12px_rgb(0,0_0,0.04)]"
			>
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0">
						<h1 class="truncate font-site-name text-[18px] font-bold text-foreground">
							{targetUser.name}
						</h1>
						<p
							class="mt-0.5 truncate font-mono text-[11px] font-bold tracking-widest text-foreground/40 uppercase"
						>
							{targetUser.accountNumber}
						</p>
					</div>

					<button
						onclick={() => goto(resolve(`/admin/users/${userId}/status`))}
						class="group flex shrink-0 items-center gap-1 rounded-full border py-1.5 pr-2 pl-3 text-[11px] font-bold transition-all active:scale-95
                        {targetUser.isActive
							? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
							: 'border-destructive/20 bg-destructive/10 text-destructive'}"
					>
						{#if targetUser.isActive}
							<ShieldCheck size={12} strokeWidth={2.5} />
							<span>Active</span>
						{:else}
							<ShieldAlert size={12} strokeWidth={2.5} />
							<span>Inactive</span>
						{/if}
						<ChevronRight size={12} class="transition-transform group-hover:translate-x-0.5" />
					</button>
				</div>

				<div
					class="mt-5 flex items-center justify-between rounded-xl border border-muted/20 bg-muted/10"
				>
					<div class="p-4">
						<p class="text-[10px] font-bold tracking-[0.15em] text-foreground/50 uppercase">
							Current Balance
						</p>
						<p class="mt-1 font-mono text-[24px] font-bold tracking-tight text-foreground">
							{formatCurrencyINR(Number(targetUser.balance))}
						</p>
					</div>
					{#if targetUser.isActive}
						<button
							onclick={() => (activeTab = 'FUNDS')}
							class="mr-4 flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[12px] font-bold text-background transition-transform active:scale-95"
						>
							<Wallet size={14} strokeWidth={2.5} /> Manage Funds
						</button>
					{/if}
				</div>

				<div class="mt-4 flex gap-3 border-t border-muted/20 pt-4">
					<button
						type="button"
						onclick={triggerManualOtpGeneration}
						class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-muted/40 px-3 py-3 text-[12px] font-bold text-foreground transition-all hover:bg-muted/60 active:scale-[0.97]"
					>
						<QrCode size={14} class="text-primary" /> Fallback Code
					</button>

					<button
						type="button"
						onclick={() => (showResetModal = true)}
						class="flex items-center justify-center gap-2 rounded-xl border border-destructive/20 px-6 py-3 text-[12px] font-bold text-destructive transition-all hover:bg-destructive/5 active:scale-[0.97]"
					>
						<RefreshCw size={14} /> Reset PIN
					</button>
				</div>
			</div>

			{#if !targetUser.isActive && targetUser.deactivationReason}
				<div class="mt-3.5 rounded-2xl border border-destructive/10 bg-destructive/5 px-4 py-2.5">
					<p class="text-[9px] font-bold tracking-widest text-destructive/60 uppercase">
						Reason for Suspension
					</p>
					<p class="mt-0.5 text-[12px] leading-normal font-medium text-foreground/80">
						{targetUser.deactivationReason}
					</p>
				</div>
			{/if}
		{/if}

		<div class="flex gap-2 rounded-2xl border border-accent/10 bg-accent/5 p-1.5">
			<button
				onclick={() => (activeTab = 'ORDERS')}
				class="flex-1 rounded-xl py-2 text-[12px] font-bold transition-all {activeTab === 'ORDERS'
					? 'bg-primary text-background shadow-sm'
					: 'text-foreground/50 hover:text-foreground'}">Orders</button
			>
			<button
				onclick={() => (activeTab = 'TXNS')}
				class="flex-1 rounded-xl py-2 text-[12px] font-bold transition-all {activeTab === 'TXNS'
					? 'bg-primary text-background shadow-sm'
					: 'text-foreground/50 hover:text-foreground'}">Transactions</button
			>
			{#if targetUser?.isActive}
				<button
					onclick={() => (activeTab = 'FUNDS')}
					class="flex-1 rounded-xl py-2 text-[12px] font-bold transition-all {activeTab === 'FUNDS'
						? 'bg-primary text-background shadow-sm'
						: 'text-foreground/50 hover:text-foreground'}">Funds</button
				>
			{/if}
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
													>{order.totalItems} Items</span
												>
											</p>
											<p
												class="mt-0.5 text-[10px] font-bold tracking-widest text-foreground/40 uppercase"
											>
												{order.formattedDate}
											</p>
										</div>
									</div>
									<div class="flex shrink-0 flex-col items-end gap-1 pl-3">
										<span class="font-mono text-[14px] font-bold text-foreground"
											>{formatCurrencyINR(Number(order.totalAmount))}</span
										>
										<span class="text-[9px] font-bold tracking-wider uppercase {config.color}"
											>{order.status}</span
										>
									</div>
								</div>
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
										{#if tx.type === 'CREDIT'}<ArrowDownLeft
												size={18}
												strokeWidth={2.5}
											/>{:else}<ArrowUpRight size={18} strokeWidth={2.5} />{/if}
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
		{:else if activeTab === 'FUNDS' && targetUser?.isActive}
			<form
				onsubmit={handleWalletFunds}
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
							for="fundAction"
							class="mb-2 block text-[10px] font-bold tracking-widest text-foreground/50 uppercase"
							>Transaction Type</label
						>
						<select
							id="fundAction"
							bind:value={fundAction}
							class="w-full appearance-none rounded-[14px] border border-muted/40 bg-muted/10 px-4 py-3 text-[13px] font-bold text-foreground transition-colors outline-none focus:border-foreground/50 focus:bg-card"
						>
							<option value="CREDIT">Add Funds (+)</option>
							<option value="DEBIT">Deduct Funds (-)</option>
						</select>
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
							<option value="CASH"
								>{fundAction === 'CREDIT' ? 'Cash Deposit' : 'Cash Refund'}</option
							>
							<option value="UPI">UPI / Online</option>
							<option value="ADJUSTMENT">Manual Adjustment</option>
						</select>
					</div>
				</div>

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
							for="txnId"
							class="mb-2 block text-[10px] font-bold tracking-widest text-foreground/50 uppercase"
							>Reference (Optional)</label
						>
						<input
							id="txnId"
							type="text"
							bind:value={topupTxnId}
							class="w-full rounded-[14px] border border-muted/40 bg-muted/10 px-4 py-3 text-[14px] font-bold text-foreground transition-colors outline-none placeholder:text-foreground/30 focus:border-foreground/50 focus:bg-card"
							placeholder="Auto-generate ID"
						/>
					</div>
				</div>

				<div class="border-t border-muted/20 pt-4">
					<label
						for="adminPin"
						class="mb-2 flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-foreground/50 uppercase"
					>
						<KeyRound size={12} strokeWidth={2.5} /> Admin Authorization PIN
					</label>
					<input
						id="adminPin"
						type="password"
						maxlength="5"
						bind:value={adminPin}
						required
						class="w-full rounded-[14px] border border-muted/40 bg-muted/10 px-4 py-3 text-center text-[18px] font-black tracking-widest text-foreground transition-colors outline-none placeholder:text-foreground/30 focus:border-primary/50 focus:bg-card"
						placeholder="•••••"
					/>
				</div>

				<button
					type="submit"
					disabled={isTopupSubmitting}
					class="mt-2 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[13px] font-bold text-background transition-transform active:scale-[0.98] disabled:opacity-50 {fundAction ===
					'CREDIT'
						? 'bg-primary'
						: 'bg-destructive'}"
				>
					{#if isTopupSubmitting}
						<Loader2 size={16} strokeWidth={2.5} class="animate-spin" /> Processing Ledger...
					{:else if topupSuccessMsg}
						<CheckCircle2 size={16} strokeWidth={2.5} /> Updated Successfully!
					{:else}
						<Wallet size={16} strokeWidth={2.5} />
						{fundAction === 'CREDIT' ? 'Confirm Addition' : 'Confirm Deduction'}
					{/if}
				</button>
			</form>
		{/if}
	</div>
</div>

{#if showOtpModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-background/40 p-5 backdrop-blur-xs"
	>
		<div
			class="animate-in zoom-in-95 w-full max-w-sm rounded-3xl border border-muted/30 bg-card p-6 shadow-xl duration-150"
		>
			<div class="flex items-center justify-between">
				<h3 class="text-[17px] font-bold text-foreground">Fallback Verification</h3>
				{#if !isGeneratingOtp}
					<button
						onclick={closeOtpModal}
						class="p-1 text-foreground/40 transition-colors hover:text-foreground"
					>
						<XCircle size={18} />
					</button>
				{/if}
			</div>

			<!-- 1. LOADING STATE -->
			{#if isGeneratingOtp}
				<div class="flex flex-col items-center justify-center space-y-3 py-12">
					<Loader2 size={32} class="animate-spin text-primary" />
					<p class="text-[13px] font-medium text-foreground/60">Generating fallback token...</p>
				</div>
			{/if}

			<!-- 2. ERROR STATE -->
			{#if otpError && !isGeneratingOtp}
				<div
					class="mt-4 flex items-start gap-2.5 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-destructive"
				>
					<AlertCircle size={16} class="mt-0.5 shrink-0" />
					<p class="text-[13px] leading-normal font-semibold">{otpError}</p>
				</div>
				<div class="mt-6">
					<button
						type="button"
						onclick={closeOtpModal}
						class="w-full rounded-full bg-muted/60 py-2.5 text-[12px] font-bold text-foreground transition-colors active:scale-95"
					>
						Dismiss
					</button>
				</div>
			{/if}

			<!-- 3. SUCCESS / OTP DISPLAY STATE -->
			{#if generatedOtp && !isGeneratingOtp}
				<p class="mt-2 text-[13px] leading-relaxed text-foreground/60">
					A secure session verification key has been provisioned for <span
						class="font-semibold text-foreground">{targetUser?.name || 'the user'}</span
					>. Provide this dynamic credential to clear terminal checkpoints:
				</p>

				<div
					class="animate-in slide-in-from-top-2 mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center duration-300"
				>
					<p class="text-[10px] font-bold tracking-widest text-primary uppercase">
						One-Time Security Token
					</p>
					<p
						class="mt-2 pl-[0.2em] font-mono text-[32px] font-black tracking-[0.2em] text-foreground"
					>
						{generatedOtp}
					</p>
					<div class="mt-2 flex items-center justify-center">
						<span class="rounded bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground/50"
							>Expires in 5 minutes</span
						>
					</div>
				</div>

				<div class="mt-6">
					<button
						type="button"
						onclick={closeOtpModal}
						class="w-full rounded-full bg-primary py-2.5 text-[13px] font-bold text-background shadow-md transition-colors active:scale-95"
					>
						Dismiss & Done
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if showResetModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-background/40 p-5 backdrop-blur-xs"
	>
		<div
			class="animate-in zoom-in-95 w-full max-w-sm rounded-3xl border border-muted/30 bg-card p-6 shadow-xl duration-150"
		>
			<div class="flex items-center justify-between">
				<h3 class="text-[17px] font-bold text-foreground">Reset Credentials</h3>
				{#if returnedResetPin}
					<button
						onclick={closeResetModal}
						class="p-1 text-foreground/40 transition-colors hover:text-foreground"
					>
						<XCircle size={18} />
					</button>
				{/if}
			</div>

			{#if !returnedResetPin}
				<p class="mt-2 text-[13px] leading-relaxed text-foreground/60">
					This will wipe the current authentication hash for <span
						class="font-semibold text-foreground">{targetUser?.name || 'this user'}</span
					>. They will be assigned a temporary fallback PIN derived from their account details.
				</p>
			{:else}
				<p class="mt-2 text-[13px] leading-relaxed text-foreground/60">
					The credentials have been modified. Please write down or read this temporary security key
					out loud to <span class="font-semibold text-foreground"
						>{targetUser?.name || 'the user'}</span
					>:
				</p>
			{/if}

			{#if returnedResetPin}
				<div
					class="animate-in slide-in-from-top-2 mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center duration-300"
				>
					<p class="text-[10px] font-bold tracking-widest text-emerald-600/70 uppercase">
						Temporary Auth Key
					</p>
					<p
						class="mt-2 pl-[0.25em] font-mono text-[32px] font-black tracking-[0.25em] text-emerald-600"
					>
						{returnedResetPin.toUpperCase()}
					</p>
					<p class="mt-2 text-[11px] leading-normal font-medium text-foreground/40">
						The user will be forced to modify this temporary key on their next successful sign-in
						pipeline initialization.
					</p>
				</div>
			{/if}

			{#if resetStatusMessage && !returnedResetPin}
				<div
					class="mt-4 rounded-xl bg-muted/60 p-3 text-center text-[12px] font-bold text-foreground"
				>
					{resetStatusMessage}
				</div>
			{/if}

			<div class="mt-6 flex gap-3">
				{#if !returnedResetPin}
					<button
						type="button"
						disabled={isResettingPin}
						onclick={closeResetModal}
						class="flex-1 rounded-full bg-muted/60 py-2.5 text-[12px] font-bold text-foreground transition-colors active:scale-95"
						>Cancel</button
					>
					<button
						type="button"
						disabled={isResettingPin}
						onclick={confirmUserPinReset}
						class="flex-1 rounded-full bg-destructive py-2.5 text-[12px] font-bold text-background transition-colors active:scale-95 disabled:opacity-50"
					>
						{#if isResettingPin}<Loader2 size={14} class="mr-1 inline animate-spin" /> Clearing...{:else}Reset
							PIN{/if}
					</button>
				{:else}
					<button
						type="button"
						onclick={closeResetModal}
						class="w-full rounded-full bg-primary py-2.5 text-[13px] font-bold text-background shadow-md transition-colors active:scale-95"
						>Dismiss & Done</button
					>
				{/if}
			</div>
		</div>
	</div>
{/if}
