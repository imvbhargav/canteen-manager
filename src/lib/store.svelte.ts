import type { UserWallet, MenuItem, CartItem, Ticket } from '$lib/types';

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