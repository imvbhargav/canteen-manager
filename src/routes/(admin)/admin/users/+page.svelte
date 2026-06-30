<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Search, ShieldCheck, User as UserIcon, Users, Wallet } from 'lucide-svelte';
	import { formatCurrencyINR, getInitials } from '$lib';
	import AdminHeader from '$lib/components/AdminHeader.svelte';
	import CardSkeleton from '$lib/components/CardSkeleton.svelte';

	type UserRecord = {
		id: string;
		name: string;
		referenceKey: string;
		accountNumber: string;
		role: string;
		balance: string | number;
		isActive: boolean;
		createdAt: string;
	};

	let usersList: UserRecord[] = $state([]);
	let isLoading: boolean = $state(true);
	let isLoadingMore: boolean = $state(false);

	// Stats State Variables
	let totalUsers: number = $state(0);
	let totalBalance: string | number = $state(0);

	let searchQuery: string = $state('');
	let statusFilter: 'all' | 'active' | 'inactive' = $state('all');
	let nextCursor: string | null = $state(null);
	let hasNextPage: boolean = $state(false);

	let searchTimeout: ReturnType<typeof setTimeout>;

	// Fetch Aggregated Dashboard Metrics
	async function fetchStats(): Promise<void> {
		try {
			const response = await fetch(resolve('/api/admin/users/stats'));
			const result = await response.json();
			if (result.success) {
				totalUsers = result.data.totalUsers;
				totalBalance = result.data.totalBalance;
			}
		} catch (err) {
			console.error('Failed to load wallet stats', err);
		}
	}

	function handleStatusFilter(filter: 'all' | 'active' | 'inactive') {
		statusFilter = filter;
		fetchUsers(null, true);
	}

	// Fetch Users with optional cursor and search reset
	async function fetchUsers(cursor: string | null = null, reset: boolean = false): Promise<void> {
		if (reset) {
			isLoading = true;
			usersList = [];
		}

		const url = new URL(resolve('/api/admin/users'), window.location.origin);
		url.searchParams.set('limit', '15');
		if (cursor) url.searchParams.set('cursor', cursor);
		if (searchQuery.trim()) url.searchParams.set('search', searchQuery.trim());

		// 2. Append the status parameter if it's not set to 'all'
		if (statusFilter !== 'all') {
			url.searchParams.set('status', statusFilter);
		}

		try {
			const response: Response = await fetch(url.toString());
			const result = await response.json();

			if (result.success) {
				if (reset) {
					usersList = result.data.users;
				} else {
					usersList = [...usersList, ...result.data.users];
				}
				nextCursor = result.data.pagination.nextCursor;
				hasNextPage = result.data.pagination.hasNextPage;
			} else {
				console.error(result.error || 'Failed to load users.');
			}
		} catch (err: unknown) {
			console.error('Network error occurred while fetching user data.', err);
		} finally {
			isLoading = false;
			isLoadingMore = false;
		}
	}

	// Debounced search to prevent API spam while typing
	function handleSearchInput() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			fetchUsers(null, true);
		}, 400);
	}

	function loadMore() {
		if (!nextCursor || isLoadingMore) return;
		isLoadingMore = true;
		fetchUsers(nextCursor);
	}

	onMount(() => {
		fetchStats(); // Fetch totals numbers
		fetchUsers(null, true);
	});

	function navigateToUser(id: string) {
		goto(resolve('/(admin)/admin/users/[userId]', { userId: id }));
	}
</script>

<svelte:head><title>Users | MunchUp Admin</title></svelte:head>

