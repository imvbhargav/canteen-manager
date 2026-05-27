<script lang="ts">
    import { appState } from '$lib/store.svelte';
    import { goto } from '$app/navigation';
    import { ArrowLeft, QrCode, ScanLine, CheckCircle, X, Hash, ShoppingBag, Loader2 } from 'lucide-svelte';
    import jsQR from 'jsqr';
	import { resolve } from '$app/paths';

    type ScanState = 'idle' | 'starting' | 'scanning' | 'success' | 'error';
    type FallbackState = 'hidden' | 'open' | 'submitting' | 'confirmed';

    let scanState: ScanState = $state('idle');
    let fallbackState: FallbackState = $state('hidden');
    let manualOrderId: string = $state('');
    let manualError: string = $state('');

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
            console.error("Camera access denied or failed:", err);
            scanState = 'error';
            manualError = 'Camera access denied. Please use manual entry.';
        }
    }

    function scanLoop(): void {
        if (scanState !== 'scanning' || !videoEl || !canvasEl) return;

        if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
            canvasEl.height = videoEl.videoHeight;
            canvasEl.width = videoEl.videoWidth;
            const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
            
            if (ctx) {
                ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
                const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
                
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert'
                });

                if (code) {
                    handleSuccessfulScan();
                    return;
                }
            }
        }
        animationFrameId = requestAnimationFrame(scanLoop);
    }

    async function handleSuccessfulScan() {
        stopCamera();
        scanState = 'success';
        await handleCollected();
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
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
            await handleCollected();
        }, 1500);
    }

    async function handleCollected() {
        if (appState.activeTicket && appState.wallet) {
            try {
                const payload = appState.activeTicket.items.map(i => ({ id: i.menuItem.id, quantity: i.quantity }));
                const response = await fetch('/api/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cart: payload })
                });
                const result = await response.json();
                if (result.success) {
                    appState.wallet.balance -= appState.activeTicket.total;
                    appState.activeTicket = { ...appState.activeTicket, status: 'COMPLETED' };
                    appState.activeTicket = null;
                    goto(resolve('/'));
                }
            } catch (err) { console.error(err); }
        }
    }
</script>

<svelte:head><title>Your Ticket | BPS Canteen</title></svelte:head>

