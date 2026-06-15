<script lang="ts">
	import {
		ArrowRight,
		Loader2,
		ChevronRight,
		User,
		ArrowRightLeft,
		Users,
		Plus,
		Trash2,
		X,
		UserCog
	} from 'lucide-svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { onMount, untrack } from 'svelte';
	import AppLogo from '$lib/components/AppLogo.svelte';

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

	// Friction & Removal States
	let isEditingProfiles: boolean = $state(false);
	let profileToRemove: SavedProfile | null = $state(null);

	let isSwitching: boolean = $derived($page.url.searchParams.get('action') === 'switch');

	// Updated: Alphanumeric validation rule changes (PIN is now 5 characters)
	let isValid: boolean = $derived(identifier.length >= 2 && pin.length === 5);

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

	function saveProfile(id: string, data: { name: string; id: string }): void {
		const name = data.name;
		const idx = savedProfiles.findIndex((p) => p.identifier === id);

		if (idx >= 0) return;

		const entry: SavedProfile = { identifier: id, lastUsed: Date.now(), name };
		savedProfiles.push(entry);
		savedProfiles.sort((a, b) => b.lastUsed - a.lastUsed);

		try {
			localStorage.setItem(PROFILES_KEY, JSON.stringify(savedProfiles));
		} catch {
			/* quota or private mode */
		}
	}

	function removeProfile(profileId: string): void {
		savedProfiles = savedProfiles.filter((p) => p.identifier !== profileId);
		try {
			localStorage.setItem(PROFILES_KEY, JSON.stringify(savedProfiles));
		} catch {
			/* quota or private mode */
		}
		profileToRemove = null;

		if (savedProfiles.length === 0) {
			isEditingProfiles = false;
			currentScreen = 'full';
		}
	}

	function handleProfileClick(profile: SavedProfile): void {
		if (isEditingProfiles) {
			profileToRemove = profile;
		} else {
			selectedProfile = profile;
			identifier = profile.identifier;
			pin = '';
			errorMsg = '';
			currentScreen = 'pin';
			setTimeout(() => pinInputEl?.focus(), 80);
		}
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
			isEditingProfiles = false;
			currentScreen = 'profiles';
		}
	}

	// Sanitize alphanumeric keyboard entries
	function handlePinInput(e: Event) {
		const target = e.target as HTMLInputElement;
		// Strip everything that isn't letters or numbers
		pin = target.value.replace(/[^a-zA-Z0-9]/g, '');
	}

	type LoginResponse = {
		success: boolean;
		error?: string;
		message?: string;
		isDeactivated?: boolean;
		reason?: string;
		role?: 'STUDENT' | 'STAFF' | 'ADMIN';
		data?: { name: string; id: string };
	};

	let deactivationNotice: { show: boolean; reason: string } = $state({
		show: false,
		reason: ''
	});

	async function executeLogin(): Promise<void> {
		if (identifier.length < 2 || pin.length !== 5 || isLoading) return;

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
				saveProfile(data.data.id, data.data);
				await invalidateAll();
				if (data.role === 'ADMIN') {
					await goto(resolve('/admin'));
				} else {
					await goto(resolve('/'));
				}
			} else {
				// If account is deactivated, toggle the custom modal state
				if (data.isDeactivated) {
					deactivationNotice = {
						show: true,
						reason: data.reason || 'Suspended due to validation anomalies.'
					};
				} else {
					errorMsg = data.error || 'Login failed';
				}

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

	// Auto-submit when Alphanumeric PIN reaches exactly 5 characters
	$effect(() => {
		if (pin.length === 5 && identifier.length >= 2) {
			untrack(() => {
				if (!isLoading) executeLogin();
			});
		}
	});

	$effect(() => {
		if (!hasLoadedOnce || isSwitching || currentScreen !== 'profiles' || userRequestedProfiles)
			return;

		if (savedProfiles.length === 1) {
			handleProfileClick(savedProfiles[0]);
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
	{#if isInitialLoading}
		<div class="flex flex-1 flex-col items-center justify-center px-5">
			<Loader2 size={24} class="animate-spin text-foreground/30" />
			<p class="mt-4 text-[12px] font-bold tracking-widest text-foreground/30 uppercase">
				Loading profiles...
			</p>
		</div>
	{:else if currentScreen === 'profiles'}
		<div class="flex flex-1 flex-col px-5">
			<div class="mt-2 flex items-start justify-between gap-4">
				<div>
					<AppLogo />
					<p class="text-[13px] font-medium text-foreground/50">Welcome back. Choose an account.</p>
				</div>

				{#if savedProfiles.length > 0}
					<button
						onclick={() => (isEditingProfiles = !isEditingProfiles)}
						class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold outline-hidden transition-all active:scale-95
                        {isEditingProfiles
							? 'border-destructive/20 bg-destructive/10 text-destructive'
							: 'border-muted/30 bg-muted/40 text-foreground/60'}"
					>
						<UserCog size={13} strokeWidth={2.5} />
						<span>{isEditingProfiles ? 'Done' : 'Manage'}</span>
					</button>
				{/if}
			</div>

			<div class="mt-8 space-y-3">
				{#each savedProfiles as profile (profile.identifier)}
					<button
						onclick={() => handleProfileClick(profile)}
						class="flex w-full items-center gap-4 rounded-2xl border bg-card p-4 shadow-[0_2px_12px_rgb(0,0,0,0.04)] outline-hidden transition-all active:scale-[0.99]
                        {isEditingProfiles
							? 'animate-pulse border-destructive/30 bg-destructive/0 px-4 ring-2 ring-destructive/5'
							: 'border-muted/30 active:bg-muted/30'}"
					>
						<div
							class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[18px] font-black transition-colors
                            {isEditingProfiles
								? 'bg-destructive/10 text-destructive'
								: 'bg-muted/50 text-foreground/60'}"
						>
							{profile.name?.charAt(0).toUpperCase()}
						</div>
						<div class="min-w-0 flex-1 text-left">
							<span class="block truncate text-[14px] font-bold text-foreground">
								{profile.name || 'Unknown User'}
							</span>
							<span
								class="mt-0.5 block text-[11px] font-medium tracking-wide text-foreground/50 uppercase"
							>
								{profile.identifier}
							</span>
						</div>

						{#if isEditingProfiles}
							<div class="scale-110 text-destructive transition-transform duration-150">
								<Trash2 size={16} strokeWidth={2.5} />
							</div>
						{:else}
							<ChevronRight size={16} strokeWidth={2.5} class="text-foreground/30" />
						{/if}
					</button>
				{/each}

				{#if !isEditingProfiles}
					<button
						onclick={() => (currentScreen = 'full')}
						class="flex w-full items-center gap-4 rounded-2xl border border-dashed border-accent/25 bg-card p-4 transition-all active:scale-[0.98] active:bg-muted/30"
					>
						<div
							class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted/50 text-[18px] font-black text-foreground/60"
						>
							<Plus class="h-4 w-4" />
						</div>
						<div class="flex-1 text-left">
							<span class="block text-[14px] font-bold text-foreground"> Add new profile </span>
							<span class="mt-0.5 block text-[11px] font-medium tracking-wide text-foreground/50">
								Login with a different user to save
							</span>
						</div>
					</button>
				{/if}
			</div>
		</div>

		{#if profileToRemove}
			<div
				class="animate-in fade-in zoom-in-95 fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-5 backdrop-blur-xs duration-200"
			>
				<div class="w-full max-w-xs rounded-3xl border border-muted/40 bg-card p-5 shadow-2xl">
					<div class="flex items-center justify-between">
						<h4 class="text-[14px] font-bold text-foreground">Remove Profile?</h4>
						<button
							onclick={() => (profileToRemove = null)}
							class="text-foreground/40 hover:text-foreground"
						>
							<X size={16} strokeWidth={2.5} />
						</button>
					</div>

					<p class="mt-2 text-[12px] leading-relaxed font-medium text-foreground/50">
						Are you sure you want to remove <span class="font-bold text-foreground"
							>{profileToRemove.name || 'this user'}</span
						>
						({profileToRemove.identifier}) from your saved profiles list?
					</p>

					<div class="mt-5 flex gap-2.5">
						<button
							onclick={() => (profileToRemove = null)}
							class="flex-1 rounded-xl border border-muted/30 bg-muted/10 py-2.5 text-[12px] font-bold text-foreground transition-all active:scale-95"
						>
							Cancel
						</button>
						<button
							onclick={() => removeProfile(profileToRemove!.identifier)}
							class="flex-1 rounded-xl bg-destructive py-2.5 text-[12px] font-bold text-background transition-all active:scale-95"
						>
							Confirm Delete
						</button>
					</div>
				</div>
			</div>
		{/if}
	{:else if currentScreen === 'pin'}
		<div class="flex flex-1 flex-col px-5 pt-2">
			<div>
				<AppLogo />
				<p class="text-[13px] font-medium text-foreground/50">
					Enter your 5-digit alphanumeric PIN.
				</p>
			</div>

			<div class="relative mt-12 rounded-2xl bg-linear-to-b from-primary/75 to-transparent p-2">
				<button
					onclick={goBack}
					class="absolute -top-3 -right-3 flex items-center gap-2 rounded-full border-2 border-primary/75 bg-background px-4 py-1 text-xs text-foreground"
				>
					<ArrowRightLeft class="h-4 w-4" />
					<span> Change </span>
				</button>

				<div class="flex items-center justify-between px-2">
					<div class="flex items-center gap-2 rounded-t-2xl px-4 pt-4 pb-8">
						<div
							class="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-[24px] font-black text-primary"
						>
							<User class="h-6 w-6" />
						</div>
						<div>
							<p class="text-xs font-medium tracking-wide text-foreground/50 uppercase">
								{selectedProfile!.identifier}
							</p>
							<p class="-mt-1 font-bold text-foreground">
								{selectedProfile!.name || 'Unknown User'}
							</p>
						</div>
					</div>
				</div>

				<div class="-mt-4 flex flex-col items-center rounded-2xl bg-background">
					<button
						type="button"
						onclick={() => pinInputEl?.focus()}
						class="relative w-full cursor-pointer bg-transparent px-4 py-4 outline-none"
					>
						<div class="flex items-center justify-center gap-2.5">
							{#each [0, 1, 2, 3, 4] as i (i)}
								<div
									class="flex h-12 w-12 items-center justify-center rounded-xl border-2 font-mono text-sm font-bold transition-all duration-150 {i <
									pin.length
										? 'scale-105 border-foreground bg-foreground text-background'
										: i === pin.length && !isLoading
											? 'border-foreground/50 bg-muted/30 text-foreground'
											: 'border-muted/40 bg-muted/20 text-foreground/30'}"
								>
									{#if i < pin.length}
										•
									{/if}
								</div>
							{/each}
						</div>

						<input
							bind:this={pinInputEl}
							type="password"
							maxlength="5"
							value={pin}
							oninput={handlePinInput}
							class="pointer-events-none absolute inset-0 h-full w-full cursor-default uppercase opacity-0"
							autocomplete="current-password"
							autocorrect="off"
						/>
					</button>
				</div>
			</div>

			{#if isLoading}
				<div class="mt-6 flex items-center justify-center gap-2">
					<Loader2 size={14} class="animate-spin text-foreground/50" />
					<span class="text-[11px] font-bold text-foreground/50">Authenticating...</span>
				</div>
			{/if}

			{#if errorMsg}
				<div
					class="mx-auto mt-6 max-w-xs rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-2.5"
				>
					<p class="text-center text-[11px] font-bold text-destructive">{errorMsg}</p>
				</div>
			{/if}
		</div>
	{:else}
		<div class="flex flex-1 flex-col px-5 pt-2">
			<div class="flex items-center gap-3">
				<div>
					<AppLogo />
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
						User ID.
					</label>
					<input
						id="identifier"
						type="text"
						bind:value={identifier}
						class="w-full rounded-xl border border-muted/30 bg-muted/40 px-4 py-3 text-[14px] font-bold text-foreground uppercase transition-colors outline-none placeholder:text-foreground/30 focus:border-foreground/30 focus:bg-muted/60"
						placeholder="BMS10445"
						autocomplete="username"
					/>
				</div>

				<div class="space-y-2">
					<label
						for="full-pin"
						class="block text-[10px] font-bold tracking-widest text-foreground/60 uppercase"
					>
						5-Character Alphanumeric PIN
					</label>
					<input
						id="full-pin"
						bind:this={fullPinInputEl}
						type="password"
						maxlength="5"
						value={pin}
						oninput={handlePinInput}
						class="w-full rounded-xl border border-muted/30 bg-muted/40 px-4 py-3 font-mono text-[18px] tracking-[0.4em] text-foreground uppercase transition-colors outline-none placeholder:text-foreground/20 focus:border-foreground/30 focus:bg-muted/60"
						placeholder="•••••"
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

				{#if savedProfiles.length > 0}
					<button
						onclick={goBack}
						type="button"
						class="flex w-full items-center justify-center gap-2.5 rounded-full border border-muted/30 bg-muted/20 py-3 text-[12px] font-bold text-foreground/70 transition-all active:scale-[0.98] active:bg-muted/40"
					>
						<Users size={15} strokeWidth={2.5} />
						Use existing profiles
					</button>
				{/if}
			</form>

			<div class="mt-auto mb-4 rounded-2xl bg-accent/15 px-2 pt-4 pb-2 text-center">
				<p class="mb-2 text-[10px] font-bold tracking-widest text-foreground/40 uppercase">
					New to Campus?
				</p>
				<button
					onclick={() => goto(resolve('/register'))}
					class="w-full rounded-xl bg-background py-2 text-[13px] font-bold text-foreground transition-opacity active:opacity-60"
				>
					Create an account →
				</button>
			</div>
		</div>
	{/if}
</div>

{#if deactivationNotice.show}
	<div
		class="animate-in fade-in zoom-in-95 fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-5 backdrop-blur-xs duration-200"
	>
		<div class="w-full max-w-xs rounded-3xl border border-muted/40 bg-card p-5 shadow-2xl">
			<div class="flex items-center justify-between">
				<h4 class="text-[14px] font-bold text-destructive">Account Locked Out</h4>
				<button
					onclick={() => (deactivationNotice.show = false)}
					class="text-foreground/40 hover:text-foreground"
				>
					<X size={16} strokeWidth={2.5} />
				</button>
			</div>

			<div class="mt-3.5 rounded-xl border border-destructive/10 bg-destructive/5 p-3">
				<p class="text-[9px] font-bold tracking-widest text-destructive/60 uppercase">
					System Suspension Reason
				</p>
				<p class="mt-0.5 text-[12px] leading-normal font-semibold text-foreground/80">
					{#if deactivationNotice.reason == 'verification'}
						Account pending activation. We are verifying your submitted documents and details.
					{:else}
						{deactivationNotice.reason}
					{/if}
				</p>
			</div>

			<div class="mt-4 space-y-2">
				<p class="text-[10px] font-bold tracking-widest text-foreground/40 uppercase">
					How to Reactivate
				</p>
				<p class="text-[12px] leading-relaxed font-medium text-foreground/60">
					Please visit the <span class="font-bold underline">physical helpdesk counter</span> in person
					to complete identity verification, provide documentation credentials, and clear the pending
					flags on this profile.
				</p>
			</div>

			<div class="mt-5">
				<button
					onclick={() => (deactivationNotice.show = false)}
					class="w-full rounded-xl bg-primary py-2.5 text-[12px] font-bold text-background shadow-sm transition-all active:scale-95"
				>
					Acknowledge
				</button>
			</div>
		</div>
	</div>
{/if}