<div class="animate-in fade-in absolute inset-0 z-20 flex flex-col bg-background duration-300">
	<AdminHeader showLogout />

	<div class="flex-1 space-y-6 overflow-y-auto px-5 pt-4 pb-10">
		<div class="space-y-4">
			<h3 class="text-[17px] font-bold tracking-tight text-foreground">User Management</h3>

			<div class="grid grid-cols-2 gap-3.5">
				<div
					class="rounded-[22px] border border-muted/30 bg-card p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)]"
				>
					<div
						class="mb-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary"
					>
						<Users size={16} strokeWidth={2.5} />
					</div>
					<p class="text-[11px] font-bold tracking-wider text-foreground/40 uppercase">
						Total Users
					</p>
					<p class="mt-0.5 font-mono text-xl font-bold text-foreground">{totalUsers}</p>
				</div>

				<div
					class="rounded-[22px] border border-muted/30 bg-card p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)]"
				>
					<div
						class="mb-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500"
					>
						<Wallet size={16} strokeWidth={2.5} />
					</div>
					<p class="text-[11px] font-bold tracking-wider text-foreground/40 uppercase">
						Total in Wallets
					</p>
					<p class="mt-0.5 font-mono text-xl font-bold text-foreground">
						{formatCurrencyINR(Number(totalBalance))}
					</p>
				</div>
			</div>

			<div class="relative">
				<Search
					class="absolute top-1/2 left-4 -translate-y-1/2 text-foreground/40"
					size={16}
					strokeWidth={2.5}
				/>
				<input
					type="text"
					bind:value={searchQuery}
					oninput={handleSearchInput}
					placeholder="Search name, roll number, or ID..."
					class="w-full rounded-full border border-muted/40 bg-card py-3.5 pr-4 pl-11 text-[13px] font-bold text-foreground shadow-[0_2px_12px_rgb(0,0,0,0.02)] transition-colors outline-none placeholder:text-foreground/30 focus:border-foreground/50"
				/>
			</div>
			<div
				class="relative mx-2 flex items-center justify-between gap-1 rounded-2xl border border-accent/10 bg-accent/5 p-2"
			>
				<div
					class="absolute top-1.5 bottom-1.5 left-1.5 z-0 rounded-xl border border-muted/30 bg-primary shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-300 ease-out"
					class:translate-x-0={statusFilter === 'all'}
					class:left-[calc(33.33%)]={statusFilter === 'active'}
					class:left-[calc(66%)]={statusFilter === 'inactive'}
					style="width: calc(33.33% - 4px);"
				></div>

				<button
					onclick={() => handleStatusFilter('all')}
					class="relative z-10 min-w-17.5 flex-1 rounded-xl px-3.5 py-1.5 text-center text-[11px] font-bold tracking-wider uppercase transition-colors duration-200
            {statusFilter === 'all'
						? 'text-background'
						: 'text-foreground/60 hover:text-foreground/80'}"
				>
					All
				</button>

				<button
					onclick={() => handleStatusFilter('active')}
					class="relative z-10 flex min-w-17.5 flex-1 items-center justify-center gap-1.5 rounded-xl px-3.5 py-1.5 text-center text-[11px] font-bold tracking-wider uppercase transition-colors duration-200
            {statusFilter === 'active'
						? 'text-background'
						: 'text-foreground/60 hover:text-foreground/80'}"
				>
					Active
				</button>

				<button
					onclick={() => handleStatusFilter('inactive')}
					class="relative z-10 flex min-w-17.5 flex-1 items-center justify-center gap-1.5 rounded-xl px-3.5 py-1.5 text-center text-[11px] font-bold tracking-wider uppercase transition-colors duration-200
            {statusFilter === 'inactive'
						? 'text-background'
						: 'text-foreground/60 hover:text-foreground/80'}"
				>
					Inactive
				</button>
			</div>
		</div>

		<div class="space-y-3">
			{#if isLoading}
				<CardSkeleton type="user" count={5} />
			{:else if usersList.length > 0}
				{#each usersList as user (user.id)}
					<button
						onclick={() => navigateToUser(user.id)}
						class="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[20px] border border-muted/30 bg-card p-4 shadow-[0_2px_12px_rgb(0,0,0,0.04)] transition-all hover:border-muted/50 active:scale-[0.98]"
					>
						<div class="flex min-w-0 items-center gap-3.5">
							<div
								class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[13px] font-bold text-primary"
							>
								{getInitials(user.name)}
							</div>

							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<h3 class="truncate text-[14px] font-bold text-foreground">
										{user.name}
									</h3>
									{#if user.role === 'ADMIN'}
										<span
											class="flex items-center gap-1 rounded bg-rose-500/10 px-1.5 py-0.5 text-[8px] font-black tracking-widest text-rose-500 uppercase"
										>
											<ShieldCheck size={10} strokeWidth={3} /> Admin
										</span>
									{/if}
								</div>

								<p
									class="mt-0.5 truncate font-mono text-[11px] font-bold tracking-wider text-foreground/40 uppercase"
								>
									{user.referenceKey}
								</p>
							</div>
						</div>

						<div class="flex shrink-0 flex-col items-end pl-2">
							<span class="font-mono text-[14px] font-bold text-foreground">
								{formatCurrencyINR(Number(user.balance))}
							</span>
							<span
								class="mt-0.5 flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase {user.isActive
									? 'text-emerald-500'
									: 'text-foreground/40'}"
							>
								<div
									class="h-1.5 w-1.5 rounded-full {user.isActive ? 'bg-emerald-500' : 'bg-muted'}"
								></div>
								{user.isActive ? 'Active' : 'Inactive'}
							</span>
						</div>
					</button>
				{/each}

				{#if hasNextPage}
					<div class="mt-4 text-center">
						<button
							onclick={loadMore}
							disabled={isLoadingMore}
							class="rounded-full bg-muted/50 px-5 py-2 text-[12px] font-bold text-foreground transition-all active:scale-95 disabled:opacity-50"
						>
							{isLoadingMore ? 'Loading...' : 'Load More Users'}
						</button>
					</div>
				{:else}
					<p
						class="mt-4 text-center text-[10px] font-bold tracking-[0.15em] text-foreground/30 uppercase"
					>
						End of user list
					</p>
				{/if}
			{:else}
				<div class="rounded-2xl border border-muted/25 bg-card py-12 text-center">
					<div
						class="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/60"
					>
						<UserIcon size={18} strokeWidth={1.75} class="text-foreground/30" />
					</div>
					<p class="text-[13px] font-medium text-foreground/40">No users found.</p>
				</div>
			{/if}
		</div>
	</div>
</div>
