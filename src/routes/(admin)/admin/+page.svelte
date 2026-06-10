<script lang="ts">
	import { onMount } from 'svelte';
	import {
		UtensilsCrossed,
		CheckCircle2,
		Loader2,
		LogOut,
		Plus,
		Search,
		Edit,
		Save,
		X,
		Archive,
		ArchiveRestore
	} from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';

	interface MenuItem {
		id: string;
		name: string;
		description: string;
		price: number;
		category: string;
		dietary: string;
		inStock: boolean;
		isArchived: boolean;
	}

	let menuItemsList: MenuItem[] = $state([]);
	let isFetchingMenu: boolean = $state(true);
	let searchQuery: string = $state('');
	let showArchived: boolean = $state(false);

	let processingItemId: string | null = $state(null);

	let filteredMenu: MenuItem[] = $derived(
		menuItemsList.filter((item) => {
			const matchesSearch: boolean =
				item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.category.toLowerCase().includes(searchQuery.toLowerCase());
			const matchesArchiveStatus: boolean = showArchived ? true : !item.isArchived;
			return matchesSearch && matchesArchiveStatus;
		})
	);

	let menuForm = $state({
		name: '',
		description: '',
		price: '',
		category: 'Breakfast',
		dietary: 'veg'
	});
	let isMenuSubmitting: boolean = $state(false);
	let menuSuccessMsg: string = $state('');

	let editingId: string | null = $state(null);
	let editForm = $state({
		name: '',
		description: '',
		price: '',
		category: '',
		dietary: ''
	});
	let isEditSubmitting: boolean = $state(false);
	let isLoggingOut: boolean = $state(false);

	onMount(() => {
		fetchMenuItems(true);
	});

	async function fetchMenuItems(showSkeleton: boolean = true): Promise<void> {
		if (showSkeleton) isFetchingMenu = true;
		try {
			const res: Response = await fetch('/api/menu?includeArchived=true');
			const data = await res.json();
			if (res.ok && data.success) {
				menuItemsList = data.data;
			}
		} catch {
			console.error('Failed to fetch menu items');
		} finally {
			if (showSkeleton) isFetchingMenu = false;
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

	async function handleAddMenuItem(e: Event): Promise<void> {
		e.preventDefault();
		isMenuSubmitting = true;

		try {
			const res: Response = await fetch('/api/menu', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...menuForm,
					price: Number(menuForm.price)
				})
			});

			if (res.ok) {
				menuSuccessMsg = 'Item published';
				menuForm = { name: '', description: '', price: '', category: 'Breakfast', dietary: 'veg' };
				await fetchMenuItems(false);
				setTimeout(() => (menuSuccessMsg = ''), 3000);
			}
		} catch {
			console.error('Failed to add item');
		} finally {
			isMenuSubmitting = false;
		}
	}

	function startEditing(item: MenuItem): void {
		editingId = item.id;
		editForm = {
			name: item.name,
			description: item.description,
			price: String(item.price),
			category: item.category,
			dietary: item.dietary
		};
	}

	function cancelEditing(): void {
		editingId = null;
	}

	async function handleUpdateItem(e: Event): Promise<void> {
		e.preventDefault();
		isEditSubmitting = true;
		if (editingId) processingItemId = editingId;

		try {
			const res: Response = await fetch('/api/menu', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: editingId,
					...editForm,
					price: Number(editForm.price)
				})
			});

			if (res.ok) {
				await fetchMenuItems(false);
				editingId = null;
			}
		} catch {
			console.error('Failed to update item');
		} finally {
			isEditSubmitting = false;
			processingItemId = null;
		}
	}

	async function handleStatusToggle(id: string, payload: Partial<MenuItem>): Promise<void> {
		if (processingItemId) return;
		processingItemId = id;

		try {
			const res: Response = await fetch('/api/menu', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, ...payload })
			});

			if (res.ok) {
				await fetchMenuItems(false);
			}
		} catch {
			console.error('Failed to update status');
		} finally {
			processingItemId = null;
		}
	}
</script>

<svelte:head><title>Menu Manager | MunchUp Admin</title></svelte:head>

