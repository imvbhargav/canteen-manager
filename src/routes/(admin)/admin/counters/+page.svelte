<script lang="ts">
    import { ArrowLeft, Download, Loader2, QrCode } from 'lucide-svelte';
    import { resolve } from '$app/paths';

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
</script>

<svelte:head><title>Counter QRs | Admin</title></svelte:head>

<div class="animate-in fade-in flex h-full flex-col bg-background duration-200">
    <header class="flex shrink-0 items-center gap-3 border-b border-border bg-background p-4 shadow-sm">
        <a 
            href={resolve("/admin")} 
            class="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
            <ArrowLeft size={18} />
        </a>
        <div class="min-w-0 flex-1">
            <h2 class="text-base leading-none font-semibold tracking-tight text-foreground">Counter QRs</h2>
        </div>
    </header>

    <div class="flex-1 overflow-y-auto p-4 space-y-6">
        <div class="space-y-4">
            <div class="border border-border bg-card p-4">
                <p class="text-sm font-light leading-relaxed text-muted-foreground mb-4">
                    Generate highly-secure encrypted QR stickers. When scanned natively, these appear as gibberish, preventing users from checking out outside of the canteen app.
                </p>
                <button 
                    onclick={fetchCounterQRs} 
                    disabled={isLoading}
                    class="flex w-full items-center justify-center gap-2 bg-foreground py-3 text-sm font-medium text-background transition-transform active:scale-[0.98] disabled:opacity-50"
                >
                    {#if isLoading}
                        <Loader2 size={16} class="animate-spin" /> Generating Assets...
                    {:else}
                        <QrCode size={16} /> Fetch Counter QRs
                    {/if}
                </button>
            </div>

            {#if errorMessage}
                <div class="border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs font-mono tracking-wide text-destructive uppercase">
                    Error: {errorMessage}
                </div>
            {/if}

            {#if counterList.length > 0}
                <div class="space-y-3">
                    {#each counterList as counter (counter.id)}
                        <div class="flex items-center justify-between gap-4 border border-border bg-card p-4">
                            <div class="flex items-center gap-4">
                                <img src={counter.qrImage} alt="Counter QR" class="h-16 w-16 shrink-0 border border-border bg-white p-1" />
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-2">
                                        <span class="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Counter 0{counter.counterNumber}</span>
                                    </div>
                                    <h3 class="mt-0.5 truncate text-sm font-medium text-foreground">{counter.displayName}</h3>
                                    <p class="mt-1 truncate font-mono text-[9px] text-muted-foreground">{counter.id}</p>
                                </div>
                            </div>
                            
                            <button 
                                onclick={() => downloadQR(counter)}
                                class="flex h-10 w-10 shrink-0 items-center justify-center border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                title="Download PNG"
                            >
                                <Download size={16} />
                            </button>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
</div>