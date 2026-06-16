<script lang="ts">
	import '../layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/stores';
	import { Home, UtensilsCrossed, QrCode, X, Download, WifiOff, User } from 'lucide-svelte';
	import { appState } from '$lib/store.svelte';
	import { resolve } from '$app/paths';
	import type { UserWallet, MenuItem } from '$lib/types';
	import { onMount, type Snippet } from 'svelte';

	let {
		data,
		children
	}: {
		data: {
			wallet: UserWallet | null;
			menuItems: MenuItem[];
		};
		children: Snippet;
	} = $props();

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
			const nav = document.getElementById('bottom-nav');
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

	$effect(() => {
		if (data.wallet && !appState.wallet) appState.wallet = data.wallet;
		if (data.menuItems && appState.menuItems.length === 0) appState.menuItems = data.menuItems;
	});

	const navItems = [
		{ path: resolve('/'), icon: Home, label: 'Home' },
		{ path: resolve('/menu'), icon: UtensilsCrossed, label: 'Menu' },
		{ path: resolve('/ticket'), icon: QrCode, label: 'Ticket' },
		{ path: resolve('/profile'), icon: User, label: 'Profile' }
	];

	let currentPath = $derived($page.url.pathname);

	// --- PWA Installation Logic ---
	interface BeforeInstallPromptEvent extends Event {
		readonly platforms: Array<string>;
		readonly userChoice: Promise<{
			outcome: 'accepted' | 'dismissed';
			platform: string;
		}>;
		prompt(): Promise<void>;
	}

	let deferredPrompt: BeforeInstallPromptEvent | null = $state(null);
	let showInstallBanner = $state(false);

	$effect(() => {
		const handleBeforeInstallPrompt = (e: Event) => {
			e.preventDefault();
			deferredPrompt = e as BeforeInstallPromptEvent;
			showInstallBanner = true;
		};

		const handleAppInstalled = () => {
			showInstallBanner = false;
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
		if (!deferredPrompt) return;
		deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		if (outcome === 'accepted') {
			showInstallBanner = false;
		}
		deferredPrompt = null;
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta
		name="description"
		content="Manage your campus digital wallet and order food live from BPS Canteen."
	/>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if isOffline}
	<div
		class="fixed inset-0 z-9999 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md"
	>
		<div class="flex max-w-[80%] flex-col items-center space-y-4 text-center">
			<div
				class="flex h-16 w-16 items-center justify-center rounded-[20px] bg-destructive/10 text-destructive"
			>
				<WifiOff size={28} strokeWidth={2.5} />
			</div>
			<div>
				<h2 class="text-[20px] font-black tracking-tight text-foreground">Connection Lost</h2>
				<p class="mt-1.5 text-[14px] leading-relaxed font-medium text-foreground/50">
					The canteen system requires an active internet connection to process live wallet
					transactions and print orders. Please check your connection.
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

	{#if showInstallBanner}
		<div
			class="animate-in slide-in-from-bottom-4 fade-in absolute right-5 bottom-2 left-5 z-50 duration-300"
		>
			<div
				class="flex items-center justify-between rounded-3xl border border-muted/30 bg-card p-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
			>
				<div class="flex items-center gap-3">
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500"
					>
						<Download size={18} strokeWidth={2.5} />
					</div>
					<div>
						<h3 class="text-[14px] font-bold text-foreground">Install App</h3>
						<p class="text-[10px] font-bold tracking-widest text-foreground/40 uppercase">
							Add to home screen
						</p>
					</div>
				</div>
				<div class="flex items-center gap-2.5">
					<button
						onclick={() => (showInstallBanner = false)}
						class="flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 text-foreground transition-transform active:scale-90"
					>
						<X size={14} strokeWidth={2.5} />
					</button>
					<button
						onclick={installApp}
						class="rounded-full bg-foreground px-5 py-2.5 text-[12px] font-bold text-background transition-all active:scale-95"
					>
						Install
					</button>
				</div>
			</div>
		</div>
	{/if}

	<nav
		id="bottom-nav"
		class="fixed bottom-0 left-0 z-40 w-full border-t border-muted/20 bg-background/85 backdrop-blur-xl"
	>
		<div
			class="mx-auto flex max-w-md items-center justify-around px-2 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
		>
			{#each navItems as { path, icon: Icon, label } (path)}
				{#if path !== resolve('/menu') || !appState.activeTicket}
					<a
						href={path}
						class="group relative flex w-16 flex-col items-center gap-1.5 transition-all {currentPath ===
							path ||
						(path === resolve('/profile') && currentPath.startsWith(resolve('/profile')))
							? 'text-primary'
							: 'text-foreground/60 hover:text-foreground/70'}"
					>
						{#if path === resolve('/ticket') && appState.activeTicket}
							<div class="relative">
								<Icon size={22} strokeWidth={currentPath === path ? 2.5 : 2} />
								<span
									class="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-amber-500"
								></span>
							</div>
						{:else}
							<Icon
								size={22}
								strokeWidth={currentPath === path ||
								(path === resolve('/profile') && currentPath.startsWith(resolve('/profile')))
									? 2.5
									: 2}
							/>
						{/if}
						<span class="text-[10px] font-bold tracking-wider uppercase">{label}</span>
					</a>
				{/if}
			{/each}
		</div>
	</nav>
</div>
