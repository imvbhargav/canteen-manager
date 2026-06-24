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
		Home,
		AlertCircle,
		RefreshCw,
		Clock,
		ShieldCheck
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
			manualError =
				'Camera access denied. Please allow camera permissions or use manual verification.';
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
						manualError =
							'Invalid QR code code structure. Make sure you are scanning the official QR sticker attached to this specific counter.';
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

	async function submitManual(): Promise<void> {
		const sanitizedOtp = manualOrderId.trim();
		if (sanitizedOtp.length !== 6 || isNaN(Number(sanitizedOtp))) {
			manualError = 'Please enter a valid 6-digit confirmation code.';
			return;
		}

		if (!appState.activeTicket) return;

		fallbackState = 'submitting';
		manualError = '';

		try {
			const payloadItems = appState.activeTicket.items.map((i) => ({
				menuItemId: i.menuItem.id,
				quantity: i.quantity
			}));

			const response = await fetch('/api/checkout/manual/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					otpCode: sanitizedOtp,
					items: payloadItems
				})
			});

			const result = await response.json();

			if (response.ok && result.success && result.ticket) {
				fallbackState = 'confirmed';

				completedTicket = { ...appState.activeTicket };
				completedTotal = Number(result.ticket.total);
				completedTicketRef = result.ticket.reference;

				if (appState.wallet) {
					appState.wallet.balance -= completedTotal;
				}
				appState.activeTicket = null;
				scanState = 'success';
			} else {
				fallbackState = 'open';
				manualError =
					result.error || 'Verification code rejected. Double check with counter staff.';
			}
		} catch {
			fallbackState = 'open';
			manualError = 'Network communication failure during token verification.';
		}
	}

	async function handleCollected(securePayload: string): Promise<void> {
		if (appState.activeTicket && appState.wallet) {
			scanState = 'processing';
			fallbackState = 'hidden';

			try {
				const payload = appState.activeTicket.items.map((i) => ({
					id: i.menuItem.id,
					quantity: i.quantity
				}));

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
					};
				} = await response.json();

				if (response.ok && result.success && result.data) {
					completedTicket = { ...appState.activeTicket };
					completedTotal = Number(result.data.totalAmount);
					completedTicketRef = result.data.ticketReference;

					appState.wallet.balance -= Number(result.data.totalAmount);
					appState.activeTicket = null;

					scanState = 'success';
				} else {
					scanState = 'error';
					// Catches engine-off validation faults cleanly from camera scans
					manualError = result.error || 'The system could not finish processing checkout.';
				}
			} catch (err: unknown) {
				console.error(err);
				scanState = 'error';
				manualError = 'Network disconnect detected. Please check your data connection and retry.';
			}
		}
	}

	function cancelOrder(): void {
		appState.activeTicket = null;
		goto(resolve('/menu'));
	}
</script>

<svelte:head><title>Your Ticket | MunchUp</title></svelte:head>

<div
	class="animate-in fade-in absolute inset-0 z-20 flex flex-col overflow-y-auto bg-background duration-300"
