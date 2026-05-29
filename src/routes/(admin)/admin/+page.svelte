<script lang="ts">
    import { onMount } from 'svelte';
    import {
        Wallet,
        UtensilsCrossed,
        CheckCircle2,
        Loader2,
        AlertCircle,
        LogOut,
        Plus,
        Search,
        Edit,
        Save,
        X,
        Archive,
        ArchiveRestore,
    } from 'lucide-svelte';
    import { resolve } from '$app/paths';
    import { goto } from '$app/navigation';

    interface MenuItem {
        id: string;
        name: string;
        description: string;
        price: number;
        category: string;
        dietary: string;
        inStock: boolean;
        isArchived: boolean;
    }

    let activeTab: 'menu' | 'wallet' = $state('menu');

    let menuItemsList: MenuItem[] = $state([]);
    let isFetchingMenu: boolean = $state(true); 
    let searchQuery: string = $state('');
    let showArchived: boolean = $state(false);
    
    let processingItemId: string | null = $state(null);
    
    let filteredMenu: MenuItem[] = $derived(
        menuItemsList.filter(item => {
            const matchesSearch: boolean = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                           item.category.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesArchiveStatus: boolean = showArchived ? true : !item.isArchived;
            return matchesSearch && matchesArchiveStatus;
        })
    );

    let menuForm: { name: string; description: string; price: string; category: string; dietary: string } = $state({
        name: '',
        description: '',
        price: '',
        category: 'Breakfast',
        dietary: 'veg'
    });
    let isMenuSubmitting: boolean = $state(false);
    let menuSuccessMsg: string = $state('');

    let editingId: string | null = $state(null);
    let editForm: { name: string; description: string; price: string; category: string; dietary: string } = $state({
        name: '', 
        description: '', 
        price: '', 
        category: '', 
        dietary: ''
    });
    let isEditSubmitting: boolean = $state(false);

    let walletForm: { identifier: string; amount: string; provider: string; providerTxnId: string } = $state({
        identifier: '',
        amount: '',
        provider: 'CASH',
        providerTxnId: ''
    });
    let isWalletSubmitting: boolean = $state(false);
    let walletSuccessMsg: string = $state('');
    let walletErrorMsg: string = $state('');

    let isLoggingOut: boolean = $state(false);

    onMount(() => {
        fetchMenuItems(true);
    });

    async function fetchMenuItems(showSkeleton: boolean = true): Promise<void> {
        if (showSkeleton) isFetchingMenu = true;
        try {
            const res: Response = await fetch('/api/menu?includeArchived=true');
            const data = await res.json();
            if (res.ok && data.success) {
                menuItemsList = data.data;
            }
        } catch {
            console.error('Failed to fetch menu items');
        } finally {
            if (showSkeleton) isFetchingMenu = false;
        }
    }

    async function handleLogout(): Promise<void> {
        if (isLoggingOut) return;
        isLoggingOut = true;
        
        try {
            const res: Response = await fetch('/api/auth/logout', { method: 'POST' });
            if (res.ok) {
                goto(resolve('/login'));
            } else {
                console.error('Logout failed');
                isLoggingOut = false;
            }
        } catch {
            console.error('Network error during logout');
            isLoggingOut = false;
        }
    }

    async function handleAddMenuItem(e: Event): Promise<void> {
        e.preventDefault();
        isMenuSubmitting = true;

        try {
            const res: Response = await fetch('/api/menu', {
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
                await fetchMenuItems(false);
                setTimeout(() => (menuSuccessMsg = ''), 3000);
            }
        } catch {
            console.error('Failed to add item');
        } finally {
            isMenuSubmitting = false;
        }
    }

    function startEditing(item: MenuItem): void {
        editingId = item.id;
        editForm = { 
            name: item.name, 
            description: item.description, 
            price: String(item.price), 
            category: item.category, 
            dietary: item.dietary 
        };
    }

    function cancelEditing(): void {
        editingId = null;
    }

    async function handleUpdateItem(e: Event): Promise<void> {
        e.preventDefault();
        isEditSubmitting = true;
        if (editingId) processingItemId = editingId;
        
        try {
            const res: Response = await fetch('/api/menu', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id: editingId, 
                    ...editForm, 
                    price: Number(editForm.price) 
                })
            });

            if (res.ok) {
                await fetchMenuItems(false);
                editingId = null;
            }
        } catch {
            console.error('Failed to update item');
        } finally {
            isEditSubmitting = false;
            processingItemId = null;
        }
    }

    async function handleStatusToggle(id: string, payload: Partial<MenuItem>): Promise<void> {
        if (processingItemId) return;
        processingItemId = id;
        
        try {
            const res: Response = await fetch('/api/menu', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...payload })
            });

            if (res.ok) {
                await fetchMenuItems(false);
            }
        } catch {
            console.error('Failed to update status');
        } finally {
            processingItemId = null;
        }
    }

    async function handleWalletTopup(e: Event): Promise<void> {
        e.preventDefault();
        isWalletSubmitting = true;
        walletErrorMsg = '';
        walletSuccessMsg = '';

        try {
            const res: Response = await fetch('/api/wallet/topup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    identifier: walletForm.identifier,
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
    <header class="z-20 flex shrink-0 items-center gap-3 border-b border-border bg-background p-4 pt-5 shadow-sm">
        <div class="min-w-0 flex-1">
            <h2 class="text-base leading-none font-semibold tracking-tight text-foreground">
                Admin Console
            </h2>
        </div>
        <div class="flex items-center gap-2">
            <div class="flex items-center gap-1.5 border-r border-border pr-2">
                <div class="status-dot"></div>
                <span class="font-mono text-[10px] tracking-wider text-emerald-400 uppercase">System Online</span>
            </div>

            <button
                onclick={handleLogout}
                disabled={isLoggingOut}
                class="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
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

            <div class="my-8 h-px bg-border"></div>

            <div class="space-y-4">
                <div class="flex items-center justify-between">
                    <h3 class="text-sm font-semibold tracking-tight text-foreground">Active Menu Items</h3>
                    <label class="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
                        <input type="checkbox" bind:checked={showArchived} class="accent-foreground" />
                        Show Archived
                    </label>
                </div>
                
                <div class="relative">
                    <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <input 
                        type="text" 
                        bind:value={searchQuery}
                        placeholder="Search menu by name or category..." 
                        class="w-full border border-border bg-card py-2.5 pl-10 pr-3 text-sm text-foreground transition-colors focus:border-foreground focus:outline-none"
                    />
                </div>

                <div class="space-y-3">
                    {#if isFetchingMenu}
                        {#each Array.from({ length: 4 }, (_, i) => i) as i (i)}
                            <div class="flex animate-pulse items-start justify-between gap-3 border border-border bg-card p-3">
                                <div class="flex-1 space-y-2.5 py-1">
                                    <div class="flex items-center gap-2">
                                        <div class="h-4 w-32 rounded bg-muted"></div>
                                        <div class="h-4 w-16 rounded bg-muted"></div>
                                    </div>
                                    <div class="h-3 w-3/4 rounded bg-muted/70"></div>
                                    <div class="h-4 w-12 rounded bg-muted"></div>
                                </div>
                                <div class="flex shrink-0 items-center gap-1">
                                    <div class="h-8 w-8 rounded bg-muted"></div>
                                    <div class="h-8 w-8 rounded bg-muted"></div>
                                    <div class="h-8 w-8 rounded bg-muted"></div>
                                </div>
                            </div>
                        {/each}
                    {:else if filteredMenu.length === 0}
                        <p class="border border-dashed border-border py-4 text-center text-sm text-muted-foreground">No items found.</p>
                    {:else}
                        {#each filteredMenu as item (item.id)}
                            <div class="relative overflow-hidden border border-border bg-card p-3 transition-opacity {item.isArchived ? 'opacity-60' : ''} {processingItemId === item.id && !editingId ? 'pointer-events-none' : ''}">
                                
                                {#if processingItemId === item.id && !editingId}
                                    <div class="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
                                        <Loader2 size={24} class="animate-spin text-foreground" />
                                    </div>
                                {/if}

                                {#if editingId === item.id}
                                    <form onsubmit={handleUpdateItem} class="space-y-3">
                                        <div class="grid grid-cols-2 gap-2">
                                            <input type="text" bind:value={editForm.name} required class="w-full border border-border bg-background px-2 py-1.5 text-sm" placeholder="Name" />
                                            <input type="number" step="0.01" bind:value={editForm.price} required class="w-full border border-border bg-background px-2 py-1.5 font-mono text-sm" placeholder="Price" />
                                        </div>
                                        <input type="text" bind:value={editForm.description} required class="w-full border border-border bg-background px-2 py-1.5 text-sm" placeholder="Description" />
                                        <div class="grid grid-cols-2 gap-2">
                                            <select bind:value={editForm.category} class="w-full border border-border bg-background px-2 py-1.5 text-sm">
                                                <option value="Breakfast">Breakfast</option>
                                                <option value="Lunch">Lunch</option>
                                                <option value="Snacks">Snacks</option>
                                                <option value="Beverages">Beverages</option>
                                            </select>
                                            <div class="flex gap-2">
                                                <button type="button" onclick={cancelEditing} class="flex flex-1 items-center justify-center border border-border text-muted-foreground transition-colors hover:bg-muted">
                                                    <X size={16} />
                                                </button>
                                                <button type="submit" disabled={isEditSubmitting} class="flex flex-1 items-center justify-center bg-foreground text-background transition-transform active:scale-[0.98] disabled:opacity-50">
                                                    {#if isEditSubmitting}
                                                        <Loader2 size={16} class="animate-spin" />
                                                    {:else}
                                                        <Save size={16} />
                                                    {/if}
                                                </button>
                                            </div>
                                        </div>
                                    </form>
                                {:else}
                                    <div class="flex items-start justify-between gap-3">
                                        <div class="flex-1">
                                            <div class="flex items-center gap-2">
                                                <h4 class="text-sm font-medium text-foreground {item.isArchived ? 'line-through' : ''}">{item.name}</h4>
                                                <span class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase">{item.category}</span>
                                            </div>
                                            <p class="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.description}</p>
                                            <p class="mt-1.5 font-mono text-sm text-foreground">₹{item.price}</p>
                                        </div>
                                        <div class="flex shrink-0 items-center gap-1">
                                            <button 
                                                onclick={() => handleStatusToggle(item.id, { isArchived: !item.isArchived })} 
                                                class="p-2 transition-colors {item.isArchived ? 'text-amber-500' : 'text-muted-foreground hover:text-foreground'}" 
                                                title={item.isArchived ? 'Restore Item' : 'Archive Item'}
                                            >
                                                {#if item.isArchived}
                                                    <ArchiveRestore size={16} />
                                                {:else}
                                                    <Archive size={16} />
                                                {/if}
                                            </button>
                                            <button 
                                                onclick={() => startEditing(item)} 
                                                class="p-2 text-muted-foreground transition-colors hover:text-foreground" 
                                                title="Edit Item"
                                            >
                                                <Edit size={16} />
                                            </button>
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    {/if}
                </div>
            </div>
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