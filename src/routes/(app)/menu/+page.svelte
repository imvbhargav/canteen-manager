<script lang="ts">
	import { appState } from '$lib/store.svelte';
	import { ArrowLeft, Plus, Minus, ShoppingBag } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import type { MenuItem } from '$lib/types';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { formatCurrencyINR } from '$lib';

	// ── Read ?category= param and pre-select the tab ──────────────────────────
	const categoryOrder = ['Breakfast', 'Lunch', 'Snacks', 'Beverages'];

	function resolveInitialCategory(): string {
		const param = $page.url.searchParams.get('category');
		if (!param) return 'All';
		const match = categoryOrder.find((c) => c.toLowerCase() === param.toLowerCase());
		return match ?? 'All';
	}

	let activeCategory = $state(resolveInitialCategory());

	// ── Derived totals ─────────────────────────────────────────────────────────
	let total = $derived(
		appState.cart.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0)
	);
	let itemCount = $derived(appState.cart.reduce((sum, item) => sum + item.quantity, 0));

	// ── Menu refresh every 5 s ────────────────────────────────────────────────
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

	// ── Cart helpers ──────────────────────────────────────────────────────────
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

	// ── Menu grouping ─────────────────────────────────────────────────────────
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

	// ── Checkout ──────────────────────────────────────────────────────────────
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

	// ── Wallet shortfall ──────────────────────────────────────────────────────
	let insufficientBalance = $derived((appState.wallet?.balance ?? 0) < total);
</script>

<svelte:head><title>Order Food | MunchUp</title></svelte:head>

