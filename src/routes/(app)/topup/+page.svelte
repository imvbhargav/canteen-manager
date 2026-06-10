<script lang="ts">
	import { resolve } from '$app/paths';
	import { appState } from '$lib/store.svelte';
	import { ArrowLeft, AlertCircle } from 'lucide-svelte';

	let amount: number = $state(0);
	const presets: number[] = [50, 100, 200, 500];

	let newBalance = $derived((appState.wallet?.balance || 0) + amount);
	//let isValid = false;
</script>

<svelte:head><title>Add Funds | MunchUp</title></svelte:head>

<div class="animate-in fade-in absolute inset-0 z-20 flex flex-col bg-background duration-300">
	<header
		class="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 bg-background/15 px-5 backdrop-blur-md"
	>
		<a
			href={resolve('/')}
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-foreground transition-transform active:scale-90"
		>
			<ArrowLeft size={18} strokeWidth={2.5} />
		</a>

		<h2 class="flex-1 text-[20px] font-bold tracking-tight text-foreground">Add Funds</h2>

		<div class="flex w-20 justify-end"></div>
	</header>

	<div class="flex-1 space-y-5 px-5 pt-1">
		<div
			class="flex items-center justify-between rounded-[20px] border border-muted/30 bg-card px-5 py-4 shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
		>
			<span class="text-[10px] font-bold tracking-[0.15em] text-foreground/50 uppercase">
				Current Balance
			</span>
			<span class="text-[14px] font-bold text-foreground">
				₹{appState.wallet?.balance.toFixed(2) || '0.00'}
			</span>
		</div>

		<div class="flex items-start gap-3 rounded-[20px] bg-amber-400/10 px-5 py-4 text-amber-600">
			<AlertCircle size={18} strokeWidth={2.5} class="mt-0.5 shrink-0 text-amber-500" />
			<p class="text-[13px] leading-relaxed font-medium">
				Online top-ups are currently disabled. Funds can only be added through offline mode at the
				canteen counter.
			</p>
		</div>

		<div
			class="pointer-events-none rounded-3xl border border-muted/30 bg-card p-6 opacity-40 shadow-[0_2px_12px_rgb(0,0,0,0.04)] grayscale"
		>
			<p
				class="mb-6 text-center text-[10px] font-bold tracking-[0.15em] text-foreground/40 uppercase"
			>
				Top-up Amount
			</p>
			<div class="mb-8 flex items-baseline justify-center gap-1">
				<span class="text-[24px] font-bold text-foreground/40">₹</span>
				<input
					type="number"
					disabled
					bind:value={amount}
					min="1"
					max="10000"
					class="w-40 border-b-2 border-foreground/10 bg-transparent pb-1 text-center text-[48px] font-black tracking-tight text-foreground transition-colors outline-none"
					placeholder="0"
				/>
			</div>
			<div class="grid grid-cols-4 gap-2">
				{#each presets as preset (preset)}
					<button
						disabled
						class="rounded-full border border-muted/50 bg-card py-2.5 text-[13px] font-bold text-foreground/50"
					>
						₹{preset}
					</button>
				{/each}
			</div>
		</div>

		<div
			class="pointer-events-none overflow-hidden rounded-3xl border border-muted/30 bg-card opacity-40 shadow-[0_2px_12px_rgb(0,0,0,0.04)] grayscale"
		>
			<div class="divide-y divide-muted/20">
				<div class="flex items-center justify-between px-5 py-4">
					<span class="text-[10px] font-bold tracking-[0.15em] text-foreground/50 uppercase">
						Current
					</span>
					<span class="text-[13px] font-bold text-foreground/60">
						₹{appState.wallet?.balance.toFixed(2) || '0.00'}
					</span>
				</div>
				<div class="flex items-center justify-between px-5 py-4">
					<span class="text-[10px] font-bold tracking-[0.15em] text-foreground/50 uppercase">
						Adding
					</span>
					<span class="text-[13px] font-bold text-emerald-500">
						+₹{amount || 0}
					</span>
				</div>
				<div
					class="flex items-center justify-between border-t border-muted/20 bg-muted/10 px-5 py-4"
				>
					<span class="text-[11px] font-bold text-foreground/60">New Balance</span>
					<span class="text-[16px] font-bold text-foreground">
						₹{newBalance.toFixed(2)}
					</span>
				</div>
			</div>
		</div>
	</div>

	<div class="px-5 pt-4 pb-6">
		<button
			disabled
			class="w-full cursor-not-allowed rounded-full bg-muted py-3.5 text-[13px] font-bold text-foreground/40"
		>
			Top-up Disabled
		</button>
	</div>
</div>
