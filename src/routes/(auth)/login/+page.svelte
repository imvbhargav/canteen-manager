<script lang="ts">
	import {
		ArrowRight,
		Loader2,
		Fingerprint,
		ChevronLeft,
		ChevronRight,
		UserPlus
	} from 'lucide-svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	interface SavedProfile {
		identifier: string;
		name?: string;
		lastUsed: number;
	}

	const PROFILES_KEY = 'munchup-saved-profiles';

	let savedProfiles: SavedProfile[] = $state([]);
	let selectedProfile: SavedProfile | null = $state(null);
	let identifier: string = $state('');
	let pin: string = $state('');
	let errorMsg: string = $state('');
	let isLoading: boolean = $state(false);
	let pinInputEl: HTMLInputElement | undefined = $state();
	let fullPinInputEl: HTMLInputElement | undefined = $state();

	let isInitialLoading: boolean = $state(true);
	let hasLoadedOnce: boolean = $state(false);
	let userRequestedProfiles: boolean = $state(false);

	let isSwitching: boolean = $derived($page.url.searchParams.get('action') === 'switch');
	let isValid: boolean = $derived(identifier.length >= 2 && pin.length === 4);

	type Screen = 'profiles' | 'pin' | 'full';
	let currentScreen: Screen = $state('profiles');

	onMount(() => {
		const setHeight = () => {
			document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
		};
		setHeight();
		window.addEventListener('resize', setHeight);

		loadProfiles();

		if (isSwitching) {
			currentScreen = 'full';
		}

		return () => window.removeEventListener('resize', setHeight);
	});

	function loadProfiles(): void {
		try {
			const raw = localStorage.getItem(PROFILES_KEY);
			if (raw) {
				savedProfiles = (JSON.parse(raw) as SavedProfile[]).sort((a, b) => b.lastUsed - a.lastUsed);
			}
		} catch {
			savedProfiles = [];
		} finally {
			isInitialLoading = false;
			hasLoadedOnce = true;
		}
	}

	function saveProfile(id: string, data: { name: string; roll: string }): void {
		const name = data.name;
		const idx = savedProfiles.findIndex((p) => p.identifier === id);
		const entry: SavedProfile = { identifier: id, lastUsed: Date.now(), name };
		if (idx >= 0) {
			savedProfiles[idx] = { ...savedProfiles[idx], ...entry };
		} else {
			savedProfiles.push(entry);
		}
		savedProfiles.sort((a, b) => b.lastUsed - a.lastUsed);
		try {
			localStorage.setItem(PROFILES_KEY, JSON.stringify(savedProfiles));
		} catch {
			/* quota or private mode */
		}
	}

	function selectProfile(profile: SavedProfile): void {
		selectedProfile = profile;
		identifier = profile.identifier;
		pin = '';
		errorMsg = '';
		currentScreen = 'pin';
		setTimeout(() => pinInputEl?.focus(), 80);
	}

	function goBack(): void {
		if (isSwitching) {
			goto(resolve('/'));
			return;
		}
		if (currentScreen === 'pin' || currentScreen === 'full') {
			selectedProfile = null;
			identifier = '';
			pin = '';
			errorMsg = '';
			userRequestedProfiles = true;
			currentScreen = 'profiles';
		}
	}

	type LoginResponse = {
		success: boolean;
		error?: string;
		message?: string;
		role?: 'STUDENT' | 'STAFF' | 'ADMIN';
		data?: { name: string; roll: string };
	};

	async function executeLogin(): Promise<void> {
		if (identifier.length < 2 || pin.length !== 4 || isLoading) return;

		isLoading = true;
		errorMsg = '';

		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ identifier, pin })
			});

			const data = (await res.json()) as LoginResponse;

			if (data.success && data.data) {
				saveProfile(identifier, data.data);
				await invalidateAll();
				if (data.role === 'ADMIN') {
					await goto(resolve('/admin'));
				} else {
					await goto(resolve('/'));
				}
			} else {
				errorMsg = data.error || 'Login failed';
				pin = '';
				if (currentScreen === 'pin') {
					pinInputEl?.focus();
				} else {
					fullPinInputEl?.focus();
				}
			}
		} catch {
			errorMsg = 'Network error. Please try again.';
		} finally {
			isLoading = false;
		}
	}

	// Auto-submit when PIN reaches 4 digits
	$effect(() => {
		if (pin.length === 4 && identifier.length >= 2 && !isLoading) {
			executeLogin();
		}
	});

	// Handle initial routing based on loaded profiles
	$effect(() => {
		if (!hasLoadedOnce || isSwitching || currentScreen !== 'profiles' || userRequestedProfiles)
			return;

		if (savedProfiles.length === 1) {
			selectProfile(savedProfiles[0]);
		} else if (savedProfiles.length === 0) {
			currentScreen = 'full';
		}
	});
