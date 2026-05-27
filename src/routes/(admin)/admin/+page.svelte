<script lang="ts">
    import {
        Wallet,
        UtensilsCrossed,
        CheckCircle2,
        Loader2,
        AlertCircle,
        LogOut, // 1. Imported LogOut icon
		Plus

    } from 'lucide-svelte';
    import { resolve } from '$app/paths';
    import { goto } from '$app/navigation'; // 2. Imported for programmatic navigation

    // Tabs state
    let activeTab: 'menu' | 'wallet' = $state('menu');

    // Menu Item State
    let menuForm = $state({
        name: '',
        description: '',
        price: '',
        category: 'Breakfast',
        dietary: 'veg'
    });
    let isMenuSubmitting = $state(false);
    let menuSuccessMsg = $state('');

    // Wallet Top-up State
    let walletForm = $state({
        identifier: '', // Uses Student ID or Roll Number
        amount: '',
        provider: 'CASH',
        providerTxnId: ''
    });
    let isWalletSubmitting = $state(false);
    let walletSuccessMsg = $state('');
    let walletErrorMsg = $state('');

    // 3. New Logout Handler
    let isLoggingOut = $state(false);
    async function handleLogout() {
        if (isLoggingOut) return;
        isLoggingOut = true;
        
        try {
            const res = await fetch('/api/auth/logout', { method: 'POST' });
            if (res.ok) {
                goto(resolve('/login'));
            } else {
                console.error('Logout failed');
                isLoggingOut = false; // Reset if it failed so they can try again
            }
        } catch {
            console.error('Network error during logout');
            isLoggingOut = false;
        }
    }

    async function handleAddMenuItem(e: Event) {
        e.preventDefault();
        isMenuSubmitting = true;

        try {
            const res = await fetch('/api/menu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...menuForm,
                    price: Number(menuForm.price)
                })
            });

            if (res.ok) {
                menuSuccessMsg = 'Item added to live menu';
                menuForm = { name: '', description: '', price: '', category: 'Breakfast', dietary: 'veg' };
                setTimeout(() => (menuSuccessMsg = ''), 3000);
            }
        } catch {
            console.error('Failed to add item');
        } finally {
            isMenuSubmitting = false;
        }
    }

    async function handleWalletTopup(e: Event) {
        e.preventDefault();
        isWalletSubmitting = true;
        walletErrorMsg = '';
        walletSuccessMsg = '';

        try {
            const res = await fetch('/api/wallet/topup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    identifier: walletForm.identifier, // Send the Roll No / Student ID
                    amount: Number(walletForm.amount),
                    provider: walletForm.provider,
                    providerTxnId: walletForm.providerTxnId || crypto.randomUUID()
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                walletSuccessMsg = `Credited ${data.studentName}. New Balance: ₹${data.newBalance}`;
                walletForm = { identifier: '', amount: '', provider: 'CASH', providerTxnId: '' };
                setTimeout(() => (walletSuccessMsg = ''), 5000);
            } else {
                walletErrorMsg = data.error || 'Failed to process top-up';
            }
        } catch {
            walletErrorMsg = 'Network error occurred';
        } finally {
            isWalletSubmitting = false;
        }
    }
</script>

<svelte:head><title>Admin Console | BPS Canteen</title></svelte:head>

