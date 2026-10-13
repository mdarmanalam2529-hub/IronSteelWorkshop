export type OrderStatus = 'pending' | 'active' | 'completed' | 'cancelled';
export type OrderPriority = 'low' | 'medium' | 'high' | 'urgent';
export type PaymentStatus = 'pending' | 'paid' | 'overdue';
export type PaymentMethod = 'cash' | 'check' | 'transfer' | 'card';
export type UserRole = 'admin' | 'manager' | 'worker';

export interface Customer {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  created_at: string;
}

export interface CustomerStats {
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
}

export interface CustomerDetail extends Customer {
  orders: Order[];
  payments: Payment[];
}

export interface Order {
  id: string;
  customer_id: string;
  title: string;
  description: string | null;
  status: OrderStatus;
  priority: OrderPriority;
  due_date: string | null;
  total_amount: number;
  advance_paid: number;
  created_at: string;
  updated_at: string;
  customer?: Customer;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
  sku: string | null;
  quantity: number;
  unit: string;
  reorder_level: number;
  price_per_unit: number;
  supplier: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  order_id: string | null;
  customer_id: string;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod;
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
  created_at: string;
  customer?: Customer;
  order?: Pick<Order, 'id' | 'title'>;
}

export interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  active: boolean;
  created_at: string;
}

export interface WorkshopSettings {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  working_hours: string;
  gst_enabled?: boolean;
  gstin?: string;
  gst_rate?: number;
  gst_type?: 'cgst_sgst' | 'igst'; // whether to split as CGST+SGST or keep as IGST
  state_code?: string;
  state_name?: string;
  tax_inclusive?: boolean;
  default_hsn?: string;
  auto_state_split?: boolean;
  updated_at: string;
}

export interface SupportRequest {
  id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
}

export interface ActivityLog {
  id: string;
  table_name: string;
  record_id: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  description: string;
  changes: Record<string, unknown> | null;
  created_at: string;
}

export interface DashboardStats {
  totalCustomers: number;
  activeOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalPaymentsReceived: number;
  outstandingPayments: number;
  lowStockItems: InventoryItem[];
  recentOrders: (Order & { customer?: Customer })[];
  chartData?: { date: string; revenue: number; orders: number }[];
}
