<script lang="ts">
	import { resolve } from '$app/paths';
    import { ArrowLeft } from 'lucide-svelte';

    let notifyOrders = $state(true);
    let notifyWallet = $state(true);
    let notifyPromo = $state(false);
</script>

<svelte:head><title>Notifications | Campus Wallet</title></svelte:head>

<div class="flex flex-col h-full animate-in fade-in duration-200">
    <header class="flex items-center gap-3 pb-4 border-b border-border sticky top-0 bg-background z-10 pt-1 p-4">
        <a href={resolve("/profile")} class="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><ArrowLeft size={18} /></a>
        <div>
            <h2 class="text-base font-semibold text-foreground tracking-tight leading-none">Notifications</h2>
        </div>
    </header>

    <div class="flex-1 overflow-y-auto p-4 space-y-6 animate-in slide-in-from-right-2 duration-300">
        <div>
            <p class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 px-1">Preferences</p>
            <div class="bg-card border border-border divide-y divide-border">
                <button onclick={() => notifyOrders = !notifyOrders} class="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors">
                    <div class="text-left">
                        <span class="text-sm text-foreground block">Order Updates</span>
                        <span class="text-xs text-muted-foreground mt-0.5 block font-light">Ticket status and ready alerts</span>
                    </div>
                    <div class="w-8 h-4 rounded-full border border-border relative transition-colors {notifyOrders ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-muted'}">
                        <div class="absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all {notifyOrders ? 'bg-emerald-400 left-4.5' : 'bg-muted-foreground left-1'}"></div>
                    </div>
                </button>
                <button onclick={() => notifyWallet = !notifyWallet} class="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors">
                    <div class="text-left">
                        <span class="text-sm text-foreground block">Wallet Alerts</span>
                        <span class="text-xs text-muted-foreground mt-0.5 block font-light">Low balance and top-up receipts</span>
                    </div>
                    <div class="w-8 h-4 rounded-full border border-border relative transition-colors {notifyWallet ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-muted'}">
                        <div class="absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all {notifyWallet ? 'bg-emerald-400 left-4.5' : 'bg-muted-foreground left-1'}"></div>
                    </div>
                </button>
                <button onclick={() => notifyPromo = !notifyPromo} class="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors">
                    <div class="text-left">
                        <span class="text-sm text-foreground block">Promotions</span>
                        <span class="text-xs text-muted-foreground mt-0.5 block font-light">Canteen specials and discounts</span>
                    </div>
                    <div class="w-8 h-4 rounded-full border border-border relative transition-colors {notifyPromo ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-muted'}">
                        <div class="absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all {notifyPromo ? 'bg-emerald-400 left-4.5' : 'bg-muted-foreground left-1'}"></div>
                    </div>
                </button>
            </div>
        </div>
    </div>
</div>