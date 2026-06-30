<script lang="ts">
	import '../layout.css';
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

		const setHeight = () => {
			document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
		};
		setHeight();
		window.addEventListener('resize', setHeight);

		return () => {
			window.removeEventListener('resize', setHeight);
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	});
</script>

{#if isOffline}
	<div
		class="fixed inset-0 z-9999 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm"
	>
		<div class="flex max-w-sm flex-col items-center space-y-4 p-6 text-center">
			<div class="rounded-full bg-destructive/10 p-4 text-destructive">
				<WifiOff size={48} />
			</div>
			<h2 class="text-xl font-bold tracking-tight text-foreground">Connection Lost</h2>
			<p class="text-sm text-muted-foreground">
				Please connect to the internet to access your account.
			</p>
		</div>
	</div>
{/if}

<main
	class="h-(--app-height) overflow-hidden transition-all duration-300 {isOffline
		? 'pointer-events-none blur-sm'
		: ''}"
>
	{@render children()}
</main>
