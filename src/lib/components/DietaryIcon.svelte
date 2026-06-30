<script lang="ts">
	let {
		dietary,
		class: className = ''
	}: {
		dietary: string;
		class?: string;
	} = $props();
</script>

<div
	class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[2px] border transition-colors duration-150 {dietary === 'veg'
		? 'border-emerald-500/50 bg-emerald-500/5 text-emerald-500'
		: 'border-rose-500/50 bg-rose-500/5 text-rose-500'} {className}"
>
	<div
		class="h-1.5 w-1.5 rounded-full {dietary === 'veg' ? 'bg-emerald-500' : 'bg-rose-500'}"
	></div>
</div>
