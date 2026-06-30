<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';

	let {
		title,
		backHref = resolve('/'),
		onclickBack,
		rightSection
	}: {
		title: string;
		backHref?: string;
		onclickBack?: () => void;
		rightSection?: Snippet;
	} = $props();
</script>

<header
	class="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 bg-background/15 px-5 backdrop-blur-md"
>
	{#if onclickBack}
		<button
			onclick={onclickBack}
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-foreground transition-transform active:scale-90"
		>
			<ArrowLeft size={18} strokeWidth={2.5} />
		</button>
	{:else}
		<a
			href={backHref}
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-foreground transition-transform active:scale-90"
		>
			<ArrowLeft size={18} strokeWidth={2.5} />
		</a>
	{/if}

	<h2 class="flex-1 text-[20px] font-bold tracking-tight text-foreground">{title}</h2>

	<div class="flex w-20 justify-end">
		{#if rightSection}
			{@render rightSection()}
		{/if}
	</div>
</header>
