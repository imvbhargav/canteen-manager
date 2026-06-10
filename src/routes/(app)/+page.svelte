<script lang="ts">
	import { appState } from '$lib/store.svelte';
	import { goto } from '$app/navigation';
	import {
		UtensilsCrossed,
		Wallet,
		QrCode,
		Plus,
		Minus,
		ArrowUpRight,
		ArrowDownLeft,
		Bell,
		ChevronRight,
		Sunrise,
		Coffee,
		Pizza,
		Sandwich,
		ArrowRight
	} from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import type { MenuItem } from '$lib/types';

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

	function addToCart(item: MenuItem) {
		const existing = appState.cart.find((c) => c.menuItem.id === item.id);
		if (existing) {
			existing.quantity += 1;
		} else {
			appState.cart.push({ menuItem: item, quantity: 1 });
		}
	}

	function removeFromCart(item: MenuItem) {
		const index = appState.cart.findIndex((c) => c.menuItem.id === item.id);
		if (index !== -1) {
			if (appState.cart[index].quantity > 1) {
				appState.cart[index].quantity -= 1;
			} else {
				appState.cart.splice(index, 1);
			}
		}
	}

	function getQty(id: string) {
		return appState.cart.find((c) => c.menuItem.id === id)?.quantity ?? 0;
	}

	const categoryOrder = ['Breakfast', 'Lunch', 'Snacks', 'Beverages'];
	const categoryIcons: Record<string, typeof Sunrise> = {
		Breakfast: Sunrise,
		Lunch: Sandwich,
		Snacks: Pizza,
		Beverages: Coffee
	};

	let activeCategory = $state('Breakfast');

	let summaryItems = $derived(() =>
		appState.menuItems.filter((item) => item.category === activeCategory).slice(0, 4)
	);

	let availableCategories = $derived(() =>
		categoryOrder.filter((cat) => appState.menuItems.some((item) => item.category === cat))
	);

	$effect(() => {
		const avail = availableCategories();
		if (avail.length > 0 && !avail.includes(activeCategory)) {
			activeCategory = avail[0];
		}
	});
</script>

<svelte:head><title>Dashboard | MunchUp</title></svelte:head>

