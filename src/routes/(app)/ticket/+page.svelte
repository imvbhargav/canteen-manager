<script lang="ts">
	import { appState } from '$lib/store.svelte';
	import { goto } from '$app/navigation';
	import {
		ArrowLeft,
		QrCode,
		ScanLine,
		CheckCircle,
		X,
		Hash,
		ShoppingBag,
		Loader2,
		Home
	} from 'lucide-svelte';
	import jsQR from 'jsqr';
	import type { QRCode } from 'jsqr';
	import { resolve } from '$app/paths';
	import { formatCurrencyINR } from '$lib';

	type ScanState = 'idle' | 'starting' | 'scanning' | 'processing' | 'success' | 'error';
	type FallbackState = 'hidden' | 'open' | 'submitting' | 'confirmed';

	let scanState: ScanState = $state('idle');
	let fallbackState: FallbackState = $state('hidden');
	let manualOrderId: string = $state('');
	let manualError: string = $state('');

	let completedTicket: typeof appState.activeTicket = $state(null);
	let completedTotal: number = $state(0);
	let completedTicketRef: string = $state('');

	let videoEl: HTMLVideoElement | undefined = $state();
	let canvasEl: HTMLCanvasElement | undefined = $state();
	let stream: MediaStream | null = null;
	let animationFrameId: number;

	$effect(() => {
		return () => stopCamera();
	});

	async function startCamera(): Promise<void> {
		scanState = 'starting';
		manualError = '';

		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'environment' }
			});

			scanState = 'scanning';

			setTimeout(() => {
				if (videoEl) {
					videoEl.srcObject = stream;
					videoEl.setAttribute('playsinline', 'true');
					videoEl.play();
					requestAnimationFrame(scanLoop);
				}
			}, 50);
		} catch (err: unknown) {
			console.error(err);
			scanState = 'error';
			manualError = 'Camera access denied. Please use manual entry.';
		}
	}

	function scanLoop(): void {
		if (scanState !== 'scanning' || !videoEl || !canvasEl) return;

		if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
			canvasEl.height = videoEl.videoHeight;
			canvasEl.width = videoEl.videoWidth;
			const ctx: CanvasRenderingContext2D | null = canvasEl.getContext('2d', {
				willReadFrequently: true
			});

			if (ctx) {
				ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
				const imageData: ImageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);

				const code: QRCode | null = jsQR(imageData.data, imageData.width, imageData.height, {
					inversionAttempts: 'dontInvert'
				});

				if (code) {
					const rawData: string = code.data.trim();

					if (rawData.includes(':') && rawData.length > 30) {
						handleSuccessfulScan(rawData);
					} else {
						stopCamera();
						scanState = 'error';
						manualError = 'Invalid QR code. Please scan a valid counter QR.';
					}
					return;
				}
			}
		}
		animationFrameId = requestAnimationFrame(scanLoop);
	}

	async function handleSuccessfulScan(securePayload: string): Promise<void> {
		stopCamera();
		await handleCollected(securePayload);
	}

	function stopCamera(): void {
		if (stream) {
			stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
			stream = null;
		}
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
		}
	}

	function resetScan(): void {
		stopCamera();
		scanState = 'idle';
	}

	function openFallback(): void {
		stopCamera();
		scanState = 'idle';
		fallbackState = 'open';
		manualOrderId = '';
		manualError = '';
	}

	function closeFallback(): void {
		fallbackState = 'hidden';
		manualOrderId = '';
		manualError = '';
	}

	function submitManual(): void {
		if (manualOrderId.trim().toUpperCase() !== appState.activeTicket?.id) {
			manualError = 'Order ID does not match — ask staff to verify';
			return;
		}
		fallbackState = 'submitting';
		setTimeout(async () => {
			fallbackState = 'confirmed';
			await handleCollected('MANUAL_FALLBACK');
		}, 1500);
	}

	async function handleCollected(securePayload: string): Promise<void> {
		if (appState.activeTicket && appState.wallet) {
			scanState = 'processing';
			fallbackState = 'hidden';

			try {
				const payload: { id: string; quantity: number }[] = appState.activeTicket.items.map(
					(i) => ({
						id: i.menuItem.id,
						quantity: i.quantity
					})
				);

				const response: Response = await fetch('/api/checkout', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						cart: payload,
						securePayload: securePayload
					})
				});

				const result: {
					success: boolean;
					error?: string;
					data?: {
						id: string;
						ticketReference: string;
						totalAmount: string;
						status: string;
						printStatus: string;
					};
				} = await response.json();

				if (result.success && result.data) {
					completedTicket = { ...appState.activeTicket };
					completedTotal = Number(result.data.totalAmount);
					completedTicketRef = result.data.ticketReference;

					appState.wallet.balance -= Number(result.data.totalAmount);
					appState.activeTicket = null;

					scanState = 'success';
				} else {
					scanState = 'error';
					manualError = result.error || 'Checkout failed. Please try again.';
				}
			} catch (err: unknown) {
				console.error(err);
				scanState = 'error';
				manualError = 'Network error. Could not connect to the server.';
			}
		}
	}

	function cancelOrder(): void {
		appState.activeTicket = null;
		goto(resolve('/menu'));
	}
