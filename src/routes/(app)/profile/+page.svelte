<script lang="ts">
	import { resolve } from '$app/paths';
	import { appState } from '$lib/store.svelte';
	import {
		LogOut,
		ChevronRight,
		History,
		CreditCard,
		Wallet,
		ArrowLeft,
		Download,
		CheckCircle,
		KeyRound,
		Fingerprint,
		Users,
		Laptop
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
	let biometricsEnabled: boolean = $state(true);

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

	async function switchProfile(): Promise<void> {
		window.location.href = '/login?action=switch';
	}

	async function logoutAllDevices(): Promise<void> {
		await fetch('/api/auth/logout-all', { method: 'POST' });
		window.location.href = '/login';
	}
</script>

<svelte:head><title>Profile | MunchUp</title></svelte:head>

<div class="animate-in fade-in absolute inset-0 z-20 flex flex-col bg-background duration-300">
	<!-- ── Header: fixed height h-16, matches menu and ticket screens ── -->
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

		<!-- Spacer: fixed width w-20 so header width never changes -->
		<div class="flex w-20 justify-end"></div>
	</header>

	{#if appState.wallet}
		<div class="space-y-4 px-5 pt-1">
			<!-- User Info Card -->
			<div
				class="flex items-center gap-4 rounded-[20px] border border-muted/30 bg-card p-4 shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
			>
				<div
					class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted/50 text-[20px] font-black text-foreground/60"
				>
					{appState.wallet.name.charAt(0)}
				</div>
				<div class="min-w-0 flex-1">
					<h3 class="truncate text-[16px] font-bold text-foreground">
						{appState.wallet.name}
					</h3>
					<div class="mt-1 flex items-center gap-2">
						<span
							class="rounded-md bg-muted/50 px-2 py-0.5 text-[10px] font-bold tracking-widest text-foreground/60 uppercase"
						>
							{appState.wallet.studentId}
						</span>
						<span
							class="rounded-md bg-muted/50 px-2 py-0.5 text-[10px] font-bold tracking-widest text-foreground/60 uppercase"
						>
							Roll {appState.wallet.rollNumber}
						</span>
					</div>
				</div>
			</div>

			<!-- Wallet Card -->
			<div
				class="relative overflow-hidden rounded-3xl bg-accent bg-linear-to-br from-primary/40 via-accent to-primary/25 px-5 py-5 shadow-[0_4px_24px_rgba(15,37,68,0.18)]"
			>
				<div class="relative">
					<div class="flex items-center gap-2">
						<Wallet size={13} strokeWidth={2.5} class="text-white/40" />
						<span class="text-[10px] font-bold tracking-[0.15em] text-white/40 uppercase"
							>Campus Wallet</span
						>
					</div>
					<div class="mt-2 flex items-end justify-between">
						<div>
							<span class="text-[32px] font-bold tracking-tight text-white"
								>₹{appState.wallet.balance.toFixed(2)}</span
							>
						</div>
						<a
							href={resolve('/topup')}
							class="mb-1 flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-4 py-1.5 text-sm font-black text-white backdrop-blur-sm transition-all hover:border-primary/50 hover:bg-primary/25 active:scale-95 active:bg-white/20"
						>
							<CreditCard size={14} strokeWidth={2.5} /> Top Up
						</a>
					</div>
				</div>
			</div>

			<!-- Main Options List -->
			<div>
				<div
					class="overflow-hidden rounded-3xl border border-muted/30 bg-card shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
				>
					<div class="divide-y divide-muted/20">
						<!-- Transaction History -->
						<a
							href={resolve('/profile/history')}
							class="flex w-full items-center justify-between px-4 py-4 transition-colors active:bg-muted/30"
						>
							<div class="flex items-center gap-3.5 text-left">
								<div
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/40"
								>
									<History size={16} strokeWidth={2.5} class="text-foreground/70" />
								</div>
								<div>
									<span class="block text-[14px] font-bold text-foreground"
										>Transaction History</span
									>
									<span class="mt-0.5 block text-[11px] font-medium text-foreground/50"
										>View past orders and top-ups</span
									>
								</div>
							</div>
							<ChevronRight size={16} strokeWidth={2.5} class="text-foreground/30" />
						</a>

						<!-- Change PIN -->
						<a
							href={resolve('/profile/pin')}
							class="flex w-full items-center justify-between px-4 py-4 transition-colors active:bg-muted/30"
						>
							<div class="flex items-center gap-3.5 text-left">
								<div
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/40"
								>
									<KeyRound size={16} strokeWidth={2.5} class="text-foreground/70" />
								</div>
								<div>
									<span class="block text-[14px] font-bold text-foreground"
										>Change Security PIN</span
									>
									<span class="mt-0.5 block text-[11px] font-medium text-foreground/50"
										>Update your 4-digit transaction PIN</span
									>
								</div>
							</div>
							<ChevronRight size={16} strokeWidth={2.5} class="text-foreground/30" />
						</a>

						<!-- Biometrics Toggle -->
						<button
							onclick={() => (biometricsEnabled = !biometricsEnabled)}
							class="flex w-full items-center justify-between px-4 py-4 transition-colors active:bg-muted/30"
						>
							<div class="flex items-center gap-3.5 text-left">
								<div
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/40"
								>
									<Fingerprint size={16} strokeWidth={2.5} class="text-foreground/70" />
								</div>
								<div>
									<span class="block text-[14px] font-bold text-foreground">Biometric Login</span>
									<span class="mt-0.5 block text-[11px] font-medium text-foreground/50"
										>Use fingerprint or Face ID</span
									>
								</div>
							</div>
							<div
								class="relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200 ease-in-out {biometricsEnabled
									? 'bg-emerald-500'
									: 'bg-muted/80'}"
							>
								<div
									class="absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform duration-200 ease-in-out {biometricsEnabled
										? 'translate-x-4 shadow-[0_2px_4px_rgba(0,0,0,0.2)]'
										: 'translate-x-0'}"
								></div>
							</div>
						</button>

						<!-- PWA Install Status -->
						{#if isInstalled}
							<div class="flex items-center justify-between bg-muted/10 px-4 py-4">
								<div class="flex items-center gap-3.5 text-left">
									<div
										class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10"
									>
										<CheckCircle size={16} strokeWidth={2.5} class="text-emerald-500" />
									</div>
									<div>
										<span class="block text-[14px] font-bold text-foreground">App Installed</span>
										<span class="mt-0.5 block text-[11px] font-medium text-foreground/50"
											>Running natively on your device</span
										>
									</div>
								</div>
								<span class="text-[10px] font-bold tracking-widest text-emerald-500 uppercase"
									>Active</span
								>
							</div>
						{:else}
							<button
								onclick={installApp}
								class="flex w-full items-center justify-between px-4 py-4 transition-colors active:bg-muted/30"
							>
								<div class="flex items-center gap-3.5 text-left">
									<div
										class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/40"
									>
										<Download size={16} strokeWidth={2.5} class="text-foreground/70" />
									</div>
									<div>
										<span class="block text-[14px] font-bold text-foreground">Install App</span>
										<span class="mt-0.5 block text-[11px] font-medium text-foreground/50"
											>Add MunchUp to your homescreen</span
										>
									</div>
								</div>
								<ChevronRight size={16} strokeWidth={2.5} class="text-foreground/30" />
							</button>
						{/if}
					</div>
				</div>
			</div>

			<!-- Session & Account Actions -->
			<div>
				<div
					class="overflow-hidden rounded-3xl border border-muted/30 bg-card shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
				>
					<div class="divide-y divide-muted/20">
						<!-- Switch Profile -->
						<button
							onclick={switchProfile}
							class="flex w-full items-center justify-between px-4 py-4 transition-colors active:bg-muted/30"
						>
							<div class="flex items-center gap-3.5 text-left">
								<div
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/40"
								>
									<Users size={16} strokeWidth={2.5} class="text-foreground/70" />
								</div>
								<div>
									<span class="block text-[14px] font-bold text-foreground">Switch Profile</span>
									<span class="mt-0.5 block text-[11px] font-medium text-foreground/50"
										>Sign in with a different account</span
									>
								</div>
							</div>
							<ChevronRight size={16} strokeWidth={2.5} class="text-foreground/30" />
						</button>

						<!-- Logout of All Devices -->
						<button
							onclick={logoutAllDevices}
							class="flex w-full items-center justify-between px-4 py-4 transition-colors active:bg-muted/30"
						>
							<div class="flex items-center gap-3.5 text-left">
								<div
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10"
								>
									<Laptop size={16} strokeWidth={2.5} class="text-amber-500" />
								</div>
								<div>
									<span class="block text-[14px] font-bold text-foreground">Logout All Devices</span
									>
									<span class="mt-0.5 block text-[11px] font-medium text-foreground/50"
										>End every active session</span
									>
								</div>
							</div>
							<ChevronRight size={16} strokeWidth={2.5} class="text-foreground/30" />
						</button>
					</div>
				</div>
			</div>

			<div class="space-y-4 pt-4">
				<button
					onclick={executeLogout}
					class="flex w-full items-center justify-center gap-2 rounded-full border border-destructive/20 bg-destructive/5 py-3.5 text-[13px] font-bold text-destructive transition-colors active:scale-[0.98] active:bg-destructive/10"
				>
					<LogOut size={14} strokeWidth={2.5} /> Sign Out
				</button>

				<div class="px-2 pb-6">
					<div
						class="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 px-3 py-3"
					>
						<div class="flex w-full flex-col">
							<p
								class="flex w-full justify-between text-[10px] font-bold tracking-widest text-foreground/40 uppercase"
							>
								<span>
									&copy; MunchUp - {new Date().getFullYear()}
								</span>
								<span> Basavanagudi </span>
							</p>
						</div>
					</div>

					<p class="mt-6 text-center text-xs text-foreground/60">
						Built by
						<a href="https://github.com/imvbhargav" target="_blank" rel="noopener noreferrer">
							@imvbhargav
						</a>
					</p>
				</div>
			</div>
		</div>
	{/if}
</div>