<div class="animate-in fade-in absolute inset-0 z-20 flex flex-col bg-background duration-200">
    <header
        class="z-20 flex shrink-0 items-center gap-3 border-b border-border bg-background p-4 pt-5 shadow-sm"
    >
        <div class="min-w-0 flex-1">
            <h2 class="text-base leading-none font-semibold tracking-tight text-foreground">
                Admin Console
            </h2>
        </div>
        <div class="flex items-center gap-3">
            <div class="flex items-center gap-1.5 border-r border-border pr-3">
                <div class="status-dot"></div>
                <span class="font-mono text-[10px] tracking-wider text-emerald-400 uppercase"
                    >System Online</span
                >
            </div>
            
            <button
                onclick={handleLogout}
                disabled={isLoggingOut}
                class="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                title="Log Out"
            >
                {#if isLoggingOut}
                    <Loader2 size={16} class="animate-spin" />
                {:else}
                    <LogOut size={16} />
                {/if}
            </button>
        </div>
    </header>

    <div class="grid shrink-0 grid-cols-2 border-b border-border bg-card">
        <button
            onclick={() => (activeTab = 'menu')}
            class="flex items-center justify-center gap-2 py-3.5 transition-colors {activeTab === 'menu'
                ? 'border-b-2 border-foreground text-foreground'
                : 'text-muted-foreground hover:bg-muted/50'}"
        >
            <UtensilsCrossed size={14} />
            <span class="label-mono {activeTab === 'menu' ? 'text-foreground' : ''}">Manage Menu</span>
        </button>
        <button
            onclick={() => (activeTab = 'wallet')}
            class="flex items-center justify-center gap-2 py-3.5 transition-colors {activeTab === 'wallet'
                ? 'border-b-2 border-foreground text-foreground'
                : 'text-muted-foreground hover:bg-muted/50'}"
        >
            <Wallet size={14} />
            <span class="label-mono {activeTab === 'wallet' ? 'text-foreground' : ''}">Fund Wallet</span>
        </button>
    </div>

    <div class="flex-1 overflow-y-auto p-4 pb-12">
        {#if activeTab === 'menu'}
            <form onsubmit={handleAddMenuItem} class="space-y-5">
                <div class="space-y-1.5">
                    <label for="name" class="label-mono">Item Name</label>
                    <input
                        id="name"
                        type="text"
                        bind:value={menuForm.name}
                        required
                        class="w-full border border-border bg-card px-3 py-2.5 text-sm text-foreground transition-colors focus:border-foreground focus:outline-none"
                        placeholder="e.g. Masala Dosa"
                    />
                </div>

                <div class="space-y-1.5">
                    <label for="desc" class="label-mono">Description</label>
                    <textarea
                        id="desc"
                        bind:value={menuForm.description}
                        required
                        rows="2"
                        class="w-full resize-none border border-border bg-card px-3 py-2.5 text-sm text-foreground transition-colors focus:border-foreground focus:outline-none"
                        placeholder="Brief description of the item..."
                    ></textarea>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-1.5">
                        <label for="price" class="label-mono">Price (₹)</label>
                        <input
                            id="price"
                            type="number"
                            min="0"
                            step="0.01"
                            bind:value={menuForm.price}
                            required
                            class="w-full border border-border bg-card px-3 py-2.5 font-mono text-sm text-foreground transition-colors focus:border-foreground focus:outline-none"
                            placeholder="0.00"
                        />
                    </div>

                    <div class="space-y-1.5">
                        <label for="diet" class="label-mono">Dietary</label>
                        <select
                            disabled
							id="diet"
                            bind:value={menuForm.dietary}
                            class="w-full appearance-none border border-border bg-card px-3 py-2.5 text-sm text-foreground transition-colors focus:border-foreground focus:outline-none"
                        >
                            <option value="veg">Vegetarian</option>
                            <option value="non-veg">Non-Vegetarian</option>
                        </select>
                    </div>
                </div>

                <div class="space-y-1.5">
                    <label for="category" class="label-mono">Category</label>
                    <select
                        id="category"
                        bind:value={menuForm.category}
                        class="w-full appearance-none border border-border bg-card px-3 py-2.5 text-sm text-foreground transition-colors focus:border-foreground focus:outline-none"
                    >
                        <option value="Breakfast">Breakfast</option>
                        <option value="Lunch">Lunch</option>
                        <option value="Snacks">Snacks</option>
                        <option value="Beverages">Beverages</option>
                    </select>
                </div>

                <button
                    type="submit"
                    disabled={isMenuSubmitting}
                    class="mt-2 flex w-full items-center justify-center gap-2 bg-foreground py-3.5 text-sm font-medium text-background transition-transform active:scale-[0.98] disabled:opacity-50"
                >
                    {#if isMenuSubmitting}
                        <Loader2 size={16} class="animate-spin" /> Publishing...
                    {:else if menuSuccessMsg}
                        <CheckCircle2 size={16} class="text-emerald-400" /> {menuSuccessMsg}
                    {:else}
                        <Plus size={16} /> Publish to Live Menu
                    {/if}
                </button>
            </form>
        {/if}

        {#if activeTab === 'wallet'}
            <form onsubmit={handleWalletTopup} class="space-y-5">
                <div class="border border-amber-500/30 bg-amber-500/5 p-3">
                    <p class="font-mono text-[10px] leading-relaxed text-amber-500/80 uppercase">
                        Notice: Wallet top-ups are immutable. Verify the cash amount before committing this
                        transaction to the ledger.
                    </p>
                </div>

                {#if walletErrorMsg}
                    <div
                        class="flex items-center gap-2 border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                    >
                        <AlertCircle size={16} class="shrink-0" />
                        <span>{walletErrorMsg}</span>
                    </div>
                {/if}

                <div class="space-y-1.5">
                    <label for="identifier" class="label-mono">Student ID / Roll Number</label>
                    <input
                        id="identifier"
                        type="text"
                        bind:value={walletForm.identifier}
                        required
                        class="w-full border border-border bg-card px-3 py-2.5 font-mono text-sm text-foreground uppercase transition-colors focus:border-foreground focus:outline-none"
                        placeholder="e.g. BPS-2024-001 or 4XX21CS001"
                    />
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-1.5">
                        <label for="topupAmount" class="label-mono">Amount (₹)</label>
                        <input
                            id="topupAmount"
                            type="number"
                            min="1"
                            step="0.01"
                            bind:value={walletForm.amount}
                            required
                            class="w-full border border-border bg-card px-3 py-2.5 font-mono text-sm text-foreground transition-colors focus:border-foreground focus:outline-none"
                            placeholder="0.00"
                        />
                    </div>

                    <div class="space-y-1.5">
                        <label for="provider" class="label-mono">Payment Method</label>
                        <select
                            id="provider"
                            bind:value={walletForm.provider}
                            class="w-full appearance-none border border-border bg-card px-3 py-2.5 text-sm text-foreground transition-colors focus:border-foreground focus:outline-none"
                        >
                            <option value="CASH">Cash Deposit</option>
                            <option value="UPI">UPI Transfer</option>
                        </select>
                    </div>
                </div>

                <div class="space-y-1.5">
                    <label for="txnId" class="label-mono">Reference/Receipt No. (Optional)</label>
                    <input
                        id="txnId"
                        type="text"
                        bind:value={walletForm.providerTxnId}
                        class="w-full border border-border bg-card px-3 py-2.5 font-mono text-sm text-foreground transition-colors focus:border-foreground focus:outline-none"
                        placeholder="Leave blank to auto-generate"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isWalletSubmitting}
                    class="mt-2 flex w-full items-center justify-center gap-2 bg-emerald-500 py-3.5 text-sm font-medium text-background transition-transform active:scale-[0.98] disabled:opacity-50"
                >
                    {#if isWalletSubmitting}
                        <Loader2 size={16} class="animate-spin" /> Processing Ledger...
                    {:else if walletSuccessMsg}
                        <CheckCircle2 size={16} /> {walletSuccessMsg}
                    {:else}
                        <Wallet size={16} /> Credit Account
                    {/if}
                </button>
            </form>
        {/if}
    </div>
</div>