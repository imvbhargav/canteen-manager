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
		User,
		Clock,
		Utensils,
		CheckCircle2,
		XCircle,
		ReceiptText
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

	function cancelOrder(): void {
		appState.activeTicket = null;
		goto(resolve('/menu'));
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
			accent: 'bg-amber-50',
			iconColor: 'text-amber-500',
			dot: 'bg-amber-400',
			label: 'Breakfast'
		},
		Lunch: {
			Icon: Sandwich,
			accent: 'bg-lime-50',
			iconColor: 'text-lime-600',
			dot: 'bg-lime-400',
			label: 'Lunch'
		},
		Snacks: {
			Icon: Pizza,
			accent: 'bg-rose-50',
			iconColor: 'text-rose-500',
			dot: 'bg-rose-400',
			label: 'Snacks'
		},
		Beverages: {
			Icon: Coffee,
			accent: 'bg-sky-50',
			iconColor: 'text-sky-500',
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

<svelte:head><title>Dashboard | MunchUp</title></svelte:head>

{#if appState.wallet}
	<div
		class="animate-in fade-in absolute inset-0 z-20 flex flex-col overflow-y-auto bg-background duration-300"
	>
		<header
			class="sticky top-0 z-100 flex h-16 shrink-0 items-center justify-between gap-3 bg-background/15 px-5 backdrop-blur-md"
		>
			<AppLogo />
			<button
				onclick={() => goto(resolve('/profile'))}
				aria-label="Profile"
				class="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary text-background transition-all duration-150 hover:scale-105 active:scale-90"
			>
				<User size={16} strokeWidth={2} />
			</button>
		</header>

		<div class="px-6 py-3">
			<h2 class="font-site-name text-3xl font-black">
				Welcome <span class="text-primary">{appState.wallet.name.split(' ')[0]}!</span> 👋
			</h2>
			<p class="px-1 text-sm text-foreground/50">{appState.wallet.referenceKey}</p>
		</div>

		<div class="px-5 pt-5">
			{#if appState.activeTicket}
				<div
					class="mt-1 overflow-hidden rounded-3xl border border-muted/30 bg-card shadow-[0_2px_16px_rgb(0,0,0,0.05)]"
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
								<span class="font-mono text-[14px] font-bold text-foreground">
									{formatCurrencyINR(item.menuItem.price * item.quantity)}
								</span>
							</div>
						{/each}
					</div>

					<div
						class="flex items-center justify-between border-t border-muted/20 bg-muted/20 px-5 py-3.5"
					>
						<span class="text-[13px] text-foreground/50">Due on collection</span>
						<span class="font-mono text-[17px] font-bold text-foreground">
							{formatCurrencyINR(appState.activeTicket.total)}
						</span>
					</div>

					<div class="grid grid-cols-2 gap-2.5 bg-muted/20 px-5 pt-2 pb-5">
						<button
							onclick={cancelOrder}
							class="rounded-full border border-destructive/25 bg-card py-3 text-[13px] font-bold text-destructive transition-all duration-150 active:scale-[0.98]"
						>
							Cancel
						</button>
						<a
							href={resolve('/ticket')}
							class="flex items-center justify-center gap-2 rounded-full bg-primary py-3 text-[13px] font-bold text-background transition-all duration-150 active:scale-[0.98]"
						>
							<QrCode size={16} />
							View QR
						</a>
					</div>
				</div>
			{:else}
				<div class="mt-1">
					<div class="mb-4 flex items-baseline justify-between">
						<div>
							<h2 class="text-[17px] font-bold text-foreground">Categories</h2>
							<p class="mt-0.5 text-[13px] font-medium text-foreground/40">What are you craving?</p>
						</div>
						<a
							href={resolve('/menu')}
							class="flex items-center gap-0.5 text-[13px] font-semibold text-primary"
						>
							All <ChevronRight size={14} strokeWidth={2.5} />
						</a>
					</div>

					<div
						class="flex snap-x snap-mandatory scrollbar-none flex-row gap-3 overflow-x-auto px-5 pb-2"
					>
						{#each availableCategories as cat (cat)}
							{@const cfg = categoryConfig[cat] ?? {
								Icon: UtensilsCrossed,
								accent: 'bg-muted/40',
								iconColor: 'text-foreground/60',
								dot: 'bg-foreground/30',
								label: cat
							}}
							{@const Icon = cfg.Icon}
							{@const count = appState.menuItems.filter(
								(item: MenuItem): boolean => item.category === cat
							).length}

							<a
								href="{resolve('/menu')}?category={cat.toLowerCase()}"
								class="{cfg.accent} group relative flex w-37 shrink-0 snap-start flex-col gap-3 rounded-2xl border border-muted/25 px-4 pt-4 pb-3.5 shadow-[0_1px_4px_rgb(0,0,0,0.05)] transition-all duration-150 hover:border-muted/50 hover:shadow-[0_2px_8px_rgb(0,0,0,0.08)] active:scale-95"
							>
								<div class="flex items-center justify-between">
									<div
										class="flex h-10 w-10 items-center justify-center rounded-xl bg-background {cfg.iconColor} transition-transform duration-150 group-active:scale-90"
									>
										<Icon size={20} strokeWidth={2} />
									</div>
									<span
										class="flex h-5 w-5 items-center justify-center rounded-full {cfg.iconColor} bg-background text-[10px] font-bold"
									>
										{count}
									</span>
								</div>
								<div>
									<p class="text-[14px] leading-tight font-bold text-foreground">{cfg.label}</p>
									<p class="mt-0.5 text-[11px] leading-tight font-medium text-foreground/40">
										{categoryTaglines[cat]}
									</p>
								</div>
								<div
									class="absolute right-4 bottom-0 left-4 h-[2.5px] rounded-full {cfg.dot} opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-active:opacity-100"
								></div>
							</a>
						{/each}
					</div>
				</div>

				<a
					href={resolve('/menu')}
					class="group relative mt-5 block overflow-hidden rounded-3xl bg-[#0f2544] px-6 py-7 shadow-[0_8px_32px_rgba(15,37,68,0.35)] transition-transform duration-300 active:scale-[0.98]"
				>
					<div
						class="pointer-events-none absolute -top-10 -left-10 h-52 w-52 animate-pulse rounded-full bg-orange-500/40 blur-3xl [animation-duration:3s]"
					></div>
					<div
						class="pointer-events-none absolute -right-8 -bottom-8 h-56 w-56 animate-pulse rounded-full bg-violet-600/35 blur-3xl [animation-delay:1s] [animation-duration:4s]"
					></div>
					<div
						class="pointer-events-none absolute -bottom-12 left-1/2 h-40 w-40 -translate-x-1/2 animate-pulse rounded-full bg-rose-500/30 blur-3xl [animation-delay:2s] [animation-duration:5s]"
					></div>

					<div class="relative z-10">
						<p
							class="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.14em] text-white/40 uppercase"
						>
							<UtensilsCrossed size={12} strokeWidth={2.5} />
							Full Menu
						</p>
						<h2 class="mt-2 font-outfit text-2xl leading-tight font-bold tracking-tight text-white">
							Fresh. Wholesome. Everyday
						</h2>
						<p class="mt-2 text-[14px] leading-relaxed font-medium text-white/55">
							Made without artificial colours, flavour enhancers, or preservatives.
						</p>

						<div
							class="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/12 px-5 py-2.5 text-[13px] font-bold text-white backdrop-blur-sm transition-all duration-200 group-hover:gap-3 group-hover:border-white/25 group-hover:bg-white/20 group-active:scale-95"
						>
							Explore the Menu
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

		<div class="mt-6 space-y-5 px-5">
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
					<p class="mt-1.5 font-mono text-2xl font-bold tracking-tight text-white">
						{formatCurrencyINR(appState.wallet.balance)}
					</p>
					<div class="mt-4 flex items-center justify-between">
						<p class="font-black text-background">{appState.wallet.name}</p>
						<a
							href={resolve('/topup')}
							class="flex items-center gap-1.5 rounded-full bg-background/80 px-4 py-2 text-[13px] font-black text-primary ring-4 ring-accent/25 backdrop-blur-md transition-all active:scale-95"
						>
							<span class="text-lg leading-none">+</span>
							Add Money
						</a>
					</div>
				</div>
			</div>

			<div>
				<div class="mb-3 flex items-center justify-between">
					<h3 class="text-[17px] font-bold text-foreground">Recent Orders</h3>
					<a
						href={resolve('/orders')}
						class="flex items-center gap-0.5 text-[13px] font-semibold text-primary"
					>
						See all <ChevronRight size={14} strokeWidth={2.5} />
					</a>
				</div>

				<div
					class="mb-12 overflow-hidden rounded-[20px] border border-muted/25 bg-card shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
				>
					{#if isLoadingOrders}
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
								<div class="h-4 w-12 rounded-full bg-muted"></div>
							</div>
						{/each}
					{:else if activeOrders.length > 0}
						<div class="divide-y divide-muted/20">
							{#each activeOrders as order (order.id)}
								{@const config = getStatusConfig(order.status)}
								<div
									class="flex flex-col px-4 py-4 transition-colors duration-100 active:bg-muted/30"
								>
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
					{:else}
						<div class="px-4 py-10 text-center">
							<div
								class="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/60"
							>
								<ReceiptText size={18} strokeWidth={1.75} class="text-foreground/30" />
							</div>
							<p class="text-[14px] font-medium text-foreground/40">No active orders.</p>
							<p class="mt-1 text-[12px] text-foreground/25">Grab a bite and check back here!</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
