<script lang="ts">
  import type { UserWallet } from '$lib/types';
  import { 
    Bell, Shield, LogOut, ChevronRight, History, CreditCard, Wallet,
    ArrowLeft, ArrowDownLeft, ArrowUpRight, KeyRound, Fingerprint, Smartphone,
    Check, Loader2
  } from 'lucide-svelte';

  let {
    wallet,
    onLogout,
    onTopUp,
    onBack
  }: {
    wallet: UserWallet;
    onLogout: () => void;
    onTopUp: () => void;
		onBack: () => void;
  } = $props();

  type ProfileView = 'MAIN' | 'HISTORY' | 'SECURITY' | 'NOTIFICATIONS' | 'CHANGE_PIN';
  
  type Transaction = {
    id: string;
    type: 'credit' | 'debit';
    title: string;
    date: string;
    amount: number;
  };

  let currentView: ProfileView = $state('MAIN');
  let biometricsEnabled: boolean = $state(true);
  let notifyOrders: boolean = $state(true);
  let notifyWallet: boolean = $state(true);
  let notifyPromo: boolean = $state(false);

  let deviceSignOutStatus: 'IDLE' | 'LOADING' | 'SUCCESS' = $state('IDLE');
  let pinUpdateStatus: 'IDLE' | 'SAVING' | 'SUCCESS' = $state('IDLE');

  let currentPin: string = $state('');
  let newPin: string = $state('');
  let confirmPin: string = $state('');

  let transactions: Transaction[] = $state([]);
  let isLoadingHistory: boolean = $state(true);

  let isPinValid: boolean = $derived(
    currentPin.length === 4 && 
    newPin.length === 4 && 
    newPin === confirmPin
  );

  $effect(() => {
    if (currentView === 'HISTORY' && transactions.length === 0) {
      isLoadingHistory = true;
      fetch('/api/wallet/history')
        .then((res: Response) => res.json())
        .then((data: { success: boolean; data: { id: string; type: string; description: string; createdAt: string; amount: string }[] }) => {
          if (data.success) {
            transactions = data.data.map((tx) => ({
              id: tx.id,
              type: tx.type === 'CREDIT' ? 'credit' : 'debit',
              title: tx.description,
              date: new Date(tx.createdAt).toLocaleString(),
              amount: Number(tx.amount)
            }));
          }
        })
        .catch((err: unknown) => {
          console.error('Failed to fetch transactions:', err);
        })
        .finally(() => {
            isLoadingHistory = false;
        });
    } else if (currentView === 'HISTORY' && transactions.length > 0) {
        isLoadingHistory = false;
    }
  });

  async function handleSignOutDevices(): Promise<void> {
    if (deviceSignOutStatus !== 'IDLE') return;
    deviceSignOutStatus = 'LOADING';
    
    try {
      const res: Response = await fetch('/api/auth/logout-devices', { method: 'POST' });
      if (res.ok) {
        deviceSignOutStatus = 'SUCCESS';
        setTimeout(() => {
          deviceSignOutStatus = 'IDLE';
        }, 3000);
      } else {
        deviceSignOutStatus = 'IDLE';
      }
    } catch (err: unknown) {
      console.error('Failed to sign out devices:', err);
      deviceSignOutStatus = 'IDLE';
    }
  }

  async function handleUpdatePin(): Promise<void> {
    if (!isPinValid || pinUpdateStatus !== 'IDLE') return;
    pinUpdateStatus = 'SAVING';
    
    try {
      const res: Response = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin, newPin })
      });
      
      if (res.ok) {
        pinUpdateStatus = 'SUCCESS';
        setTimeout(() => {
          currentPin = '';
          newPin = '';
          confirmPin = '';
          pinUpdateStatus = 'IDLE';
          currentView = 'SECURITY';
        }, 1000);
      } else {
        pinUpdateStatus = 'IDLE';
      }
    } catch (err: unknown) {
      console.error('Failed to update PIN:', err);
      pinUpdateStatus = 'IDLE';
    }
  }

  async function executeLogout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      onLogout();
    } catch (err: unknown) {
      console.error('Failed to execute logout:', err);
    }
  }
</script>

