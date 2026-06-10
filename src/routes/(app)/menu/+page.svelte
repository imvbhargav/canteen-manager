<script lang="ts">
	import { appState } from '$lib/store.svelte';
	import { ArrowLeft, Plus, Minus, ShoppingBag } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import type { MenuItem } from '$lib/types';
	import { resolve } from '$app/paths';

	let total = $derived(
		appState.cart.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0)
	);
	let itemCount = $derived(appState.cart.reduce((sum, item) => sum + item.quantity, 0));

	$effect(() => {
		const fetchLatestMenu = async () => {
			try {
				const res = await fetch('/api/menu');
				if (res.ok) {
					const result = await res.json();
					if (result.success && Array.isArray(result.data)) {
						appState.menuItems = result.data;
						const availableIds = new Set(result.data.map((item: MenuItem) => item.id));
						appState.cart = appState.cart.filter((cartItem) =>
							availableIds.has(cartItem.menuItem.id)
						);
					}
				}
			} catch (err) {
				console.error('Failed to refresh menu:', err);
			}
		};
		const intervalId = setInterval(fetchLatestMenu, 5000);
		return () => clearInterval(intervalId);
	});

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
		return appState.cart.find((c) => c.menuItem.id === id)?.quantity || 0;
	}

	const categoryOrder = ['Breakfast', 'Lunch', 'Snacks', 'Beverages'];
	let activeCategory = $state('All');

	function groupedMenu() {
		const groups: Record<string, MenuItem[]> = {};
		for (const item of appState.menuItems) {
			if (!groups[item.category]) groups[item.category] = [];
			groups[item.category].push(item);
		}
		return categoryOrder.filter((c) => groups[c]).map((c) => ({ category: c, items: groups[c] }));
	}

	function filteredMenu() {
		if (activeCategory === 'All') return groupedMenu();
		return groupedMenu().filter((g) => g.category === activeCategory);
	}

	function handleCheckout() {
		appState.activeTicket = {
			id: 'NEX-' + Math.floor(10000 + Math.random() * 90000).toString(),
			items: [...appState.cart],
			total,
			timestamp: new Date(),
			status: 'PENDING'
		};
		appState.cart = [];
		goto(resolve('/ticket'));
	}
</script>

<svelte:head><title>Order Food | MunchUp</title></svelte:head>