<div class="animate-in fade-in flex h-full flex-col duration-200">
    <header class="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background p-4 pt-1">
        <a href={resolve("/")} onclick={stopCamera} class="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ArrowLeft size={18} />
        </a>
        <div class="min-w-0 flex-1">
            <h2 class="text-base leading-none font-semibold tracking-tight text-foreground">Order Ticket</h2>
        </div>
        {#if (appState.activeTicket?.items.length ?? 0) > 0}
            <div class="flex items-center gap-1.5">
                <ShoppingBag size={14} class="text-muted-foreground" />
                <span class="font-mono text-xs text-foreground">{appState.activeTicket?.items.length}</span>
            </div>
        {/if}
    </header>

    <div class="flex-1">
    {#if appState.activeTicket}
        <div class="flex-1 space-y-4 overflow-y-auto p-4">
            <div class="flex items-center">
                <div class="flex items-center gap-2">
                    <div class="flex h-5 w-5 shrink-0 items-center justify-center border border-emerald-500">
                        <div class="h-2 w-2 bg-emerald-500"></div>
                    </div>
                    <span class="font-mono text-[10px] tracking-widest text-emerald-400 uppercase">Placed</span>
                </div>
                <div class="mx-3 h-px flex-1 bg-border"></div>
                <div class="flex items-center gap-2">
                    <div class="flex h-5 w-5 shrink-0 items-center justify-center border {scanState === 'success' || fallbackState === 'confirmed' ? 'border-emerald-500' : 'border-amber-400'}">
                        <div class="h-2 w-2 {scanState === 'success' || fallbackState === 'confirmed' ? 'bg-emerald-500' : 'animate-pulse bg-amber-400'}"></div>
                    </div>
                    <span class="font-mono text-[10px] tracking-widest uppercase {scanState === 'success' || fallbackState === 'confirmed' ? 'text-emerald-400' : 'text-amber-400'}">
                        {scanState === 'success' || fallbackState === 'confirmed' ? 'Collected' : 'Collect'}
                    </span>
                </div>
            </div>

            <div class="flex items-start gap-3 border border-border bg-card px-4 py-3">
                <div class="mt-0.5 h-full w-1 shrink-0 self-stretch bg-amber-400/40"></div>
                <p class="font-mono text-[10px] leading-relaxed tracking-wider text-muted-foreground uppercase">
                    ₹{appState.activeTicket.total} will be deducted from your wallet only when you scan the counter QR and collect your order.
                </p>
            </div>

            {#if scanState === 'idle' || scanState === 'starting' || scanState === 'scanning'}
                <div class="flex flex-col items-center gap-5 border border-border bg-card p-6">
                    <div class="relative aspect-square w-full max-w-xs overflow-hidden bg-black/5">
                        <canvas bind:this={canvasEl} class="hidden"></canvas>
                        <video bind:this={videoEl} class="absolute inset-0 h-full w-full object-cover opacity-80" class:hidden={scanState !== 'scanning'} muted playsinline></video>

                        {#if scanState === 'idle'}
                            <div class="absolute inset-0 flex items-center justify-center bg-card"><ScanLine size={64} class="text-muted-foreground/25" strokeWidth={1} /></div>
                            <div class="absolute top-0 left-0 h-8 w-8 border-t-2 border-l-2 border-foreground/40"></div><div class="absolute top-0 right-0 h-8 w-8 border-t-2 border-r-2 border-foreground/40"></div><div class="absolute bottom-0 left-0 h-8 w-8 border-b-2 border-l-2 border-foreground/40"></div><div class="absolute right-0 bottom-0 h-8 w-8 border-r-2 border-b-2 border-foreground/40"></div>
                        {/if}
                        {#if scanState === 'starting'}
                            <div class="absolute inset-0 flex items-center justify-center bg-card animate-pulse"><ScanLine size={64} class="text-muted-foreground/25" strokeWidth={1} /></div>
                            <div class="absolute top-0 left-0 h-8 w-8 border-t-2 border-l-2 border-foreground/40 animate-pulse"></div><div class="absolute top-0 right-0 h-8 w-8 border-t-2 border-r-2 border-foreground/40 animate-pulse"></div><div class="absolute bottom-0 left-0 h-8 w-8 border-b-2 border-l-2 border-foreground/40 animate-pulse"></div><div class="absolute right-0 bottom-0 h-8 w-8 border-r-2 border-b-2 border-foreground/40 animate-pulse"></div>
                        {/if}
                        {#if scanState === 'scanning'}
                            <div class="absolute top-0 left-0 h-8 w-8 border-t-2 border-l-2 border-emerald-500/80"></div><div class="absolute top-0 right-0 h-8 w-8 border-t-2 border-r-2 border-emerald-500/80"></div><div class="absolute bottom-0 left-0 h-8 w-8 border-b-2 border-l-2 border-emerald-500/80"></div><div class="absolute right-0 bottom-0 h-8 w-8 border-r-2 border-b-2 border-emerald-500/80"></div>
                            <div class="absolute right-3 left-3 h-0.5 animate-[scan_1.5s_ease-in-out_infinite] bg-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                        {/if}
                    </div>

                    {#if scanState === 'idle'}
                        <button onclick={startCamera} class="flex w-full items-center justify-center gap-2 bg-foreground py-3.5 text-sm font-medium tracking-wide text-background transition-all active:scale-[0.98]">
                            <ScanLine size={15} /> Open Camera · Scan Counter QR
                        </button>
                    {:else if scanState === 'starting'}
                        <p class="flex w-full items-center justify-center gap-2 bg-foreground py-3.5 text-sm font-medium tracking-wide text-background transition-all"><Loader2 size={15} class="animate-spin" /> Accessing Camera</p>
                    {:else if scanState === 'scanning'}
                        <button onclick={resetScan} class="w-full border border-border py-3.5 text-xs font-medium tracking-wide text-foreground transition-colors hover:bg-muted">Cancel Scan</button>
                    {/if}
                </div>
            {:else if scanState === 'success'}
                <div class="flex flex-col items-center gap-4 border border-emerald-500/25 bg-card p-6">
                    <div class="flex h-14 w-14 items-center justify-center border border-emerald-500/40"><CheckCircle size={26} class="text-emerald-400" strokeWidth={1.5} /></div>
                    <div class="text-center">
                        <h3 class="text-sm font-medium text-foreground">Order Collected</h3>
                        <p class="mt-1 font-mono text-[10px] tracking-widest text-emerald-400 uppercase">₹{appState.activeTicket.total} deducted from wallet</p>
                    </div>
                </div>
            {:else if scanState === 'error'}
                <div class="flex flex-col items-center gap-4 border border-destructive/25 bg-card p-6">
                    <div class="flex h-14 w-14 items-center justify-center border border-destructive/40"><X size={22} class="text-destructive" /></div>
                    <div class="text-center">
                        <h3 class="text-sm font-medium text-foreground">Scan Failed</h3>
                        <p class="mt-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">{manualError || 'Could not read the counter QR'}</p>
                    </div>
                    <button onclick={resetScan} class="w-full border border-border py-3 text-xs font-medium tracking-wide text-foreground transition-colors hover:bg-muted">Try Again</button>
                </div>
            {/if}

            {#if scanState !== 'success' && fallbackState !== 'confirmed'}
                <div class="overflow-hidden border border-dashed border-border">
                    {#if fallbackState === 'hidden'}
                        <button onclick={openFallback} class="flex w-full items-center justify-between px-4 py-3.5 transition-colors hover:bg-muted/30">
                            <div class="flex items-center gap-2.5"><Hash size={13} class="text-muted-foreground" /><span class="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Scanner not working?</span></div>
                            <span class="font-mono text-[10px] tracking-wider text-foreground/40 uppercase">Manual entry →</span>
                        </button>
                    {:else if fallbackState === 'open'}
                        <div class="space-y-3 px-4 py-4">
                            <div class="flex items-center justify-between">
                                <span class="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Manual Confirmation</span>
                                <button onclick={closeFallback} class="text-muted-foreground hover:text-foreground"><X size={13} /></button>
                            </div>
                            <p class="text-xs leading-relaxed font-light text-muted-foreground">Tell the counter staff your order number. They will enter it on their terminal to confirm your order.</p>
                            <div class="border border-border bg-background px-4 py-3 text-center">
                                <p class="mb-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Your Order ID</p>
                                <p class="font-mono text-2xl font-medium tracking-wider text-foreground">{appState.activeTicket.id}</p>
                            </div>
                            <div class="h-px bg-border"></div>
                            <div class="space-y-2">
                                <p class="block font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Staff: enter order ID to confirm</p>
                                <input type="text" bind:value={manualOrderId} placeholder={appState.activeTicket.id} class="w-full border border-border bg-background px-3 py-2.5 font-mono text-sm tracking-wider text-foreground uppercase transition-colors outline-none placeholder:text-muted-foreground/30 focus:border-foreground/40" oninput={() => (manualError = '')} />
                                {#if manualError}<p class="font-mono text-[10px] tracking-wider text-destructive uppercase">{manualError}</p>{/if}
                            </div>
                            <button onclick={submitManual} class="w-full bg-foreground py-3 text-xs font-medium tracking-wide text-background transition-all active:scale-[0.98]">Confirm Order</button>
                        </div>
                    {:else if fallbackState === 'submitting'}
                        <div class="flex items-center justify-center gap-3 px-4 py-4">
                            <div class="h-4 w-4 animate-spin border border-foreground/30 border-t-foreground"></div>
                            <span class="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Confirming…</span>
                        </div>
                    {:else if fallbackState === 'confirmed'}
                        <div class="flex items-center justify-center gap-2 px-4 py-4">
                            <CheckCircle size={14} class="text-emerald-400" /><span class="font-mono text-[11px] tracking-widest text-emerald-400 uppercase">Confirmed by staff</span>
                        </div>
                    {/if}
                </div>
            {/if}

            <div class="overflow-hidden border border-border bg-card">
                <div class="flex items-center justify-between border-b border-border px-5 py-3">
                    <span class="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Receipt</span>
                    <span class="font-mono text-[10px] text-muted-foreground">{appState.activeTicket.id}</span>
                </div>
                <div class="space-y-3 px-5 py-4">
                    {#each appState.activeTicket.items as item (item.menuItem.id)}
                        <div class="flex items-start justify-between">
                            <div class="flex items-start gap-3">
                                <span class="w-6 shrink-0 pt-px text-right font-mono text-[11px] text-muted-foreground">{item.quantity}×</span>
                                <div>
                                    <span class="text-sm font-medium text-foreground">{item.menuItem.name}</span>
                                    <p class="mt-0.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">{item.menuItem.category}</p>
                                </div>
                            </div>
                            <span class="font-mono text-sm text-foreground">₹{item.menuItem.price * item.quantity}</span>
                        </div>
                    {/each}
                </div>
                <div class="mx-5 border-t border-dashed border-border"></div>
                <div class="flex items-center justify-between px-5 py-4">
                    <span class="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Due on Collection</span>
                    <span class="font-mono text-xl font-medium text-foreground">₹{appState.activeTicket.total}</span>
                </div>
            </div>
        </div>
    {:else}
        <div class="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <div class="flex h-16 w-16 items-center justify-center border border-border"><QrCode size={28} class="text-muted-foreground" strokeWidth={1} /></div>
            <div>
                <h3 class="text-base font-medium text-foreground">No Active Orders</h3>
                <p class="mt-1 text-sm leading-relaxed font-light text-muted-foreground">Place an order from the menu to generate a ticket.</p>
            </div>
        </div>
    {/if}
    </div>
</div>

<style>
    @keyframes scan {
        0% { top: 0.75rem; }
        50% { top: calc(100% - 0.75rem); }
        100% { top: 0.75rem; }
    }
</style>