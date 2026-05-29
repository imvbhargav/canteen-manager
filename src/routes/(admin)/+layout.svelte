<script lang="ts">
    import '../layout.css';
    import favicon from '$lib/assets/favicon.svg';
    import { WifiOff } from 'lucide-svelte';
    import { onMount, type Snippet } from 'svelte';

    let { children }: { children: Snippet } = $props();

    let isOffline = $state(false);

    onMount(() => {
        // Offline Detection
        isOffline = !navigator.onLine;
        const handleOnline = () => (isOffline = false);
        const handleOffline = () => (isOffline = true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Height Calculation
        const setHeight = () => {
            document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
        }
        setHeight()
        window.addEventListener('resize', setHeight)
        
        return () => {
            window.removeEventListener('resize', setHeight);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        }
    })
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
    <meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if isOffline}
    <div class="fixed inset-0 z-9999 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
        <div class="flex max-w-sm flex-col items-center space-y-4 p-6 text-center">
            <div class="rounded-full bg-destructive/10 p-4 text-destructive">
                <WifiOff size={48} />
            </div>
            <h2 class="text-xl font-bold tracking-tight text-foreground">Admin Offline</h2>
            <p class="text-sm text-muted-foreground">
                Canteen administration requires a stable connection. Please check your network to resume processing.
            </p>
        </div>
    </div>
{/if}

<div class="relative mx-auto flex h-(--app-height) max-w-md flex-col overflow-hidden bg-background font-sans transition-all duration-300 {isOffline ? 'pointer-events-none blur-sm' : ''}">
    
    <div class="absolute top-0 right-0 left-0 z-50 h-px bg-border"></div>

    <main class="relative z-0 flex-1 h-full border-x border-neutral-500/25">
        {@render children()}
    </main>

</div>