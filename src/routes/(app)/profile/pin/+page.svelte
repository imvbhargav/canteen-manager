<script lang="ts">
	import { Loader2, CheckCircle, AlertCircle, User } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { appState } from '$lib/store.svelte';
	import { sanitizeAlphanumeric } from '$lib';
	import SubPageHeader from '$lib/components/SubPageHeader.svelte';

	let pinUpdateStatus: 'IDLE' | 'SAVING' | 'SUCCESS' = $state('IDLE');
	let errorMessage: string | null = $state(null);

	let currentPin = $state('');
	let newPin = $state('');
	let confirmPin = $state('');

	// Updated: Match verification logic constraints against 5-digit alphanumeric keys
	let isPinValid = $derived(
		currentPin.length === 5 && newPin.length === 5 && newPin === confirmPin
	);

	// Clear error message when the user starts typing to correct it
	$effect(() => {
		if (currentPin || newPin || confirmPin) {
			errorMessage = null;
		}
	});

	function handlePinInput(e: Event, currentField: 'current' | 'new' | 'confirm') {
		const target = e.target as HTMLInputElement;
		const sanitized = sanitizeAlphanumeric(target.value);

		if (currentField === 'current') currentPin = sanitized;
		if (currentField === 'new') newPin = sanitized;
		if (currentField === 'confirm') confirmPin = sanitized;
	}

	async function handleUpdatePin() {
		if (!isPinValid || pinUpdateStatus !== 'IDLE') return;

		pinUpdateStatus = 'SAVING';
		errorMessage = null;

		try {
			const res = await fetch('/api/auth/pin', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ currentPin, newPin })
			});

			const data = await res.json();

			if (res.ok && data.success) {
				pinUpdateStatus = 'SUCCESS';
				setTimeout(() => goto(resolve('/profile')), 1000);
			} else {
				pinUpdateStatus = 'IDLE';
				errorMessage = data.error || 'Failed to update PIN';
			}
		} catch (err) {
			console.error(err);
			pinUpdateStatus = 'IDLE';
			errorMessage = 'Network error occurred';
		}
	}
</script>

<svelte:head><title>Change PIN | MunchUp</title></svelte:head>

<div
	class="animate-in fade-in absolute inset-0 z-20 flex flex-col overflow-y-auto bg-background duration-300"
>
	<SubPageHeader title="Change PIN" backHref={resolve('/profile')} />

	<div class="space-y-6 px-5 pt-3">
		{#if appState.wallet}
			<div class="flex items-center gap-4 px-1 pb-1">
				<div
					class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
				>
					<User size={24} strokeWidth={2.5} />
				</div>
				<div>
					<p class="text-[10px] font-bold tracking-[0.15em] text-foreground/50 uppercase">
						Modifying PIN for
					</p>
					<h1 class="text-[18px] font-bold text-foreground">
						{appState.wallet.name}
					</h1>
				</div>
			</div>
		{/if}

		<div
			class="overflow-hidden rounded-3xl border border-muted/30 bg-card p-5 shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
		>
			<div class="space-y-5">
				<div>
					<label
						for="current"
						class="mb-2 block text-[10px] font-bold tracking-[0.15em] text-foreground/50 uppercase"
					>
						Current PIN
					</label>
					<input
						id="current"
						type="text"
						maxlength="5"
						value={currentPin}
						oninput={(e) => handlePinInput(e, 'current')}
						class="w-full rounded-[14px] border border-muted/40 bg-muted/10 px-4 py-3.5 text-center font-mono text-[22px] tracking-[0.3em] text-foreground uppercase transition-colors outline-none focus:border-foreground/50 focus:bg-card {errorMessage
							? 'border-destructive/50 bg-destructive/5 text-destructive focus:border-destructive'
							: ''}"
						placeholder="•••••"
						autocomplete="off"
						autocorrect="off"
						autocapitalize="off"
					/>
				</div>

				<div class="h-px bg-muted/20"></div>

				<div>
					<label
						for="new"
						class="mb-2 block text-[10px] font-bold tracking-[0.15em] text-foreground/50 uppercase"
					>
						New PIN
					</label>
					<input
						id="new"
						type="text"
						maxlength="5"
						value={newPin}
						oninput={(e) => handlePinInput(e, 'new')}
						class="w-full rounded-[14px] border border-muted/40 bg-muted/10 px-4 py-3.5 text-center font-mono text-[22px] tracking-[0.3em] text-foreground uppercase transition-colors outline-none focus:border-foreground/50 focus:bg-card"
						placeholder="•••••"
						autocomplete="off"
						autocorrect="off"
						autocapitalize="off"
					/>
				</div>

				<div>
					<label
						for="confirm"
						class="mb-2 block text-[10px] font-bold tracking-[0.15em] text-foreground/50 uppercase"
					>
						Confirm New PIN
					</label>
					<input
						id="confirm"
						type="text"
						maxlength="5"
						value={confirmPin}
						oninput={(e) => handlePinInput(e, 'confirm')}
						class="w-full rounded-[14px] border px-4 py-3.5 text-center font-mono text-[22px] tracking-[0.3em] uppercase transition-colors outline-none {confirmPin.length ===
							5 && confirmPin !== newPin
							? 'border-destructive/50 bg-destructive/5 text-destructive focus:border-destructive'
							: 'border-muted/40 bg-muted/10 text-foreground focus:border-foreground/50 focus:bg-card'}"
						placeholder="•••••"
						autocomplete="off"
						autocorrect="off"
						autocapitalize="off"
					/>

					{#if confirmPin.length === 5 && confirmPin !== newPin}
						<p
							class="mt-2 text-center text-[10px] font-bold tracking-widest text-destructive uppercase"
						>
							PINs do not match
						</p>
					{/if}
				</div>
			</div>
		</div>

		{#if errorMessage}
			<div
				class="flex items-center justify-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-destructive"
			>
				<AlertCircle size={16} strokeWidth={2.5} />
				<p class="text-[13px] font-bold">{errorMessage}</p>
			</div>
		{/if}

		<div class="pt-2">
			<button
				onclick={handleUpdatePin}
				disabled={!isPinValid || pinUpdateStatus !== 'IDLE'}
				class="flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[13px] font-bold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 {pinUpdateStatus ===
				'SUCCESS'
					? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
					: 'bg-primary text-background shadow-[0_4px_12px_rgba(0,0,0,0.1)]'}"
			>
				{#if pinUpdateStatus === 'SAVING'}
					<Loader2 size={16} strokeWidth={2.5} class="animate-spin text-background" />
					<span>Updating...</span>
				{:else if pinUpdateStatus === 'SUCCESS'}
					<CheckCircle size={16} strokeWidth={2.5} />
					<span>PIN Updated</span>
				{:else}
					Save New PIN
				{/if}
			</button>
		</div>
	</div>
</div>
