<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AppLogo from '$lib/components/AppLogo.svelte';
	import { QrCode, Download, Loader2, LogOut } from 'lucide-svelte';

	type CounterQR = {
		id: string;
		counterNumber: number;
		displayName: string;
		fileName: string;
		qrImage: string;
	};

	let counterList: CounterQR[] = $state([]);
	let isLoading: boolean = $state(false);
	let errorMessage: string = $state('');
	let isLoggingOut: boolean = $state(false);

	async function fetchCounterQRs(): Promise<void> {
		isLoading = true;
		errorMessage = '';

		try {
			const response: Response = await fetch('/api/qr');
			const result = await response.json();

			if (result.success) {
				counterList = result.counters;
			} else {
				errorMessage = result.error || 'Failed to load counter QR codes.';
			}
		} catch (err: unknown) {
			console.error(err);
			errorMessage = 'Network error occurred while fetching QR data.';
		} finally {
			isLoading = false;
		}
	}

	function downloadQR(qr: CounterQR): void {
		const downloadLink = document.createElement('a');
		downloadLink.href = qr.qrImage;
		downloadLink.download = qr.fileName;
		document.body.appendChild(downloadLink);
		downloadLink.click();
		document.body.removeChild(downloadLink);
	}

	async function handleLogout(): Promise<void> {
		if (isLoggingOut) return;
		isLoggingOut = true;

		try {
			const res: Response = await fetch('/api/auth/logout', { method: 'POST' });
			if (res.ok) {
				goto(resolve('/login'));
			} else {
				console.error('Logout failed');
				isLoggingOut = false;
			}
		} catch {
			console.error('Network error during logout');
			isLoggingOut = false;
		}
	}
</script>

<svelte:head><title>Counter QRs | MunchUp Admin</title></svelte:head>

<div class="animate-in fade-in absolute inset-0 z-20 flex flex-col bg-background duration-300">
	<header
		class="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-3 bg-background/15 px-5 backdrop-blur-md"
	>
		<div>
			<AppLogo />
		</div>
		<div class="flex items-center justify-end gap-3">
			<div
				class="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-600"
			>
				<div class="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
				<span class="text-[9px] font-bold tracking-widest uppercase">Online</span>
			</div>

			<button
				onclick={handleLogout}
				disabled={isLoggingOut}
				class="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 text-foreground transition-transform active:scale-90 disabled:opacity-50"
				title="Log Out"
			>
				{#if isLoggingOut}
					<Loader2 size={16} strokeWidth={2.5} class="animate-spin" />
				{:else}
					<LogOut size={16} strokeWidth={2.5} />
				{/if}
			</button>
		</div>
	</header>

	<div class="space-y-6 px-5 pt-4">
		<div class="rounded-3xl border border-muted/30 bg-card p-5 shadow-[0_2px_12px_rgb(0,0,0,0.04)]">
			<p class="mb-5 text-[13px] leading-relaxed font-medium text-foreground/60">
				Generate highly-secure encrypted QR stickers. When scanned natively, these appear as
				gibberish, preventing users from checking out outside of the canteen app.
			</p>
			<button
				onclick={fetchCounterQRs}
				disabled={isLoading}
				class="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[13px] font-bold text-background transition-transform active:scale-[0.98] disabled:opacity-50"
			>
				{#if isLoading}
					<Loader2 size={16} strokeWidth={2.5} class="animate-spin" /> Generating Assets...
				{:else}
					<QrCode size={16} strokeWidth={2.5} /> Fetch Counter QRs
				{/if}
			</button>
		</div>

		{#if errorMessage}
			<div
				class="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-[11px] font-bold tracking-widest text-destructive uppercase"
			>
				Error: {errorMessage}
			</div>
		{/if}

		{#if counterList.length > 0}
			<div class="space-y-3">
				{#each counterList as counter (counter.id)}
					<div
						class="flex items-center justify-between gap-4 rounded-[20px] border border-muted/30 bg-card p-4 shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
					>
						<div class="flex items-center gap-4">
							<div
								class="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-muted/20 bg-white"
							>
								<img src={counter.qrImage} alt="Counter QR" class="h-14 w-14" />
							</div>
							<div class="min-w-0 flex-1">
								<span class="text-[9px] font-bold tracking-[0.15em] text-foreground/40 uppercase">
									Counter 0{counter.counterNumber}
								</span>
								<h3 class="mt-0.5 truncate text-[14px] font-bold text-foreground">
									{counter.displayName}
								</h3>
								<p class="mt-0.5 truncate font-mono text-[9px] font-medium text-foreground/40">
									{counter.id}
								</p>
							</div>
						</div>

						<button
							onclick={() => downloadQR(counter)}
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/40 text-foreground/60 transition-colors hover:text-foreground"
							title="Download PNG"
						>
							<Download size={16} strokeWidth={2.5} />
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