</script>

<svelte:head>
	<title>{isSwitching ? 'Switch Profile' : 'Sign In'} | MunchUp</title>
</svelte:head>

<div
	class="animate-in fade-in relative mx-auto flex h-(--app-height) max-w-md flex-col overflow-hidden bg-background duration-300"
>
	<!-- ── Screen: Initial Loading ── -->
	{#if isInitialLoading}
		<div class="flex flex-1 flex-col items-center justify-center px-5">
			<Loader2 size={24} class="animate-spin text-foreground/30" />
			<p class="mt-4 text-[12px] font-bold tracking-widest text-foreground/30 uppercase">
				Loading profiles...
			</p>
		</div>

		<!-- ── Screen: Saved Profiles (Default) ── -->
	{:else if currentScreen === 'profiles'}
		<div class="flex flex-1 flex-col px-5">
			<div class="mt-2">
				<h1 class="text-[32px] font-black tracking-tight text-primary">MunchUp</h1>
				<p class="text-[13px] font-medium text-foreground/50">Welcome back. Choose an account.</p>
			</div>

			<div class="mt-8 space-y-3">
				{#each savedProfiles as profile (profile.identifier)}
					<button
						onclick={() => selectProfile(profile)}
						class="flex w-full items-center gap-4 rounded-2xl border border-muted/30 bg-card p-4 shadow-[0_2px_12px_rgb(0,0,0,0.04)] transition-all active:scale-[0.98] active:bg-muted/30"
					>
						<div
							class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted/50 text-[18px] font-black text-foreground/60"
						>
							{profile.name?.charAt(0).toUpperCase()}
						</div>
						<div class="flex-1 text-left">
							<span class="block text-[14px] font-bold text-foreground">
								{profile.name || 'Unknown User'}
							</span>
							<span
								class="mt-0.5 block text-[11px] font-medium tracking-wide text-foreground/50 uppercase"
							>
								{profile.identifier}
							</span>
						</div>
						<ChevronRight size={16} strokeWidth={2.5} class="text-foreground/30" />
					</button>
				{/each}
			</div>

			<!-- Side-by-side bottom buttons -->
			<div class="mt-auto mb-2 flex gap-2 rounded-full bg-accent p-1">
				<button
					onclick={() => (currentScreen = 'full')}
					class="flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 font-bold text-background transition-all"
				>
					<ArrowRight size={14} strokeWidth={2.5} />
					Login
				</button>

				<button
					onclick={() => goto(resolve('/register'))}
					class="flex flex-1 items-center justify-center gap-2 rounded-full bg-background py-3.5 font-bold text-foreground transition-all"
				>
					<UserPlus size={14} strokeWidth={2.5} />
					Register
				</button>
			</div>
		</div>

		<!-- ── Screen: PIN Entry (selected profile) ── -->
	{:else if currentScreen === 'pin'}
		<div class="flex flex-1 flex-col px-5 pt-4">
			<div class="flex items-center gap-3">
				<button
					onclick={goBack}
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-foreground transition-transform active:scale-90"
				>
					<ChevronLeft size={18} strokeWidth={2.5} />
				</button>
				<h1 class="text-[20px] font-bold tracking-tight text-foreground">MunchUp</h1>
			</div>

			<div class="mt-12 flex flex-col items-center">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 text-[24px] font-black text-foreground/60"
				>
					{selectedProfile!.name?.charAt(0).toUpperCase()}
				</div>
				<p class="mt-3 text-[16px] font-bold text-foreground">
					{selectedProfile!.name || 'Unknown User'}
				</p>
				<p class="mt-1 text-[11px] font-medium tracking-wide text-foreground/50 uppercase">
					{selectedProfile!.identifier}
				</p>
			</div>

			{#if errorMsg}
				<div
					class="mx-auto mt-6 max-w-xs rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-2.5"
				>
					<p class="text-center text-[11px] font-bold text-destructive">{errorMsg}</p>
				</div>
			{/if}

			<div class="mt-8 flex flex-col items-center">
				<button
					type="button"
					onclick={() => pinInputEl?.focus()}
					class="relative cursor-pointer bg-transparent px-4 py-4 outline-none"
				>
					<div class="flex items-center justify-center gap-4">
						{#each [0, 1, 2, 3] as i (i)}
							<div
								class="flex h-14 w-14 items-center justify-center rounded-2xl border-2 transition-all duration-150 {i <
								pin.length
									? 'scale-105 border-foreground bg-foreground'
									: i === pin.length && !isLoading
										? 'border-foreground/50 bg-muted/30'
										: 'border-muted/40 bg-muted/20'}"
							>
								{#if i < pin.length}
									<div class="h-3 w-3 rounded-full bg-background"></div>
								{/if}
							</div>
						{/each}
					</div>
					<input
						bind:this={pinInputEl}
						type="password"
						inputmode="numeric"
						maxlength="4"
						bind:value={pin}
						class="pointer-events-none absolute inset-0 cursor-default opacity-0"
						autocomplete="current-password"
					/>
				</button>

				{#if isLoading}
					<div class="mt-6 flex items-center gap-2">
						<Loader2 size={14} class="animate-spin text-foreground/50" />
						<span class="text-[11px] font-bold text-foreground/50">Authenticating...</span>
					</div>
				{/if}

				<button
					type="button"
					class="mt-8 flex items-center gap-2 text-[12px] font-bold text-foreground/50 transition-colors active:text-foreground/80"
				>
					<Fingerprint size={15} strokeWidth={2.5} />
					Use Biometrics
				</button>
			</div>
		</div>

		<!-- ── Screen: Full Login Form ── -->
	{:else}
		<div class="flex flex-1 flex-col px-5 pt-4">
			<div class="flex items-center gap-3">
				<button
					onclick={goBack}
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-foreground transition-transform active:scale-90"
				>
					<ChevronLeft size={16} strokeWidth={2.5} />
				</button>
				<div>
					<h1 class="text-[20px] font-bold tracking-tight text-foreground">MunchUp</h1>
					<p class="mt-0.5 text-[13px] font-medium text-foreground/50">
						{isSwitching ? 'Sign in with a different account' : 'Sign in to continue'}
					</p>
				</div>
			</div>

			<form onsubmit={(e) => e.preventDefault()} class="mt-10 space-y-6">
				{#if errorMsg}
					<div class="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
						<p class="text-[11px] font-bold text-destructive">{errorMsg}</p>
					</div>
				{/if}

				<div class="space-y-2">
					<label
						for="identifier"
						class="block text-[10px] font-bold tracking-widest text-foreground/60 uppercase"
					>
						Student ID or Roll No.
					</label>
					<input
						id="identifier"
						type="text"
						bind:value={identifier}
						class="w-full rounded-xl border border-muted/30 bg-muted/40 px-4 py-3 text-[14px] font-bold text-foreground uppercase transition-colors outline-none placeholder:text-foreground/30 focus:border-foreground/30 focus:bg-muted/60"
						placeholder="STU-XXXXX or 10445"
						autocomplete="username"
					/>
				</div>

				<div class="space-y-2">
					<label
						for="full-pin"
						class="block text-[10px] font-bold tracking-widest text-foreground/60 uppercase"
					>
						4-Digit PIN
					</label>
					<input
						id="full-pin"
						bind:this={fullPinInputEl}
						type="password"
						inputmode="numeric"
						maxlength="4"
						bind:value={pin}
						class="w-full rounded-xl border border-muted/30 bg-muted/40 px-4 py-3 font-mono text-[20px] tracking-[0.4em] text-foreground transition-colors outline-none placeholder:text-foreground/20 focus:border-foreground/30 focus:bg-muted/60"
						placeholder="••••"
						autocomplete="current-password"
					/>
				</div>

				<button
					type="submit"
					disabled={!isValid || isLoading}
					class="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-[13px] font-bold text-background transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
				>
					{#if isLoading}
						<Loader2 size={15} class="animate-spin" />
						<span>Authenticating...</span>
					{:else}
						<span>Sign In to Account</span>
						<ArrowRight size={15} />
					{/if}
				</button>

				<button
					type="button"
					class="flex w-full items-center justify-center gap-2.5 rounded-full border border-muted/30 bg-muted/20 py-3 text-[12px] font-bold text-foreground/70 transition-all active:scale-[0.98] active:bg-muted/40"
				>
					<Fingerprint size={15} strokeWidth={2.5} />
					Use Biometrics
				</button>
			</form>

			<div class="mt-auto pt-8 pb-2 text-center">
				<p class="mb-2 text-[10px] font-bold tracking-widest text-foreground/40 uppercase">
					New to Campus?
				</p>
				<button
					onclick={() => goto(resolve('/register'))}
					class="text-[13px] font-bold text-foreground transition-opacity active:opacity-60"
				>
					Create an account →
				</button>
			</div>
		</div>
	{/if}
</div>