<div class="flex flex-col h-full animate-in fade-in duration-200">

  {#if currentView === 'MAIN'}
    <header
		class="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background pt-1 pb-4"
	>
		<button
    onclick={onBack}
			class="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
		>
			<ArrowLeft size={18} />
		</button>
		<div class="min-w-0 flex-1">
			<h2 class="text-base leading-none font-semibold tracking-tight text-foreground">
				Profile
			</h2>
		</div>
	</header>

    <div class="flex-1 overflow-y-auto py-5 space-y-4 pb-6 animate-in slide-in-from-left-2 duration-300">
      <div class="bg-card border border-border p-5 flex items-center gap-4">
        <div class="w-12 h-12 border border-border flex items-center justify-center shrink-0">
          <span class="font-mono text-lg font-medium text-foreground">{wallet.name.charAt(0)}</span>
        </div>
        <div class="min-w-0">
          <h3 class="text-base font-semibold text-foreground tracking-tight leading-none">{wallet.name}</h3>
          <div class="flex items-center gap-3 mt-1.5">
            <span class="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{wallet.studentId}</span>
            <span class="w-px h-3 bg-border"></span>
            <span class="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Roll {wallet.rollNumber}</span>
          </div>
        </div>
      </div>

      <div class="bg-card border border-border overflow-hidden">
        <div class="px-5 py-3 border-b border-border flex items-center gap-2">
          <Wallet size={12} class="text-muted-foreground" />
          <span class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Campus Wallet</span>
        </div>

        <div class="px-5 py-5">
          <div class="mb-5">
            <span class="font-mono text-muted-foreground text-sm mr-1">₹</span>
            <span class="text-4xl font-semibold text-foreground tracking-tight">{wallet.balance.toFixed(2)}</span>
          </div>
          <button
            onclick={onTopUp}
            class="w-full py-3 border border-border text-foreground text-xs font-medium tracking-wide flex items-center justify-center gap-2 hover:bg-muted transition-colors active:scale-[0.98]"
          >
            <CreditCard size={13} />
            Top Up Wallet
          </button>
        </div>
      </div>

      <div>
        <p class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 px-1">Account</p>

        <div class="bg-card border border-border divide-y divide-border">
          <button 
            onclick={() => currentView = 'HISTORY'}
            class="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors active:scale-[0.99]"
          >
            <div class="flex items-center gap-3">
              <History size={15} class="text-muted-foreground" />
              <span class="text-sm text-foreground">Transaction History</span>
            </div>
            <ChevronRight size={14} class="text-muted-foreground" />
          </button>

          <button 
            onclick={() => currentView = 'NOTIFICATIONS'}
            class="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors active:scale-[0.99]"
          >
            <div class="flex items-center gap-3">
              <Bell size={15} class="text-muted-foreground" />
              <span class="text-sm text-foreground">Notifications</span>
            </div>
            <span class="font-mono text-[10px] uppercase tracking-wider {notifyOrders || notifyWallet ? 'text-emerald-400 border-emerald-400/30' : 'text-muted-foreground border-border'} border px-2 py-1">
              {notifyOrders || notifyWallet ? 'On' : 'Off'}
            </span>
          </button>

          <button 
            onclick={() => currentView = 'SECURITY'}
            class="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors active:scale-[0.99]"
          >
            <div class="flex items-center gap-3">
              <Shield size={15} class="text-muted-foreground" />
              <span class="text-sm text-foreground">Security & PIN</span>
            </div>
            <ChevronRight size={14} class="text-muted-foreground" />
          </button>
        </div>
      </div>

      <div class="flex justify-between items-center px-1">
        <span class="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">Nexus Bites v2.1.0</span>
        <span class="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">Shivamogga</span>
      </div>

      <button
        onclick={executeLogout}
        class="w-full py-3.5 border border-destructive/25 text-destructive text-sm font-medium tracking-wide flex items-center justify-center gap-2 hover:bg-destructive/5 transition-colors active:scale-[0.98]"
      >
        <LogOut size={15} />
        Sign Out
      </button>
    </div>

  {:else if currentView === 'HISTORY'}
    <header class="flex items-center gap-3 pb-4 border-b border-border sticky top-0 bg-background z-10 pt-1">
      <button onclick={() => currentView = 'MAIN'} class="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
        <ArrowLeft size={18} />
      </button>
      <div>
        <h2 class="text-base font-semibold text-foreground tracking-tight leading-none">History</h2>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto py-5 animate-in slide-in-from-right-2 duration-300">
      <div class="bg-card border border-border divide-y divide-border">
        {#if isLoadingHistory}
            {#each [1, 2, 3, 4, 5] as i (i)}
                <div class="flex items-center justify-between px-4 py-4 animate-pulse">
                    <div class="flex items-center gap-3">
                        <div class="h-9 w-9 bg-muted shrink-0 border border-border"></div>
                        <div class="space-y-2 min-w-0">
                            <div class="h-3.5 w-32 bg-muted/80"></div>
                            <div class="h-2.5 w-20 bg-muted/50"></div>
                        </div>
                    </div>
                    <div class="h-3.5 w-16 shrink-0 bg-muted/80"></div>
                </div>
            {/each}
        {:else if transactions.length > 0}
            {#each transactions as tx (tx.id)}
            <div class="flex items-center justify-between px-4 py-4">
                <div class="flex items-center gap-3">
                <div class="w-9 h-9 bg-muted flex items-center justify-center shrink-0 border border-border">
                    {#if tx.type === 'credit'}
                    <ArrowDownLeft size={15} class="text-emerald-400" />
                    {:else}
                    <ArrowUpRight size={15} class="text-muted-foreground" />
                    {/if}
                </div>
                <div class="min-w-0">
                    <p class="text-sm text-foreground font-medium truncate">{tx.title}</p>
                    <p class="font-mono text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">{tx.date}</p>
                </div>
                </div>
                <span class="font-mono text-sm shrink-0 pl-3 {tx.type === 'credit' ? 'text-emerald-400' : 'text-foreground'}">
                {tx.type === 'credit' ? '+' : '-'}₹{tx.amount.toFixed(2)}
                </span>
            </div>
            {/each}
        {:else}
            <div class="px-4 py-6 text-center">
                <p class="text-xs font-light text-muted-foreground">No recent transactions.</p>
            </div>
        {/if}
      </div>
      <p class="font-mono text-[10px] text-center text-muted-foreground mt-6 uppercase tracking-widest">End of recent history</p>
    </div>

  {:else if currentView === 'NOTIFICATIONS'}
    <header class="flex items-center gap-3 pb-4 border-b border-border sticky top-0 bg-background z-10 pt-1">
      <button onclick={() => currentView = 'MAIN'} class="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
        <ArrowLeft size={18} />
      </button>
      <div>
        <h2 class="text-base font-semibold text-foreground tracking-tight leading-none">Notifications</h2>
        <p class="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Manage alerts</p>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto py-5 space-y-6 animate-in slide-in-from-right-2 duration-300">
      <div>
        <p class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 px-1">Preferences</p>
        <div class="bg-card border border-border divide-y divide-border">
          <button onclick={() => notifyOrders = !notifyOrders} class="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors">
            <div class="text-left">
              <span class="text-sm text-foreground block">Order Updates</span>
              <span class="text-xs text-muted-foreground mt-0.5 block font-light">Ticket status and ready alerts</span>
            </div>
            <div class="w-8 h-4 rounded-full border border-border relative transition-colors {notifyOrders ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-muted'}">
              <div class="absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all {notifyOrders ? 'bg-emerald-400 left-4.5' : 'bg-muted-foreground left-1'}"></div>
            </div>
          </button>

          <button onclick={() => notifyWallet = !notifyWallet} class="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors">
            <div class="text-left">
              <span class="text-sm text-foreground block">Wallet Alerts</span>
              <span class="text-xs text-muted-foreground mt-0.5 block font-light">Low balance and top-up receipts</span>
            </div>
            <div class="w-8 h-4 rounded-full border border-border relative transition-colors {notifyWallet ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-muted'}">
              <div class="absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all {notifyWallet ? 'bg-emerald-400 left-4.5' : 'bg-muted-foreground left-1'}"></div>
            </div>
          </button>

          <button onclick={() => notifyPromo = !notifyPromo} class="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors">
            <div class="text-left">
              <span class="text-sm text-foreground block">Promotions</span>
              <span class="text-xs text-muted-foreground mt-0.5 block font-light">Canteen specials and discounts</span>
            </div>
            <div class="w-8 h-4 rounded-full border border-border relative transition-colors {notifyPromo ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-muted'}">
              <div class="absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all {notifyPromo ? 'bg-emerald-400 left-4.5' : 'bg-muted-foreground left-1'}"></div>
            </div>
          </button>
        </div>
      </div>
    </div>

  {:else if currentView === 'SECURITY'}
    <header class="flex items-center gap-3 pb-4 border-b border-border sticky top-0 bg-background z-10 pt-1">
      <button onclick={() => currentView = 'MAIN'} class="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
        <ArrowLeft size={18} />
      </button>
      <div>
        <h2 class="text-base font-semibold text-foreground tracking-tight leading-none">Security</h2>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto py-5 space-y-6 animate-in slide-in-from-right-2 duration-300">
      <div>
        <p class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 px-1">Authentication</p>
        <div class="bg-card border border-border divide-y divide-border">
          <button onclick={() => currentView = 'CHANGE_PIN'} class="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors">
            <div class="flex items-center gap-3 text-left">
              <KeyRound size={15} class="text-muted-foreground shrink-0" />
              <div>
                <span class="text-sm text-foreground block">Change Security PIN</span>
                <span class="text-xs text-muted-foreground mt-0.5 block font-light">Update your 4-digit transaction PIN</span>
              </div>
            </div>
            <ChevronRight size={14} class="text-muted-foreground" />
          </button>

          <button 
            onclick={() => biometricsEnabled = !biometricsEnabled}
            class="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors"
          >
            <div class="flex items-center gap-3 text-left">
              <Fingerprint size={15} class="text-muted-foreground shrink-0" />
              <div>
                <span class="text-sm text-foreground block">Biometric Login</span>
                <span class="text-xs text-muted-foreground mt-0.5 block font-light">Use fingerprint or Face ID</span>
              </div>
            </div>
            <div class="w-8 h-4 rounded-full border border-border relative transition-colors {biometricsEnabled ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-muted'}">
              <div class="absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all {biometricsEnabled ? 'bg-emerald-400 left-4.5' : 'bg-muted-foreground left-1'}"></div>
            </div>
          </button>
        </div>
      </div>

      <div>
        <p class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 px-1">Active Sessions</p>
        <div class="bg-card border border-border">
          <div class="flex items-center justify-between px-5 py-4 border-b border-border">
            <div class="flex items-center gap-3 text-left">
              <Smartphone size={15} class="text-muted-foreground shrink-0" />
              <div>
                <span class="text-sm text-foreground block">Current Device</span>
                <span class="font-mono text-[10px] text-emerald-400 mt-1 uppercase tracking-wider block">Active Now</span>
              </div>
            </div>
          </div>
          <div class="px-5 py-4">
            <button 
              onclick={handleSignOutDevices}
              disabled={deviceSignOutStatus !== 'IDLE'}
              class="w-full py-2.5 border text-xs font-medium tracking-wide transition-all active:scale-[0.98] flex items-center justify-center gap-2
                {deviceSignOutStatus === 'SUCCESS' ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' : 'border-border text-foreground hover:bg-muted'}"
            >
              {#if deviceSignOutStatus === 'LOADING'}
                <Loader2 size={14} class="animate-spin text-muted-foreground" />
                Processing...
              {:else if deviceSignOutStatus === 'SUCCESS'}
                <Check size={14} />
                Devices Signed Out
              {:else}
                Sign Out All Other Devices
              {/if}
            </button>
          </div>
        </div>
      </div>
    </div>

  {:else if currentView === 'CHANGE_PIN'}
    <header class="flex items-center gap-3 pb-4 border-b border-border sticky top-0 bg-background z-10 pt-1">
      <button onclick={() => currentView = 'SECURITY'} class="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
        <ArrowLeft size={18} />
      </button>
      <div>
        <h2 class="text-base font-semibold text-foreground tracking-tight leading-none">Change PIN</h2>
      </div>
    </header>

    <div class="flex-1 flex flex-col py-5 animate-in slide-in-from-right-2 duration-300 h-full">
      <div class="space-y-4 flex-1">
        <div class="bg-card border border-border p-5 space-y-6">
          <div>
            <label for="current" class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">Current PIN</label>
            <input 
              id="current"
              type="password" 
              inputmode="numeric"
              maxlength="4"
              bind:value={currentPin}
              class="w-full bg-transparent border-b-2 border-border focus:border-foreground py-2 text-2xl font-mono tracking-[0.5em] outline-none transition-colors text-foreground"
              placeholder="••••"
            />
          </div>

          <div>
            <label for="new" class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">New PIN</label>
            <input 
              id="new"
              type="password" 
              inputmode="numeric"
              maxlength="4"
              bind:value={newPin}
              class="w-full bg-transparent border-b-2 border-border focus:border-foreground py-2 text-2xl font-mono tracking-[0.5em] outline-none transition-colors text-foreground"
              placeholder="••••"
            />
          </div>

          <div>
            <label for="confirm" class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">Confirm New PIN</label>
            <input 
              id="confirm"
              type="password" 
              inputmode="numeric"
              maxlength="4"
              bind:value={confirmPin}
              class="w-full bg-transparent border-b-2 border-border focus:border-foreground py-2 text-2xl font-mono tracking-[0.5em] outline-none transition-colors text-foreground {confirmPin.length === 4 && confirmPin !== newPin ? 'border-destructive focus:border-destructive text-destructive' : ''}"
              placeholder="••••"
            />
            {#if confirmPin.length === 4 && confirmPin !== newPin}
              <p class="font-mono text-[10px] text-destructive mt-1.5 uppercase tracking-wider">Pins do not match</p>
            {/if}
          </div>
        </div>
      </div>

      <div class="pt-4 mt-auto border-t border-border bg-background pb-2">
        <button
          onclick={handleUpdatePin}
          disabled={!isPinValid || pinUpdateStatus !== 'IDLE'}
          class="w-full py-3.5 bg-foreground text-background text-sm font-medium tracking-wide transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2
          {pinUpdateStatus === 'SUCCESS' ? 'bg-emerald-500! text-background! opacity-100!' : ''}"
        >
          {#if pinUpdateStatus === 'SAVING'}
            <Loader2 size={16} class="animate-spin text-background" />
            Updating...
          {:else if pinUpdateStatus === 'SUCCESS'}
            <Check size={16} />
            PIN Updated Successfully
          {:else}
            Save New PIN
          {/if}
        </button>
      </div>
    </div>
  {/if}
</div>