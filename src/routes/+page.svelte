<script lang="ts">
    import type { UserWallet, AppView, MenuItem, CartItem, Ticket } from '$lib/types';
    import {
        Home,
        UtensilsCrossed,
        Wallet,
        QrCode,
        User,
        Plus,
        ArrowUpRight,
        ArrowDownLeft
    } from 'lucide-svelte';

    import TopUp from '$lib/components/TopUp.svelte';
    import MenuOrder from '$lib/components/MenuOrder.svelte';
    import ActiveTicket from '$lib/components/ActiveTicket.svelte';
	import UserProfile from '$lib/components/UserProfile.svelte';
    
    let { data }: { data: { wallet: UserWallet; menuItems: MenuItem[] } } = $props();

    let currentView: AppView = $state('DASHBOARD');

    // svelte-ignore state_referenced_locally
    let wallet: UserWallet = $state(data.wallet);

    // svelte-ignore state_referenced_locally
    let menuItems: MenuItem[] = $state(data.menuItems);

    let cart: CartItem[] = $state([]);
    let activeTicket: Ticket | null = $state(null);

    // Transaction state for dashboard recent activity
    type Transaction = {
        id: string;
        type: 'credit' | 'debit';
        title: string;
        date: string;
        amount: number;
    };
    let recentTransactions: Transaction[] = $state([]);
    let isLoadingTransactions: boolean = $state(true);

    async function loadRecentTransactions() {
        isLoadingTransactions = true;
        try {
            const res = await fetch('/api/wallet/history');
            const result = await res.json();
            if (result.success) {
                recentTransactions = result.data.map(
                    (tx: {
                        id: string;
                        type: string;
                        description: string;
                        createdAt: string;
                        amount: string;
                    }) => {
                        const d = new Date(tx.createdAt);
                        const dateStr = d.toLocaleDateString(undefined, { weekday: 'short' });
                        const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
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
        } catch (err: unknown) {
            console.error('Failed to fetch transactions:', err);
        } finally {
            isLoadingTransactions = false;
        }
    }

    // Refresh transactions whenever returning to the dashboard
    $effect(() => {
        if (currentView === 'DASHBOARD') {
            loadRecentTransactions();
        }
    });

    function handleNavigate(view: AppView): void {
        currentView = view;
    }

    async function handleTopUp(amount: number): Promise<void> {
        try {
            const res: Response = await fetch('/api/wallet/topup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: wallet.studentId, amount, provider: 'CASH' })
            });
            const responseData: { success: boolean; newBalance?: number } = await res.json();

            if (responseData.success && responseData.newBalance !== undefined) {
                wallet.balance = responseData.newBalance;
                currentView = 'PROFILE';
            }
        } catch (err: unknown) {
            console.error('Failed to process top-up:', err);
        }
    }

    function handleCheckout(total: number): void {
        activeTicket = {
            id: 'NEX-' + Math.floor(10000 + Math.random() * 90000).toString(),
            items: [...cart],
            total,
            timestamp: new Date(),
            status: 'PENDING'
        };
        cart = [];
        currentView = 'QR_TICKET';
    }

    async function handleCollected(): Promise<void> {
        if (activeTicket) {
            try {
                const payload: { id: string; quantity: number }[] = activeTicket.items.map(
                    (i: CartItem) => ({
                        id: i.menuItem.id,
                        quantity: i.quantity
                    })
                );

                const response: Response = await fetch('/api/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cart: payload })
                });

                const result: { success: boolean; data?: { totalAmount: string } } = await response.json();

                if (result.success) {
                    wallet.balance -= activeTicket.total;
                    activeTicket = { ...activeTicket, status: 'COMPLETED' };
                    activeTicket = null;
                    currentView = 'DASHBOARD';
                }
            } catch (err: unknown) {
                console.error('Failed to process collection checkout:', err);
            }
        }
    }

    function cancelOrder(): void {
        if (activeTicket) {
            activeTicket = null;
            currentView = 'MENU';
        }
    }

    const navItems = [
        { view: 'DASHBOARD' as AppView, icon: Home, label: 'Home' },
        { view: 'MENU' as AppView, icon: UtensilsCrossed, label: 'Menu' },
        { view: 'QR_TICKET' as AppView, icon: QrCode, label: 'Ticket' },
        { view: 'PROFILE' as AppView, icon: User, label: 'Profile' }
    ] as const;
</script>

<div class="relative mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-background font-sans">
    <div class="absolute top-0 right-0 left-0 z-50 h-px bg-border"></div>

    <main class="relative z-0 flex-1 overflow-y-auto px-5 pt-6 pb-28">
        {#if currentView === 'DASHBOARD'}
            <div class="animate-in fade-in space-y-5 duration-300">
                <header class="mb-6 flex items-start justify-between">
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

                {#if activeTicket}
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
                            {#each activeTicket.items as item (item.menuItem.id)}
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
                            <span class="font-mono font-medium text-foreground">₹{activeTicket.total}</span>
                        </div>

                        <div class="mt-1 grid grid-cols-2 gap-2 px-5 pb-4">
                            <button
                                onclick={cancelOrder}
                                class="border border-destructive/30 py-2.5 text-xs font-medium tracking-wide text-destructive transition-all hover:bg-destructive/5 active:scale-[0.98]"
                            >
                                Cancel Order
                            </button>
                            <button
                                onclick={() => handleNavigate('QR_TICKET')}
                                class="flex items-center justify-center gap-2 bg-foreground py-2.5 text-xs font-medium tracking-wide text-background transition-all active:scale-[0.98]"
                            >
                                <QrCode size={13} />
                                Scan to Collect
                            </button>
                        </div>
                    </div>
                {:else}
                    <button
                        onclick={() => handleNavigate('MENU')}
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
                    </button>
                {/if}

                <div class="relative overflow-hidden border border-border bg-card p-5">
                    <div
                        class="absolute top-0 right-0 left-0 h-px bg-linear-to-r from-transparent via-foreground/20 to-transparent"
                    ></div>
                    <div class="mb-4 flex items-start justify-between">
                        <div class="label-mono flex items-center gap-1.5">
                            <Wallet size={11} />
                            Campus Wallet
                        </div>
                        <button
                            onclick={() => handleNavigate('TOP_UP')}
                            class="flex items-center gap-1 border border-border px-2.5 py-1.5 font-mono text-[10px] tracking-wider text-foreground uppercase transition-colors hover:bg-muted"
                        >
                            <Plus size={10} />
                            Add Funds
                        </button>
                    </div>
                    <div class="mb-1">
                        <span class="mr-1 font-mono text-sm text-muted-foreground">₹</span>
                        <span class="text-4xl font-semibold tracking-tight text-foreground"
                            >{wallet.balance.toFixed(2)}</span
                        >
                    </div>
                    <p class="label-mono">{wallet.studentId} · {wallet.name}</p>
                </div>

                <div>
                    <div class="mb-3 flex items-center justify-between">
                        <span class="label-mono">Recent Activity</span>
                        <button
                            onclick={() => handleNavigate('PROFILE')}
                            class="label-mono text-foreground/50 transition-colors hover:text-foreground"
                        >
                            View All →
                        </button>
                    </div>
                    <div class="divide-y divide-border border border-border bg-card">
                        {#if isLoadingTransactions}
                            {#each [1, 2, 3] as i (i)}
                                <div class="flex items-center justify-between px-4 py-3.5 animate-pulse">
                                    <div class="flex items-center gap-3">
                                        <div class="flex h-8 w-8 shrink-0 items-center justify-center bg-muted"></div>
                                        <div class="space-y-2 min-w-0">
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
                                            {#if tx.type === 'credit'}
                                                <ArrowDownLeft size={14} class="text-emerald-400" />
                                            {:else}
                                                <ArrowUpRight size={14} class="text-muted-foreground" />
                                            {/if}
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
        {:else if currentView === 'TOP_UP'}
            <TopUp {wallet} onProcessTopUp={handleTopUp} onCancel={() => handleNavigate('PROFILE')} />
        {:else if currentView === 'MENU'}
            <MenuOrder
                menu={menuItems}
                bind:cart
                walletBalance={wallet.balance}
                onCheckout={handleCheckout}
                onCancel={() => handleNavigate('DASHBOARD')}
            />
        {:else if currentView === 'QR_TICKET'}
            <ActiveTicket
                ticket={activeTicket}
                onReturn={() => handleNavigate('DASHBOARD')}
                onCollected={handleCollected}
            />
        {:else if currentView === 'PROFILE'}
            <UserProfile
                {wallet}
                onLogout={() => {
                    window.location.href = '/login';
                }}
                onTopUp={() => handleNavigate('TOP_UP')}
				onBack={() => handleNavigate('DASHBOARD')}
            />
        {/if}
    </main>

    <nav
        class="absolute bottom-0 z-40 w-full border-t border-border bg-background px-2 pt-3 pb-6 supports-[padding:max(0px)]:pb-[max(1.5rem,env(safe-area-inset-bottom))]"
    >
        <div class="mx-auto flex max-w-sm items-center justify-around">
            {#each navItems as { view, icon: Icon, label } (view)}
                {#if view !== 'MENU' || !activeTicket}
                    <button
                        onclick={() => handleNavigate(view)}
                        class="relative flex w-16 flex-col items-center gap-1.5 transition-colors {currentView ===
                        view
                            ? 'text-foreground'
                            : 'text-muted-foreground hover:text-foreground/70'}"
                    >
                        {#if view === 'QR_TICKET' && activeTicket}
                            <div class="relative">
                                <Icon size={20} strokeWidth={currentView === view ? 2 : 1.5} />
                                <span
                                    class="absolute -top-0.5 -right-1 h-2 w-2 rounded-full border-2 border-background bg-amber-400"
                                ></span>
                            </div>
                        {:else}
                            <Icon size={20} strokeWidth={currentView === view ? 2 : 1.5} />
                        {/if}
                        <span class="font-mono text-[9px] tracking-widest uppercase">{label}</span>
                        {#if currentView === view}
                            <span
                                class="absolute -bottom-3 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-foreground"
                            ></span>
                        {/if}
                    </button>
                {/if}
            {/each}
        </div>
    </nav>
</div>