</script>

<svelte:head><title>Your Ticket | MunchUp</title></svelte:head>

<div class="animate-in fade-in absolute inset-0 z-20 flex flex-col bg-background duration-300">
	<header
		class="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 bg-background/15 px-5 backdrop-blur-md"
	>
		<a
			href={resolve('/')}
			onclick={stopCamera}
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-foreground transition-transform active:scale-90"
		>
			<ArrowLeft size={18} strokeWidth={2.5} />
		</a>

		<h2 class="flex-1 text-[20px] font-bold tracking-tight text-foreground">Order Ticket</h2>

		<div class="flex w-20 justify-end">
			{#if (appState.activeTicket?.items.length ?? 0) > 0}
				<div class="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5">
					<ShoppingBag size={15} strokeWidth={2.5} class="text-primary" />
					<span class="text-[13px] font-bold text-primary"
						>{appState.activeTicket?.items.length}</span
					>
				</div>
			{/if}
		</div>
	</header>

	<div class="px-5 pt-1 pb-8">
		{#if scanState === 'success' && completedTicket}
			<div class="space-y-3">
				<div
					class="flex flex-col items-center gap-3 rounded-[20px] border border-emerald-500/25 bg-emerald-500/5 p-5 shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
				>
					<div class="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
						<CheckCircle size={26} class="text-emerald-500" strokeWidth={2.5} />
					</div>
					<div class="text-center">
						<h3 class="text-[17px] font-bold text-foreground">Order Confirmed</h3>
						<p
							class="mt-1 font-mono text-[11px] font-bold tracking-widest text-emerald-600 uppercase"
						>
							{formatCurrencyINR(completedTotal)} deducted from wallet
						</p>
					</div>
				</div>

				<div
					class="overflow-hidden rounded-[20px] border border-muted/30 bg-card shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
				>
					<div
						class="flex items-center justify-between border-b border-muted/20 bg-muted/10 px-4 py-2.5"
					>
						<span class="text-[9px] font-bold tracking-[0.15em] text-foreground/50 uppercase">
							Receipt
						</span>
						<span class="text-[11px] font-bold text-foreground/50">{completedTicketRef}</span>
					</div>
					<div class="divide-y divide-muted/20 px-4">
						{#each completedTicket.items as item (item.menuItem.id)}
							<div class="flex items-center justify-between py-2.5">
								<div class="flex items-center gap-2.5">
									<span
										class="flex h-5 w-5 items-center justify-center rounded-md bg-muted text-[11px] font-bold text-foreground/70"
									>
										{item.quantity}
									</span>
									<div class="flex flex-col">
										<span class="text-[13px] font-semibold text-foreground">
											{item.menuItem.name}
										</span>
										<span class="text-[9px] font-bold tracking-widest text-foreground/50 uppercase">
											{item.menuItem.category}
										</span>
									</div>
								</div>
								<span class="font-mono text-[13px] font-bold text-foreground">
									{formatCurrencyINR(item.menuItem.price * item.quantity)}
								</span>
							</div>
						{/each}
					</div>
					<div
						class="flex items-center justify-between border-t border-muted/20 bg-muted/20 px-4 py-3"
					>
						<span class="text-[11px] font-bold text-foreground/60">Total paid</span>
						<span class="font-mono text-[16px] font-bold text-foreground"
							>{formatCurrencyINR(completedTotal)}</span
						>
					</div>
				</div>

				<div class="pt-2">
					<a
						href={resolve('/')}
						class="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[13px] font-bold text-background transition-all active:scale-[0.98]"
					>
						<Home size={15} strokeWidth={2.5} />
						Back to Home
					</a>
				</div>
			</div>
		{:else if appState.activeTicket}
			<div class="space-y-3">
				{#if scanState === 'processing'}
					<div
						class="flex flex-col items-center justify-center gap-5 rounded-[20px] border border-primary/20 bg-primary/5 px-6 py-10 shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
					>
						<div class="relative flex h-16 w-16 items-center justify-center">
							<div
								class="absolute inset-0 animate-ping rounded-full bg-primary/25 duration-1000"
							></div>
							<div
								class="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary/20"
							>
								<Loader2 size={28} class="animate-spin text-primary" strokeWidth={2.5} />
							</div>
						</div>
						<div class="text-center">
							<h3 class="text-[17px] font-bold text-foreground">Processing Payment</h3>
							<p class="mt-1.5 text-[10px] font-bold tracking-widest text-primary/80 uppercase">
								Please hold on
							</p>
						</div>
					</div>
				{:else if scanState === 'idle' || scanState === 'starting' || scanState === 'scanning'}
					<div
						class="flex flex-col items-center gap-3 rounded-[20px] border border-muted/30 bg-card p-4 shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
					>
						<div class="relative aspect-square w-full overflow-hidden rounded-2xl bg-muted/20">
							<canvas bind:this={canvasEl} class="hidden"></canvas>
							<video
								bind:this={videoEl}
								class="absolute inset-0 h-full w-full object-cover opacity-90"
								class:hidden={scanState !== 'scanning'}
								muted
								playsinline
							></video>

							{#if scanState === 'idle'}
								<div class="absolute inset-0 flex items-center justify-center bg-card/60">
									<ScanLine size={48} class="text-foreground/30" strokeWidth={1.5} />
								</div>
								<div
									class="absolute top-4 left-4 h-10 w-10 rounded-tl-2xl border-t-[3px] border-l-[3px] border-foreground/40"
								></div>
								<div
									class="absolute top-4 right-4 h-10 w-10 rounded-tr-2xl border-t-[3px] border-r-[3px] border-foreground/40"
								></div>
								<div
									class="absolute bottom-4 left-4 h-10 w-10 rounded-bl-2xl border-b-[3px] border-l-[3px] border-foreground/40"
								></div>
								<div
									class="absolute right-4 bottom-4 h-10 w-10 rounded-br-2xl border-r-[3px] border-b-[3px] border-foreground/40"
								></div>
							{/if}
							{#if scanState === 'starting'}
								<div
									class="absolute inset-0 flex animate-pulse items-center justify-center bg-card/60"
								>
									<ScanLine size={48} class="text-foreground/30" strokeWidth={1.5} />
								</div>
								<div
									class="absolute top-4 left-4 h-10 w-10 animate-pulse rounded-tl-2xl border-t-[3px] border-l-[3px] border-foreground/40"
								></div>
								<div
									class="absolute top-4 right-4 h-10 w-10 animate-pulse rounded-tr-2xl border-t-[3px] border-r-[3px] border-foreground/40"
								></div>
								<div
									class="absolute bottom-4 left-4 h-10 w-10 animate-pulse rounded-bl-2xl border-b-[3px] border-l-[3px] border-foreground/40"
								></div>
								<div
									class="absolute right-4 bottom-4 h-10 w-10 animate-pulse rounded-br-2xl border-r-[3px] border-b-[3px] border-foreground/40"
								></div>
							{/if}
							{#if scanState === 'scanning'}
								<div
									class="absolute top-4 left-4 h-10 w-10 rounded-tl-2xl border-t-[3px] border-l-[3px] border-emerald-500"
								></div>
								<div
									class="absolute top-4 right-4 h-10 w-10 rounded-tr-2xl border-t-[3px] border-r-[3px] border-emerald-500"
								></div>
								<div
									class="absolute bottom-4 left-4 h-10 w-10 rounded-bl-2xl border-b-[3px] border-l-[3px] border-emerald-500"
								></div>
								<div
									class="absolute right-4 bottom-4 h-10 w-10 rounded-br-2xl border-r-[3px] border-b-[3px] border-emerald-500"
								></div>
							{/if}
						</div>

						{#if scanState === 'idle'}
							<button
								onclick={startCamera}
								class="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-[12px] font-bold text-background transition-all active:scale-[0.98]"
							>
								<ScanLine size={14} strokeWidth={2.5} /> Scan Counter QR
							</button>
						{:else if scanState === 'starting'}
							<p
								class="flex w-full items-center justify-center gap-2 rounded-full bg-muted py-3 text-[12px] font-bold text-foreground transition-all"
							>
								<Loader2 size={14} strokeWidth={2.5} class="animate-spin" /> Accessing Camera
							</p>
						{:else if scanState === 'scanning'}
							<button
								onclick={resetScan}
								class="w-full rounded-full border border-muted/50 bg-card py-3 text-[12px] font-bold text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
							>
								Cancel Scan
							</button>
						{/if}
					</div>
					<div class="flex items-start gap-2 rounded-2xl bg-amber-400/10 px-4 py-3 text-amber-600">
						<span class="text-[12px] leading-relaxed font-medium">
							<strong class="font-mono font-bold"
								>{formatCurrencyINR(appState.activeTicket.total)}</strong
							> will be deducted from your wallet only when you scan the counter QR and collect your order.
						</span>
					</div>
				{:else if scanState === 'error'}
					<div
						class="flex flex-col items-center gap-3 rounded-[20px] border border-destructive/25 bg-destructive/5 p-4 shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
					>
						<div class="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/20">
							<X size={22} class="text-destructive" strokeWidth={2.5} />
						</div>
						<div class="text-center">
							<h3 class="text-[15px] font-bold text-foreground">Scan Failed</h3>
							<p class="mt-0.5 text-[10px] font-bold tracking-widest text-foreground/60 uppercase">
								{manualError || 'Could not read the counter QR'}
							</p>
						</div>
						<button
							onclick={resetScan}
							class="w-full rounded-full border border-muted/50 bg-card py-3 text-[12px] font-bold text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
						>
							Try Again
						</button>
					</div>
				{/if}

				{#if scanState !== 'success' && scanState !== 'processing' && fallbackState !== 'confirmed'}
					<div
						class="overflow-hidden rounded-[20px] border border-muted/30 bg-card shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
					>
						{#if fallbackState === 'hidden'}
							<button
								onclick={openFallback}
								class="flex w-full items-center justify-between px-4 py-3 transition-colors active:bg-muted/30"
							>
								<div class="flex items-center gap-2">
									<Hash size={14} strokeWidth={2.5} class="text-foreground/40" />
									<span class="text-[10px] font-bold tracking-widest text-foreground/60 uppercase">
										Scanner not working?
									</span>
								</div>
								<span class="text-[10px] font-bold tracking-widest text-primary uppercase">
									Manual entry →
								</span>
							</button>
						{:else if fallbackState === 'open'}
							<div class="space-y-3 px-4 py-4">
								<div class="flex items-center justify-between">
									<span class="text-[10px] font-bold tracking-widest text-foreground/60 uppercase">
										Manual Confirmation
									</span>
									<button
										onclick={closeFallback}
										class="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-foreground transition-transform active:scale-90"
									>
										<X size={13} strokeWidth={2.5} />
									</button>
								</div>
								<p class="text-[12px] leading-relaxed font-medium text-foreground/60">
									Tell the counter staff your order number. They will enter it on their terminal to
									confirm your order.
								</p>
								<div class="rounded-[14px] bg-muted/20 px-3 py-3 text-center">
									<p
										class="mb-0.5 text-[9px] font-bold tracking-[0.15em] text-foreground/50 uppercase"
									>
										Your Order ID
									</p>
									<p class="text-[22px] font-black tracking-widest text-foreground uppercase">
										{appState.activeTicket.id}
									</p>
								</div>
								<div class="h-px bg-muted/20"></div>
								<div class="space-y-1.5">
									<p
										class="block text-[9px] font-bold tracking-widest text-foreground/60 uppercase"
									>
										Staff: enter order ID to confirm
									</p>
									<input
										type="text"
										bind:value={manualOrderId}
										placeholder={appState.activeTicket.id}
										class="w-full rounded-xl border border-muted/40 bg-card px-3 py-2.5 text-[13px] font-bold tracking-wider text-foreground uppercase transition-colors outline-none placeholder:text-foreground/30 focus:border-foreground/50"
										oninput={() => (manualError = '')}
									/>
									{#if manualError}
										<p class="text-[10px] font-bold tracking-widest text-destructive uppercase">
											{manualError}
										</p>
									{/if}
								</div>
								<button
									onclick={submitManual}
									class="mt-1 w-full rounded-full bg-primary py-3 text-[12px] font-bold text-background transition-all active:scale-[0.98]"
								>
									Confirm Order
								</button>
							</div>
						{:else if fallbackState === 'submitting'}
							<div class="flex items-center justify-center gap-2.5 px-4 py-4">
								<Loader2 size={14} strokeWidth={2.5} class="animate-spin text-foreground/50" />
								<span class="text-[10px] font-bold tracking-widest text-foreground/60 uppercase">
									Confirming…
								</span>
							</div>
						{:else if fallbackState === 'confirmed'}
							<div class="flex items-center justify-center gap-2 bg-emerald-500/10 px-4 py-4">
								<CheckCircle size={14} strokeWidth={2.5} class="text-emerald-500" />
								<span class="text-[10px] font-bold tracking-widest text-emerald-500 uppercase">
									Confirmed by staff
								</span>
							</div>
						{/if}
					</div>
				{/if}

				<div
					class="overflow-hidden rounded-[20px] border border-muted/30 bg-card shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
				>
					<div
						class="flex items-center justify-between border-b border-muted/20 bg-muted/10 px-4 py-2.5"
					>
						<span class="text-[9px] font-bold tracking-[0.15em] text-foreground/50 uppercase">
							Receipt
						</span>
						<span class="text-[11px] font-bold text-foreground/50">{appState.activeTicket.id}</span>
					</div>
					<div class="divide-y divide-muted/20 px-4">
						{#each appState.activeTicket.items as item (item.menuItem.id)}
							<div class="flex items-center justify-between py-2.5">
								<div class="flex items-center gap-2.5">
									<span
										class="flex h-5 w-5 items-center justify-center rounded-md bg-muted text-[11px] font-bold text-foreground/70"
									>
										{item.quantity}
									</span>
									<div class="flex flex-col">
										<span class="text-[13px] font-semibold text-foreground">
											{item.menuItem.name}
										</span>
										<span class="text-[9px] font-bold tracking-widest text-foreground/50 uppercase">
											{item.menuItem.category}
										</span>
									</div>
								</div>
								<span class="font-mono text-[13px] font-bold text-foreground">
									{formatCurrencyINR(item.menuItem.price * item.quantity)}
								</span>
							</div>
						{/each}
					</div>
					<div
						class="flex items-center justify-between border-t border-muted/20 bg-muted/20 px-4 py-3"
					>
						<span class="text-[11px] font-bold text-foreground/60">Due on collection</span>
						<span class="font-mono text-[16px] font-bold text-foreground"
							>{formatCurrencyINR(appState.activeTicket.total)}</span
						>
					</div>
				</div>

				<div class="pt-2">
					<button
						onclick={cancelOrder}
						class="w-full rounded-full border border-destructive/25 bg-card py-3.5 text-[13px] font-bold text-destructive transition-all active:scale-[0.98]"
					>
						Cancel Order
					</button>
				</div>
			</div>
		{:else}
			<div
				class="mt-6 flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl border border-muted/25 bg-card p-8 text-center shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
			>
				<div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
					<QrCode size={24} strokeWidth={2} class="text-foreground/50" />
				</div>
				<div>
					<h3 class="text-[16px] font-bold text-foreground">No Active Orders</h3>
					<p class="mt-1 text-[13px] font-medium text-foreground/50">
						Place an order from the menu to generate a ticket.
					</p>
				</div>
				<a
					href={resolve('/menu')}
					class="mt-1 rounded-full bg-primary px-5 py-2.5 text-[12px] font-bold text-background transition-all active:scale-95"
				>
					Browse Menu
				</a>
			</div>
		{/if}
	</div>
</div>
