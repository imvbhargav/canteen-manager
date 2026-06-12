<script lang="ts">
	import '../layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/stores';
	import { UtensilsCrossed, WifiOff, Users, ReceiptIndianRupee, ChartBar } from 'lucide-svelte';
	import { resolve } from '$app/paths';
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
			const nav = document.getElementById('admin-bottom-nav');
			const navHeight = nav ? nav.offsetHeight : 0;

			document.documentElement.style.setProperty(
				'--app-height',
				`${window.innerHeight - navHeight}px`
			);
		};

		setHeight();
		window.addEventListener('resize', setHeight);

		return () => {
			window.removeEventListener('resize', setHeight);
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	});

	const adminNavItems = [
		{ path: resolve('/admin'), icon: UtensilsCrossed, label: 'Menu' },
		{ path: resolve('/admin/counters'), icon: ReceiptIndianRupee, label: 'Counters' },
		{ path: resolve('/admin/users'), icon: Users, label: 'Users' },
		{ path: resolve('/admin/analytics'), icon: ChartBar, label: 'Analytics' }
	];

	let currentPath = $derived($page.url.pathname);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if isOffline}
	<div
		class="fixed inset-0 z-9999 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm"
	>
		<div class="flex max-w-[80%] flex-col items-center space-y-4 text-center">
			<div
				class="flex h-16 w-16 items-center justify-center rounded-[20px] bg-destructive/10 text-destructive"
			>
				<WifiOff size={28} strokeWidth={2.5} />
			</div>
			<div>
				<h2 class="text-[20px] font-black tracking-tight text-foreground">Admin Offline</h2>
				<p class="mt-1.5 text-[14px] leading-relaxed font-medium text-foreground/50">
					Canteen administration requires a stable connection. Please check your network to resume
					processing.
				</p>
			</div>
		</div>
	</div>
{/if}

<div
	class="relative mx-auto flex h-(--app-height) max-w-md flex-col overflow-hidden font-sans transition-all duration-300 {isOffline
		? 'pointer-events-none blur-sm'
		: ''}"
>
	<main class="relative z-0 flex-1 overflow-y-auto">
		{@render children()}
	</main>

	<nav
		id="admin-bottom-nav"
		class="fixed bottom-0 left-0 z-40 w-full border-t border-muted/20 bg-background/85 backdrop-blur-xl"
	>
		<div
			class="mx-auto flex max-w-md items-center justify-around px-2 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
		>
			{#each adminNavItems as { path, icon: Icon, label } (path)}
				<a
					href={path}
					class="group relative flex w-16 flex-col items-center gap-1.5 transition-all {currentPath ===
					path
						? 'text-primary'
						: 'text-foreground/40 hover:text-foreground/70'}"
				>
					<Icon size={22} strokeWidth={currentPath === path ? 2.5 : 2} />
					<span class="text-[10px] font-bold tracking-wider uppercase">{label}</span>
				</a>
			{/each}
		</div>
	</nav>
</div>
