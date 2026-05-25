<script lang="ts">
	import { ArrowLeft, Loader2, Check } from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';

	let name = $state('');
	let studentId = $state('');
	let rollNumber = $state('');
	let pin = $state('');
	let confirmPin = $state('');

	let errorMsg = $state('');
	let isLoading = $state(false);

	let isPinMatching = $derived(pin.length === 4 && pin === confirmPin);
	let isValid = $derived(
		name.length > 2 && studentId.length >= 3 && rollNumber.length >= 2 && isPinMatching
	);

	async function handleRegister(e: Event) {
		e.preventDefault();
		if (!isValid || isLoading) return;

		isLoading = true;
		errorMsg = '';

		try {
			const res = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, studentId, rollNumber, pin })
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

<div class="relative mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-background font-sans">
	<header class="flex items-center justify-between border-b border-border p-5">
		<button
			onclick={() => goto(resolve('/login'))}
			class="flex h-8 w-8 items-center justify-center border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
		>
			<ArrowLeft size={18} />
		</button>
		<span class="font-mono text-[10px] tracking-widest text-muted-foreground uppercase"
			>Setup Profile</span
		>
		<div class="w-8"></div>
	</header>

	<div class="flex-1 overflow-y-auto px-6 py-8">
		<div class="mb-8">
			<h1 class="mb-2 text-2xl leading-none font-bold tracking-tight text-foreground">
				Create Account
			</h1>
			<p class="text-sm leading-relaxed font-light text-muted-foreground">
				Enter your campus details to setup your digital wallet.
			</p>
		</div>

		<form onsubmit={handleRegister} class="space-y-6">
			{#if errorMsg}
				<div class="border border-destructive/20 bg-destructive/10 p-3">
					<p class="font-mono text-[10px] tracking-widest text-destructive uppercase">{errorMsg}</p>
				</div>
			{/if}

			<div class="space-y-2">
				<label
					for="name"
					class="font-mono text-[10px] tracking-widest text-muted-foreground uppercase"
					>Full Name</label
				>
				<input
					id="name"
					type="text"
					bind:value={name}
					class="w-full border-b-2 border-border bg-transparent py-2 text-base font-medium text-foreground transition-colors outline-none placeholder:font-light focus:border-foreground"
					placeholder="e.g. Jane Doe"
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<label
						for="studentId"
						class="font-mono text-[10px] tracking-widest text-muted-foreground uppercase"
						>Student ID</label
					>
					<input
						id="studentId"
						type="text"
						bind:value={studentId}
						class="w-full border-b-2 border-border bg-transparent py-2 font-mono text-base text-foreground uppercase transition-colors outline-none placeholder:font-sans placeholder:font-light focus:border-foreground"
						placeholder="STU-1044"
					/>
				</div>
				<div class="space-y-2">
					<label
						for="rollNumber"
						class="font-mono text-[10px] tracking-widest text-muted-foreground uppercase"
						>Roll No.</label
					>
					<input
						id="rollNumber"
						type="text"
						bind:value={rollNumber}
						class="w-full border-b-2 border-border bg-transparent py-2 font-mono text-base text-foreground transition-colors outline-none placeholder:font-sans placeholder:font-light focus:border-foreground"
						placeholder="10445"
					/>
				</div>
			</div>

			<div class="space-y-6 pt-4">
				<div class="space-y-2">
					<label
						for="pin"
						class="font-mono text-[10px] tracking-widest text-muted-foreground uppercase"
						>Create 4-Digit PIN</label
					>
					<input
						id="pin"
						type="password"
						inputmode="numeric"
						maxlength="4"
						bind:value={pin}
						class="w-full border-b-2 border-border bg-transparent py-2 font-mono text-2xl tracking-[0.5em] text-foreground transition-colors outline-none focus:border-foreground"
						placeholder="••••"
					/>
				</div>

				<div class="space-y-2">
					<div class="flex items-end justify-between">
						<label
							for="confirmPin"
							class="font-mono text-[10px] tracking-widest text-muted-foreground uppercase"
							>Confirm PIN</label
						>
						{#if pin.length === 4 && confirmPin.length > 0 && !isPinMatching}
							<span class="font-mono text-[10px] tracking-widest text-destructive uppercase"
								>Mismatch</span
							>
						{/if}
					</div>
					<input
						id="confirmPin"
						type="password"
						inputmode="numeric"
						maxlength="4"
						bind:value={confirmPin}
						class="w-full border-b-2 border-border bg-transparent py-2 font-mono text-2xl tracking-[0.5em] text-foreground transition-colors outline-none focus:border-foreground {pin.length ===
							4 &&
						confirmPin.length > 0 &&
						!isPinMatching
							? 'border-destructive text-destructive focus:border-destructive'
							: ''}"
						placeholder="••••"
					/>
				</div>
			</div>

			<div class="pt-6">
				<button
					type="submit"
					disabled={!isValid || isLoading}
					class="flex w-full items-center justify-center gap-2 bg-foreground py-4 text-sm font-medium tracking-wide text-background transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
				>
					{#if isLoading}
						<Loader2 size={16} class="animate-spin" />
						Creating Wallet...
					{:else}
						<Check size={16} />
						Create Account
					{/if}
				</button>
			</div>
		</form>
	</div>
</div>
