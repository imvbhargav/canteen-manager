<script lang="ts">
	import { Wallet, CheckCircle2, Loader2, AlertCircle, LogOut } from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';

	let walletForm = $state({
		identifier: '',
		amount: '',
		provider: 'CASH',
		providerTxnId: ''
	});

	let isWalletSubmitting: boolean = $state(false);
	let walletSuccessMsg: string = $state('');
	let walletErrorMsg: string = $state('');
	let isLoggingOut: boolean = $state(false);

	async function handleWalletTopup(e: Event): Promise<void> {
		e.preventDefault();
		isWalletSubmitting = true;
		walletErrorMsg = '';
		walletSuccessMsg = '';

		try {
			const res: Response = await fetch('/api/wallet/topup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					identifier: walletForm.identifier,
					amount: Number(walletForm.amount),
					provider: walletForm.provider,
					providerTxnId: walletForm.providerTxnId || crypto.randomUUID()
				})
			});

			const data = await res.json();

			if (res.ok && data.success) {
				walletSuccessMsg = `Credited ${data.studentName}. New Balance: ₹${data.newBalance}`;
				walletForm = { identifier: '', amount: '', provider: 'CASH', providerTxnId: '' };
				setTimeout(() => (walletSuccessMsg = ''), 5000);
			} else {
				walletErrorMsg = data.error || 'Failed to process top-up';
			}
		} catch {
			walletErrorMsg = 'Network error occurred';
		} finally {
			isWalletSubmitting = false;
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

<svelte:head><title>Fund Wallet | MunchUp Admin</title></svelte:head>

<div class="animate-in fade-in min-h-full bg-background pb-6 duration-300">
	<header class="flex h-16 shrink-0 items-center gap-3 px-5">
		<div
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-background"
		>
			<Wallet size={16} strokeWidth={2.5} />
		</div>

		<h2 class="flex-1 text-[20px] font-bold tracking-tight text-foreground">Fund Wallet</h2>

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

	<div class="flex-1 px-5 pt-4">
		<form
			onsubmit={handleWalletTopup}
			class="space-y-5 rounded-3xl border border-muted/30 bg-card p-5 shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
		>
			<div class="flex items-start gap-3 rounded-2xl bg-amber-400/10 px-4 py-3 text-amber-600">
				<AlertCircle size={16} strokeWidth={2.5} class="mt-0.5 shrink-0 text-amber-500" />
				<p class="text-[11px] leading-relaxed font-bold tracking-wider uppercase">
					Notice: Wallet top-ups are immutable. Verify the cash amount before committing this
					transaction.
				</p>
			</div>

			{#if walletErrorMsg}
				<div
					class="flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-[13px] font-bold text-destructive"
				>
					<AlertCircle size={16} strokeWidth={2.5} class="shrink-0" />
					<span>{walletErrorMsg}</span>
				</div>
			{/if}

			<div>
				<label
					for="identifier"
					class="mb-2 block text-[10px] font-bold tracking-widest text-foreground/50 uppercase"
					>Student ID / Roll No</label
				>
				<input
					id="identifier"
					type="text"
					bind:value={walletForm.identifier}
					required
					class="w-full rounded-[14px] border border-muted/40 bg-muted/10 px-4 py-3 text-[14px] font-bold text-foreground uppercase transition-colors outline-none placeholder:text-foreground/30 focus:border-foreground/50 focus:bg-card"
					placeholder="e.g. BPS-2024-001"
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<label
						for="topupAmount"
						class="mb-2 block text-[10px] font-bold tracking-widest text-foreground/50 uppercase"
						>Amount (₹)</label
					>
					<input
						id="topupAmount"
						type="number"
						min="1"
						step="0.01"
						bind:value={walletForm.amount}
						required
						class="w-full rounded-[14px] border border-muted/40 bg-muted/10 px-4 py-3 text-[14px] font-bold text-foreground transition-colors outline-none placeholder:text-foreground/30 focus:border-foreground/50 focus:bg-card"
						placeholder="0.00"
					/>
				</div>

				<div>
					<label
						for="provider"
						class="mb-2 block text-[10px] font-bold tracking-widest text-foreground/50 uppercase"
						>Payment Method</label
					>
					<select
						id="provider"
						bind:value={walletForm.provider}
						class="w-full appearance-none rounded-[14px] border border-muted/40 bg-muted/10 px-4 py-3 text-[13px] font-bold text-foreground transition-colors outline-none focus:border-foreground/50 focus:bg-card"
					>
						<option value="CASH">Cash Deposit</option>
						<option value="UPI">UPI Transfer</option>
					</select>
				</div>
			</div>

			<div>
				<label
					for="txnId"
					class="mb-2 block text-[10px] font-bold tracking-widest text-foreground/50 uppercase"
					>Reference/Receipt No. (Optional)</label
				>
				<input
					id="txnId"
					type="text"
					bind:value={walletForm.providerTxnId}
					class="w-full rounded-[14px] border border-muted/40 bg-muted/10 px-4 py-3 text-[14px] font-bold text-foreground transition-colors outline-none placeholder:text-foreground/30 focus:border-foreground/50 focus:bg-card"
					placeholder="Leave blank to auto-generate"
				/>
			</div>

			<button
				type="submit"
				disabled={isWalletSubmitting}
				class="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[13px] font-bold text-background transition-transform active:scale-[0.98] disabled:opacity-50"
			>
				{#if isWalletSubmitting}
					<Loader2 size={16} strokeWidth={2.5} class="animate-spin" /> Processing Ledger...
				{:else if walletSuccessMsg}
					<CheckCircle2 size={16} strokeWidth={2.5} /> {walletSuccessMsg}
				{:else}
					<Wallet size={16} strokeWidth={2.5} /> Credit Account
				{/if}
			</button>
		</form>
	</div>
</div>
