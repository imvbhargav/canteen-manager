<script lang="ts">
    import { ArrowRight, Loader2, Fingerprint } from 'lucide-svelte';
    import { goto, invalidateAll } from '$app/navigation'; 
    import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	onMount(() => {
		const setHeight = () => {
			document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
		}
		setHeight()
		window.addEventListener('resize', setHeight)
		return () => window.removeEventListener('resize', setHeight)
	})

    let identifier: string = $state('');
    let pin: string = $state('');
    let errorMsg: string = $state('');
    let isLoading: boolean = $state(false);

    let isValid: boolean = $derived(identifier.length >= 2 && pin.length === 4);

    type LoginResponse = {
        success: boolean;
        error?: string;
        message?: string;
        role?: 'STUDENT' | 'STAFF' | 'ADMIN';
    };

    async function handleLogin(e: Event): Promise<void> {
        e.preventDefault();
        if (!isValid || isLoading) return;

        isLoading = true;
        errorMsg = '';

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, pin })
            });

            const data = (await res.json()) as LoginResponse;

            if (data.success) {
                await invalidateAll(); 
                
                if (data.role === 'ADMIN') {
                    await goto(resolve('/admin'));
                } else {
                    await goto(resolve('/'));
                }
            } else {
                errorMsg = data.error || 'Login failed';
                pin = ''; 
            }
        } catch {
            errorMsg = 'Network error. Please try again.';
        } finally {
            isLoading = false;
        }
    }
</script>

<div class="relative mx-auto flex h-[var(--app-height)] max-w-md flex-col overflow-hidden bg-background pt-12 font-sans border-x border-neutral-400/25">
    <div class="flex flex-1 flex-col px-6">
        <div class="mb-12">
            <h1 class="mb-2 text-3xl leading-none font-bold tracking-tight text-foreground">
                BPS CANTEEN
            </h1>
            <p class="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                Campus Wallet & Canteen
            </p>
        </div>

        <form onsubmit={handleLogin} class="space-y-8">
            {#if errorMsg}
                <div class="border border-destructive/20 bg-destructive/10 p-3">
                    <p class="font-mono text-[10px] tracking-widest text-destructive uppercase">{errorMsg}</p>
                </div>
            {/if}

            <div class="space-y-2">
                <label for="identifier" class="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Student ID or Roll No.</label>
                <input
                    id="identifier"
                    type="text"
                    bind:value={identifier}
                    class="w-full border-b-2 border-border bg-transparent py-2 font-mono text-lg text-foreground uppercase transition-colors outline-none focus:border-foreground"
                    placeholder="STU-XXXXX or 10445"
                    autocomplete="username"
                />
            </div>

            <div class="space-y-2">
                <label for="pin" class="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">4-Digit PIN</label>
                <input
                    id="pin"
                    type="password"
                    inputmode="numeric"
                    maxlength="4"
                    bind:value={pin}
                    class="w-full border-b-2 border-border bg-transparent py-2 font-mono text-2xl tracking-[0.5em] text-foreground transition-colors outline-none focus:border-foreground"
                    placeholder="••••"
                    autocomplete="current-password"
                />
            </div>

            <button
                type="submit"
                disabled={!isValid || isLoading}
                class="mt-4 flex w-full items-center justify-between bg-foreground px-6 py-4 text-sm font-medium tracking-wide text-background transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
            >
                <span>{isLoading ? 'Authenticating...' : 'Sign In to Account'}</span>
                {#if isLoading}
                    <Loader2 size={16} class="animate-spin" />
                {:else}
                    <ArrowRight size={16} />
                {/if}
            </button>

            <button
                type="button"
                class="flex w-full items-center justify-center gap-2 border border-border py-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
                <Fingerprint size={14} />
                Use Biometrics
            </button>
        </form>

        <div class="mt-auto pt-8 pb-8 text-center">
            <p class="mb-2 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                New to Campus?
            </p>
            <button
                onclick={() => goto(resolve('/register'))}
                class="text-sm font-medium text-foreground decoration-foreground/30 underline-offset-4 hover:underline"
            >
                Create an account →
            </button>
        </div>
    </div>
</div>