<script lang="ts">
    import { ArrowLeft, Loader2, Check } from 'lucide-svelte';
    import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

    let pinUpdateStatus: 'IDLE' | 'SAVING' | 'SUCCESS' = $state('IDLE');
    let currentPin = $state('');
    let newPin = $state('');
    let confirmPin = $state('');

    let isPinValid = $derived(currentPin.length === 4 && newPin.length === 4 && newPin === confirmPin);

    async function handleUpdatePin() {
        if (!isPinValid || pinUpdateStatus !== 'IDLE') return;
        pinUpdateStatus = 'SAVING';
        try {
            const res = await fetch('/api/auth/pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPin, newPin })
            });
            if (res.ok) {
                pinUpdateStatus = 'SUCCESS';
                setTimeout(() => goto(resolve('/profile/security')), 1000);
            } else pinUpdateStatus = 'IDLE';
        } catch (err) {
            console.error(err);
            pinUpdateStatus = 'IDLE';
        }
    }
</script>

<svelte:head><title>Change PIN | Campus Wallet</title></svelte:head>

<div class="flex flex-col h-full animate-in fade-in duration-200">
    <header class="flex items-center gap-3 pb-4 border-b border-border sticky top-0 bg-background z-10 pt-1 p-4">
        <a href={resolve("/profile/security")} class="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><ArrowLeft size={18} /></a>
        <div><h2 class="text-base font-semibold text-foreground tracking-tight leading-none">Change PIN</h2></div>
    </header>

    <div class="flex-1 flex flex-col p-4 animate-in slide-in-from-right-2 duration-300 h-full">
        <div class="space-y-4 flex-1">
            <div class="bg-card border border-border p-5 space-y-6">
                <div>
                    <label for="current" class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">Current PIN</label>
                    <input id="current" type="password" inputmode="numeric" maxlength="4" bind:value={currentPin} class="w-full bg-transparent border-b-2 border-border focus:border-foreground py-2 text-2xl font-mono tracking-[0.5em] outline-none transition-colors text-foreground" placeholder="••••" />
                </div>
                <div>
                    <label for="new" class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">New PIN</label>
                    <input id="new" type="password" inputmode="numeric" maxlength="4" bind:value={newPin} class="w-full bg-transparent border-b-2 border-border focus:border-foreground py-2 text-2xl font-mono tracking-[0.5em] outline-none transition-colors text-foreground" placeholder="••••" />
                </div>
                <div>
                    <label for="confirm" class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">Confirm New PIN</label>
                    <input id="confirm" type="password" inputmode="numeric" maxlength="4" bind:value={confirmPin} class="w-full bg-transparent border-b-2 border-border focus:border-foreground py-2 text-2xl font-mono tracking-[0.5em] outline-none transition-colors text-foreground {confirmPin.length === 4 && confirmPin !== newPin ? 'border-destructive focus:border-destructive text-destructive' : ''}" placeholder="••••" />
                    {#if confirmPin.length === 4 && confirmPin !== newPin}
                        <p class="font-mono text-[10px] text-destructive mt-1.5 uppercase tracking-wider">Pins do not match</p>
                    {/if}
                </div>
            </div>
        </div>

        <div class="pt-4 mt-auto border-t border-border bg-background pb-2">
            <button onclick={handleUpdatePin} disabled={!isPinValid || pinUpdateStatus !== 'IDLE'} class="w-full py-3.5 bg-foreground text-background text-sm font-medium tracking-wide transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 {pinUpdateStatus === 'SUCCESS' ? 'bg-emerald-500! text-background! opacity-100!' : ''}">
                {#if pinUpdateStatus === 'SAVING'}
                    <Loader2 size={16} class="animate-spin text-background" /> Updating...
                {:else if pinUpdateStatus === 'SUCCESS'}
                    <Check size={16} /> PIN Updated Successfully
                {:else} Save New PIN {/if}
            </button>
        </div>
    </div>
</div>