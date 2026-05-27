<script lang="ts">
    import '../layout.css';
    import { onMount, type Snippet } from 'svelte';

    let { children }: { children: Snippet } = $props();

	onMount(() => {
		const setHeight = () => {
			document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
		}
		setHeight()
		window.addEventListener('resize', setHeight)
		return () => window.removeEventListener('resize', setHeight)
	})
</script>

<main class="h-[--app-height] overflow-hidden">
    {@render children()}
</main>
