<script lang="ts">
    import '../layout.css';
    import favicon from '$lib/assets/favicon.svg';
    import { type Snippet } from 'svelte';

    let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
    <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="relative mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-background font-sans">
    
    <div class="absolute top-0 right-0 left-0 z-50 h-px bg-border"></div>

    <main class="relative z-0 flex-1 h-full border-x border-neutral-500/25">
        {@render children()}
    </main>

</div>