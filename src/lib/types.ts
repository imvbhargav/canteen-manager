export interface UserWallet {
  studentId: string;
  name: string;
  rollNumber: string;
  balance: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: "Breakfast" | "Lunch" | "Snacks" | "Beverages";
  inStock: boolean;
  dietary: "veg" | "non-veg";
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
  status: "PENDING" | "READY" | "COMPLETED";
}

export type AppView = "DASHBOARD" | "MENU" | "TOP_UP" | "QR_TICKET" | "PROFILE";