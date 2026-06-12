<script lang="ts">
	import { onMount } from 'svelte';
	import { Info, Loader2, LogOut, Printer, Download, QrCode } from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import AppLogo from '$lib/components/AppLogo.svelte';

	type Counter = {
		id: string;
		counterNumber: number;
		displayName: string;
		printerType: string;
		printerAddress: string | null;
		status: string;
		isActive: boolean;
	};

	let counters: Counter[] = $state([]);
	let isLoading: boolean = $state(true);
	let processingId: string | null = $state(null);
	let isLoggingOut: boolean = $state(false);

	// QR Download States
	let isDownloadingAll: boolean = $state(false);
	let downloadingQrId: string | null = $state(null);

	onMount(() => {
		fetchCounters();
	});

	async function fetchCounters(): Promise<void> {
		isLoading = true;
		try {
			const res: Response = await fetch('/api/counters');
			const data = await res.json();
			if (res.ok && data.success) {
				counters = data.data;
			}
		} catch (err) {
			console.error('Failed to fetch counters', err);
		} finally {
			isLoading = false;
		}
	}

	async function updateCounter(id: string, payload: Partial<Counter>): Promise<void> {
		if (processingId) return;
		processingId = id;

		try {
			const res: Response = await fetch(`/api/counters/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const data = await res.json();

			if (res.ok && data.success) {
				const idx = counters.findIndex((c) => c.id === id);
				if (idx !== -1) {
					counters[idx] = { ...counters[idx], ...payload };
				}
			} else {
				await fetchCounters();
			}
		} catch (err) {
			console.error('Network error while updating counter', err);
		} finally {
			processingId = null;
		}
	}

	// ─── QR Download Logic ───

	function triggerDownload(qrImage: string, fileName: string) {
		const link = document.createElement('a');
		link.href = qrImage;
		link.download = fileName;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	async function downloadSingleQR(id: string) {
		if (downloadingQrId) return;
		downloadingQrId = id;

		try {
			const res = await fetch(`/api/qr?counterId=${id}`);
			const data = await res.json();

			if (data.success && data.counters.length > 0) {
				triggerDownload(data.counters[0].qrImage, data.counters[0].fileName);
			} else {
				console.error(data.error || 'Failed to fetch QR');
			}
		} catch (err) {
			console.error('Network error downloading QR', err);
		} finally {
			downloadingQrId = null;
		}
	}

	async function downloadAllQRs() {
		if (isDownloadingAll) return;
		isDownloadingAll = true;

		try {
			const res = await fetch('/api/qr');
			const data = await res.json();

			if (data.success && data.counters.length > 0) {
				// Loop through and trigger downloads with a slight delay
				// to prevent the browser from blocking multiple popups/downloads
				data.counters.forEach((c: { qrImage: string; fileName: string }, index: number) => {
					setTimeout(() => {
						triggerDownload(c.qrImage, c.fileName);
					}, index * 300);
				});
			}
		} catch (err) {
			console.error('Network error downloading all QRs', err);
		} finally {
			isDownloadingAll = false;
		}
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

<svelte:head><title>Counters | MunchUp Admin</title></svelte:head>

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

	<div class="flex-1 space-y-5 px-5 pt-4 pb-10">
		<div
			class="flex items-start gap-3 rounded-[20px] bg-blue-500/10 px-4 py-4 text-blue-600 shadow-[0_2px_12px_rgb(0,0,0,0.02)]"
		>
			<Info size={18} strokeWidth={2.5} class="mt-0.5 shrink-0 text-blue-500" />
			<div class="space-y-1">
				<p class="text-[11px] font-bold tracking-[0.15em] text-blue-600 uppercase">
					Printer Hub App Required
				</p>
				<p class="text-[13px] leading-relaxed font-medium text-blue-600/80">
					To register a new counter, install and log into the <strong>Printer Hub</strong> Android application
					on the target device. It will automatically connect, sync hardware details, and appear in this
					list.
				</p>
			</div>
		</div>

		<div class="flex items-center justify-between pt-2">
			<h3 class="text-[17px] font-bold tracking-tight text-foreground">Active Counters</h3>
			<button
				onclick={downloadAllQRs}
				disabled={isDownloadingAll || counters.length === 0}
				class="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-background transition-transform active:scale-95 disabled:opacity-50"
			>
				{#if isDownloadingAll}
					<Loader2 size={12} strokeWidth={3} class="animate-spin" /> Fetching...
				{:else}
					<Download size={12} strokeWidth={3} /> All QRs
				{/if}
			</button>
		</div>

		<div class="space-y-3">
			{#if isLoading}
				{#each Array.from({ length: 3 }, (_, i) => i) as i (i)}
					<div
						class="flex animate-pulse flex-col gap-4 rounded-[20px] border border-muted/30 bg-card p-4"
					>
						<div class="flex items-center gap-3">
							<div class="h-10 w-10 rounded-xl bg-muted/40"></div>
							<div class="flex-1 space-y-2">
								<div class="h-4 w-32 rounded-full bg-muted/60"></div>
								<div class="h-3 w-16 rounded-full bg-muted/40"></div>
							</div>
						</div>
					</div>
				{/each}
			{:else if counters.length > 0}
				{#each counters as counter (counter.id)}
					<div
						class="relative overflow-hidden rounded-[20px] border border-muted/30 bg-card p-4 shadow-[0_2px_12px_rgb(0,0,0,0.04)] transition-all hover:border-muted/50 {counter.isActive
							? ''
							: 'opacity-60'}"
					>
						{#if processingId === counter.id}
							<div
								class="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[1px]"
							>
								<Loader2 size={24} strokeWidth={2.5} class="animate-spin text-foreground" />
							</div>
						{/if}

						<div class="flex items-start justify-between gap-3">
							<div class="flex items-center gap-3.5">
								<div
									class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
								>
									<Printer size={20} strokeWidth={2.5} />
								</div>
								<div class="min-w-0">
									<p class="-mb-1 text-[10px] text-accent/50">
										{counter.printerType === 'BT' ? 'Bluetooth' : counter.printerType}
									</p>
									<h3 class="truncate text-[15px] font-bold text-foreground">
										{counter.displayName}
									</h3>
									<p
										class="mt-0.5 font-mono text-[10px] font-bold tracking-widest text-foreground/40 uppercase"
									>
										Counter {String(counter.counterNumber).padStart(2, '0')}
									</p>
								</div>
							</div>

							<div class="flex shrink-0 items-center gap-3">
								<button
									onclick={() => downloadSingleQR(counter.id)}
									disabled={downloadingQrId === counter.id}
									class="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 text-foreground transition-colors hover:bg-muted disabled:opacity-50"
									title="Download Counter QR"
								>
									{#if downloadingQrId === counter.id}
										<Loader2 size={14} strokeWidth={2.5} class="animate-spin" />
									{:else}
										<QrCode size={14} strokeWidth={2.5} />
									{/if}
								</button>

								<button
									onclick={() => updateCounter(counter.id, { isActive: !counter.isActive })}
									class="flex h-6.5 w-11 items-center rounded-full p-1 transition-colors duration-200 {counter.isActive
										? 'bg-primary'
										: 'bg-muted/60'}"
									aria-label="Toggle Counter Active Status"
								>
									<div
										class="h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 {counter.isActive
											? 'translate-x-4.5'
											: 'translate-x-0'}"
									></div>
								</button>
							</div>
						</div>

						<div class="mt-4 flex items-center justify-between border-t border-muted/20 pt-4">
							<div class="flex items-center gap-2">
								<span class="text-[10px] font-bold tracking-[0.15em] text-foreground/50 uppercase">
									State
								</span>
								<select
									value={counter.status || 'ONLINE'}
									onchange={(e) => updateCounter(counter.id, { status: e.currentTarget.value })}
									disabled={!counter.isActive}
									class="appearance-none rounded-lg border border-muted/40 bg-muted/10 px-2.5 py-1.5 text-[11px] font-bold text-primary transition-colors outline-none focus:border-foreground/50 disabled:opacity-50"
								>
									<option value="ACTIVE">Active</option>
									<option value="PRINTER_ISSUE">Printer Issue</option>
									<option value="OFFLINE">Offline</option>
								</select>
							</div>

							<p class="max-w-32.5 truncate font-mono text-[10px] font-medium text-foreground/40">
								{counter.printerAddress || 'Unlinked'}
							</p>
						</div>
					</div>
				{/each}
			{:else}
				<div class="rounded-2xl border border-muted/25 bg-card py-12 text-center">
					<div
						class="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/60"
					>
						<Printer size={18} strokeWidth={1.75} class="text-foreground/30" />
					</div>
					<p class="text-[13px] font-medium text-foreground/40">No counters registered yet.</p>
				</div>
			{/if}
		</div>
	</div>
</div>
