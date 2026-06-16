<script lang="ts">
	import { appState } from '$lib/store.svelte';
	import { goto } from '$app/navigation';
	import {
		UtensilsCrossed,
		Wallet,
		QrCode,
		ChevronRight,
		ArrowRight,
		Sunrise,
		Coffee,
		Pizza,
		Sandwich,
		Clock,
		Utensils,
		CheckCircle2,
		XCircle,
		ReceiptText,
		Settings,
		CreditCard,
		User,
		History,
		LogOut
	} from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import type { MenuItem } from '$lib/types';
	import AppLogo from '$lib/components/AppLogo.svelte';
	import { formatCurrencyINR } from '$lib';

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

	let activeOrders: Ticket[] = $state([]);
	let isLoadingOrders: boolean = $state(true);

	// Dropdown state engine
	let isSettingsOpen: boolean = $state(false);

	$effect(() => {
		isLoadingOrders = true;
		fetch('/api/orders?status=PENDING&status=READY&limit=5')
			.then((res: Response) => res.json())
			.then((result: { success: boolean; data: { tickets: Ticket[] } }) => {
				if (result.success) {
					activeOrders = result.data.tickets.map((t: Ticket): Ticket => {
						const d: Date = new Date(t.createdAt);
						return {
							...t,
							formattedDate: `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`,
							totalItems: t.items.reduce((acc: number, item: TicketItem) => acc + item.quantity, 0)
						};
					});
				}
			})
			.catch((err: Error) => console.error('Failed to fetch active orders:', err))
			.finally(() => (isLoadingOrders = false));
	});

	function toggleSettings(e: MouseEvent) {
		e.stopPropagation();
		isSettingsOpen = !isSettingsOpen;
	}

	function closeSettings() {
		isSettingsOpen = false;
	}

	async function executeLogout(): Promise<void> {
		await fetch('/api/auth/logout', { method: 'POST' });
		window.location.href = '/login';
	}

	function handleLogout() {
		closeSettings();
		executeLogout();
	}

	function cancelOrder(): void {
		appState.activeTicket = null;
		goto(resolve('/menu'));
	}

	function getStatusConfig(status: string) {
		switch (status) {
			case 'COMPLETED':
				return { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
			case 'READY':
				return { icon: Utensils, color: 'text-blue-500', bg: 'bg-blue-500/10' };
			case 'PENDING':
				return { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' };
			case 'CANCELLED':
				return { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' };
			default:
				return { icon: ReceiptText, color: 'text-foreground/50', bg: 'bg-muted/50' };
		}
	}

	type CategoryConfig = {
		Icon: typeof Sunrise;
		accent: string;
		iconColor: string;
		dot: string;
		label: string;
	};

	const categoryConfig: Record<string, CategoryConfig> = {
		Breakfast: {
			Icon: Sunrise,
			accent: 'bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/10',
			iconColor: 'text-amber-500 bg-amber-500/10',
			dot: 'bg-amber-400',
			label: 'Breakfast'
		},
		Lunch: {
			Icon: Sandwich,
			accent: 'bg-lime-500/5 hover:bg-lime-500/10 border-lime-500/10',
			iconColor: 'text-lime-600 bg-lime-500/10',
			dot: 'bg-lime-400',
			label: 'Lunch'
		},
		Snacks: {
			Icon: Pizza,
			accent: 'bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/10',
			iconColor: 'text-rose-500 bg-rose-500/10',
			dot: 'bg-rose-400',
			label: 'Snacks'
		},
		Beverages: {
			Icon: Coffee,
			accent: 'bg-sky-500/5 hover:bg-sky-500/10 border-sky-500/10',
			iconColor: 'text-sky-500 bg-sky-500/10',
			dot: 'bg-sky-400',
			label: 'Beverages'
		}
	};

	const categoryOrder: string[] = ['Breakfast', 'Lunch', 'Snacks', 'Beverages'];
	const categoryTaglines: Record<string, string> = {
		Breakfast: 'Start your day right',
		Lunch: 'Midday favourites',
		Snacks: 'Between-meal bites',
		Beverages: 'Hot & cold drinks'
	};

	let availableCategories: string[] = $derived(
		categoryOrder.filter((cat: string): boolean =>
			appState.menuItems.some((item: MenuItem): boolean => item.category === cat)
		)
	);
</script>

<svelte:window onclick={closeSettings} />

<svelte:head><title>Dashboard | MunchUp</title></svelte:head>

{#if appState.wallet}
	<div
		class="animate-in fade-in animate-duration-200 absolute inset-0 z-20 flex flex-col overflow-y-auto bg-background duration-300"
	>
		<!-- ── Header & Popup Anchor ── -->
		<header
			class="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between gap-3 bg-background/15 px-5 backdrop-blur-md"
		>
			<AppLogo />
			<div class="relative">
				<button
					onclick={toggleSettings}
					aria-label="Toggle settings popover panel"
					class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-muted/60 text-foreground transition-all active:scale-90
                    {isSettingsOpen ? 'bg-primary/10 text-primary ring-1 ring-primary/20' : ''}"
				>
					<Settings
						size={16}
						strokeWidth={2.5}
						class="transition-transform duration-200 {isSettingsOpen ? 'rotate-45' : ''}"
					/>
				</button>

				<!-- ── Popover Panel Overlay ── -->
				{#if isSettingsOpen}
					<div
						onclick={(e) => e.stopPropagation()}
						role="none"
						class="animate-in fade-in zoom-in-95 slide-in-from-top-2 absolute top-11 right-0 z-50 w-48 origin-top-right rounded-2xl border border-muted bg-card p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] duration-150"
					>
						<a
							href={resolve('/profile')}
							onclick={closeSettings}
							class="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-bold text-foreground/80 transition-colors hover:bg-muted/40 active:bg-muted/70"
						>
							<User size={15} strokeWidth={2.5} class="text-foreground/40" />
							My Profile
						</a>
						<a
							href={resolve('/orders')}
							onclick={closeSettings}
							class="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-bold text-foreground/80 transition-colors hover:bg-muted/40 active:bg-muted/70"
						>
							<History size={15} strokeWidth={2.5} class="text-foreground/40" />
							Order History
						</a>
						<button
							onclick={handleLogout}
							class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold text-destructive transition-colors hover:bg-destructive/5 active:bg-destructive/10"
						>
							<LogOut size={15} strokeWidth={2.5} />
							Log Out
						</button>
					</div>
				{/if}
			</div>
		</header>

		<!-- ── User Welcoming Hero ── -->
		<div class="px-5 py-3">
			<h2 class="font-site-name text-3xl leading-none font-black tracking-tight text-foreground">
				Welcome, <span class="text-primary">{appState.wallet.name.split(' ')[0]}</span> 👋
			</h2>
			<p
				class="mt-1.5 px-0.5 font-mono text-[10px] font-bold tracking-wider text-foreground/60 uppercase"
			>
				{appState.wallet.referenceKey}
			</p>
		</div>

		<div class="space-y-5 px-5 pt-3">
			<!-- ── Active Order Banner Component ── -->
			{#if appState.activeTicket}
				<div
					class="overflow-hidden rounded-3xl border border-muted bg-card p-2 shadow-[0_2px_12px_rgb(0,0,0,0.03)]"
				>
					<div class="flex items-center justify-between rounded-2xl bg-primary/5 px-4 py-3">
						<div class="flex items-center gap-2.5">
							<span class="relative flex h-2 w-2">
								<span
									class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"
								></span>
								<span class="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
							</span>
							<span class="text-[14px] font-bold tracking-tight text-foreground"
								>Active Pending Order</span
							>
						</div>
						<span
							class="rounded-md bg-primary/10 px-2 py-0.5 text-[9px] font-black tracking-widest text-primary uppercase"
						>
							Unpaid
						</span>
					</div>

					<div class="divide-y divide-muted/15 px-3">
						{#each appState.activeTicket.items as item (item.menuItem.id)}
							<div class="flex items-center justify-between py-3">
								<div class="flex items-center gap-3">
									<span
										class="flex h-5 w-5 items-center justify-center rounded bg-muted/60 text-[11px] font-black text-foreground/50"
									>
										{item.quantity}
									</span>
									<span class="text-[14px] font-bold tracking-tight text-foreground/70"
										>{item.menuItem.name}</span
									>
								</div>
								<span class="font-mono text-[13px] font-bold text-foreground/80">
									{formatCurrencyINR(item.menuItem.price * item.quantity)}
								</span>
							</div>
						{/each}
					</div>

					<div class="mt-1 flex items-center justify-between rounded-2xl bg-muted/30 px-4 py-3.5">
						<span class="text-[12px] font-medium text-foreground/40">Due on collection</span>
						<span class="font-mono text-[16px] font-black text-foreground">
							{formatCurrencyINR(appState.activeTicket.total)}
						</span>
					</div>

					<div class="mt-2 grid grid-cols-2 gap-2">
						<button
							onclick={cancelOrder}
							class="rounded-2xl border border-destructive/20 bg-card py-3.5 text-[13px] font-bold text-destructive transition-all hover:bg-destructive/5 active:scale-[0.98]"
						>
							Cancel Order
						</button>
						<a
							href={resolve('/ticket')}
							class="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-[13px] font-bold text-background shadow-sm shadow-primary/10 transition-all active:scale-[0.98] active:opacity-95"
						>
							<QrCode size={15} strokeWidth={2.5} />
							View Ticket QR
						</a>
					</div>
				</div>
			{:else}
				<!-- ── Food Categories Carousel Grid ── -->
				<div>
					<div class="mb-3 flex items-end justify-between px-1">
						<div>
							<h2 class="text-[17px] font-bold tracking-tight text-foreground">Categories</h2>
							<p class="mt-0.5 text-[12px] font-medium text-foreground/40">
								What are you craving today?
							</p>
						</div>
						<a
							href={resolve('/menu')}
							class="flex items-center gap-0.5 text-[12px] font-black tracking-tight text-primary uppercase"
						>
							View All <ChevronRight size={13} strokeWidth={3} />
						</a>
					</div>

					<div
						class="flex snap-x snap-mandatory scrollbar-none flex-row gap-2.5 overflow-x-auto pb-1"
					>
						{#each availableCategories as cat (cat)}
							{@const cfg = categoryConfig[cat] ?? {
								Icon: UtensilsCrossed,
								accent: 'bg-muted/40 border-muted',
								iconColor: 'text-foreground/60 bg-muted/40',
								dot: 'bg-foreground/30',
								label: cat
							}}
							{@const Icon = cfg.Icon}
							{@const count = appState.menuItems.filter(
								(item: MenuItem): boolean => item.category === cat
							).length}

							<a
								href="{resolve('/menu')}?category={cat.toLowerCase()}"
								class="{cfg.accent} group relative flex w-35.5 shrink-0 snap-start flex-col gap-4 rounded-2xl border p-3.5 text-left shadow-[0_2px_8px_rgba(0,0,0,0.01)] transition-all active:scale-95"
							>
								<div class="flex items-center justify-between">
									<div
										class="flex h-9 w-9 items-center justify-center rounded-xl bg-background {cfg.iconColor}"
									>
										<Icon size={18} strokeWidth={2.5} />
									</div>
									<span
										class="flex h-5 w-5 items-center justify-center rounded-full border border-muted/20 bg-background/80 font-mono text-[10px] font-black text-foreground/60 shadow-xs"
									>
										{count}
									</span>
								</div>
								<div>
									<p class="text-[14px] leading-none font-bold tracking-tight text-foreground">
										{cfg.label}
									</p>
									<p
										class="mt-1 line-clamp-1 text-[11px] leading-tight font-medium text-foreground/40"
									>
										{categoryTaglines[cat]}
									</p>
								</div>
							</a>
						{/each}
					</div>
				</div>

				<!-- ── Full Menu Exploration Banner Card ── -->
				<a
					href={resolve('/menu')}
					class="group relative block overflow-hidden rounded-3xl bg-[#0f2544] px-6 py-6 shadow-[0_12px_32px_rgba(15,37,68,0.15)] transition-transform active:scale-[0.99]"
				>
					<div
						class="pointer-events-none absolute -top-10 -left-10 h-52 w-52 animate-pulse rounded-full bg-orange-500/25 blur-3xl [animation-duration:4s]"
					></div>
					<div
						class="pointer-events-none absolute -right-8 -bottom-8 h-56 w-56 animate-pulse rounded-full bg-violet-600/20 blur-3xl [animation-delay:1s] [animation-duration:5s]"
					></div>

					<div class="relative z-10 text-left">
						<p
							class="flex items-center gap-1.5 text-[10px] font-black tracking-[0.14em] text-white/40 uppercase"
						>
							<UtensilsCrossed size={11} strokeWidth={3} />
							Full Live Menu
						</p>
						<h2 class="mt-2 text-2xl leading-tight font-bold tracking-tight text-white">
							Fresh. Wholesome. Everyday
						</h2>
						<p class="mt-1 max-w-70 text-[13px] leading-relaxed font-medium text-white/50">
							Clean kitchen food items crafted without chemical flavor enhancers.
						</p>

						<div
							class="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[12px] font-bold text-white backdrop-blur-sm transition-all group-hover:gap-2.5 group-hover:bg-white/15"
						>
							Explore Menu Selections
							<ArrowRight
								size={13}
								strokeWidth={2.5}
								class="transition-transform group-hover:translate-x-0.5"
							/>
						</div>
					</div>
				</a>
			{/if}
		</div>

		<!-- ── Wallet Dashboard Deck ── -->
		<div class="p-5">
			<div class="rounded-3xl border border-muted bg-card shadow-[0_2px_12px_rgb(0,0,0,0.04)]">
				<div
					class="relative overflow-hidden rounded-2xl bg-linear-to-br from-primary to-accent px-5 py-5 shadow-[0_4px_20px_rgba(15,37,68,0.12)]"
				>
					<div
						class="pointer-events-none absolute -top-8 -right-8 h-36 w-36 rounded-full bg-white/5"
					></div>
					<div
						class="pointer-events-none absolute -right-2 -bottom-6 h-28 w-28 rounded-full bg-white/2.5"
					></div>

					<div class="relative flex flex-col gap-4 text-left">
						<div class="flex items-center gap-2">
							<Wallet size={13} strokeWidth={2} class="text-background" />
							<p class="text-[10px] font-black tracking-[0.15em] text-background uppercase">
								Wallet Balance
							</p>
						</div>
						<div class="flex items-end justify-between">
							<div>
								<p class="font-mono text-2xl font-bold tracking-tight text-white">
									{formatCurrencyINR(appState.wallet.balance)}
								</p>
								<p
									class="mt-1 max-w-35 truncate text-[11px] font-bold tracking-tight text-white/70"
								>
									{appState.wallet.name}
								</p>
							</div>
							<a
								href={resolve('/topup')}
								class="flex items-center gap-1.5 rounded-full bg-background/80 px-4 py-2 text-xs font-black text-accent shadow-sm ring-4 ring-accent/25 backdrop-blur-md transition-all active:scale-95"
							>
								<CreditCard class="h-3.5 w-3.5" />
								Top Up
							</a>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- ── Recent Activity Logs ── -->
		<div class="p-5 pb-12">
			<div class="mb-3 flex items-end justify-between px-1">
				<div>
					<h3 class="text-[17px] font-bold tracking-tight text-foreground">Recent Activity</h3>
					<p class="mt-0.5 text-[12px] font-medium text-foreground/40">
						Track progress of requested updates
					</p>
				</div>
				<a
					href={resolve('/orders')}
					class="flex items-center gap-0.5 text-[12px] font-black tracking-tight text-primary uppercase"
				>
					See History <ChevronRight size={13} strokeWidth={3} />
				</a>
			</div>

			<div
				class="overflow-hidden rounded-3xl border border-muted bg-card p-2 shadow-[0_2px_12px_rgb(0,0,0,0.02)]"
			>
				{#if isLoadingOrders}
					{#each [1, 2, 3] as i (i)}
						<div
							class="flex animate-pulse items-center justify-between rounded-2xl p-3 {i < 3
								? 'mb-1'
								: ''}"
						>
							<div class="flex items-center gap-3">
								<div class="h-10 w-10 shrink-0 rounded-xl bg-muted/60"></div>
								<div class="space-y-2">
									<div class="h-3.5 w-24 rounded-sm bg-muted/60"></div>
									<div class="h-2.5 w-16 rounded-sm bg-muted/40"></div>
								</div>
							</div>
							<div class="h-4 w-12 rounded-full bg-muted/40"></div>
						</div>
					{/each}
				{:else if activeOrders.length > 0}
					<div class="space-y-1">
						{#each activeOrders as order (order.id)}
							{@const config = getStatusConfig(order.status)}
							<div
								class="flex flex-col rounded-2xl p-2.5 text-left transition-colors active:bg-muted/30"
							>
								<div class="flex items-center justify-between">
									<div class="flex min-w-0 items-center gap-3">
										<div
											class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl {config.bg} {config.color}"
										>
											<config.icon size={18} strokeWidth={2.5} />
										</div>
										<div class="min-w-0">
											<p
												class="flex items-center gap-2 text-[14px] font-bold tracking-tight text-foreground"
											>
												<span class="truncate">{order.ticketReference}</span>
												<span
													class="shrink-0 rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[9px] font-bold text-foreground/50"
												>
													{order.totalItems} items
												</span>
											</p>
											<p
												class="mt-0.5 text-[10px] font-bold tracking-wider text-foreground/40 uppercase"
											>
												{order.formattedDate}
											</p>
										</div>
									</div>
									<div class="flex shrink-0 flex-col items-end gap-0.5 pl-3">
										<span class="font-mono text-[14px] font-bold text-foreground">
											{formatCurrencyINR(Number(order.totalAmount))}
										</span>
										<span class="text-[9px] font-black tracking-widest uppercase {config.color}">
											{order.status}
										</span>
									</div>
								</div>

								<!-- Order Lines List -->
								{#if order.items && order.items.length > 0}
									<div
										class="mt-2.5 ml-13 flex flex-col gap-2 border-t border-muted/15 pt-2.5 text-[13px]"
									>
										{#each order.items as item (item)}
											<div class="flex items-center justify-between text-foreground/70">
												<div class="flex min-w-0 items-center gap-2.5">
													<span class="shrink-0 font-mono text-[11px] font-black text-foreground/30"
														>{item.quantity}x</span
													>
													<div class="flex min-w-0 items-center gap-1.5">
														{#if item.menuItem}
															<div
																class="flex h-3 w-3 shrink-0 items-center justify-center rounded-md border {item
																	.menuItem.dietary === 'veg'
																	? 'border-emerald-500/40 bg-emerald-500/5'
																	: 'border-rose-500/40 bg-rose-500/5'}"
															>
																<div
																	class="h-1 w-1 rounded-full {item.menuItem.dietary === 'veg'
																		? 'bg-emerald-500'
																		: 'bg-rose-500'}"
																></div>
															</div>
															<span class="truncate font-bold tracking-tight text-foreground/70"
																>{item.menuItem.name}</span
															>
														{:else}
															<span class="font-medium text-foreground/40">Unknown Item</span>
														{/if}
													</div>
												</div>
												<span class="pl-2 font-mono text-[12px] text-foreground/60">
													{formatCurrencyINR(Number(item.unitPrice) * item.quantity)}
												</span>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{:else}
					<div class="px-4 py-12 text-center">
						<div
							class="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/40"
						>
							<ReceiptText size={18} strokeWidth={2.2} class="text-foreground/30" />
						</div>
						<p class="text-[14px] font-bold tracking-tight text-foreground/40">
							No active activity history
						</p>
						<p class="mt-0.5 text-[12px] text-foreground/25">
							Order food items to monitor metrics live.
						</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
