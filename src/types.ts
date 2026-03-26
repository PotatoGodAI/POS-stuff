export type Role = 'admin' | 'cashier';
export type UserStatus = 'pending' | 'active' | 'blocked';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  isSuperAdmin?: boolean;
  ownerId?: string; // The Admin who owns this account (for cashiers)
  createdAt: string;
  lastLogin?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  stockLevel: number; // Total quantity in stock (e.g. 5000)
  unitAmount: number; // Reference amount for price (e.g. 100)
  unitName: string;   // Unit name (e.g. "grams")
  pricePerUnitAmount: number; // Price for the unitAmount (e.g. 500)
  lowStockThreshold: number;
  ownerId: string;
}

export interface RecipeItem {
  ingredientId: string;
  quantity: number;
}

export interface Category {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  variations: Record<string, number>; // e.g. { 'Small': 0, 'Medium': 20, 'Large': 40 }
  addOns: Record<string, number>; // e.g. { 'Extra Shot': 15, 'Oat Milk': 20 }
  recipe: RecipeItem[];
  ownerId: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  variation?: string;
  addOns: string[];
  price: number;
  cost: number;
  quantity: number;
}

export interface PendingOrder {
  id: string;
  items: SaleItem[];
  total: number;
  discount: number;
  staffId: string;
  staffName: string;
  timestamp: string;
  ownerId: string;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  discount: number;
  paymentMethod: 'Cash' | 'GCash' | 'Card';
  staffId: string;
  staffName: string;
  timestamp: string;
  totalCost: number;
  profit: number;
  ownerId: string;
}

export interface Shift {
  id: string;
  staffId: string;
  startTime: string;
  endTime?: string;
  totalSales: number;
  status: 'open' | 'closed';
  ownerId: string;
}
