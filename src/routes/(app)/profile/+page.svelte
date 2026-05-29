<script lang="ts">
    import { resolve } from '$app/paths';
    import { appState } from '$lib/store.svelte';
    import { Bell, Shield, LogOut, ChevronRight, History, CreditCard, Wallet, ArrowLeft, Download, CheckCircle } from 'lucide-svelte'; // Added CheckCircle

    // --- PWA Installation State ---
    interface BeforeInstallPromptEvent extends Event {
        readonly platforms: Array<string>;
        readonly userChoice: Promise<{
            outcome: 'accepted' | 'dismissed',
            platform: string
        }>;
        prompt(): Promise<void>;
    }

    let deferredPrompt: BeforeInstallPromptEvent | null = $state(null);
    let isInstalled = $state(true); 

    $effect(() => {
        isInstalled = 
            window.matchMedia('(display-mode: standalone)').matches || 
            !!(window.navigator as Navigator & { standalone?: boolean }).standalone;

        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            deferredPrompt = e as BeforeInstallPromptEvent;
            isInstalled = false; 
        };

        const handleAppInstalled = () => {
            isInstalled = true;
            deferredPrompt = null;
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    });

    async function installApp() {
        if (deferredPrompt) {
            // Trigger the native browser prompt
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                isInstalled = true;
                deferredPrompt = null;
            }
        } else {
            // Fallback for iOS Safari or browsers where the prompt isn't supported/available
            alert("To install this app, tap your browser's Share or Menu button, then select 'Add to Home Screen'.");
        }
    }
    // ------------------------------

    async function executeLogout() {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    }
</script>

<svelte:head><title>Account Profile | Campus Wallet</title></svelte:head>

<div class="flex flex-col h-full animate-in fade-in duration-200">
    <header class="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background p-4 pt-1">
        <a href={resolve("/")} class="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ArrowLeft size={18} />
        </a>
        <div class="min-w-0 flex-1"><h2 class="text-base leading-none font-semibold tracking-tight text-foreground">Profile</h2></div>
    </header>

    {#if appState.wallet}
        <div class="flex-1 overflow-y-auto py-5 space-y-4 pb-6 animate-in slide-in-from-left-2 duration-300 p-4">
            <div class="bg-card border border-border p-5 flex items-center gap-4">
                <div class="w-12 h-12 border border-border flex items-center justify-center shrink-0">
                    <span class="font-mono text-lg font-medium text-foreground">{appState.wallet.name.charAt(0)}</span>
                </div>
                <div class="min-w-0">
                    <h3 class="text-base font-semibold text-foreground tracking-tight leading-none">{appState.wallet.name}</h3>
                    <div class="flex items-center gap-3 mt-1.5">
                        <span class="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{appState.wallet.studentId}</span>
                        <span class="w-px h-3 bg-border"></span>
                        <span class="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Roll {appState.wallet.rollNumber}</span>
                    </div>
                </div>
            </div>

            <div class="bg-card border border-border overflow-hidden">
                <div class="px-5 py-3 border-b border-border flex items-center gap-2">
                    <Wallet size={12} class="text-muted-foreground" />
                    <span class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Campus Wallet</span>
                </div>
                <div class="px-5 py-5">
                    <div class="mb-5">
                        <span class="font-mono text-muted-foreground text-sm mr-1">₹</span>
                        <span class="text-4xl font-semibold text-foreground tracking-tight">{appState.wallet.balance.toFixed(2)}</span>
                    </div>
                    <a href={resolve("/topup")} class="w-full py-3 border border-border text-foreground text-xs font-medium tracking-wide flex items-center justify-center gap-2 hover:bg-muted transition-colors active:scale-[0.98]">
                        <CreditCard size={13} /> Top Up Wallet
                    </a>
                </div>
            </div>

            <div>
                <p class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 px-1">Account</p>
                <div class="bg-card border border-border divide-y divide-border">
                    <a href={resolve("/profile/history")} class="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors active:scale-[0.99]">
                        <div class="flex items-center gap-3"><History size={15} class="text-muted-foreground" /><span class="text-sm text-foreground">Transaction History</span></div>
                        <ChevronRight size={14} class="text-muted-foreground" />
                    </a>
                    <a href={resolve("/profile/notifications")} class="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors active:scale-[0.99]">
                        <div class="flex items-center gap-3"><Bell size={15} class="text-muted-foreground" /><span class="text-sm text-foreground">Notifications</span></div>
                        <ChevronRight size={14} class="text-muted-foreground" />
                    </a>
                    <a href={resolve("/profile/security")} class="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors active:scale-[0.99]">
                        <div class="flex items-center gap-3"><Shield size={15} class="text-muted-foreground" /><span class="text-sm text-foreground">Security & PIN</span></div>
                        <ChevronRight size={14} class="text-muted-foreground" />
                    </a>
                    
                    {#if isInstalled}
                        <div class="w-full flex items-center justify-between px-5 py-4 bg-muted/20">
                            <div class="flex items-center gap-3">
                                <CheckCircle size={15} class="text-emerald-500" />
                                <span class="text-sm text-foreground">App Installed</span>
                            </div>
                            <span class="font-mono text-[10px] text-emerald-500 uppercase tracking-widest">Active</span>
                        </div>
                    {:else}
                        <button onclick={installApp} class="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors active:scale-[0.99]">
                            <div class="flex items-center gap-3">
                                <Download size={15} class="text-muted-foreground" />
                                <span class="text-sm text-foreground">Install App</span>
                            </div>
                            <ChevronRight size={14} class="text-muted-foreground" />
                        </button>
                    {/if}
                </div>
            </div>

            <div class="flex justify-between items-center px-1">
                <span class="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">BPS Canteen v0.0.2</span>
                <span class="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">Bangalore</span>
            </div>

            <button onclick={executeLogout} class="w-full py-3.5 border border-destructive/25 text-destructive text-sm font-medium tracking-wide flex items-center justify-center gap-2 hover:bg-destructive/5 transition-colors active:scale-[0.98]">
                <LogOut size={15} /> Sign Out
            </button>
        </div>
    {/if}
</div>