<div class="animate-in fade-in absolute inset-0 z-20 flex flex-col bg-background duration-300">
	<!-- ── Header: fixed height h-16, matches dashboard appbar ── -->
	<header
		class="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 bg-background/15 px-5 backdrop-blur-md"
	>
		<a
			href={resolve('/')}
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-foreground transition-transform active:scale-90"
		>
			<ArrowLeft size={18} strokeWidth={2.5} />
		</a>

		<h2 class="flex-1 text-[20px] font-bold tracking-tight text-foreground">Menu</h2>

		<div class="flex w-20 justify-end">
			{#if itemCount > 0}
				<div class="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5">
					<ShoppingBag size={15} strokeWidth={2.5} class="text-primary" />
					<span class="text-[13px] font-bold text-primary">{itemCount}</span>
				</div>
			{/if}
		</div>
	</header>

	<!-- ── Category filter ── -->
	<div class="flex shrink-0 scrollbar-none gap-2 overflow-x-auto px-5 pb-3">
		{#each ['All', ...categoryOrder] as cat (cat)}
			<button
				onclick={() => (activeCategory = cat)}
				class="shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all active:scale-95
				{activeCategory === cat
					? 'bg-primary text-background'
					: 'bg-muted/50 text-foreground/60 hover:bg-muted hover:text-foreground'}"
			>
				{cat}
			</button>
		{/each}
	</div>

	<!--
		Menu list. Bottom padding is always pb-36 — regardless of whether
		the checkout bar is showing. This prevents the list from jumping
		when the bar appears/disappears.
	-->
	<div class="flex-1 overflow-y-auto pb-36">
		{#each filteredMenu() as group (group.category)}
			<div class="px-5 pt-2 pb-6">
				<div class="mb-2 flex items-center gap-3 pb-1">
					<h3 class="text-[13px] font-bold tracking-[0.06em] text-foreground/40 uppercase">
						{group.category}
					</h3>
					<div class="h-px flex-1 bg-muted/40"></div>
				</div>

				<div
					class="overflow-hidden rounded-[22px] border border-muted/25 bg-card shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
				>
					{#each group.items as item, i (item.id)}
						{@const qty = getQty(item.id)}
						<div
							class="flex items-center gap-4 px-4 py-4 {i < group.items.length - 1
								? 'border-b border-muted/20'
								: ''}"
						>
							<!-- Veg/non-veg indicator -->
							<div
								class="mt-1 flex h-4 w-4 shrink-0 items-center justify-center self-start rounded-sm border-2 {item.dietary ===
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

							<!-- Item info — flex-1 with min-w-0 so it never pushes the stepper -->
							<div class="min-w-0 flex-1">
								<h4 class="text-[15px] leading-snug font-semibold text-foreground">{item.name}</h4>
								<p class="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-foreground/45">
									{item.description}
								</p>
								<span class="mt-1.5 block text-[14px] font-bold text-accent">₹{item.price}</span>
							</div>

							<!--
								Stepper container: fixed w-[88px] at all times.
								The + button (w-9 = 36px) and the stepper pill (≈88px)
								are both centred inside this fixed box, so the text
								column never moves when the state toggles.
							-->
							<div class="flex w-22 shrink-0 items-center justify-end">
								{#if qty > 0}
									<div class="flex items-center gap-0.5 rounded-full bg-primary/8 p-1">
										<button
											onclick={() => removeFromCart(item)}
											class="flex h-7 w-7 items-center justify-center rounded-full bg-card text-foreground shadow-sm transition-transform active:scale-90"
										>
											<Minus size={13} strokeWidth={2.5} />
										</button>
										<span class="w-7 text-center text-[13px] font-bold text-foreground">{qty}</span>
										<button
											onclick={() => addToCart(item)}
											class="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform active:scale-90"
										>
											<Plus size={13} strokeWidth={2.5} />
										</button>
									</div>
								{:else}
									<!--
										Single + button: w-9 h-9 (36px).
										Wrapped in w-[88px] container so width is identical
										to the stepper pill — text column stays put.
									-->
									<button
										onclick={() => addToCart(item)}
										class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-all active:scale-90 active:bg-primary/20"
									>
										<Plus size={18} strokeWidth={2.5} />
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>

	<!-- ── Checkout bar — liquid glass, slides in/out without reflowing the list ── -->
	{#if total > 0}
		<div
			class="animate-in slide-in-from-bottom-2 absolute right-0 bottom-0 left-0 z-30 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] duration-200"
		>
			<div
				class="relative overflow-hidden rounded-[26px] bg-background/75 shadow-[0_-1px_0_rgba(0,0,0,0.06),0_8px_32px_rgba(0,0,0,0.14)] ring-1 ring-black/5 backdrop-blur-2xl backdrop-saturate-150 dark:bg-background/60 dark:ring-white/8"
			>
				<!-- Specular highlight -->
				<div
					class="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/60 dark:bg-white/15"
				></div>

				<div class="flex items-center justify-between px-5 pt-4 pb-2">
					<div>
						<p class="text-[10px] font-bold tracking-[0.14em] text-foreground/40 uppercase">
							Order Total
						</p>
						{#if (appState.wallet?.balance || 0) < total}
							<p class="mt-0.5 text-[11px] font-semibold text-destructive">
								Balance: ₹{appState.wallet?.balance.toFixed(2)}
							</p>
						{/if}
					</div>
					<span class="text-[24px] font-bold tracking-tight text-foreground">₹{total}</span>
				</div>

				<div class="px-4 pb-4">
					<button
						disabled={total === 0 || (appState.wallet?.balance || 0) < total}
						onclick={handleCheckout}
						class="w-full rounded-full py-3.5 text-[15px] font-bold tracking-wide transition-all active:scale-[0.98]
						{(appState.wallet?.balance || 0) < total
							? 'cursor-not-allowed bg-muted text-foreground/30'
							: 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'}"
					>
						{#if (appState.wallet?.balance || 0) < total}
							Insufficient Balance
						{:else}
							Proceed to Checkout · {itemCount} {itemCount === 1 ? 'item' : 'items'}
						{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
