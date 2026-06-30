export interface UserWallet {
	name: string;
	referenceKey: string;
	accountNumber: string;
	balance: number;
}

export interface MenuItem {
	id: string;
	name: string;
	description: string;
	price: number;
	category: 'Breakfast' | 'Lunch' | 'Snacks' | 'Beverages';
	inStock: boolean;
	dietary: 'veg' | 'non-veg';
}

export interface CartItem {
	menuItem: MenuItem;
	quantity: number;
}

export interface Ticket {
	id: string;
	items: CartItem[];
	total: number;
	timestamp: Date;
	status: 'PENDING' | 'READY' | 'COMPLETED';
}

export type AppView = 'DASHBOARD' | 'MENU' | 'TOP_UP' | 'QR_TICKET' | 'PROFILE';

export interface APITicketItem {
	id: string;
	quantity: number;
	unitPrice: string;
	menuItem: MenuItem;
}

export interface APITicket {
	id: string;
	ticketReference: string;
	totalAmount: string;
	status: 'PENDING' | 'READY' | 'COMPLETED' | 'CANCELLED';
	createdAt: string;
	items: APITicketItem[];
	formattedDate?: string;
	totalItems?: number;
}
