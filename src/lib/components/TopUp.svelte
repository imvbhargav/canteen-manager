<script lang="ts">
  import type { UserWallet } from '$lib/types';
  import { ArrowLeft, AlertCircle } from 'lucide-svelte';

  let {
    wallet,
    onProcessTopUp,
    onCancel
  }: {
    wallet: UserWallet;
    onProcessTopUp: (amount: number) => void;
    onCancel: () => void;
  } = $props();

  let amount: number = $state(0);
  const presets: number[] = [50, 100, 200, 500];

  let newBalance = $derived(wallet.balance + amount);
  
  let isValid = false;
</script>

<div class="flex flex-col h-full animate-in fade-in duration-200">

  <header class="flex items-center gap-3 pb-4 border-b border-border sticky top-0 bg-background z-10 pt-1">
    <button onclick={onCancel} class="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
      <ArrowLeft size={18} />
    </button>
    <div>
      <h2 class="text-base font-semibold text-foreground tracking-tight leading-none">Add Funds</h2>
    </div>
  </header>

  <div class="flex-1 overflow-y-auto py-5 space-y-4">

    <!-- Current balance display -->
    <div class="flex justify-between items-center px-5 py-4 bg-card border border-border">
      <span class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Current Balance</span>
      <span class="font-mono text-sm text-foreground">₹{wallet.balance.toFixed(2)}</span>
    </div>

    <!-- Offline Note -->
    <div class="bg-amber-500/10 border border-amber-500/20 p-4 mx-0 flex items-start gap-3">
      <AlertCircle size={16} class="text-amber-500 shrink-0 mt-0.5" />
      <p class="text-sm text-amber-500/90 leading-relaxed font-light">
        Online top-ups are currently disabled. Funds can only be added through offline mode at the canteen counter.
      </p>
    </div>

    <!-- Amount input (Disabled) -->
    <div class="bg-card border border-border p-6 opacity-40 pointer-events-none grayscale">
      <p class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-5 text-center">Top-up Amount</p>

      <div class="flex items-baseline justify-center gap-2 mb-8">
        <span class="font-mono text-2xl text-muted-foreground">₹</span>
        <input
          type="number"
          disabled
          bind:value={amount}
          min="1"
          max="10000"
          class="font-mono text-5xl font-medium bg-transparent w-40 text-center outline-none text-foreground border-b-2 border-foreground/20 focus:border-foreground pb-1 transition-colors cursor-not-allowed"
          placeholder="0"
        />
      </div>

      <div class="grid grid-cols-4 gap-2">
        {#each presets as preset (preset)}
          <button
            disabled
            class="py-2.5 text-xs font-mono font-medium border transition-all cursor-not-allowed bg-transparent text-muted-foreground border-border"
          >
            ₹{preset}
          </button>
        {/each}
      </div>
    </div>

    <!-- Balance preview (Disabled) -->
    <div class="bg-card border border-border opacity-40 pointer-events-none grayscale">
      <div class="flex justify-between items-center px-5 py-3.5 border-b border-border">
        <span class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Current</span>
        <span class="font-mono text-sm text-muted-foreground">₹{wallet.balance.toFixed(2)}</span>
      </div>
      <div class="flex justify-between items-center px-5 py-3.5 border-b border-border">
        <span class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Adding</span>
        <span class="font-mono text-sm text-emerald-400">+₹{amount || 0}</span>
      </div>
      <div class="flex justify-between items-center px-5 py-4">
        <span class="font-mono text-[10px] uppercase tracking-widest text-foreground/70">New Balance</span>
        <span class="font-mono text-lg font-medium text-foreground">₹{newBalance.toFixed(2)}</span>
      </div>
    </div>

  </div>

  <div class="pt-4 border-t border-border bg-background pb-2">
    <button
      disabled
	  onclick={() => isValid && onProcessTopUp(amount)}
      class="w-full py-3.5 bg-muted text-muted-foreground border border-border text-sm font-medium tracking-wide transition-all cursor-not-allowed"
    >
      Top-up Disabled
    </button>
  </div>

</div>