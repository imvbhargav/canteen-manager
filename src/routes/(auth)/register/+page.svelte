<script lang="ts">
	import { Loader2, Check, UploadCloud, X, Sparkles, Clock, AlertCircle } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import AppLogo from '$lib/components/AppLogo.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Tesseract from 'tesseract.js';

	onMount(() => {
		const setHeight = () => {
			document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
		};
		setHeight();
		window.addEventListener('resize', setHeight);
		return () => window.removeEventListener('resize', setHeight);
	});

	let name = $state('');
	let accountNumber = $state('');
	let pin = $state('');
	let confirmPin = $state('');
	let batchString = $state('');

	let imageBase64 = $state('');
	let rawFileFile: File | null = $state(null);
	let isDragging = $state(false);

	let errorMsg = $state('');
	let isLoading = $state(false);
	let isOcrProcessing = $state(false);
	let isRegistered = $state(false);

	let isPinMatching = $derived(pin.length === 5 && pin === confirmPin);
	let isValid = $derived(
		name.length > 2 && accountNumber.length >= 2 && isPinMatching && imageBase64.length > 0
	);

	function handleAlphanumericInput(e: Event, mode: 'account' | 'pin' | 'confirm') {
		const target = e.target as HTMLInputElement;
		const sanitized = target.value.replace(/[^a-zA-Z0-9]/g, '');

		if (mode === 'account') accountNumber = sanitized;
		if (mode === 'pin') pin = sanitized;
		if (mode === 'confirm') confirmPin = sanitized;
	}

	function handleFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			processFile(target.files[0]);
		}
	}

	function processFile(file: File) {
		if (!file.type.startsWith('image/')) {
			errorMsg = 'Please select a valid image file format.';
			return;
		}
		rawFileFile = file;
		const reader = new FileReader();
		reader.onload = () => {
			imageBase64 = reader.result as string;
			runClientSideOcr(reader.result as string);
		};
		reader.readAsDataURL(file);
	}

	async function runClientSideOcr(imageSrc: string) {
		isOcrProcessing = true;
		errorMsg = '';

		try {
			const result = await Tesseract.recognize(imageSrc, 'eng');
			const lines: string[] = result.data.text.split('\n').map((line) => line.trim());

			console.log(lines);
			const parsedData = parseOcrTextToForm(lines);

			name = parsedData.name;
			accountNumber = parsedData.accountNumber;
			batchString = parsedData.batch;
		} catch (err) {
			console.error('OCR Extraction Engine Failure:', err);
			errorMsg = 'Failed to extract text from the card image.';
		} finally {
			isOcrProcessing = false;
		}
	}

	function parseOcrTextToForm(lines: string[]) {
		let extractedName = '';
		let extractedAccountNumber = '';
		let extractedProgram = '';
		let extractedBatch = '';

		const cleanedLines = lines
			.map((line) =>
				line
					.replace(/[|[\]()—_-]/g, '') // Clears out structural artifacts cleanly
					.replace(/\s+/g, ' ')
					.trim()
			)
			.filter((line) => line.length > 0);

		// Strict boundary validation to prevent cross-label pollution
		const labelPatterns = {
			name: /^(name|full\s*name)$/i,
			accountNumber:
				/^(roll\s*no|roll\s*number|\bid\s*no\b|employee\s*id|student\s*id|se\s*roll\s*no)$/i,
			program: /^(program|course|department)$/i,
			batch: /^(batch|year)$/i
		};

		for (let i = 0; i < cleanedLines.length; i++) {
			const line = cleanedLines[i];
			const nextLine = cleanedLines[i + 1] ?? '';

			// Separate label match from content text for structured multi-line parsing
			const dynamicClean = line.replace(/[:.-]/g, '').trim();

			// 1. EXTRACT NAME
			if (
				!extractedName &&
				(labelPatterns.name.test(dynamicClean) || dynamicClean.toLowerCase().startsWith('name '))
			) {
				let inlineValue = line.replace(/^(name|full\s*name)\s*[:.-]*/i, '').trim();
				if (inlineValue.length > 0) {
					extractedName = inlineValue;
				} else if (nextLine) {
					extractedName = nextLine;
					i++;
				}
				continue; // Prevent matching other fields in this iteration
			}

			// 2. EXTRACT ROLL NO / ACCOUNT NUMBER
			if (
				!extractedAccountNumber &&
				(labelPatterns.accountNumber.test(dynamicClean) ||
					dynamicClean.toLowerCase().includes('roll no'))
			) {
				let inlineValue = line
					.replace(
						/^(roll\s*no|roll\s*number|id\s*no|employee\s*id|student\s*id|se\s*roll\s*no)\s*[:.-]*/i,
						''
					)
					.trim();

				let textToSearch = inlineValue;
				if (textToSearch.length < 4 && nextLine) {
					textToSearch = nextLine;
					if (inlineValue.length === 0) i++;
				}

				const idMatch = textToSearch.match(/[A-Z0-9]{5,}/i);
				if (idMatch) {
					extractedAccountNumber = idMatch[0].toUpperCase();
				}
				continue;
			}

			// 3. EXTRACT PROGRAM
			if (!extractedProgram && labelPatterns.program.test(dynamicClean)) {
				let inlineValue = line.replace(/^(program|course|department)\s*[:.-]*/i, '').trim();
				if (inlineValue.length > 0) {
					extractedProgram = inlineValue;
				} else if (nextLine) {
					extractedProgram = nextLine;
					i++;
				}
				continue;
			}

			// 4. EXTRACT BATCH
			if (
				!extractedBatch &&
				(labelPatterns.batch.test(dynamicClean) || dynamicClean.toLowerCase().startsWith('batch'))
			) {
				let inlineValue = line.replace(/^(batch|year)\s*[:.-]*/i, '').trim();
				if (inlineValue.length > 0) {
					extractedBatch = inlineValue;
				} else if (nextLine) {
					extractedBatch = nextLine;
					i++;
				}
				continue;
			}

			// Fallback Matcher: Catch lone floating patterns on unlabelled text rows
			if (!extractedAccountNumber) {
				const standaloneIdMatch = line.match(/\b[A-Z]{2,3}\d[A-Z0-9]{4,}\b/i);
				if (standaloneIdMatch) {
					extractedAccountNumber = standaloneIdMatch[0].toUpperCase();
				}
			}
			if (!extractedBatch) {
				const standaloneBatchMatch = line.match(/\b\d{4}\s*-\s*\d{4}\b/);
				if (standaloneBatchMatch) {
					extractedBatch = standaloneBatchMatch[0];
				}
			}
		}

		// Fallback for standalone names if fields are missing
		if (!extractedName) {
			const pureLettersPattern = /^[A-Za-z\s]{4,25}$/;
			const excluded = new Set([
				'NAME',
				'FULL NAME',
				'CARD',
				'STUDENT',
				'IDENTITY',
				'NETWORK',
				'KNOWLEDGE',
				'INNOVATION',
				'EXCELLENCE',
				'MUNCHUP'
			]);

			for (const line of cleanedLines) {
				const upper = line.toUpperCase().trim();
				if (
					pureLettersPattern.test(line) &&
					!excluded.has(upper) &&
					![...excluded].some((ex) => upper.includes(ex)) &&
					!line.toLowerCase().includes('tech') &&
					!line.toLowerCase().includes('science')
				) {
					extractedName = line;
					break;
				}
			}
		}

		return {
			name: extractedName,
			accountNumber: extractedAccountNumber,
			program: extractedProgram,
			batch: extractedBatch
		};
	}

	function removeImage() {
		imageBase64 = '';
		rawFileFile = null;
		name = '';
		accountNumber = '';
		batchString = '';
	}

	async function uploadImageToTargetStorage(): Promise<string | null> {
		if (!rawFileFile || !accountNumber) return null;

		const signResponse = await fetch('/api/auth/register/sign-image', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ accountNumber })
		});

		const signData = await signResponse.json();
		if (!signResponse.ok || !signData.success) {
			throw new Error(signData.error || 'Failed generating secure image signature context');
		}

		const formData = new FormData();

		if (signData.provider === 'R2') {
			Object.entries(signData.fields).forEach(([key, value]) => {
				formData.append(key, value as string);
			});
			formData.append('Content-Type', rawFileFile.type);
			formData.append('file', rawFileFile);

			const uploadResponse = await fetch(signData.uploadUrl, {
				method: 'POST',
				body: formData
			});

			if (!uploadResponse.ok) {
				throw new Error('Cloudflare R2 core rejected direct payload configuration submission');
			}

			return signData.fileKey;
		} else {
			formData.append('file', rawFileFile);
			formData.append('api_key', signData.apiKey);
			formData.append('timestamp', signData.timestamp.toString());
			formData.append('signature', signData.signature);
			formData.append('folder', signData.folder);
			formData.append('public_id', signData.public_id);
			formData.append('type', signData.type);

			const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`;
			const uploadResponse = await fetch(cloudinaryUrl, {
				method: 'POST',
				body: formData
			});

			const uploadData = await uploadResponse.json();
			if (!uploadResponse.ok) {
				throw new Error(uploadData.error?.message || 'Cloudinary target delivery rejected payload');
			}

			return uploadData.secure_url;
		}
	}

	async function handleRegister(e: Event) {
		e.preventDefault();
		if (!isValid || isLoading) return;

		isLoading = true;
		errorMsg = '';

		try {
			const uploadPayloadReference = await uploadImageToTargetStorage();

			if (!uploadPayloadReference) {
				errorMsg = 'Verification image transmission sequence dropped.';
				isLoading = false;
				return;
			}

			const res = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name,
					accountNumber,
					pin,
					batch: batchString,
					credentialImage: uploadPayloadReference
				})
			});

			const data = await res.json();
			if (data.success) {
				isRegistered = true;
			} else {
				errorMsg = data.error || 'Registration failed';
			}
		} catch (err: unknown) {
			console.error('Registration error:', err);
			const errMsg = (err as { message: string }).message;
			errorMsg = errMsg || 'Network error. Please try again.';
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>{isRegistered ? 'Registration Pending' : 'Create Account'} | MunchUp</title>
</svelte:head>

<div
	class="animate-in fade-in relative mx-auto flex h-(--app-height) max-w-md flex-col overflow-hidden bg-background pb-6 duration-300"
>
	<header class="flex h-16 shrink-0 items-center gap-3 px-5">
		<div class="mt-2.5">
			<AppLogo />
			{#if !isRegistered}
				<p class="text-[13px] font-medium text-foreground/50">
					Set up your MunchUp profile and digital wallet.
				</p>
			{/if}
		</div>
	</header>

	{#if !isRegistered}
		<div class="animate-in fade-in mt-8 flex-1 overflow-y-auto px-5 pt-1 duration-200">
			<form onsubmit={handleRegister} class="space-y-5">
				<div class="space-y-2">
					<span class="block text-[10px] font-bold tracking-widest text-foreground/60 uppercase">
						Identification Card
					</span>

					<div
						class="relative aspect-[2.2/1] w-full overflow-hidden rounded-2xl border-2 border-dashed border-accent/15 bg-card"
					>
						{#if !imageBase64}
							<label
								class="flex h-full w-full cursor-pointer flex-col items-center justify-center bg-muted/20 p-4 text-center transition-colors
                                {isDragging ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'}"
								ondragover={(e) => {
									e.preventDefault();
									isDragging = true;
								}}
								ondragleave={() => (isDragging = false)}
								ondrop={(e) => {
									e.preventDefault();
									isDragging = false;
									if (e.dataTransfer?.files[0]) processFile(e.dataTransfer.files[0]);
								}}
							>
								<UploadCloud size={24} class="mb-1 text-foreground/40" />
								<span class="text-[13px] font-bold text-foreground">Scan Card Image</span>
								<span class="mt-0.5 text-[11px] text-foreground/40">PNG, JPG up to 5MB</span>
								<input type="file" accept="image/*" class="hidden" onchange={handleFileChange} />
							</label>
						{:else}
							<img
								src={imageBase64}
								alt="Identity Card Preview"
								class="h-full w-full object-cover transition-opacity duration-300 {isOcrProcessing
									? 'opacity-40 blur-xs filter'
									: 'opacity-100'}"
							/>

							{#if isOcrProcessing}
								<div
									class="absolute inset-0 flex flex-col items-center justify-center bg-background/20 p-4"
								>
									<Loader2 size={22} class="animate-spin text-primary" />
									<p
										class="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-primary uppercase"
									>
										<Sparkles size={11} /> Auto-filling...
									</p>
								</div>
							{/if}

							<button
								type="button"
								onclick={removeImage}
								disabled={isLoading}
								class="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-muted/30 bg-background/80 text-foreground shadow-sm backdrop-blur-md transition-transform hover:bg-background active:scale-90 disabled:opacity-50"
								title="Remove Image"
							>
								<X size={12} strokeWidth={2.5} />
							</button>
						{/if}
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<label
							for="name"
							class="block text-[10px] font-bold tracking-widest text-foreground/60 uppercase"
							>Full Name</label
						>
						<input
							id="name"
							type="text"
							bind:value={name}
							disabled={isLoading}
							class="w-full rounded-xl border border-muted/30 bg-muted/40 px-3 py-3 text-[13px] font-bold text-foreground transition-all placeholder:text-foreground/30 focus:border-foreground/30 focus:bg-muted/60 disabled:opacity-50"
							placeholder="Jane Doe"
							autocomplete="name"
						/>
					</div>

					<div class="space-y-2">
						<label
							for="accountNumber"
							class="block text-[10px] font-bold tracking-widest text-foreground/60 uppercase"
							>User ID</label
						>
						<input
							id="accountNumber"
							type="text"
							value={accountNumber}
							disabled={isLoading}
							oninput={(e) => handleAlphanumericInput(e, 'account')}
							class="w-full rounded-xl border border-muted/30 bg-muted/40 px-3 py-3 font-mono text-[13px] font-bold text-foreground uppercase transition-all placeholder:text-foreground/30 focus:border-foreground/30 focus:bg-muted/60 disabled:opacity-50"
							placeholder="BMS10445"
							autocomplete="off"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<label
							for="pin"
							class="block text-[10px] font-bold tracking-widest text-foreground/60 uppercase"
						>
							Create PIN
						</label>
						<input
							id="pin"
							type="password"
							maxlength="5"
							value={pin}
							disabled={isLoading}
							oninput={(e) => handleAlphanumericInput(e, 'pin')}
							class="w-full rounded-xl border border-muted/30 bg-muted/40 px-3 py-3 font-mono text-[15px] tracking-[0.2em] text-foreground uppercase transition-all placeholder:text-foreground/20 focus:border-foreground/30 focus:bg-muted/60 disabled:opacity-50"
							placeholder="•••••"
							autocomplete="off"
							autocorrect="off"
							autocapitalize="off"
						/>
					</div>

					<div class="space-y-2">
						<div class="flex items-end justify-between">
							<label
								for="confirmPin"
								class="block text-[10px] font-bold tracking-widest text-foreground/60 uppercase"
							>
								Confirm PIN
							</label>
							{#if pin.length === 5 && confirmPin.length > 0 && !isPinMatching}
								<span class="text-[9px] font-bold text-destructive">Mismatch</span>
							{/if}
						</div>
						<input
							id="confirmPin"
							type="password"
							maxlength="5"
							value={confirmPin}
							disabled={isLoading}
							oninput={(e) => handleAlphanumericInput(e, 'confirm')}
							class="w-full rounded-xl border border-muted/30 bg-muted/40 px-3 py-3 font-mono text-[15px] tracking-[0.2em] text-foreground uppercase transition-all placeholder:text-foreground/20 focus:border-foreground/30 focus:bg-muted/60 disabled:opacity-50
                            {pin.length === 5 && confirmPin.length > 0 && !isPinMatching
								? 'border-destructive/40 bg-destructive/5 text-destructive focus:border-destructive'
								: ''}"
							placeholder="•••••"
							autocomplete="off"
							autocorrect="off"
							autocapitalize="off"
						/>
					</div>
				</div>

				<button
					type="submit"
					disabled={!isValid || isLoading || isOcrProcessing}
					class="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-[13px] font-bold text-background transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
				>
					{#if isLoading}
						<Loader2 size={15} class="animate-spin" />
						<span>Processing...</span>
					{:else}
						<Check size={15} />
						<span>Create Account</span>
					{/if}
				</button>
			</form>

			{#if errorMsg}
				<div class="mt-4 rounded-full border border-destructive/20 bg-destructive/10 px-4 py-3">
					<p class="text-[11px] font-bold text-destructive">{errorMsg}</p>
				</div>
			{/if}
		</div>

		<div
			class="animate-in fade-in mx-4 mt-auto rounded-2xl bg-accent/15 px-2 pt-4 pb-2 text-center duration-200"
		>
			<p class="mb-2 text-[10px] font-bold tracking-widest text-foreground/40 uppercase">
				Already have an account?
			</p>
			<button
				onclick={() => goto(resolve('/login'))}
				class="w-full rounded-xl bg-background py-2 text-[13px] font-bold text-foreground transition-opacity active:opacity-60"
			>
				Login →
			</button>
		</div>
	{:else}
		<div
			class="animate-in zoom-in-95 mt-12 flex flex-1 flex-col justify-center px-5 text-center duration-300"
		>
			<div
				class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 ring-8 ring-amber-500/5"
			>
				<Clock size={28} strokeWidth={2.5} class="animate-pulse" />
			</div>

			<h2 class="mt-6 text-[20px] font-extrabold tracking-tight text-foreground">
				Account Created Successfully!
			</h2>
			<p class="mt-2 text-[13px] leading-relaxed font-medium text-foreground/50">
				Your profile details and ID card have been sent to our admin team for verification.
			</p>

			<div
				class="mt-8 space-y-4 rounded-3xl border border-muted/30 bg-card p-5 text-left shadow-[0_2px_12px_rgb(0,0,0,0.04)]"
			>
				<p class="text-[10px] font-bold tracking-widest text-foreground/40 uppercase">
					What happens next?
				</p>

				<div class="flex gap-3">
					<div
						class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary"
					>
						1
					</div>
					<p class="text-[12px] leading-normal font-semibold text-foreground/80">
						An admin will review your ID photo to verify your account information.
					</p>
				</div>

				<div class="flex gap-3">
					<div
						class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary"
					>
						2
					</div>
					<p class="text-[12px] leading-normal font-semibold text-foreground/80">
						Your account status will automatically switch to <span
							class="font-bold text-emerald-600">Active</span
						> once approved.
					</p>
				</div>

				<div class="flex gap-3">
					<div
						class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary"
					>
						3
					</div>
					<p class="text-[12px] leading-normal font-semibold text-foreground/80">
						After activation, you can log in, add money to your wallet, and order food.
					</p>
				</div>
			</div>

			<div
				class="mt-6 flex items-start gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-left"
			>
				<AlertCircle size={16} strokeWidth={2.5} class="mt-0.5 shrink-0 text-amber-600" />
				<p class="text-[11px] leading-relaxed font-medium text-amber-700/90">
					Please try logging in after <span class="font-bold">24 hours</span>. If your account is
					still not active by then, please visit the physical support counter.
				</p>
			</div>

			<div class="mt-8">
				<button
					onclick={() => goto(resolve('/login'))}
					class="w-full rounded-xl bg-primary py-3.5 text-[13px] font-bold text-background shadow-md transition-all active:scale-95"
				>
					Go to Login Screen
				</button>
			</div>
		</div>
	{/if}
</div>
