<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { formatCurrencyINR } from '$lib';
	import {
		ChevronLeft,
		RefreshCw,
		BadgeCheck,
		BadgeX,
		CircleCheck,
		CircleX,
		CircleAlert,
		CalendarDays
	} from 'lucide-svelte';

	type UserProfile = {
		id: string;
		studentId: string;
		name: string;
		accountNumber: string;
		balance: string | number;
		isActive: boolean;
		credentialPhotoUrl: string | null;
		deactivationReason: string | null;
		batchYear: number;
		expectedGraduationYear: number;
	};

	const userId = $page.params.userId;

	let targetUser: UserProfile | null = $state(null);
	let isLoading: boolean = $state(true);
	let isSubmitting: boolean = $state(false);
	let apiErrorMsg: string = $state('');

	let editableName = $state('');
	let editableAccountNumber = $state('');
	let deactivationReason = $state('');
	let editableBatchYear = $state('');
	let editableGraduationYear = $state('');

	onMount(async () => {
		try {
			const res = await fetch(resolve('/api/admin/users/[userId]', { userId: userId as string }));
			const data = await res.json();
			if (data.success) {
				targetUser = data.data;
				if (targetUser) {
					editableName = targetUser.name;
					editableAccountNumber = targetUser.accountNumber || targetUser.studentId;
					deactivationReason = targetUser.deactivationReason || '';
					editableBatchYear =
						targetUser.batchYear?.toString() || new Date().getFullYear().toString();
					editableGraduationYear =
						targetUser.expectedGraduationYear?.toString() || new Date().getFullYear().toString();
				}
			}
		} catch (err) {
			console.error(err);
			apiErrorMsg = 'Failed loading user context parameters';
		} finally {
			isLoading = false;
		}
	});

	async function handleStatusToggle(activate: boolean) {
		if (!targetUser) return;

		apiErrorMsg = '';

		if (!activate && Number(targetUser.balance) !== 0) {
			apiErrorMsg = `Clear remaining balance (${formatCurrencyINR(Number(targetUser.balance))}) via the funds tab before deactivating this account.`;
			return;
		}

		if (!activate && deactivationReason.trim().length < 4) {
			apiErrorMsg = 'Please supply a detailed reason for profile deactivation.';
			return;
		}

		if (activate) {
			if (
				!editableName.trim() ||
				!editableAccountNumber.trim() ||
				!editableBatchYear.trim() ||
				!editableGraduationYear.trim()
			) {
				apiErrorMsg = 'All configuration parameters including cohort year bounds are required.';
				return;
			}
			if (parseInt(editableBatchYear) > parseInt(editableGraduationYear)) {
				apiErrorMsg = 'Batch entry year calculation bounds cannot exceed graduation targets.';
				return;
			}
		}

		isSubmitting = true;

		try {
			const payload = activate
				? {
						isActive: true,
						name: editableName,
						accountNumber: editableAccountNumber,
						batchYear: parseInt(editableBatchYear),
						expectedGraduationYear: parseInt(editableGraduationYear)
					}
				: { isActive: false, deactivationReason: deactivationReason };

			const res = await fetch(
				resolve('/api/admin/users/[userId]/status', { userId: userId ?? '' }),
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				}
			);

			const data = await res.json();
			if (data.success) {
				goto(resolve(`/admin/users/${userId}`));
			} else {
				apiErrorMsg = data.error || 'Failed updating execution parameters';
			}
		} catch {
			apiErrorMsg = 'Network transaction communications failure';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head><title>User Status | MunchUp Admin</title></svelte:head>

<div
	class="animate-in fade-in absolute inset-0 z-30 flex flex-col bg-background duration-200 select-none"
>
	<div class="flex shrink-0 items-center gap-3 border-b border-muted/30 bg-card px-4 py-3">
		<button
			onclick={() => goto(resolve(`/admin/users/${userId}`))}
			class="flex h-8 w-8 items-center justify-center rounded-full bg-muted/40 text-foreground transition-transform active:scale-90"
		>
			<ChevronLeft size={17} strokeWidth={2.5} />
		</button>

		<div class="min-w-0 flex-1">
			<p class="truncate text-[13px] font-bold text-foreground">Verification Controls</p>
			<p class="truncate text-[10px] font-medium text-foreground/40">Identity & account status</p>
		</div>

		{#if targetUser}
			<div
				class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold
                {targetUser.isActive
					? 'bg-emerald-500/10 text-emerald-600'
					: 'bg-destructive/10 text-destructive'}"
			>
				{#if targetUser.isActive}
					<BadgeCheck size={11} strokeWidth={2.5} />
					<span>Active</span>
				{:else}
					<BadgeX size={11} strokeWidth={2.5} />
					<span>Inactive</span>
				{/if}
			</div>
		{/if}
	</div>

	<div class="flex-1 overflow-y-auto px-5 pt-4">
		{#if isLoading}
			<div class="flex h-40 items-center justify-center">
				<RefreshCw size={22} class="animate-spin text-primary" />
			</div>
		{:else if targetUser}
			{#if !targetUser.isActive}
				<div
					class="overflow-hidden rounded-2xl border-2 border-dashed border-accent/25 bg-muted/10"
				>
					{#if targetUser.credentialPhotoUrl}
						<img
							src={targetUser.credentialPhotoUrl}
							alt="Credential Document"
							class="block h-auto max-h-[40vh] w-full rounded-xl bg-neutral-950 object-contain"
						/>
					{:else}
						<div class="flex h-24 items-center justify-center">
							<span class="text-[11px] font-medium text-foreground/30"
								>No identity document uploaded</span
							>
						</div>
					{/if}
				</div>
			{/if}

			<div class="space-y-4 pt-4 pb-10">
				{#if apiErrorMsg}
					<div
						class="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-[11px] leading-normal font-bold text-destructive"
					>
						<CircleAlert size={14} class="mt-0.5 shrink-0" strokeWidth={2.5} />
						<span>{apiErrorMsg}</span>
					</div>
				{/if}

				{#if !targetUser.isActive}
					<div class="space-y-4 rounded-2xl border border-muted/30 bg-muted/5 p-4">
						<p class="flex items-center gap-1.5 text-xs font-bold text-foreground/80">
							<span>Profile & Timeline Specifications</span>
						</p>

						<div class="grid grid-cols-2 gap-3">
							<div class="space-y-1.5">
								<label
									for="nameInput"
									class="block text-[10px] font-bold tracking-wider text-foreground/40 uppercase"
									>Full Name</label
								>
								<input
									id="nameInput"
									type="text"
									bind:value={editableName}
									disabled={isSubmitting}
									class="w-full rounded-xl border border-muted/40 bg-background px-3 py-2.5 text-[13px] font-bold text-foreground outline-none focus:border-foreground/30 disabled:opacity-50"
								/>
							</div>
							<div class="space-y-1.5">
								<label
									for="accountInput"
									class="block text-[10px] font-bold tracking-wider text-foreground/40 uppercase"
									>Account No.</label
								>
								<input
									id="accountInput"
									type="text"
									bind:value={editableAccountNumber}
									disabled={isSubmitting}
									class="w-full rounded-xl border border-muted/40 bg-background px-3 py-2.5 font-mono text-[13px] font-bold text-foreground uppercase outline-none focus:border-foreground/30 disabled:opacity-50"
								/>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-3 border-t border-muted/20 pt-3">
							<div class="space-y-1.5">
								<label
									for="batchYearInput"
									class="flex items-center gap-1 text-[10px] font-bold tracking-wider text-foreground/40 uppercase"
								>
									<CalendarDays size={10} /> Batch Year
								</label>
								<input
									id="batchYearInput"
									type="text"
									inputmode="numeric"
									pattern="[0-0]*"
									bind:value={editableBatchYear}
									disabled={isSubmitting}
									class="w-full rounded-xl border border-muted/40 bg-background px-3 py-2.5 font-mono text-[13px] font-bold text-foreground outline-none focus:border-foreground/30 disabled:opacity-50"
								/>
							</div>
							<div class="space-y-1.5">
								<label
									for="gradYearInput"
									class="flex items-center gap-1 text-[10px] font-bold tracking-wider text-foreground/40 uppercase"
								>
									<CalendarDays size={10} /> Graduation Year
								</label>
								<input
									id="gradYearInput"
									type="text"
									inputmode="numeric"
									pattern="[0-0]*"
									bind:value={editableGraduationYear}
									disabled={isSubmitting}
									class="w-full rounded-xl border border-muted/40 bg-background px-3 py-2.5 font-mono text-[13px] font-bold text-foreground outline-none focus:border-foreground/30 disabled:opacity-50"
								/>
							</div>
						</div>
					</div>
				{/if}

				{#if targetUser.isActive}
					<div class="space-y-3.5 rounded-2xl border border-muted/30 bg-muted/5 p-4">
						<div
							class="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-foreground/50 uppercase"
						>
							<CircleX size={12} class="text-destructive" strokeWidth={2.5} />
							<span>Suspend Account</span>
						</div>

						<div class="space-y-1.5">
							<label
								for="reason"
								class="block text-[10px] font-bold tracking-wider text-foreground/40 uppercase"
								>Suspension Reason</label
							>
							<textarea
								id="reason"
								bind:value={deactivationReason}
								disabled={isSubmitting}
								placeholder="Describe the reason for suspending this account..."
								rows="3"
								class="w-full resize-none rounded-xl border border-muted/40 bg-background px-3 py-2.5 text-[13px] font-medium text-foreground outline-none focus:border-destructive/40 disabled:opacity-50"
							></textarea>
						</div>

						<button
							type="button"
							disabled={isSubmitting || Number(targetUser.balance) !== 0}
							onclick={() => handleStatusToggle(false)}
							class="flex w-full items-center justify-center gap-2 rounded-full bg-destructive py-3 text-[12px] font-bold text-background transition-transform active:scale-[0.98] disabled:opacity-30"
						>
							{#if isSubmitting}
								<RefreshCw size={13} class="animate-spin" />
								<span>Suspending account...</span>
							{:else}
								<CircleX size={13} strokeWidth={2.5} />
								<span>Deactivate & Suspend User</span>
							{/if}
						</button>
					</div>
				{:else}
					<div class="space-y-3.5 rounded-2xl border border-muted/30 bg-muted/5 p-4">
						<button
							type="button"
							disabled={isSubmitting}
							onclick={() => handleStatusToggle(true)}
							class="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-[12px] font-bold text-background transition-transform active:scale-[0.98] disabled:opacity-30"
						>
							{#if isSubmitting}
								<RefreshCw size={13} class="animate-spin" />
								<span>Activating account...</span>
							{:else}
								<CircleCheck size={13} strokeWidth={2.5} />
								<span>Approve & Activate User</span>
							{/if}
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
