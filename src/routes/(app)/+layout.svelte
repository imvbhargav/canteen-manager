<script lang="ts">
	import '../layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/stores';
	import { Home, UtensilsCrossed, QrCode, User, X, Download } from 'lucide-svelte';
	import { appState } from '$lib/store.svelte';
	import { resolve } from '$app/paths';
	import type { UserWallet, MenuItem } from '$lib/types';
	import { type Snippet } from 'svelte';

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
	// Define the custom event type for TypeScript
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
			// Prevent the mini-infobar from appearing on mobile
			e.preventDefault();
			// Stash the event so it can be triggered later.
			deferredPrompt = e as BeforeInstallPromptEvent;
			// Update UI notify the user they can install the PWA
			showInstallBanner = true;
		};

		const handleAppInstalled = () => {
			// Hide the banner if the user installs it successfully
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

		// Show the install prompt
		deferredPrompt.prompt();

		// Wait for the user to respond to the prompt
		const { outcome } = await deferredPrompt.userChoice;
		if (outcome === 'accepted') {
			showInstallBanner = false;
		}

		// We've used the prompt, and can't use it again, throw it away
		deferredPrompt = null;
	}
	// ------------------------------
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta
		name="description"
		content="Manage your campus digital wallet and order food live from BPS Canteen."
	/>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div
	class="relative mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-background font-sans"
>
	<div class="absolute top-0 right-0 left-0 z-50 h-px bg-border"></div>

	<main class="relative z-0 flex-1 overflow-y-auto pt-3 border-x border-neutral-400/25">
		{@render children()}
		<div class="h-20 w-full mt-4 bg-red-500"></div>
	</main>

	<!-- Custom PWA Install Banner -->
	{#if showInstallBanner}
		<div
			class="animate-in slide-in-from-bottom-2 fade-in absolute right-4 bottom-22.5 left-4 z-50 duration-300"
		>
			<div
				class="flex items-center justify-between border border-emerald-500/30 bg-card p-3 shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
			>
				<div class="flex items-center gap-3">
					<div class="flex h-8 w-8 items-center justify-center bg-emerald-500/10 text-emerald-400">
						<Download size={16} />
					</div>
					<div>
						<h3 class="text-sm font-medium text-foreground">Install App</h3>
						<p class="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
							Add to home screen
						</p>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<button
						onclick={() => (showInstallBanner = false)}
						class="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted"
					>
						<X size={16} />
					</button>
					<button
						onclick={installApp}
						class="h-8 bg-foreground px-4 text-xs font-medium tracking-wide text-background transition-all active:scale-95"
					>
						Install
					</button>
				</div>
			</div>
		</div>
	{/if}

	<nav
		class="fixed left-0 bottom-0 z-40 w-full bg-background"
	>
		<div class="mx-auto flex max-w-md border-x border-neutral-400/25 items-center border-t px-2 pt-4 supports-[padding:max(0px)]:pb-[max(1rem,env(safe-area-inset-bottom))] justify-around">
			{#each navItems as { path, icon: Icon, label } (path)}
				{#if path !== resolve('/menu') || !appState.activeTicket}
					<a
						href={path}
						class="relative flex w-16 flex-col items-center gap-1.5 transition-colors {currentPath ===
							path ||
						(path === '/profile' && currentPath.startsWith('/profile'))
							? 'text-foreground'
							: 'text-muted-foreground hover:text-foreground/70'}"
					>
						{#if path === resolve('/ticket') && appState.activeTicket}
							<div class="relative">
								<Icon size={20} strokeWidth={currentPath === path ? 2 : 1.5} />
								<span
									class="absolute -top-0.5 -right-1 h-2 w-2 rounded-full border-2 border-background bg-amber-400"
								></span>
							</div>
						{:else}
							<Icon
								size={20}
								strokeWidth={currentPath === path ||
								(path === '/profile' && currentPath.startsWith('/profile'))
									? 2
									: 1.5}
							/>
						{/if}
						<span class="font-mono text-[9px] tracking-widest uppercase">{label}</span>
					</a>
				{/if}
			{/each}
		</div>
	</nav>
</div>
