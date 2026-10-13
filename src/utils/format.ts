import { clsx } from '@/utils/clsx';
import type {
  OrderStatus,
  OrderPriority,
  PaymentStatus,
  PaymentMethod,
} from '@/types';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
  return formatDate(dateStr);
}

export const orderStatusConfig: Record<
  OrderStatus,
  { label: string; badge: 'blue' | 'amber' | 'green' | 'gray' }
> = {
  pending: { label: 'Pending', badge: 'amber' },
  active: { label: 'Active', badge: 'blue' },
  completed: { label: 'Completed', badge: 'green' },
  cancelled: { label: 'Cancelled', badge: 'gray' },
};

export const orderPriorityConfig: Record<
  OrderPriority,
  { label: string; badge: 'neutral' | 'amber' | 'red' | 'gray' }
> = {
  low: { label: 'Low', badge: 'gray' },
  medium: { label: 'Medium', badge: 'neutral' },
  high: { label: 'High', badge: 'amber' },
  urgent: { label: 'Urgent', badge: 'red' },
};

export const paymentStatusConfig: Record<
  PaymentStatus,
  { label: string; badge: 'amber' | 'green' | 'red' }
> = {
  pending: { label: 'Pending', badge: 'amber' },
  paid: { label: 'Paid', badge: 'green' },
  overdue: { label: 'Overdue', badge: 'red' },
};

export const paymentMethodConfig: Record<PaymentMethod, string> = {
  cash: 'Cash',
  check: 'Check',
  transfer: 'Transfer',
  card: 'Card',
};

export function cn(...inputs: Parameters<typeof clsx>): string {
  return clsx(...inputs);
}
