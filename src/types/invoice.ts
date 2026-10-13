// Invoice system types for SteelWorks Manager

export type InvoicePaymentStatus = 'paid' | 'partially_paid' | 'unpaid';

export interface InvoiceItem {
  description: string;
  hsn_sac?: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string | null;
  customer_id: string;
  // Snapshot fields
  customer_name: string;
  customer_company: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  customer_gstin?: string | null;
  place_of_supply?: string | null;
  order_title: string;
  // Invoice data
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  gst_enabled: boolean;
  gst_rate: number;
  gst_amount: number;
  gst_type?: 'cgst_sgst' | 'igst';
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  tax_inclusive?: boolean;
  round_off?: number;
  grand_total: number;
  // Payment sync
  total_paid: number;
  balance_due: number;
  payment_status: InvoicePaymentStatus;
  // Metadata
  invoice_date: string;
  due_date: string | null;
  notes: string | null;
  version: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvoiceVersion {
  id: string;
  invoice_id: string;
  version: number;
  snapshot: Omit<Invoice, 'id' | 'created_at' | 'updated_at' | 'is_archived'>;
  created_at: string;
}

export interface InvoiceSettings {
  gst_enabled: boolean;
  gstin: string;
  gst_rate: number;
}