{#if appState.wallet}
	<div class="animate-in fade-in min-h-screen bg-background pb-28 duration-300">
		<!-- ━━ Header: branding + bell ━━ -->
		<div class="flex items-center justify-between px-5 pt-6 pb-0">
			<div class="flex items-center gap-2">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary text-background"
				>
					<UtensilsCrossed size={16} strokeWidth={2.5} />
				</div>
				<span class="text-[22px] font-black tracking-tight text-accent">MunchUp</span>
			</div>
			<button
				class="relative flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-foreground transition-transform active:scale-90"
			>
				<Bell size={18} strokeWidth={2} />
				<span
					class="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
				></span>
			</button>
		</div>

		<!-- ━━ Welcome + Dynamic Section (Menu or Active Ticket) ━━ -->
		<div class="px-5 pt-5">
			<h1 class="text-[26px] font-bold tracking-tight text-foreground">
				Hi, {appState.wallet.name.split(' ')[0]} 👋
			</h1>

			{#if appState.activeTicket}
				<p class="mt-1 text-[15px] font-medium text-foreground/45">Here is your pending order.</p>

				<!-- ━━ Active ticket ━━ -->
				<div
					class="mt-4 overflow-hidden rounded-3xl border border-muted/30 bg-card shadow-[0_2px_16px_rgb(0,0,0,0.05)]"
				>
					<div class="flex items-center justify-between bg-primary/8 px-5 py-3.5">
						<div class="flex items-center gap-2">
							<span class="relative flex h-2 w-2">
								<span
									class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"
								></span>
								<span class="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
							</span>
							<span class="text-[13px] font-bold text-foreground">Pending Order</span>
						</div>
						<span
							class="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-primary uppercase"
						>
							Not Charged
						</span>
					</div>
					<div class="divide-y divide-muted/20 px-5">
						{#each appState.activeTicket.items as item (item.menuItem.id)}
							<div class="flex items-center justify-between py-3">
								<div class="flex items-center gap-3">
									<span
										class="flex h-5 w-5 items-center justify-center rounded-md bg-muted text-[11px] font-bold text-foreground/60"
									>
										{item.quantity}
									</span>
									<span class="text-[14px] font-medium text-foreground">{item.menuItem.name}</span>
								</div>
								<span class="text-[14px] font-bold text-foreground"
									>₹{item.menuItem.price * item.quantity}</span
								>
							</div>
						{/each}
					</div>
					<div
						class="flex items-center justify-between border-t border-muted/20 bg-muted/20 px-5 py-3.5"
					>
						<span class="text-[13px] text-foreground/50">Due on collection</span>
						<span class="text-[17px] font-bold text-foreground">₹{appState.activeTicket.total}</span
						>
					</div>
					<div class="grid grid-cols-2 gap-2.5 bg-muted/20 px-5 pt-2 pb-5">
						<button
							onclick={cancelOrder}
							class="rounded-full border border-destructive/25 bg-card py-3 text-[13px] font-bold text-destructive transition-all active:scale-[0.98]"
						>
							Cancel
						</button>
						<a
							href={resolve('/ticket')}
							class="flex items-center justify-center gap-2 rounded-full bg-primary py-3 text-[13px] font-bold text-background transition-all active:scale-[0.98]"
						>
							<QrCode size={16} />
							View QR
						</a>
					</div>
				</div>
			{:else}
				<p class="mt-1 text-[15px] font-medium text-foreground/45">
					What are you craving for today?
				</p>

				<!-- Category tabs -->
				<div class="mt-4 flex scrollbar-none gap-2 overflow-x-auto">
					{#each availableCategories() as cat (cat)}
						{@const Icon = categoryIcons[cat] ?? UtensilsCrossed}
						<button
							onclick={() => (activeCategory = cat)}
							class="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-200 active:scale-95
                            {activeCategory === cat
								? 'bg-primary text-background shadow-sm'
								: 'bg-muted/50 text-foreground/50 hover:bg-muted hover:text-foreground'}"
						>
							<Icon size={12} strokeWidth={2} />
							{cat}
						</button>
					{/each}
				</div>

				<!-- Menu items -->
				<div class="mt-3">
					{#if summaryItems().length > 0}
						<div
							class="overflow-hidden rounded-[22px] border border-muted/25 bg-card shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
						>
							{#each summaryItems() as item, i (item.id)}
								{@const qty = getQty(item.id)}
								<div
									class="flex items-center gap-3 px-4 py-3.5 {i < summaryItems().length - 1
										? 'border-b border-muted/20'
										: ''}"
								>
									<div
										class="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center self-start rounded-sm border-2 {item.dietary ===
										'veg'
											? 'border-emerald-500'
											: 'border-red-500'}"
									>
										<div
											class="h-1.5 w-1.5 rounded-full {item.dietary === 'veg'
												? 'bg-emerald-500'
												: 'bg-red-500'}"
										></div>
									</div>
									<div class="min-w-0 flex-1">
										<p class="truncate text-[14px] font-semibold text-foreground">{item.name}</p>
										<p class="text-[13px] font-bold text-accent">₹{item.price}</p>
									</div>
									{#if qty > 0}
										<div class="flex items-center gap-1 rounded-full bg-primary/8 p-1">
											<button
												onclick={() => removeFromCart(item)}
												class="flex h-7 w-7 items-center justify-center rounded-full bg-card text-foreground shadow-sm transition-transform active:scale-90"
											>
												<Minus size={12} strokeWidth={2.5} />
											</button>
											<span class="w-5 text-center text-[13px] font-bold text-foreground"
												>{qty}</span
											>
											<button
												onclick={() => addToCart(item)}
												class="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform active:scale-90"
											>
												<Plus size={12} strokeWidth={2.5} />
											</button>
										</div>
									{:else}
										<button
											onclick={() => addToCart(item)}
											class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary transition-all active:scale-90 active:bg-primary/20"
										>
											<Plus size={16} strokeWidth={2.5} />
										</button>
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						<div class="rounded-[22px] border border-muted/25 bg-card px-4 py-8 text-center">
							<p class="text-[13px] text-foreground/40">Nothing available right now.</p>
						</div>
					{/if}
				</div>

				<!-- ━━ Lava-lamp CTA ━━ -->
				<a
					href={resolve('/menu')}
					class="group relative mt-4 block overflow-hidden rounded-3xl bg-[#0f2544] px-6
                           py-7 shadow-[0_8px_32px_rgba(15,37,68,0.35)]
                           transition-transform duration-300 active:scale-[0.98]"
				>
					<!-- Lava blobs... -->
					<div
						class="pointer-events-none absolute -top-10 -left-10 h-52 w-52 animate-pulse
                                rounded-full bg-orange-500/40
                                blur-3xl [animation-duration:3s]"
					></div>
					<div
						class="pointer-events-none absolute -right-8 -bottom-8 h-56 w-56 animate-pulse
                                rounded-full bg-violet-600/35
                                blur-3xl [animation-delay:1s] [animation-duration:4s]"
					></div>
					<div
						class="pointer-events-none absolute -bottom-12 left-1/2 h-40 w-40 -translate-x-1/2 animate-pulse
                                rounded-full bg-rose-500/30
                                blur-3xl [animation-delay:2s] [animation-duration:5s]"
					></div>
					<div
						class="pointer-events-none absolute top-0 -right-4 h-32 w-32 animate-pulse
                                rounded-full bg-emerald-400/20
                                blur-2xl [animation-delay:0.5s] [animation-duration:3.5s]"
					></div>

					<!-- Content -->
					<div class="relative z-10">
						<p class="text-[11px] font-bold tracking-[0.14em] text-white/40 uppercase">Full Menu</p>
						<h2 class="mt-2 text-[26px] leading-tight font-black tracking-tight text-white">
							Good Food,<br />Good Mood.
						</h2>
						<p class="mt-2 text-[14px] leading-relaxed font-medium text-white/55">
							Browse everything on today's canteen menu<br />and add to your cart in seconds.
						</p>

						<!-- Button with hover -->
						<div
							class="mt-5 inline-flex items-center gap-2 rounded-full
                                    border border-white/15 bg-white/12
                                    px-5 py-2.5 text-[13px]
                                    font-bold text-white
                                    backdrop-blur-sm
                                    transition-all duration-200
                                    group-hover:gap-3 group-hover:border-white/25 group-hover:bg-white/20
                                    group-active:scale-95"
						>
							Browse the menu
							<ArrowRight
								size={15}
								strokeWidth={2.5}
								class="transition-transform duration-200 group-hover:translate-x-0.5"
							/>
						</div>
					</div>
				</a>
			{/if}
		</div>

		<div class="mt-6 space-y-6 px-5">
			<!-- ━━ Wallet card ━━ -->
			<div
				class="relative overflow-hidden rounded-[28px] bg-linear-to-br from-primary to-accent px-6 py-5 shadow-[0_4px_24px_rgba(15,37,68,0.18)]"
			>
				<div
					class="pointer-events-none absolute -top-8 -right-8 h-36 w-36 rounded-full bg-white/5"
				></div>
				<div
					class="pointer-events-none absolute -right-2 -bottom-6 h-28 w-28 rounded-full bg-white/2.5"
				></div>
				<div class="relative">
					<div class="flex items-center gap-2">
						<Wallet size={13} strokeWidth={2} class="text-background" />
						<p class="text-xs font-black tracking-[0.15em] text-background uppercase">
							Wallet Balance
						</p>
					</div>
					<p class="mt-1.5 text-[36px] font-bold tracking-tight text-white">
						₹{appState.wallet.balance.toFixed(2)}
					</p>
					<div class="mt-4 flex items-center justify-between">
						<p class="text-[12px] font-medium text-background">{appState.wallet.name}</p>
						<a
							href={resolve('/topup')}
							class="flex items-center gap-1.5 rounded-full bg-background/80 px-4 py-2 text-[13px] font-black text-primary ring-4 ring-accent/25 backdrop-blur-md transition-all active:scale-95"
						>
							<Plus size={14} strokeWidth={2.5} />
							Add Money
						</a>
					</div>
				</div>
			</div>

			<!-- ━━ Recent activity ━━ -->
			<div>
				<div class="mb-3 flex items-center justify-between">
					<h3 class="text-[17px] font-bold text-foreground">Recent Activity</h3>
					<a
						href={resolve('/profile/history')}
						class="flex items-center gap-0.5 text-[13px] font-semibold text-primary"
					>
						See all <ChevronRight size={14} strokeWidth={2.5} />
					</a>
				</div>

				<div
					class="overflow-hidden rounded-[20px] border border-muted/25 bg-card shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
				>
					{#if isLoadingTransactions}
						{#each [1, 2, 3] as i (i)}
							<div
								class="flex animate-pulse items-center justify-between px-4 py-3.5 {i < 3
									? 'border-b border-muted/20'
									: ''}"
							>
								<div class="flex items-center gap-3">
									<div class="h-9 w-9 shrink-0 rounded-xl bg-muted"></div>
									<div class="space-y-2">
										<div class="h-3.5 w-24 rounded-full bg-muted"></div>
										<div class="h-2.5 w-16 rounded-full bg-muted/60"></div>
									</div>
								</div>
								<div class="h-3.5 w-10 rounded-full bg-muted"></div>
							</div>
						{/each}
					{:else if recentTransactions.length > 0}
						{#each recentTransactions.slice(0, 3) as tx, i (tx.id)}
							<div
								class="flex items-center justify-between px-4 py-3.5 transition-colors active:bg-muted/30 {i <
								Math.min(recentTransactions.length, 3) - 1
									? 'border-b border-muted/20'
									: ''}"
							>
								<div class="flex items-center gap-3">
									<div
										class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl {tx.type ===
										'credit'
											? 'bg-emerald-500/10 text-emerald-600'
											: 'bg-muted text-foreground/40'}"
									>
										{#if tx.type === 'credit'}
											<ArrowDownLeft size={16} strokeWidth={2.5} />
										{:else}
											<ArrowUpRight size={16} strokeWidth={2.5} />
										{/if}
									</div>
									<div>
										<p class="text-[14px] font-semibold text-foreground">{tx.title}</p>
										<p class="text-[11px] text-foreground/40">{tx.date}</p>
									</div>
								</div>
								<span
									class="text-[14px] font-bold {tx.type === 'credit'
										? 'text-emerald-600'
										: 'text-foreground'}"
								>
									{tx.type === 'credit' ? '+' : '-'}₹{tx.amount.toFixed(2)}
								</span>
							</div>
						{/each}
					{:else}
						<div class="px-4 py-10 text-center">
							<p class="text-[14px] text-foreground/40">No transactions yet.</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
