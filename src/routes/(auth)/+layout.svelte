<script lang="ts">
    import '../layout.css';
    import { type Snippet } from 'svelte';

    let { children }: { children: Snippet } = $props();
</script>

<main class="h-dvh overflow-hidden">
    {@render children()}
</main>
