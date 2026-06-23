import type { UserWallet, MenuItem, CartItem, Ticket } from '$lib/types';

// Key factory — all storage is scoped to the logged-in student
function keys(studentId: string) {
	return {
		cart: `munchup:${studentId}:cart`,
		ticket: `munchup:${studentId}:ticket`
	} as const;
}

// Loaders
function loadCart(studentId: string): CartItem[] {
	try {
		const raw = localStorage.getItem(keys(studentId).cart);
		return raw ? (JSON.parse(raw) as CartItem[]) : [];
	} catch {
		return [];
	}
}

function loadTicket(studentId: string): Ticket | null {
	try {
		const raw = localStorage.getItem(keys(studentId).ticket);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Ticket;
		parsed.timestamp = new Date(parsed.timestamp);
		return parsed;
	} catch {
		return null;
	}
}

// Savers
function saveCart(studentId: string, cart: CartItem[]): void {
	try {
		localStorage.setItem(keys(studentId).cart, JSON.stringify(cart));
	} catch {
		// Silently ignore — storage may be unavailable (private browsing, quota, etc.)
	}
}

function saveTicket(studentId: string, ticket: Ticket | null): void {
	try {
		if (ticket) {
			localStorage.setItem(keys(studentId).ticket, JSON.stringify(ticket));
		} else {
			localStorage.removeItem(keys(studentId).ticket);
		}
	} catch {
		// Silently ignore
	}
}

// State
export const appState = $state<{
	wallet: UserWallet | null;
	menuItems: MenuItem[];
	cart: CartItem[];
	activeTicket: Ticket | null;
}>({
	wallet: null,
	menuItems: [],
	cart: [],
	activeTicket: null
});

// Reactivity
$effect.root(() => {
	// When the wallet changes (login / logout / user switch), reload persisted
	// data for the incoming user and clear it when no user is present.
	$effect(() => {
		const id = appState.wallet?.referenceKey;
		if (id) {
			appState.cart = loadCart(id);
			appState.activeTicket = loadTicket(id);
		} else {
			appState.cart = [];
			appState.activeTicket = null;
		}
	});

	// 5-Minute Wallet Balance Polling
	$effect(() => {
		// Track the reference key to kick off/restart when a valid user logs in
		const id = appState.wallet?.referenceKey;
		if (!id) return;

		// 5 minutes in milliseconds
		const INTERVAL_MS = 5 * 60 * 1000;

		const fetchLatestWallet = async () => {
			try {
				// Fetch from your user/session API endpoint
				const res = await fetch('/api/wallet');
				if (res.ok && appState.wallet) {
					const updatedWallet = await res.json();
					// Update only the balance or the whole wallet object
					appState.wallet.balance = Number(updatedWallet.balance);
				}
			} catch (err) {
				console.error('Failed to auto-refresh wallet balance:', err);
			}
		};

		const interval = setInterval(fetchLatestWallet, INTERVAL_MS);

		// Cleanup interval when user logs out or referenceKey changes
		return () => clearInterval(interval);
	});

	// Persist cart — only runs when a user is logged in.
	$effect(() => {
		const id = appState.wallet?.referenceKey;
		if (id) saveCart(id, appState.cart);
	});

	// Persist active ticket — only runs when a user is logged in.
	$effect(() => {
		const id = appState.wallet?.referenceKey;
		if (id) saveTicket(id, appState.activeTicket);
	});
});
