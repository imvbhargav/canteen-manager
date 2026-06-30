<script lang="ts">
	import { Loader2, LogOut, ArrowLeft, ChevronLeft } from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import AppLogo from '$lib/components/AppLogo.svelte';
	import type { Snippet } from 'svelte';
	import type { ResolvedPathname } from '$app/types';

	let {
		backHref,
		backType = 'arrow',
		title,
		subtitle,
		showLogout = false,
		rightSnippet
	}: {
		backHref?: ResolvedPathname;
		backType?: 'arrow' | 'chevron';
		title?: string;
		subtitle?: string;
		showLogout?: boolean;
		rightSnippet?: Snippet;
	} = $props();

	let isLoggingOut = $state(false);

	async function handleLogout(): Promise<void> {
		if (isLoggingOut) return;
		isLoggingOut = true;
		try {
			const res = await fetch('/api/auth/logout', { method: 'POST' });
			if (res.ok) {
				goto(resolve('/login'));
			} else {
				isLoggingOut = false;
			}
		} catch {
			isLoggingOut = false;
		}
	}
</script>

<header
	class="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-3 bg-background/15 px-5 backdrop-blur-md"
>
	{#if backHref}
		<button
			onclick={() => {
				goto(backHref);
			}}
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-foreground transition-transform active:scale-90"
		>
			{#if backType === 'chevron'}
				<ChevronLeft size={17} strokeWidth={2.5} />
			{:else}
				<ArrowLeft size={18} strokeWidth={2.5} />
			{/if}
		</button>
	{/if}

	{#if title}
		<div class="min-w-0 flex-1">
			<h2
				class="truncate text-[13px] font-bold text-foreground sm:text-[15px] {subtitle
					? ''
					: 'text-[17px] font-bold'}"
			>
				{title}
			</h2>
			{#if subtitle}
				<p class="truncate text-[10px] font-medium text-foreground/40">{subtitle}</p>
			{/if}
		</div>
	{:else}
		<div class="flex-1">
			<AppLogo />
		</div>
	{/if}

	<div class="flex shrink-0 items-center justify-end gap-3">
		{#if rightSnippet}
			{@render rightSnippet()}
		{:else if showLogout}
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
		{/if}
	</div>
</header>
