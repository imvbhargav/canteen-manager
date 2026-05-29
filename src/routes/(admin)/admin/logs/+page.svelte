<script lang="ts">
    import { ArrowLeft, CheckCircle2, Clock, XCircle, Printer, AlertTriangle, Share2, Terminal } from 'lucide-svelte';
    import { resolve } from '$app/paths';
    import type { PageData } from './$types';
    import { invalidateAll } from '$app/navigation';
    import Pusher, { type Channel } from 'pusher-js';
    import { PUBLIC_PUSHER_KEY, PUBLIC_PUSHER_CLUSTER } from '$env/static/public';

    let { data }: { data: PageData } = $props();
    let logs = $derived(data.orderLogs);
    let activeCounters = $derived(data.counters);

    // Track WebSocket status for the UI
    let printerStatus: 'offline' | 'ready' | 'error' = $state('offline');

    interface PusherOrderPayload {
        orderId: string;
        ticketReference: string;
        netTotal: string;
        items: Array<{
            name: string;
            quantity: number;
            unitPrice: string;
            itemTotal: string;
        }>;
    }

    $effect(() => {
        // 1. Check if the local RawBT WebSocket is listening
        testPrinterConnection();

        // 2. Initialize Pusher
        const pusher = new Pusher(PUBLIC_PUSHER_KEY, {
            cluster: PUBLIC_PUSHER_CLUSTER
        });

        const activeChannels: Channel[] = [];

        activeCounters.forEach((counter) => {
            const channel = pusher.subscribe(`counter-${counter.id}`);

            channel.bind('NEW_ORDER', (payload: PusherOrderPayload) => {
                autoPrintViaWebSocket(payload, counter.displayName);
                invalidateAll();
            });

            channel.bind('ORDER_STATUS_UPDATE', () => {
                invalidateAll();
            });

            activeChannels.push(channel);
        });

        return () => {
            activeCounters.forEach((counter) => {
                pusher.unsubscribe(`counter-${counter.id}`);
            });
            pusher.disconnect();
        };
    });

    // Validates if RawBT is running in the background
    function testPrinterConnection() {
        const ws = new WebSocket('ws://127.0.0.1:40213/');
        ws.onopen = () => {
            printerStatus = 'ready';
            ws.close();
        };
        ws.onerror = () => {
            printerStatus = 'error';
        };
    }

    // Sends the payload silently over WebSockets using RawBT JSON API
    function autoPrintViaWebSocket(payload: PusherOrderPayload, counterName: string) {
        // 1. Construct the RawBT JSON Array
        const rawbtElements = [
            {
                type: 'text',
                text: 'BPS CANTEEN\n',
                attributes: {
                    alignment: 'center',
                    bold: true,
                    width: 2,
                    height: 2
                }
            },
            {
                type: 'text',
                text: `Counter ${counterName}\n`,
                attributes: { alignment: 'center', bold: true }
            },
            {
                type: 'text',
                text: '--------------------------------\n'
            },
            {
                type: 'text',
                text: `Order Ref : ${payload.ticketReference}\n`,
                attributes: { bold: true }
            },
            {
                type: 'text',
                text: '--------------------------------\n'
            }
        ];

        // 2. Loop through your cart items and format them
        payload.items.forEach((item) => {
            rawbtElements.push({
                type: 'text',
                text: `${item.quantity}x ${item.name}\n`
            });
            rawbtElements.push({
                type: 'text',
                text: `   Rs ${item.itemTotal}\n`,
                attributes: { bold: true }
            });
        });

        // 3. Add the footer and total
        rawbtElements.push({
            type: 'text',
            text: '--------------------------------\n'
        });
        rawbtElements.push({
            type: 'text',
            text: `TOTAL: Rs ${payload.netTotal}\n`,
            attributes: { alignment: 'right', bold: true, width: 2, height: 2 }
        });
        rawbtElements.push({
            type: 'text',
            text: '--------------------------------\n\n\n'
        });

        // 4. Wrap it in the root JSON object expected by RawBT
        const rawbtJob = {
            attributes: {},
            elements: rawbtElements
        };

        // 5. Connect and fire the JSON string
        const ws = new WebSocket('ws://127.0.0.1:40213/');

        ws.onopen = () => {
            ws.send(JSON.stringify(rawbtJob));
            printerStatus = 'ready';
            ws.close();
        };

        ws.onerror = () => {
            console.error('RawBT WebSocket failed. Is the app running?');
            printerStatus = 'error';
        };
    }

    // TEST 1: RawBT Intent
    function testIntent() {
        const receiptText = "BPS CANTEEN\n--- INTENT TEST ---\nRs 100.00\n\n\n";
        const b64 = btoa(receiptText);
        window.location.href = `intent:RawBT:${b64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
    }

    // TEST 2: WebSocket ArrayBuffer
    function testWS() {
        var socket = new WebSocket("ws://127.0.0.1:40213/");
        
        socket.binaryType = "arraybuffer"; 

        socket.onopen = function() {
            var encoder = new TextEncoder();
            var data = encoder.encode("---- WEBSOCKET TEST ----\nItem 1: Rs 10.00\nTotal:  Rs 10.00\n\nThank you!\n\n\n\n");
            
            socket.send(data);
            alert("Print job sent as binary!");
            socket.close();
        };

        socket.onerror = function() {
            alert("WebSocket Error. Make sure RawBT service is running.");
        };
    }

    // TEST 3: LanShare (Chooser Intent)
    function testLanShare() {
        const receiptText = "BPS CANTEEN\n--- LANSHARE TEST ---\nRs 100.00\n\n\n";
        // Triggers the Android "Share" menu to let you select LanShare or other apps
        const intentUrl = `intent:#Intent;action=android.intent.action.SEND;type=text/plain;S.android.intent.extra.TEXT=${encodeURIComponent(receiptText)};end;`;
        window.location.href = intentUrl;
    }
