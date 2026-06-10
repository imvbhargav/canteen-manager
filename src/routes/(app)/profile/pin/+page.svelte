<script lang="ts">
	import { ArrowLeft, Loader2, CheckCircle } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let pinUpdateStatus: 'IDLE' | 'SAVING' | 'SUCCESS' = $state('IDLE');
	let currentPin = $state('');
	let newPin = $state('');
	let confirmPin = $state('');

	let isPinValid = $derived(
		currentPin.length === 4 && newPin.length === 4 && newPin === confirmPin
	);

	async function handleUpdatePin() {
		if (!isPinValid || pinUpdateStatus !== 'IDLE') return;
		pinUpdateStatus = 'SAVING';
		try {
			const res = await fetch('/api/auth/pin', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ currentPin, newPin })
			});
			if (res.ok) {
				pinUpdateStatus = 'SUCCESS';
				setTimeout(() => goto(resolve('/profile')), 1000);
			} else pinUpdateStatus = 'IDLE';
		} catch (err) {
			console.error(err);
			pinUpdateStatus = 'IDLE';
		}
	}
</script>

<svelte:head><title>Change PIN | MunchUp</title></svelte:head>

<div class="animate-in fade-in absolute inset-0 z-20 flex flex-col bg-background duration-300">
	<header
		class="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 bg-background/15 px-5 backdrop-blur-md"
	>
		<a
			href={resolve('/profile')}
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-foreground transition-transform active:scale-90"
		>
			<ArrowLeft size={18} strokeWidth={2.5} />
		</a>

		<h2 class="flex-1 text-[20px] font-bold tracking-tight text-foreground">Change PIN</h2>

		<div class="flex w-20 justify-end"></div>
	</header>

	<div class="space-y-6 px-5 pt-1">
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
						type="password"
						inputmode="numeric"
						maxlength="4"
						bind:value={currentPin}
						class="w-full rounded-[14px] border border-muted/40 bg-muted/10 px-4 py-3.5 text-center font-mono text-[24px] tracking-[0.5em] text-foreground transition-colors outline-none focus:border-foreground/50 focus:bg-card"
						placeholder="••••"
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
						type="password"
						inputmode="numeric"
						maxlength="4"
						bind:value={newPin}
						class="w-full rounded-[14px] border border-muted/40 bg-muted/10 px-4 py-3.5 text-center font-mono text-[24px] tracking-[0.5em] text-foreground transition-colors outline-none focus:border-foreground/50 focus:bg-card"
						placeholder="••••"
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
						type="password"
						inputmode="numeric"
						maxlength="4"
						bind:value={confirmPin}
						class="w-full rounded-[14px] border px-4 py-3.5 text-center font-mono text-[24px] tracking-[0.5em] transition-colors outline-none {confirmPin.length ===
							4 && confirmPin !== newPin
							? 'border-destructive/50 bg-destructive/5 text-destructive focus:border-destructive'
							: 'border-muted/40 bg-muted/10 text-foreground focus:border-foreground/50 focus:bg-card'}"
						placeholder="••••"
					/>
					{#if confirmPin.length === 4 && confirmPin !== newPin}
						<p
							class="mt-2 text-center text-[10px] font-bold tracking-widest text-destructive uppercase"
						>
							PINs do not match
						</p>
					{/if}
				</div>
			</div>
		</div>

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