>
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
			<div class="space-y-4">
				<div
					class="flex flex-col items-center gap-3 rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6 text-center shadow-sm"
				>
					<div class="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15">
						<Clock size={26} class="animate-pulse text-amber-500" strokeWidth={2.5} />
					</div>
					<div>
						<h3 class="text-[18px] font-bold text-foreground">Order Received</h3>
						<p class="mt-1 max-w-72 text-[12px] leading-relaxed font-medium text-foreground/60">
							Your allocation request has been routed to the kitchen. The transaction finalizes when
							the token slip finishes physical printing.
						</p>
						<p class="mt-3 font-mono text-[11px] font-bold tracking-wider text-amber-600 uppercase">
							{formatCurrencyINR(completedTotal)} Held From Wallet
						</p>
					</div>
				</div>

				<div class="overflow-hidden rounded-3xl border border-muted/30 bg-card shadow-sm">
					<div
						class="flex items-center justify-between border-b border-muted/20 bg-muted/10 px-5 py-3"
					>
						<span class="text-[10px] font-bold tracking-[0.15em] text-foreground/40 uppercase">
							Receipt Token
						</span>
						<span class="font-mono text-[12px] font-bold text-foreground/70"
							>{completedTicketRef}</span
						>
					</div>
					<div class="divide-y divide-muted/15 px-5">
						{#each completedTicket.items as item (item.menuItem.id)}
							<div class="flex items-center justify-between py-3.5">
								<div class="flex items-center gap-3">
									<span
										class="flex h-5 w-5 items-center justify-center rounded-md bg-muted text-[11px] font-bold text-foreground/70"
									>
										{item.quantity}
									</span>
									<div class="flex flex-col">
										<span class="text-[13px] leading-tight font-semibold text-foreground">
											{item.menuItem.name}
										</span>
										<span
											class="mt-0.5 text-[9px] font-bold tracking-wider text-foreground/40 uppercase"
										>
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
						class="flex items-center justify-between border-t border-muted/20 bg-muted/25 px-5 py-3.5"
					>
						<span class="text-[12px] font-bold text-foreground/60">Total Amount Staged</span>
						<span class="font-mono text-[17px] font-bold text-foreground"
							>{formatCurrencyINR(completedTotal)}</span
						>
					</div>
				</div>

				<div
					class="flex items-start gap-3 rounded-2xl border border-emerald-500/10 bg-emerald-500/5 p-4 text-emerald-800"
				>
					<ShieldCheck size={18} class="mt-0.5 shrink-0 text-emerald-600" strokeWidth={2.5} />
					<div class="flex flex-col gap-0.5">
						<span class="text-[11px] font-bold tracking-wider text-emerald-600 uppercase"
							>Failsafe Protection Active</span
						>
						<p class="text-[11px] leading-relaxed font-medium text-emerald-700/90">
							If your network drops, a hardware jam occurs, or the order remains unprinted for more
							than 1 hour, our automated system engine will expire the ticket and safely return the
							full amount back to your wallet ledger.
						</p>
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
			<div class="space-y-4">
				{#if scanState === 'processing'}
					<div
						class="flex flex-col items-center justify-center gap-5 rounded-3xl border border-primary/15 bg-primary/5 px-6 py-12 text-center shadow-sm"
					>
						<div class="relative flex h-16 w-16 items-center justify-center">
							<div
								class="absolute inset-0 animate-ping rounded-full bg-primary/20 duration-1000"
							></div>
							<div
								class="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary/15"
							>
								<Loader2 size={28} class="animate-spin text-primary" strokeWidth={2.5} />
							</div>
						</div>
						<div>
							<h3 class="text-[18px] font-bold text-foreground">Processing Payment</h3>
							<p class="mt-1 text-[10px] font-bold tracking-widest text-primary/70 uppercase">
								Verifying allocations with counter
							</p>
						</div>
					</div>
				{:else if scanState === 'idle' || scanState === 'starting' || scanState === 'scanning'}
					<div
						class="flex flex-col items-center gap-4 rounded-3xl border border-muted/30 bg-card p-4 shadow-sm"
					>
						<div class="relative aspect-square w-full overflow-hidden rounded-2xl bg-muted/10">
							<canvas bind:this={canvasEl} class="hidden"></canvas>
							<video
								bind:this={videoEl}
								class="absolute inset-0 h-full w-full object-cover opacity-90"
								class:hidden={scanState !== 'scanning'}
								muted
								playsinline
							></video>

							{#if scanState === 'idle'}
								<div class="absolute inset-0 flex items-center justify-center bg-card/40">
									<ScanLine size={44} class="text-foreground/20" strokeWidth={1.5} />
								</div>
								<div
									class="absolute top-4 left-4 h-8 w-8 rounded-tl-xl border-t-[3px] border-l-[3px] border-foreground/30"
								></div>
								<div
									class="absolute top-4 right-4 h-8 w-8 rounded-tr-xl border-t-[3px] border-r-[3px] border-foreground/30"
								></div>
								<div
									class="absolute bottom-4 left-4 h-8 w-8 rounded-bl-xl border-b-[3px] border-l-[3px] border-foreground/30"
								></div>
								<div
									class="absolute right-4 bottom-4 h-8 w-8 rounded-br-xl border-r-[3px] border-b-[3px] border-foreground/30"
								></div>
							{/if}
							{#if scanState === 'starting'}
								<div
									class="absolute inset-0 flex animate-pulse items-center justify-center bg-card/40"
								>
									<ScanLine size={44} class="text-foreground/20" strokeWidth={1.5} />
								</div>
								<div
									class="absolute top-4 left-4 h-8 w-8 animate-pulse rounded-tl-xl border-t-[3px] border-l-[3px] border-foreground/30"
								></div>
								<div
									class="absolute top-4 right-4 h-8 w-8 animate-pulse rounded-tr-xl border-t-[3px] border-r-[3px] border-foreground/30"
								></div>
								<div
									class="absolute bottom-4 left-4 h-8 w-8 animate-pulse rounded-bl-xl border-b-[3px] border-l-[3px] border-foreground/30"
								></div>
								<div
									class="absolute right-4 bottom-4 h-8 w-8 animate-pulse rounded-br-xl border-r-[3px] border-b-[3px] border-foreground/30"
								></div>
							{/if}
							{#if scanState === 'scanning'}
								<div
									class="absolute top-4 left-4 h-8 w-8 animate-pulse rounded-tl-xl border-t-[3px] border-l-[3px] border-emerald-500"
								></div>
								<div
									class="absolute top-4 right-4 h-8 w-8 animate-pulse rounded-tr-xl border-t-[3px] border-r-[3px] border-emerald-500"
								></div>
								<div
									class="absolute bottom-4 left-4 h-8 w-8 animate-pulse rounded-bl-xl border-b-[3px] border-l-[3px] border-emerald-500"
								></div>
								<div
									class="absolute right-4 bottom-4 h-8 w-8 animate-pulse rounded-br-xl border-r-[3px] border-b-[3px] border-emerald-500"
								></div>
							{/if}
						</div>

						{#if scanState === 'idle'}
							<button
								onclick={startCamera}
								class="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[13px] font-bold text-background transition-all active:scale-[0.98]"
							>
								<ScanLine size={15} strokeWidth={2.5} /> Scan Counter QR
							</button>
						{:else if scanState === 'starting'}
							<p
								class="flex w-full items-center justify-center gap-2 rounded-full bg-muted py-3.5 text-[13px] font-bold text-foreground/60 transition-all"
							>
								<Loader2 size={15} strokeWidth={2.5} class="animate-spin" /> Fetching Camera Stream
							</p>
						{:else if scanState === 'scanning'}
							<button
								onclick={resetScan}
								class="w-full rounded-full border border-muted bg-card py-3.5 text-[13px] font-bold text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
							>
								Cancel Camera Scan
							</button>
						{/if}
					</div>
					<div
						class="flex items-start gap-2.5 rounded-2xl bg-amber-500/10 px-4 py-3.5 text-amber-700"
					>
						<span class="text-[12px] leading-relaxed font-medium">
							The sum of <strong class="font-mono font-bold"
								>{formatCurrencyINR(appState.activeTicket.total)}</strong
							> will only be subtracted from your balance account setup after scanning the counter validation
							tag.
						</span>
					</div>
				{:else if scanState === 'error'}
					<div
						class="flex flex-col items-stretch gap-4 rounded-3xl border border-destructive/15 bg-destructive/5 p-5 shadow-sm"
					>
						<div class="flex flex-col items-center gap-2.5 text-center">
							<div
								class="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15"
							>
								<AlertCircle size={22} class="text-destructive" strokeWidth={2.5} />
							</div>
							<div>
								<h3 class="text-[16px] font-bold text-foreground">Transaction Blocked</h3>
								<p class="mt-1 text-[13px] font-semibold text-destructive/90">
									{manualError}
								</p>
							</div>
						</div>

						<div class="space-y-2 rounded-xl border border-destructive/10 bg-background/50 p-3.5">
							<h4 class="text-[10px] font-bold tracking-wider text-foreground/50 uppercase">
								Suggested Next Steps
							</h4>
							<ul
								class="list-inside list-disc space-y-1 text-[12px] font-medium text-foreground/70"
							>
								{#if manualError.toLowerCase().includes('offline')}
									<li>Move to an adjacent active counter display point.</li>
									<li>Request a manual verification token sequence from service handlers.</li>
								{:else if manualError.toLowerCase().includes('printer')}
									<li>Inform the staff at this platform about the printing device crash.</li>
									<li>Use manual entry mode to log orders safely.</li>
								{:else if manualError.toLowerCase().includes('funds')}
									<li>Navigate back home and load currency into your active wallet store.</li>
								{:else}
									<li>
										Wipe down your camera lens loop frame clear of smudges and align the target
										square.
									</li>
									<li>Request terminal personnel for an internal OTP override transaction.</li>
								{/if}
							</ul>
						</div>

						<div class="flex flex-col gap-2 pt-1">
							<button
								onclick={resetScan}
								class="flex w-full items-center justify-center gap-1.5 rounded-full bg-primary py-3 text-[12px] font-bold text-background transition-all active:scale-[0.98]"
							>
								<RefreshCw size={13} strokeWidth={2.5} /> Retry Operation
							</button>
							<button
								onclick={openFallback}
								class="w-full rounded-full border border-muted bg-card py-3 text-[12px] font-bold text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
							>
								Switch to Manual Verification
							</button>
						</div>
					</div>
				{/if}

				{#if scanState !== 'success' && scanState !== 'processing' && fallbackState !== 'confirmed'}
					<div class="overflow-hidden rounded-3xl border border-muted/30 bg-card shadow-sm">
						{#if fallbackState === 'hidden'}
							<button
								onclick={openFallback}
								class="flex w-full items-center justify-between px-5 py-3.5 transition-colors active:bg-muted/30"
							>
								<div class="flex items-center gap-2">
									<Hash size={14} strokeWidth={2.5} class="text-foreground/40" />
									<span class="text-[11px] font-bold tracking-wider text-foreground/50 uppercase">
										Scanner hardware issues?
									</span>
								</div>
								<span class="text-[11px] font-bold tracking-wider text-primary uppercase">
									Manual Entry →
								</span>
							</button>
						{:else if fallbackState === 'open'}
							<div class="space-y-4 px-5 py-5">
								<div class="flex items-center justify-between">
									<span class="text-[11px] font-bold tracking-wider text-foreground/50 uppercase">
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
									Provide the counter clerk with your User account sequence. They will emit a
									validation code block to supply below.
								</p>

								<div class="rounded-2xl border border-muted/10 bg-muted/30 px-3 py-3.5 text-center">
									<p
										class="mb-0.5 text-[9px] font-bold tracking-[0.15em] text-foreground/40 uppercase"
									>
										Your Customer Account Reference
									</p>
									<p class="text-[22px] font-black tracking-widest text-foreground uppercase">
										{appState.wallet?.accountNumber}
									</p>
								</div>

								<div class="h-px bg-muted/20"></div>

								<div class="space-y-1.5">
									<label
										for="manualOtpInput"
										class="block text-[10px] font-bold tracking-wider text-foreground/50 uppercase"
									>
										Staff Authorization OTP
									</label>
									<input
										id="manualOtpInput"
										type="text"
										inputmode="numeric"
										pattern="[0-9]*"
										placeholder="000000"
										maxlength="6"
										bind:value={manualOrderId}
										class="w-full rounded-xl border border-muted/60 bg-card px-3 py-2.5 text-center text-[15px] font-bold tracking-[0.25em] text-foreground uppercase transition-colors outline-none placeholder:tracking-normal placeholder:text-foreground/30 focus:border-foreground/60"
										oninput={() => (manualError = '')}
									/>
									{#if manualError}
										<p class="text-[10px] font-bold tracking-wider text-destructive uppercase">
											{manualError}
										</p>
									{/if}
								</div>

								<button
									onclick={submitManual}
									class="mt-1 w-full rounded-full bg-primary py-3.5 text-[13px] font-bold text-background transition-all active:scale-[0.98]"
								>
									Confirm Counter Dispatch
								</button>
							</div>
						{:else if fallbackState === 'submitting'}
							<div class="flex items-center justify-center gap-2.5 px-5 py-5">
								<Loader2 size={14} strokeWidth={2.5} class="animate-spin text-foreground/40" />
								<span class="text-[11px] font-bold tracking-wider text-foreground/50 uppercase">
									Validating Token Ledger…
								</span>
							</div>
						{:else if fallbackState === 'confirmed'}
							<div class="flex items-center justify-center gap-2 bg-emerald-500/10 px-5 py-5">
								<CheckCircle size={14} strokeWidth={2.5} class="text-emerald-500" />
								<span class="text-[11px] font-bold tracking-wider text-emerald-500 uppercase">
									Authorized via Operator Override
								</span>
							</div>
						{/if}
					</div>
				{/if}

				<div class="overflow-hidden rounded-3xl border border-muted/30 bg-card shadow-sm">
					<div
						class="flex items-center justify-between border-b border-muted/20 bg-muted/10 px-5 py-3"
					>
						<span class="text-[10px] font-bold tracking-[0.15em] text-foreground/40 uppercase">
							Staging Summary
						</span>
						<span class="font-mono text-[11px] font-bold text-foreground/40"
							>{appState.activeTicket.id}</span
						>
					</div>
					<div class="divide-y divide-muted/15 px-5">
						{#each appState.activeTicket.items as item (item.menuItem.id)}
							<div class="flex items-center justify-between py-3.5">
								<div class="flex items-center gap-3">
									<span
										class="flex h-5 w-5 items-center justify-center rounded-md bg-muted text-[11px] font-bold text-foreground/70"
									>
										{item.quantity}
									</span>
									<div class="flex flex-col">
										<span class="text-[13px] leading-tight font-semibold text-foreground">
											{item.menuItem.name}
										</span>
										<span
											class="mt-0.5 text-[9px] font-bold tracking-wider text-foreground/40 uppercase"
										>
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
						class="flex items-center justify-between border-t border-muted/20 bg-muted/25 px-5 py-3.5"
					>
						<span class="text-[12px] font-bold text-foreground/60">Amount Pending Collection</span>
						<span class="font-mono text-[17px] font-bold text-foreground"
							>{formatCurrencyINR(appState.activeTicket.total)}</span
						>
					</div>
				</div>

				{#if scanState !== 'processing'}
					<div class="pt-1">
						<button
							onclick={cancelOrder}
							class="w-full rounded-full border border-destructive/20 bg-card py-3.5 text-[13px] font-bold text-destructive transition-all active:scale-[0.98]"
						>
							Cancel Active Order Staging
						</button>
					</div>
				{/if}
			</div>
		{:else}
			<div
				class="mt-8 flex flex-1 flex-col items-center justify-center gap-4 rounded-3xl border border-muted/20 bg-card p-8 text-center shadow-sm"
			>
				<div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/40">
					<QrCode size={24} strokeWidth={2} class="text-foreground/40" />
				</div>
				<div>
					<h3 class="text-[17px] font-bold text-foreground">No Ticket Initiated</h3>
					<p
						class="mx-auto mt-1 max-w-60 text-[13px] leading-relaxed font-medium text-foreground/40"
					>
						Select food and beverage allocations within the store menu to draft your payment route.
					</p>
				</div>
				<a
					href={resolve('/menu')}
					class="mt-2 rounded-full bg-primary px-6 py-3 text-[13px] font-bold text-background shadow-sm transition-all active:scale-95"
				>
					Browse Core Menu
				</a>
			</div>
		{/if}
	</div>
</div>