<div class="animate-in fade-in min-h-full bg-background pb-6 duration-300">
	<header class="flex h-16 shrink-0 items-center gap-3 px-5">
		<div
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-background"
		>
			<UtensilsCrossed size={16} strokeWidth={2.5} />
		</div>

		<h2 class="flex-1 text-[20px] font-bold tracking-tight text-foreground">Menu</h2>

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

	<div class="flex-1 space-y-6 px-5 pt-4">
		<form
			onsubmit={handleAddMenuItem}
			class="space-y-4 rounded-3xl border border-muted/30 bg-card p-5 shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
		>
			<div>
				<label
					for="name"
					class="mb-2 block text-[10px] font-bold tracking-widest text-foreground/50 uppercase"
					>Item Name</label
				>
				<input
					id="name"
					type="text"
					bind:value={menuForm.name}
					required
					class="w-full rounded-[14px] border border-muted/40 bg-muted/10 px-4 py-3 text-[14px] font-bold text-foreground transition-colors outline-none placeholder:text-foreground/30 focus:border-foreground/50 focus:bg-card"
					placeholder="e.g. Masala Dosa"
				/>
			</div>

			<div>
				<label
					for="desc"
					class="mb-2 block text-[10px] font-bold tracking-widest text-foreground/50 uppercase"
					>Description</label
				>
				<textarea
					id="desc"
					bind:value={menuForm.description}
					required
					rows="2"
					class="w-full resize-none rounded-[14px] border border-muted/40 bg-muted/10 px-4 py-3 text-[13px] font-medium text-foreground transition-colors outline-none placeholder:text-foreground/30 focus:border-foreground/50 focus:bg-card"
					placeholder="Brief description of the item..."
				></textarea>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<label
						for="price"
						class="mb-2 block text-[10px] font-bold tracking-widest text-foreground/50 uppercase"
						>Price (₹)</label
					>
					<input
						id="price"
						type="number"
						min="0"
						step="0.01"
						bind:value={menuForm.price}
						required
						class="w-full rounded-[14px] border border-muted/40 bg-muted/10 px-4 py-3 text-[14px] font-bold text-foreground transition-colors outline-none placeholder:text-foreground/30 focus:border-foreground/50 focus:bg-card"
						placeholder="0.00"
					/>
				</div>

				<div>
					<label
						for="diet"
						class="mb-2 block text-[10px] font-bold tracking-widest text-foreground/50 uppercase"
						>Dietary</label
					>
					<select
						disabled
						id="diet"
						bind:value={menuForm.dietary}
						class="w-full appearance-none rounded-[14px] border border-muted/40 bg-muted/10 px-4 py-3 text-[13px] font-bold text-foreground opacity-70 transition-colors outline-none"
					>
						<option value="veg">Vegetarian</option>
						<option value="non-veg">Non-Vegetarian</option>
					</select>
				</div>
			</div>

			<div>
				<label
					for="category"
					class="mb-2 block text-[10px] font-bold tracking-widest text-foreground/50 uppercase"
					>Category</label
				>
				<select
					id="category"
					bind:value={menuForm.category}
					class="w-full appearance-none rounded-[14px] border border-muted/40 bg-muted/10 px-4 py-3 text-[13px] font-bold text-foreground transition-colors outline-none focus:border-foreground/50 focus:bg-card"
				>
					<option value="Breakfast">Breakfast</option>
					<option value="Lunch">Lunch</option>
					<option value="Snacks">Snacks</option>
					<option value="Beverages">Beverages</option>
				</select>
			</div>

			<button
				type="submit"
				disabled={isMenuSubmitting}
				class="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[13px] font-bold text-background transition-transform active:scale-[0.98] disabled:opacity-50"
			>
				{#if isMenuSubmitting}
					<Loader2 size={16} strokeWidth={2.5} class="animate-spin" /> Publishing...
				{:else if menuSuccessMsg}
					<CheckCircle2 size={16} strokeWidth={2.5} class="text-emerald-400" /> {menuSuccessMsg}
				{:else}
					<Plus size={16} strokeWidth={2.5} /> Publish to Menu
				{/if}
			</button>
		</form>

		<div class="h-px bg-muted/30"></div>

		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<h3 class="text-[17px] font-bold tracking-tight text-foreground">Menu Items</h3>
				<label
					class="flex cursor-pointer items-center gap-2 text-[11px] font-bold tracking-widest text-foreground/50 uppercase transition-colors hover:text-foreground"
				>
					<input type="checkbox" bind:checked={showArchived} class="accent-foreground" />
					Show Archived
				</label>
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
					placeholder="Search menu..."
					class="w-full rounded-full border border-muted/40 bg-card py-3.5 pr-4 pl-11 text-[13px] font-bold text-foreground transition-colors outline-none placeholder:text-foreground/30 focus:border-foreground/50"
				/>
			</div>

			<div class="space-y-3">
				{#if isFetchingMenu}
					{#each Array.from({ length: 4 }, (_, i) => i) as i (i)}
						<div
							class="flex animate-pulse items-center gap-3 rounded-2xl border border-muted/30 bg-card p-4"
						>
							<div class="flex-1 space-y-2.5">
								<div class="h-4 w-32 rounded-full bg-muted/60"></div>
								<div class="h-3 w-3/4 rounded-full bg-muted/40"></div>
								<div class="h-4 w-16 rounded-full bg-muted/60"></div>
							</div>
							<div class="flex gap-2">
								<div class="h-8 w-8 rounded-full bg-muted/40"></div>
								<div class="h-8 w-8 rounded-full bg-muted/40"></div>
							</div>
						</div>
					{/each}
				{:else if filteredMenu.length === 0}
					<div class="rounded-2xl border border-muted/25 bg-card py-10 text-center">
						<p class="text-[13px] font-medium text-foreground/40">No items found.</p>
					</div>
				{:else}
					{#each filteredMenu as item (item.id)}
						<div
							class="relative overflow-hidden rounded-2xl border border-muted/30 bg-card p-4 shadow-[0_2px_12px_rgb(0,0,0,0.04)] transition-opacity {item.isArchived
								? 'opacity-50'
								: ''}"
						>
							{#if processingItemId === item.id && !editingId}
								<div
									class="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px]"
								>
									<Loader2 size={24} strokeWidth={2.5} class="animate-spin text-foreground" />
								</div>
							{/if}

							{#if editingId === item.id}
								<form onsubmit={handleUpdateItem} class="space-y-3">
									<div class="grid grid-cols-2 gap-2">
										<input
											type="text"
											bind:value={editForm.name}
											required
											class="w-full rounded-[10px] border border-muted/40 bg-muted/10 px-3 py-2 text-[13px] font-bold text-foreground outline-none focus:border-foreground/50"
											placeholder="Name"
										/>
										<input
											type="number"
											step="0.01"
											bind:value={editForm.price}
											required
											class="w-full rounded-[10px] border border-muted/40 bg-muted/10 px-3 py-2 text-[13px] font-bold text-foreground outline-none focus:border-foreground/50"
											placeholder="Price"
										/>
									</div>
									<input
										type="text"
										bind:value={editForm.description}
										required
										class="w-full rounded-[10px] border border-muted/40 bg-muted/10 px-3 py-2 text-[12px] font-medium text-foreground outline-none focus:border-foreground/50"
										placeholder="Description"
									/>
									<div class="grid grid-cols-2 gap-2">
										<select
											bind:value={editForm.category}
											class="w-full appearance-none rounded-[10px] border border-muted/40 bg-muted/10 px-3 py-2 text-[13px] font-bold text-foreground outline-none focus:border-foreground/50"
										>
											<option value="Breakfast">Breakfast</option>
											<option value="Lunch">Lunch</option>
											<option value="Snacks">Snacks</option>
											<option value="Beverages">Beverages</option>
										</select>
										<div class="flex gap-2">
											<button
												type="button"
												onclick={cancelEditing}
												class="flex flex-1 items-center justify-center rounded-[10px] border border-muted/50 text-foreground/50 transition-colors hover:bg-muted active:scale-95"
											>
												<X size={16} strokeWidth={2.5} />
											</button>
											<button
												type="submit"
												disabled={isEditSubmitting}
												class="flex flex-1 items-center justify-center rounded-[10px] bg-foreground text-background transition-transform active:scale-95 disabled:opacity-50"
											>
												{#if isEditSubmitting}
													<Loader2 size={16} strokeWidth={2.5} class="animate-spin" />
												{:else}
													<Save size={16} strokeWidth={2.5} />
												{/if}
											</button>
										</div>
									</div>
								</form>
							{:else}
								<div class="flex items-start justify-between gap-3">
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<h4
												class="truncate text-[15px] font-bold text-foreground {item.isArchived
													? 'line-through decoration-foreground/40'
													: ''}"
											>
												{item.name}
											</h4>
											<span
												class="rounded bg-muted/50 px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-foreground/50 uppercase"
												>{item.category}</span
											>
										</div>
										<p
											class="mt-0.5 line-clamp-2 text-[12px] leading-relaxed font-medium text-foreground/50"
										>
											{item.description}
										</p>
										<p class="mt-1.5 text-[14px] font-black text-foreground">₹{item.price}</p>
									</div>
									<div class="flex shrink-0 items-center gap-1.5">
										<button
											onclick={() => handleStatusToggle(item.id, { isArchived: !item.isArchived })}
											class="flex h-8 w-8 items-center justify-center rounded-full transition-colors {item.isArchived
												? 'bg-amber-500/10 text-amber-500'
												: 'bg-muted/40 text-foreground/40 hover:text-foreground'}"
											title={item.isArchived ? 'Restore Item' : 'Archive Item'}
										>
											{#if item.isArchived}
												<ArchiveRestore size={14} strokeWidth={2.5} />
											{:else}
												<Archive size={14} strokeWidth={2.5} />
											{/if}
										</button>
										<button
											onclick={() => startEditing(item)}
											class="flex h-8 w-8 items-center justify-center rounded-full bg-muted/40 text-foreground/40 transition-colors hover:text-foreground"
											title="Edit Item"
										>
											<Edit size={14} strokeWidth={2.5} />
										</button>
									</div>
								</div>
							{/if}
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>
</div>