</script>

<svelte:head><title>Order Logs | Admin</title></svelte:head>

<div class="animate-in fade-in flex h-full flex-col bg-background duration-200">
    <header
        class="flex shrink-0 items-center justify-between bg-background p-4 shadow-sm z-10"
    >
        <div class="flex items-center gap-3">
            <a
                href={resolve('/admin')}
                class="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
                <ArrowLeft size={18} />
            </a>
            <h2 class="text-base leading-none font-semibold tracking-tight text-foreground">
                Order Logs
            </h2>
        </div>

        <div class="flex items-center gap-1.5 pl-4">
            {#if printerStatus === 'ready'}
                <div class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></div>
                <span class="font-mono text-[10px] tracking-wider text-emerald-500 uppercase"
                    >Printer Ready</span
                >
            {:else if printerStatus === 'error'}
                <AlertTriangle size={12} class="text-destructive" />
                <span class="font-mono text-[10px] tracking-wider text-destructive uppercase"
                    >Printer Error</span
                >
            {:else}
                <div class="h-1.5 w-1.5 rounded-full bg-muted-foreground"></div>
                <span class="font-mono text-[10px] tracking-wider text-muted-foreground uppercase"
                    >Checking...</span
                >
            {/if}
        </div>
    </header>

    <div class="shrink-0 border-y border-border bg-card p-3">
        <div class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Terminal size={14} /> Output Tests
        </div>
        <div class="grid grid-cols-3 gap-2">
            <button
                onclick={testIntent}
                class="flex items-center justify-center gap-2 rounded border border-border bg-muted/30 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
            >
                <Printer size={14} /> Intent
            </button>
            <button
                onclick={testWS}
                class="flex items-center justify-center gap-2 rounded border border-border bg-muted/30 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
            >
                <Terminal size={14} /> WS (Binary)
            </button>
            <button
                onclick={testLanShare}
                class="flex items-center justify-center gap-2 rounded border border-border bg-muted/30 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
            >
                <Share2 size={14} /> LanShare
            </button>
        </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
        {#if logs.length === 0}
            <div class="flex flex-col items-center justify-center space-y-3 py-12 text-muted-foreground">
                <Clock size={32} class="opacity-20" />
                <p class="text-sm">No orders processed yet.</p>
            </div>
        {:else}
            <div class="space-y-4">
                {#each logs as log (log.id)}
                    <div class="overflow-hidden border border-border bg-card">
                        <div
                            class="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3"
                        >
                            <div class="flex items-center gap-3">
                                <span class="font-mono text-sm font-semibold tracking-tight text-foreground"
                                    >{log.ticketReference}</span
                                >
                                {#if log.counter}
                                    <span
                                        class="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase"
                                    >
                                        {log.counter.displayName || 'Counter'}
                                    </span>
                                {:else}
                                    <span
                                        class="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-600 uppercase"
                                    >
                                        MANUAL OVERRIDE
                                    </span>
                                {/if}
                            </div>
                            <span class="font-mono text-sm font-medium text-foreground">₹{log.totalAmount}</span>
                        </div>

                        <div class="px-4 py-3">
                            <div class="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                                <span
                                    >Student: <span class="font-mono font-medium text-foreground"
                                        >{log.user?.name || log.user?.studentId || log.userId}</span
                                    ></span
                                >
                                <div class="flex items-center gap-3">
                                    <div class="flex items-center gap-1">
                                        {#if log.status === 'COMPLETED'}
                                            <CheckCircle2 size={12} class="text-emerald-500" />
                                            <span class="text-emerald-500">Completed</span>
                                        {:else if log.status === 'PENDING'}
                                            <Clock size={12} class="text-amber-500" />
                                            <span class="text-amber-500">Pending</span>
                                        {:else}
                                            <XCircle size={12} class="text-destructive" />
                                            <span class="text-destructive">Failed</span>
                                        {/if}
                                    </div>
                                    <div class="h-3 w-px bg-border"></div>
                                    <div class="flex items-center gap-1">
                                        <Printer
                                            size={12}
                                            class={log.printStatus === 'PRINTED'
                                                ? 'text-emerald-500'
                                                : 'text-muted-foreground'}
                                        />
                                        <span
                                            class="font-mono text-[10px] uppercase {log.printStatus === 'PRINTED'
                                                ? 'text-emerald-500'
                                                : ''}"
                                        >
                                            {log.printStatus}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div class="space-y-1.5">
                                {#each log.items as item (item.id)}
                                    <div class="flex items-center justify-between text-sm">
                                        <span class="text-muted-foreground">
                                            {item.quantity}x
                                            <span class="text-foreground">{item.menuItem?.name || 'Unknown Item'}</span>
                                        </span>
                                        <span class="font-mono text-muted-foreground"
                                            >₹{(Number(item.unitPrice) * item.quantity).toFixed(2)}</span
                                        >
                                    </div>
                                {/each}
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>