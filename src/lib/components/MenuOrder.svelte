<script lang="ts">
	import type { MenuItem, CartItem } from '$lib/types';
	import { ArrowLeft, Plus, Minus, ShoppingBag } from 'lucide-svelte';

	let {
		menu,
		cart = $bindable(),
		walletBalance,
		onCheckout,
		onCancel
	}: {
		menu: MenuItem[];
		cart: CartItem[];
		walletBalance: number;
		onCheckout: (total: number) => void;
		onCancel: () => void;
	} = $props();

	let total: number = $derived(
		cart.reduce((sum: number, item: CartItem) => sum + item.menuItem.price * item.quantity, 0)
	);
	let itemCount: number = $derived(
		cart.reduce((sum: number, item: CartItem) => sum + item.quantity, 0)
	);

	function addToCart(item: MenuItem): void {
		const existing: CartItem | undefined = cart.find((c: CartItem) => c.menuItem.id === item.id);
		if (existing) {
			cart = cart.map((c: CartItem) =>
				c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
			);
		} else {
			cart = [...cart, { menuItem: item, quantity: 1 }];
		}
	}

	function removeFromCart(item: MenuItem): void {
		const existing: CartItem | undefined = cart.find((c: CartItem) => c.menuItem.id === item.id);
		if (existing) {
			if (existing.quantity > 1) {
				cart = cart.map((c: CartItem) =>
					c.menuItem.id === item.id ? { ...c, quantity: c.quantity - 1 } : c
				);
			} else {
				cart = cart.filter((c: CartItem) => c.menuItem.id !== item.id);
			}
		}
	}

	function getQty(id: string): number {
		return cart.find((c: CartItem) => c.menuItem.id === id)?.quantity || 0;
	}

	const categoryOrder: readonly string[] = ['Breakfast', 'Lunch', 'Snacks', 'Beverages'];

	function groupedMenu(): { category: string; items: MenuItem[] }[] {
		const groups: Record<string, MenuItem[]> = {};
		for (const item of menu) {
			if (!groups[item.category]) groups[item.category] = [];
			groups[item.category].push(item);
		}
		return categoryOrder
			.filter((c: string) => groups[c])
			.map((c: string) => ({ category: c, items: groups[c] }));
	}
</script>

<div class="animate-in fade-in flex h-full flex-col duration-200">
	<header
		class="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background pt-1 pb-4"
	>
		<button
			onclick={onCancel}
			class="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
		>
			<ArrowLeft size={18} />
		</button>
		<div class="min-w-0 flex-1">
			<h2 class="text-base leading-none font-semibold tracking-tight text-foreground">
				Kitchen Menu
			</h2>
		</div>
		{#if itemCount > 0}
			<div class="flex items-center gap-1.5">
				<ShoppingBag size={14} class="text-muted-foreground" />
				<span class="font-mono text-xs text-foreground">{itemCount}</span>
			</div>
		{/if}
	</header>

	<div class="flex-1 space-y-6 overflow-y-auto py-4">
		{#each groupedMenu() as group (group.category)}
			<div>
				<div class="mb-3 flex items-center gap-3">
					<span class="font-mono text-[10px] tracking-widest text-muted-foreground uppercase"
						>{group.category}</span
					>
					<div class="h-px flex-1 bg-border"></div>
				</div>

				<div class="space-y-px">
					{#each group.items as item (item.id)}
						{@const qty = getQty(item.id)}
						<div
							class="flex items-center justify-between border border-border bg-card px-4 py-3.5 transition-colors {qty >
							0
								? 'border-foreground/20'
								: 'hover:border-border'}"
						>
							<div class="flex min-w-0 flex-1 items-start gap-3 pr-4">
								<div
									class="mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center border {item.dietary ===
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
								<div class="min-w-0">
									<h3 class="truncate text-sm leading-tight font-medium text-foreground">
										{item.name}
									</h3>
									<p
										class="mt-0.5 line-clamp-1 text-xs leading-relaxed font-light text-muted-foreground"
									>
										{item.description}
									</p>
									<span class="mt-1.5 block font-mono text-sm text-foreground">₹{item.price}</span>
								</div>
							</div>

							<div class="shrink-0">
								{#if qty > 0}
									<div
										class="flex h-8 items-center overflow-hidden border border-foreground/30 bg-background"
									>
										<button
											onclick={() => removeFromCart(item)}
											class="flex h-full w-8 items-center justify-center border-r border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
										>
											<Minus size={12} />
										</button>
										<span class="w-8 text-center font-mono text-sm font-medium text-foreground"
											>{qty}</span
										>
										<button
											onclick={() => addToCart(item)}
											class="flex h-full w-8 items-center justify-center border-l border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
										>
											<Plus size={12} />
										</button>
									</div>
								{:else}
									<button
										onclick={() => addToCart(item)}
										class="h-8 border border-border bg-muted px-4 text-xs font-medium tracking-wide text-foreground transition-colors hover:bg-border active:scale-95"
									>
										Add
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>

	<div class="z-20 border-t border-border bg-background pt-4 pb-2">
		<div class="mb-3 flex items-center justify-between">
			<div>
				<p class="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
					Order Total
				</p>
				{#if walletBalance < total && total > 0}
					<p class="mt-0.5 font-mono text-[10px] text-destructive">
						Balance: ₹{walletBalance.toFixed(2)}
					</p>
				{/if}
			</div>
			<span class="font-mono text-2xl font-medium text-foreground">₹{total}</span>
		</div>

		<button
			disabled={total === 0 || walletBalance < total}
			onclick={() => onCheckout(total)}
			class="w-full bg-foreground py-3.5 text-sm font-medium tracking-wide text-background transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30 disabled:active:scale-100"
		>
			{#if walletBalance < total && total > 0}
				Insufficient Balance
			{:else if total === 0}
				Select Items to Continue
			{:else}
				Checkout · Generate QR
			{/if}
		</button>
	</div>
</div>
