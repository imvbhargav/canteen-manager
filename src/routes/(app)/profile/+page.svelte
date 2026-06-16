<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatCurrencyINR } from '$lib';
	import { appState } from '$lib/store.svelte';
	import {
		LogOut,
		ChevronRight,
		History,
		Wallet,
		ArrowLeft,
		Download,
		CheckCircle,
		KeyRound,
		Laptop,
		CreditCard,
		Utensils
	} from 'lucide-svelte';

	interface BeforeInstallPromptEvent extends Event {
		readonly platforms: Array<string>;
		readonly userChoice: Promise<{
			outcome: 'accepted' | 'dismissed';
			platform: string;
		}>;
		prompt(): Promise<void>;
	}

	let deferredPrompt: BeforeInstallPromptEvent | null = $state(null);
	let isInstalled: boolean = $state(true);

	$effect((): (() => void) => {
		isInstalled =
			window.matchMedia('(display-mode: standalone)').matches ||
			!!(window.navigator as Navigator & { standalone?: boolean }).standalone;

		const handleBeforeInstallPrompt = (e: Event): void => {
			e.preventDefault();
			deferredPrompt = e as BeforeInstallPromptEvent;
			isInstalled = false;
		};

		const handleAppInstalled = (): void => {
			isInstalled = true;
			deferredPrompt = null;
		};

		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
		window.addEventListener('appinstalled', handleAppInstalled);

		return (): void => {
			window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
			window.removeEventListener('appinstalled', handleAppInstalled);
		};
	});

	async function installApp(): Promise<void> {
		if (deferredPrompt) {
			deferredPrompt.prompt();
			const { outcome }: { outcome: 'accepted' | 'dismissed' } = await deferredPrompt.userChoice;

			if (outcome === 'accepted') {
				isInstalled = true;
				deferredPrompt = null;
			}
		} else {
			alert(
				"To install this app, tap your browser's Share or Menu button, then select 'Add to Home Screen'."
			);
		}
	}

	async function executeLogout(): Promise<void> {
		await fetch('/api/auth/logout', { method: 'POST' });
		window.location.href = '/login';
	}

	async function logoutAllDevices(): Promise<void> {
		await fetch('/api/auth/logout-devices', { method: 'POST' });
		window.location.href = '/login';
	}
</script>

<svelte:head><title>Profile | MunchUp</title></svelte:head>

<div
	class="animate-in fade-in absolute inset-0 z-20 flex flex-col overflow-y-auto bg-background duration-300"
