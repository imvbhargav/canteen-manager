<script lang="ts">
	let {
		count = 3,
		type = 'menu'
	}: {
		count?: number;
		type?: 'menu' | 'counter' | 'user' | 'overview' | 'chart' | 'analytics' | 'order' | 'menuOrder';
	} = $props();
</script>

<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
{#each Array.from({ length: count }) as _, idx (idx)}
	{#if type === 'menu'}
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
	{:else if type === 'counter'}
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
	{:else if type === 'user'}
		<div
			class="flex animate-pulse items-center gap-4 rounded-[20px] border border-muted/30 bg-card p-4"
		>
			<div class="h-12 w-12 rounded-full bg-muted/40"></div>
			<div class="flex-1 space-y-2">
				<div class="h-4 w-32 rounded-full bg-muted/60"></div>
				<div class="h-3 w-20 rounded-full bg-muted/40"></div>
			</div>
			<div class="h-5 w-16 rounded-full bg-muted/60"></div>
		</div>
	{:else if type === 'overview'}
		<div
			class="relative overflow-hidden rounded-3xl border border-muted/30 bg-card p-5 shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
		>
			<div class="flex animate-pulse items-start justify-between gap-4">
				<div class="w-full max-w-40 space-y-2">
					<div class="h-5 w-4/5 rounded-md bg-muted/60"></div>
					<div class="h-3 w-3/5 rounded-md bg-muted/40"></div>
				</div>
				<div class="h-7 w-18 shrink-0 rounded-full bg-muted/50"></div>
			</div>
			<div
				class="mt-5 flex h-16.5 animate-pulse items-center justify-between rounded-xl border border-muted/20 bg-muted/10 p-4"
			>
				<div class="space-y-1.5">
					<div class="h-3 w-16 rounded bg-muted/40"></div>
					<div class="h-6 w-24 rounded-md bg-muted/60"></div>
				</div>
				<div class="h-8 w-32 rounded-full bg-muted/60"></div>
			</div>
			<div class="mt-4 flex animate-pulse gap-3 border-t border-muted/20 pt-4">
				<div class="h-10.5 flex-1 rounded-xl bg-muted/40"></div>
				<div class="h-10.5 w-28.5 rounded-xl bg-muted/40"></div>
			</div>
		</div>
	{:else if type === 'chart'}
		<div class="h-48 w-full animate-pulse rounded-2xl bg-muted/20"></div>
	{:else if type === 'analytics'}
		<div class="space-y-3">
			<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
			{#each Array.from({ length: 3 }) as _, idx (idx)}
				<div
					class="flex animate-pulse items-center justify-between rounded-2xl border border-muted/30 bg-card p-5 shadow-sm"
				>
					<div class="space-y-2">
						<div class="h-3 w-20 rounded bg-muted/40"></div>
						<div class="h-8 w-36 rounded bg-muted/60"></div>
						<div class="h-3.5 w-28 rounded bg-muted/40"></div>
					</div>
					<div class="h-12 w-12 rounded-2xl bg-muted/30"></div>
				</div>
			{/each}
			<div class="animate-pulse space-y-4 rounded-2xl border border-muted/30 bg-card p-5 shadow-sm">
				<div class="flex items-center justify-between">
					<div class="h-4 w-32 rounded bg-muted/60"></div>
					<div class="h-4 w-16 rounded bg-muted/40"></div>
				</div>
				<div class="h-36 w-full rounded bg-muted/20"></div>
			</div>
		</div>
	{:else if type === 'order'}
		<div class="space-y-3">
			<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
			{#each Array.from({ length: count }) as _, idx (idx)}
				<div
					class="flex animate-pulse flex-col space-y-3 rounded-2xl border border-muted/30 bg-card p-4 shadow-sm"
				>
					<div class="flex items-start justify-between">
						<div class="flex-1 space-y-2">
							<div class="flex gap-2">
								<div class="h-4.5 w-20 rounded bg-muted/60"></div>
								<div class="h-4.5 w-16 rounded-full bg-muted/40"></div>
							</div>
							<div class="h-4 w-40 rounded bg-muted/40"></div>
						</div>
						<div class="flex shrink-0 flex-col items-end space-y-2">
							<div class="h-4.5 w-16 rounded bg-muted/60"></div>
							<div class="h-3 w-10 rounded bg-muted/40"></div>
						</div>
					</div>
					<div class="ml-4 space-y-2 border-l border-muted/20 pl-2">
						<div class="h-3 w-3/4 rounded bg-muted/40"></div>
						<div class="h-3 w-1/2 rounded bg-muted/40"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if type === 'menuOrder'}
		<div class="space-y-2">
			<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
			{#each Array.from({ length: count }) as _, idx (idx)}
				<div class="animate-pulse space-y-3 rounded-xl border border-muted/15 bg-card p-4">
					<div class="flex items-center justify-between gap-3">
						<div class="flex-1 space-y-2">
							<div class="h-4 w-28 rounded bg-muted/60"></div>
							<div class="h-3 w-40 rounded bg-muted/40"></div>
						</div>
						<div class="flex shrink-0 flex-col items-end space-y-2">
							<div class="h-4 w-16 rounded bg-muted/60"></div>
							<div class="h-3 w-20 rounded bg-muted/40"></div>
						</div>
					</div>
					<div class="flex items-center justify-between border-t border-muted/10 pt-2">
						<div class="h-3.5 w-24 rounded bg-muted/40"></div>
						<div class="h-4 w-16 rounded bg-muted/60"></div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
{/each}
