<script lang="ts">
	import { resolve } from '$app/paths';
    import { ArrowLeft, ChevronRight, KeyRound, Fingerprint, Smartphone, Loader2, Check } from 'lucide-svelte';

    let biometricsEnabled = $state(true);
    let deviceSignOutStatus: 'IDLE' | 'LOADING' | 'SUCCESS' = $state('IDLE');

    async function handleSignOutDevices() {
        if (deviceSignOutStatus !== 'IDLE') return;
        deviceSignOutStatus = 'LOADING';
        try {
            const res = await fetch('/api/auth/logout-devices', { method: 'POST' });
            if (res.ok) {
                deviceSignOutStatus = 'SUCCESS';
                setTimeout(() => deviceSignOutStatus = 'IDLE', 3000);
            } else deviceSignOutStatus = 'IDLE';
        } catch (err) {
            console.error(err);
            deviceSignOutStatus = 'IDLE';
        }
    }
</script>

<svelte:head><title>Security | Campus Wallet</title></svelte:head>

<div class="flex flex-col h-full animate-in fade-in duration-200">
    <header class="flex items-center gap-3 pb-4 border-b border-border sticky top-0 bg-background z-10 pt-1 p-4">
        <a href={resolve("/profile")} class="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><ArrowLeft size={18} /></a>
        <div><h2 class="text-base font-semibold text-foreground tracking-tight leading-none">Security</h2></div>
    </header>

    <div class="flex-1 overflow-y-auto p-4 space-y-6 animate-in slide-in-from-right-2 duration-300">
        <div>
            <p class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 px-1">Authentication</p>
            <div class="bg-card border border-border divide-y divide-border">
                <a href={resolve("/profile/security/pin")} class="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors">
                    <div class="flex items-center gap-3 text-left">
                        <KeyRound size={15} class="text-muted-foreground shrink-0" />
                        <div>
                            <span class="text-sm text-foreground block">Change Security PIN</span>
                            <span class="text-xs text-muted-foreground mt-0.5 block font-light">Update your 4-digit transaction PIN</span>
                        </div>
                    </div>
                    <ChevronRight size={14} class="text-muted-foreground" />
                </a>
                <button onclick={() => biometricsEnabled = !biometricsEnabled} class="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors">
                    <div class="flex items-center gap-3 text-left">
                        <Fingerprint size={15} class="text-muted-foreground shrink-0" />
                        <div>
                            <span class="text-sm text-foreground block">Biometric Login</span>
                            <span class="text-xs text-muted-foreground mt-0.5 block font-light">Use fingerprint or Face ID</span>
                        </div>
                    </div>
                    <div class="w-8 h-4 rounded-full border border-border relative transition-colors {biometricsEnabled ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-muted'}">
                        <div class="absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all {biometricsEnabled ? 'bg-emerald-400 left-4.5' : 'bg-muted-foreground left-1'}"></div>
                    </div>
                </button>
            </div>
        </div>

        <div>
            <p class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 px-1">Active Sessions</p>
            <div class="bg-card border border-border">
                <div class="flex items-center justify-between px-5 py-4 border-b border-border">
                    <div class="flex items-center gap-3 text-left">
                        <Smartphone size={15} class="text-muted-foreground shrink-0" />
                        <div>
                            <span class="text-sm text-foreground block">Current Device</span>
                            <span class="font-mono text-[10px] text-emerald-400 mt-1 uppercase tracking-wider block">Active Now</span>
                        </div>
                    </div>
                </div>
                <div class="px-5 py-4">
                    <button onclick={handleSignOutDevices} disabled={deviceSignOutStatus !== 'IDLE'} class="w-full py-2.5 border text-xs font-medium tracking-wide transition-all active:scale-[0.98] flex items-center justify-center gap-2 {deviceSignOutStatus === 'SUCCESS' ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' : 'border-border text-foreground hover:bg-muted'}">
                        {#if deviceSignOutStatus === 'LOADING'}
                            <Loader2 size={14} class="animate-spin text-muted-foreground" /> Processing...
                        {:else if deviceSignOutStatus === 'SUCCESS'}
                            <Check size={14} /> Devices Signed Out
                        {:else} Sign Out All Other Devices {/if}
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>