>
	<!-- ── Header ── -->
	<header
		class="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 bg-background/15 px-5 backdrop-blur-md"
	>
		<a
			href={resolve('/')}
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-foreground transition-transform active:scale-90"
		>
			<ArrowLeft size={18} strokeWidth={2.5} />
		</a>

		<h2 class="flex-1 text-[20px] font-bold tracking-tight text-foreground">Profile</h2>

		<div class="flex w-20 justify-end"></div>
	</header>

	{#if appState.wallet}
		<div class="space-y-5 px-5 pt-1">
			<!-- ── Section: Account Info & Wallet ── -->
			<div class="rounded-3xl border border-muted bg-card p-2 shadow-[0_2px_12px_rgb(0,0,0,0.04)]">
				<!-- User Info -->
				<div class="mb-2 flex items-center gap-4 rounded-2xl bg-muted/10 p-4">
					<div
						class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted/60 text-[18px] font-black text-foreground/70"
					>
						{appState.wallet.name.charAt(0)}
					</div>
					<div class="min-w-0 flex-1">
						<h3 class="truncate text-[16px] font-bold text-foreground">
							{appState.wallet.name}
						</h3>
						<div class="mt-0.5 flex items-center gap-2">
							<span
								class="rounded bg-muted/50 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-foreground/60 uppercase"
							>
								{appState.wallet.referenceKey}
							</span>
						</div>
					</div>
				</div>

				<!-- Wallet Card -->
				<div
					class="relative overflow-hidden rounded-2xl bg-linear-to-br from-primary to-accent px-5 py-5 shadow-[0_4px_20px_rgba(15,37,68,0.12)]"
				>
					<div
						class="pointer-events-none absolute -top-8 -right-8 h-36 w-36 rounded-full bg-white/5"
					></div>
					<div
						class="pointer-events-none absolute -right-2 -bottom-6 h-28 w-28 rounded-full bg-white/2.5"
					></div>

					<div class="relative flex flex-col gap-4">
						<div class="flex items-center gap-2">
							<Wallet size={13} strokeWidth={2} class="text-background" />
							<p class="text-[10px] font-black tracking-[0.15em] text-background uppercase">
								Wallet Balance
							</p>
						</div>
						<div class="flex items-end justify-between">
							<p class="font-mono text-2xl font-bold tracking-tight text-white">
								{formatCurrencyINR(appState.wallet.balance)}
							</p>
							<a
								href={resolve('/topup')}
								class="flex items-center gap-1.5 rounded-full bg-background/80 px-4 py-2 text-xs font-black text-accent ring-4 ring-accent/25 backdrop-blur-md transition-all active:scale-95"
							>
								<CreditCard class="h-3.5 w-3.5" />
								Top Up
							</a>
						</div>
					</div>
				</div>
			</div>

			<!-- ── Section: Activity & History ── -->
			<div class="rounded-3xl border border-muted bg-card p-2 shadow-[0_2px_12px_rgb(0,0,0,0.04)]">
				<p
					class="px-4 pt-2 pb-1 text-[11px] font-black tracking-widest text-foreground/40 uppercase"
				>
					Activity & History
				</p>
				<div class="divide-y divide-muted/15">
					<!-- Order History -->
					<a
						href={resolve('/orders')}
						class="group flex w-full items-center justify-between rounded-2xl p-2 text-left transition-all hover:bg-muted/40 active:bg-muted/60"
					>
						<div class="flex items-center gap-4">
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/50 text-foreground/70 transition-colors group-hover:text-foreground"
							>
								<Utensils size={16} strokeWidth={2.5} />
							</div>
							<div>
								<span class="block text-[14px] font-bold tracking-tight text-foreground"
									>Order History</span
								>
								<span class="mt-0.5 block text-[11px] font-medium text-foreground/40"
									>Track and review your food orders</span
								>
							</div>
						</div>
						<ChevronRight size={16} strokeWidth={2.5} class="mr-2 text-foreground/30" />
					</a>

					<!-- Transaction History -->
					<a
						href={resolve('/profile/history')}
						class="group flex w-full items-center justify-between rounded-2xl p-2 text-left transition-all hover:bg-muted/40 active:bg-muted/60"
					>
						<div class="flex items-center gap-4">
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/50 text-foreground/70 transition-colors group-hover:text-foreground"
							>
								<History size={16} strokeWidth={2.5} />
							</div>
							<div>
								<span class="block text-[14px] font-bold tracking-tight text-foreground"
									>Transaction History</span
								>
								<span class="mt-0.5 block text-[11px] font-medium text-foreground/40"
									>View account statements and top-ups</span
								>
							</div>
						</div>
						<ChevronRight size={16} strokeWidth={2.5} class="mr-2 text-foreground/30" />
					</a>
				</div>
			</div>

			<!-- ── Section: Application Status ── -->
			<div class="rounded-3xl border border-muted bg-card p-2 shadow-[0_2px_12px_rgb(0,0,0,0.04)]">
				<p
					class="px-4 pt-2 pb-1 text-[11px] font-black tracking-widest text-foreground/40 uppercase"
				>
					Application
				</p>
				{#if isInstalled}
					<div class="flex items-center justify-between rounded-2xl bg-emerald-500/5 p-2">
						<div class="flex items-center gap-4">
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500"
							>
								<CheckCircle size={16} strokeWidth={2.5} />
							</div>
							<div>
								<span class="block text-[14px] font-bold tracking-tight text-foreground"
									>App Installed</span
								>
								<span class="mt-0.5 block text-[11px] font-medium text-foreground/40"
									>Running natively on your device</span
								>
							</div>
						</div>
						<span class="mr-3 text-[10px] font-black tracking-widest text-emerald-500 uppercase"
							>Active</span
						>
					</div>
				{:else}
					<button
						onclick={installApp}
						class="group flex w-full cursor-pointer items-center justify-between rounded-2xl p-2 text-left transition-all hover:bg-muted/40 active:bg-muted/60"
					>
						<div class="flex items-center gap-4">
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/50 text-foreground/70 transition-colors group-hover:text-foreground"
							>
								<Download size={16} strokeWidth={2.5} />
							</div>
							<div>
								<span class="block text-[14px] font-bold tracking-tight text-foreground"
									>Install App</span
								>
								<span class="mt-0.5 block text-[11px] font-medium text-foreground/40"
									>Add MunchUp to your homescreen</span
								>
							</div>
						</div>
					</button>
				{/if}
			</div>

			<!-- ── Section: Account Security ── -->
			<div class="rounded-3xl border border-muted bg-card p-2 shadow-[0_2px_12px_rgb(0,0,0,0.04)]">
				<p
					class="px-4 pt-2 pb-1 text-[11px] font-black tracking-widest text-destructive/60 uppercase"
				>
					Account Security
				</p>
				<div class="divide-y divide-muted/15">
					<!-- Change PIN -->
					<a
						href={resolve('/profile/pin')}
						class="group flex w-full items-center justify-between rounded-2xl p-2 text-left transition-all hover:bg-muted/40 active:bg-muted/60"
					>
						<div class="flex items-center gap-4">
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/50 text-foreground/70 transition-colors group-hover:text-foreground"
							>
								<KeyRound size={16} strokeWidth={2.5} />
							</div>
							<div>
								<span class="block text-[14px] font-bold tracking-tight text-foreground"
									>Change Security PIN</span
								>
								<span class="mt-0.5 block text-[11px] font-medium text-foreground/40"
									>Update your 4-digit transaction PIN</span
								>
							</div>
						</div>
						<ChevronRight size={16} strokeWidth={2.5} class="mr-2 text-foreground/30" />
					</a>

					<!-- Log Out Current Session -->
					<button
						onclick={executeLogout}
						class="group flex w-full cursor-pointer items-center justify-between rounded-2xl p-2 text-left transition-all hover:bg-destructive/10 active:bg-destructive/20 disabled:opacity-50"
					>
						<div class="flex items-center gap-4">
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-foreground/70 transition-colors group-hover:bg-destructive/15 group-hover:text-foreground"
							>
								<LogOut size={16} strokeWidth={2.5} />
							</div>
							<div>
								<span class="block text-[14px] font-bold tracking-tight text-foreground">
									Log Out
								</span>
								<span class="mt-0.5 block text-[11px] font-medium text-foreground/40">
									Exit your current session
								</span>
							</div>
						</div>
					</button>

					<!-- Sign Out All Devices -->
					<button
						onclick={logoutAllDevices}
						class="group flex w-full cursor-pointer items-center justify-between rounded-2xl p-2 text-left transition-all hover:bg-destructive/10 active:bg-destructive/20"
					>
						<div class="flex items-center gap-4">
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 transition-colors group-hover:bg-orange-500/20"
							>
								<Laptop size={16} strokeWidth={2.5} />
							</div>
							<div>
								<span
									class="block text-[14px] font-bold tracking-tight text-orange-600 group-hover:text-orange-700"
								>
									Sign Out All Devices
								</span>
								<span class="mt-0.5 block text-[11px] font-medium text-orange-600/50">
									Revoke access everywhere except here
								</span>
							</div>
						</div>
					</button>
				</div>
			</div>

			<!-- ── Footer ── -->
			<div class="space-y-4 pt-2">
				<div class="pb-16 font-site-name font-black">
					<div class="space-y-4 rounded-xl p-4">
						<div class="flex items-center justify-between">
							<div class="flex w-full flex-col">
								<p
									class="flex w-full justify-between text-[10px] tracking-widest text-foreground/40"
								>
									<span>
										&copy; MunchUp - {new Date().getFullYear()}
									</span>
									<span class="uppercase"> Basavanagudi </span>
								</p>
								<p class="mt-4 ml-1 text-foreground/50">A unit of</p>
								<div class="relative overflow-hidden">
									<div
										class="absolute inset-0 z-10 bg-linear-to-b from-background/25 to-background"
									></div>
									<h1 class="text-center text-[70px] leading-none font-black opacity-80">
										Pepper<span class="text-primary">Vine</span>
									</h1>
								</div>
								<p class="text-right text-foreground/50">Hospitality</p>
							</div>
						</div>
					</div>
					<p class="mt-4 px-5 text-[10px] text-foreground/60">
						Built by
						<a
							href="https://xharv.in"
							target="_blank"
							rel="noopener noreferrer"
							class="hover:underline"
						>
							@imvbhargav
						</a>
					</p>
				</div>
			</div>
		</div>
	{/if}
</div>
