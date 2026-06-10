<script lang="ts">
	import { ArrowLeft, Loader2, Check } from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	onMount(() => {
		const setHeight = () => {
			document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
		};
		setHeight();
		window.addEventListener('resize', setHeight);
		return () => window.removeEventListener('resize', setHeight);
	});

	let name = $state('');
	let rollNumber = $state('');
	let pin = $state('');
	let confirmPin = $state('');

	let errorMsg = $state('');
	let isLoading = $state(false);

	let isPinMatching = $derived(pin.length === 4 && pin === confirmPin);
	let isValid = $derived(name.length > 2 && rollNumber.length >= 2 && isPinMatching);

	async function handleRegister(e: Event) {
		e.preventDefault();
		if (!isValid || isLoading) return;

		isLoading = true;
		errorMsg = '';

		try {
			const res = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, rollNumber, pin })
			});

			const data = await res.json();

			if (data.success) {
				window.location.href = '/'; // Hard redirect to load server data
			} else {
				errorMsg = data.error || 'Registration failed';
			}
		} catch (err: unknown) {
			console.error('Registration error:', err);
			errorMsg = 'Network error. Please try again.';
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Create Account | MunchUp</title>
	<meta name="description" content="Set up your MunchUp profile and digital wallet." />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div
	class="animate-in fade-in relative mx-auto flex h-(--app-height) max-w-md flex-col overflow-hidden bg-background pb-6 duration-300"
>
	<!-- ── Header ── -->
	<header class="flex h-16 shrink-0 items-center gap-3 px-5">
		<a
			href={resolve('/login')}
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-foreground transition-transform active:scale-90"
		>
			<ArrowLeft size={18} strokeWidth={2.5} />
		</a>

		<h2 class="flex-1 text-[20px] font-bold tracking-tight text-foreground">Create Account</h2>

		<!-- Spacer: fixed width w-20 so header width never changes -->
		<div class="flex w-20 justify-end"></div>
	</header>

	<!-- ── Body ── -->
	<div class="flex-1 overflow-y-auto px-5 pt-1">
		<p class="mb-6 text-[13px] font-medium text-foreground/50">
			Set up your MunchUp profile and digital wallet.
		</p>

		<form onsubmit={handleRegister} class="space-y-5">
			{#if errorMsg}
				<div class="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
					<p class="text-[11px] font-bold text-destructive">{errorMsg}</p>
				</div>
			{/if}

			<div class="space-y-2">
				<label
					for="name"
					class="block text-[10px] font-bold tracking-widest text-foreground/60 uppercase"
				>
					Full Name
				</label>
				<input
					id="name"
					type="text"
					bind:value={name}
					class="w-full rounded-xl border border-muted/30 bg-muted/40 px-4 py-3 text-[14px] font-bold text-foreground transition-colors outline-none placeholder:text-foreground/30 focus:border-foreground/30 focus:bg-muted/60"
					placeholder="e.g. Jane Doe"
					autocomplete="name"
				/>
			</div>

			<div class="space-y-2">
				<label
					for="rollNumber"
					class="block text-[10px] font-bold tracking-widest text-foreground/60 uppercase"
				>
					Roll No.
				</label>
				<input
					id="rollNumber"
					type="text"
					bind:value={rollNumber}
					class="w-full rounded-xl border border-muted/30 bg-muted/40 px-4 py-3 font-mono text-[14px] font-bold text-foreground uppercase transition-colors outline-none placeholder:text-foreground/30 focus:border-foreground/30 focus:bg-muted/60"
					placeholder="10445"
					autocomplete="off"
				/>
			</div>

			<div class="space-y-5 pt-2">
				<div class="space-y-2">
					<label
						for="pin"
						class="block text-[10px] font-bold tracking-widest text-foreground/60 uppercase"
					>
						Create 4-Digit PIN
					</label>
					<input
						id="pin"
						type="password"
						inputmode="numeric"
						maxlength="4"
						bind:value={pin}
						class="w-full rounded-xl border border-muted/30 bg-muted/40 px-4 py-3 font-mono text-[20px] tracking-[0.4em] text-foreground transition-colors outline-none placeholder:text-foreground/20 focus:border-foreground/30 focus:bg-muted/60"
						placeholder="••••"
						autocomplete="new-password"
					/>
				</div>

				<div class="space-y-2">
					<div class="flex items-end justify-between">
						<label
							for="confirmPin"
							class="block text-[10px] font-bold tracking-widest text-foreground/60 uppercase"
						>
							Confirm PIN
						</label>
						{#if pin.length === 4 && confirmPin.length > 0 && !isPinMatching}
							<span class="text-[11px] font-bold text-destructive">Mismatch</span>
						{/if}
					</div>
					<input
						id="confirmPin"
						type="password"
						inputmode="numeric"
						maxlength="4"
						bind:value={confirmPin}
						class="w-full rounded-xl border border-muted/30 bg-muted/40 px-4 py-3 font-mono text-[20px] tracking-[0.4em] text-foreground transition-colors outline-none placeholder:text-foreground/20 focus:border-foreground/30 focus:bg-muted/60 {pin.length ===
							4 &&
						confirmPin.length > 0 &&
						!isPinMatching
							? 'border-destructive/40 bg-destructive/5 text-destructive focus:border-destructive'
							: ''}"
						placeholder="••••"
						autocomplete="new-password"
					/>
				</div>
			</div>

			<button
				type="submit"
				disabled={!isValid || isLoading}
				class="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-[13px] font-bold text-background transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
			>
				{#if isLoading}
					<Loader2 size={15} class="animate-spin" />
					Creating Wallet...
				{:else}
					<Check size={15} />
					Create Account
				{/if}
			</button>
		</form>
	</div>
</div>