<div class="animate-in fade-in absolute inset-0 z-20 flex flex-col bg-background duration-300">
	<!-- ── Header ── -->
	<header
		class="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 bg-background/15 px-5 backdrop-blur-md"
	>
		<a
			href={resolve('/')}
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-foreground transition-transform active:scale-90"
		>
			<ArrowLeft size={18} strokeWidth={2.5} />
		</a>

		<div class="flex-1">
			<h2 class="text-[20px] font-bold tracking-tight text-foreground">Menu</h2>
			{#if activeCategory !== 'All'}
				<p class="mt-0.5 text-[11px] font-medium text-foreground/40">{activeCategory}</p>
			{/if}
		</div>

		<!-- Cart pill indicator -->
		<div class="flex w-20 justify-end">
			{#if itemCount > 0}
				<div
					class="animate-in zoom-in-95 flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 ring-1 ring-primary/20"
				>
					<ShoppingBag size={14} strokeWidth={2.5} class="text-primary" />
					<span class="text-[13px] font-black text-primary tabular-nums">{itemCount}</span>
				</div>
			{/if}
		</div>
	</header>

	<!-- ── Category filter tabs ── -->
	<div
		class="flex shrink-0 scrollbar-none gap-2 overflow-x-auto border-b border-muted/10 px-5 py-3"
	>
		{#each ['All', ...categoryOrder] as cat (cat)}
			<button
				onclick={() => (activeCategory = cat)}
				class="shrink-0 rounded-full px-4 py-1.5 text-[13px] font-bold tracking-tight transition-all duration-150 active:scale-95
                {activeCategory === cat
					? 'bg-primary text-background shadow-[0_2px_8px_rgba(var(--primary),0.15)]'
					: 'bg-muted/40 text-foreground/50 hover:bg-muted/70 hover:text-foreground'}"
			>
				{cat}
			</button>
		{/each}
	</div>

	<!-- ── Menu list ── -->
	<div class="flex-1 overflow-y-auto pb-42">
		{#each filteredMenu() as group (group.category)}
			<div class="px-5 pt-4 pb-2">
				<!-- Section header -->
				<div class="mb-3 flex items-center gap-3 px-4">
					<h3 class="text-[11px] font-black tracking-[0.12em] text-foreground/35 uppercase">
						{group.category}
					</h3>
					<div class="h-px flex-1 bg-muted/20"></div>
					<span class="text-[10px] font-bold tracking-wider text-foreground/25 uppercase">
						{group.items.length}
						{group.items.length === 1 ? 'item' : 'items'}
					</span>
				</div>

				<!-- Card container -->
				<div
					class="space-y-1 overflow-hidden rounded-3xl border border-muted bg-card p-2 shadow-[0_2px_12px_rgb(0,0,0,0.02)]"
				>
					{#each group.items as item (item.id)}
						{@const qty = getQty(item.id)}
						<div
							class="group flex items-center gap-4 rounded-2xl p-3 text-left transition-all duration-150
                            {qty > 0 ? 'bg-primary/5 ring-1 ring-primary/10' : 'hover:bg-muted/30'}"
						>
							<!-- Veg / non-veg marker badge -->
							<div
								class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center self-start rounded border
                                {item.dietary === 'veg'
									? 'border-emerald-500/50 bg-emerald-500/5'
									: 'border-rose-500/50 bg-rose-500/5'}"
							>
								<div
									class="h-1.5 w-1.5 rounded-full
                                    {item.dietary === 'veg' ? 'bg-emerald-500' : 'bg-rose-500'}"
								></div>
							</div>

							<!-- Item descriptions metrics -->
							<div class="min-w-0 flex-1">
								<h4 class="text-[15px] leading-snug font-bold tracking-tight text-foreground">
									{item.name}
								</h4>
								<p class="mt-0.5 line-clamp-2 pr-2 text-[12px] leading-relaxed text-foreground/45">
									{item.description}
								</p>
								<span class="mt-2 block font-mono text-[14px] font-bold tracking-tight text-accent"
									>{formatCurrencyINR(item.price)}</span
								>
							</div>

							<!-- Stepper component wrapper -->
							<div class="flex w-24 shrink-0 items-center justify-end">
								{#if qty > 0}
									<div
										class="flex items-center gap-1 rounded-full bg-card p-1 shadow-sm ring-1 ring-muted/80"
									>
										<button
											onclick={() => removeFromCart(item)}
											aria-label="Remove one {item.name}"
											class="flex h-7 w-7 items-center justify-center rounded-full bg-muted/40 text-foreground transition-all active:scale-85 active:bg-muted/80"
										>
											<Minus size={12} strokeWidth={3} />
										</button>
										<span
											class="w-6 text-center text-[13px] font-black text-foreground tabular-nums"
											>{qty}</span
										>
										<button
											onclick={() => addToCart(item)}
											aria-label="Add one more {item.name}"
											class="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-background shadow-sm transition-all active:scale-85 active:bg-primary/90"
										>
											<Plus size={12} strokeWidth={3} />
										</button>
									</div>
								{:else}
									<button
										onclick={() => addToCart(item)}
										aria-label="Add {item.name} to cart"
										class="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 text-foreground transition-all hover:bg-primary hover:text-background active:scale-90"
									>
										<Plus size={16} strokeWidth={2.5} />
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}

		<!-- Empty category state layout -->
		{#if filteredMenu().length === 0}
			<div
				class="animate-in fade-in dynamic-duration flex flex-col items-center justify-center px-8 py-28 text-center"
			>
				<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted/40">
					<ShoppingBag size={20} strokeWidth={2} class="text-foreground/30" />
				</div>
				<p class="text-[14px] font-bold tracking-tight text-foreground/50">No Items Available</p>
				<p class="mt-0.5 max-w-50 text-[12px] text-foreground/30">
					Check back soon for available selections in {activeCategory}.
				</p>
			</div>
		{/if}
	</div>

	<!-- ── Floating bottom checkout bar ── -->
	{#if total > 0}
		<div
			class="animate-in slide-in-from-bottom-6 absolute right-0 bottom-0 left-0 z-30 px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] duration-300"
		>
			<div
				class="relative overflow-hidden rounded-[28px] border border-muted bg-card/75 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl backdrop-saturate-150"
			>
				<div class="flex items-center justify-between px-5 pt-4 pb-2.5">
					<div>
						<p class="text-[10px] font-black tracking-[0.14em] text-foreground/40 uppercase">
							Order Total
						</p>
						{#if insufficientBalance}
							<p class="mt-0.5 font-mono text-[11px] font-bold tracking-tight text-destructive">
								Balance shortfall: {formatCurrencyINR(appState.wallet?.balance ?? 0)}
							</p>
						{/if}
					</div>
					<span class="font-mono text-2xl font-bold tracking-tight text-foreground tabular-nums">
						{formatCurrencyINR(total)}
					</span>
				</div>

				<div class="px-4 pb-4">
					<button
						disabled={insufficientBalance}
						onclick={handleCheckout}
						class="w-full rounded-full py-3.5 text-[15px] font-bold tracking-wide transition-all active:scale-[0.98]
                        {insufficientBalance
							? 'cursor-not-allowed bg-muted text-foreground/30'
							: 'bg-primary text-background shadow-lg shadow-primary/20 active:opacity-95'}"
					>
						{#if insufficientBalance}
							Insufficient Balance
						{:else}
							Checkout · {itemCount} {itemCount === 1 ? 'item' : 'items'}
						{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
