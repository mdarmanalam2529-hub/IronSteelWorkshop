import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Customer, Order, Payment, CustomerStats } from '@/types';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import {
  ArrowLeft,
  Mail,
  Phone,
  MessageCircle,
  MapPin,
  Building2,
  StickyNote,
  ClipboardList,
  CheckCircle2,
  IndianRupee,
  AlertCircle,
  Calendar,
  CreditCard,
  Pencil,
} from 'lucide-react';
import {
  formatCurrency,
  formatDate,
  formatRelativeDate,
  orderStatusConfig,
  orderPriorityConfig,
  paymentStatusConfig,
  paymentMethodConfig,
} from '@/utils/format';

interface CustomerDetailPageProps {
  customerId: string;
  onBack: () => void;
  onEdit: (customer: Customer) => void;
}

export function CustomerDetailPage({ customerId, onBack, onEdit }: CustomerDetailPageProps) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);

    // 1. Try local SQLite API first
    try {
      const res = await fetch(`/api/customers/${customerId}/detail`);
      if (res.ok) {
        const detail = await res.json();
        if (detail.customer) {
          setCustomer(detail.customer);
          const orderList = (detail.orders || []).map((o: any) => ({
            ...o,
            total_amount: Number(o.total_amount || 0),
            advance_paid: Number(o.advance_paid || 0),
          }));
          const payList = (detail.payments || []).map((p: any) => ({
            ...p,
            amount: Number(p.amount || 0),
          }));
          setOrders(orderList);
          setPayments(payList);

          const totalBilled = orderList.reduce((s: number, o: any) => s + Number(o.total_amount), 0);
          const totalPaid = payList.filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + Number(p.amount), 0);
          const outstanding = payList.filter((p: any) => p.status !== 'paid').reduce((s: number, p: any) => s + Number(p.amount), 0);

          setStats({
            totalOrders: orderList.length,
            activeOrders: orderList.filter((o: any) => o.status === 'active').length,
            completedOrders: orderList.filter((o: any) => o.status === 'completed').length,
            totalBilled,
            totalPaid,
            outstanding,
          });
          setLoading(false);
          return;
        }
      }
    } catch {
      // Fallback to Supabase
    }

    try {
      const [cRes, jRes, pRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', customerId).maybeSingle(),
        supabase.from('orders').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }),
        supabase.from('payments').select('*, order:orders(id, title)').eq('customer_id', customerId).order('created_at', { ascending: false }),
      ]);

      if (cRes.error) { setError(cRes.error.message); setLoading(false); return; }
      if (!cRes.data) { setError('Customer not found'); setLoading(false); return; }

      setCustomer(cRes.data);
      setOrders(jRes.data ?? []);
      setPayments(pRes.data ?? []);

      const orderList = jRes.data ?? [];
      const payList = pRes.data ?? [];
      const totalBilled = orderList.reduce((s, order) => s + Number(order.total_amount), 0);
      const totalPaid = payList.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0);
      const outstanding = payList.filter((p) => p.status !== 'paid').reduce((s, p) => s + Number(p.amount), 0);

      setStats({
        totalOrders: orderList.length,
        activeOrders: orderList.filter((order) => order.status === 'active').length,
        completedOrders: orderList.filter((order) => order.status === 'completed').length,
        totalBilled,
        totalPaid,
        outstanding,
      });
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to load customer details');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  if (loading) return <LoadingState label="Loading customer profile…" />;
  if (error) return <ErrorState message={error} onRetry={fetchDetail} />;
  if (!customer || !stats) return null;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-steel-400 hover:text-steel-100 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Customers
      </button>

      {/* Header card */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
              <Building2 className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-steel-100">{customer.name}</h2>
              {customer.company && (
                <p className="mt-0.5 text-sm text-steel-400">{customer.company}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="gray">ID: {customer.id.slice(0, 8)}</Badge>
                <Badge variant="gray">Since {formatDate(customer.created_at)}</Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {customer.whatsapp_number && (
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => window.open(`https://wa.me/${customer.whatsapp_number!.replace(/[^0-9+]/g, '')}`, '_blank')}
              >
                <MessageCircle className="h-4 w-4 text-emerald-400" /> WhatsApp
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => onEdit(customer)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          </div>
        </div>

        {/* Contact info */}
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-charcoal-700/40 pt-5 sm:grid-cols-2 lg:grid-cols-3">
          {customer.email && (
            <p className="flex items-center gap-2 text-sm text-steel-300">
              <Mail className="h-4 w-4 text-steel-600" /> {customer.email}
            </p>
          )}
          {customer.phone && (
            <p className="flex items-center gap-2 text-sm text-steel-300">
              <Phone className="h-4 w-4 text-steel-600" /> {customer.phone}
            </p>
          )}
          {customer.whatsapp_number && (
            <p className="flex items-center gap-2 text-sm text-steel-300">
              <MessageCircle className="h-4 w-4 text-steel-600" /> {customer.whatsapp_number}
            </p>
          )}
          {customer.address && (
            <p className="flex items-start gap-2 text-sm text-steel-300">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-steel-600" /> {customer.address}
            </p>
          )}
          {customer.city && (
            <p className="flex items-center gap-2 text-sm text-steel-300">
              <MapPin className="h-4 w-4 text-steel-600" /> {customer.city}
            </p>
          )}
        </div>

        {customer.notes && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-charcoal-700/40 bg-charcoal-900/40 p-3">
            <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-steel-600" />
            <p className="text-sm text-steel-400">{customer.notes}</p>
          </div>
        )}
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-steel-500">Total Works</p>
              <p className="text-lg font-bold text-steel-100">{stats.totalOrders}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-steel-500">Active Work</p>
              <p className="text-lg font-bold text-steel-100">{stats.activeOrders}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-steel-500">Completed</p>
              <p className="text-lg font-bold text-steel-100">{stats.completedOrders}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-steel-500/15 text-steel-300">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-steel-500">Total Billed</p>
              <p className="text-lg font-bold text-steel-100">{formatCurrency(stats.totalBilled)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Payment summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-steel-500">Total Paid</p>
              <p className="text-lg font-bold text-emerald-300">{formatCurrency(stats.totalPaid)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/15 text-red-400">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-steel-500">Outstanding</p>
              <p className="text-lg font-bold text-red-300">{formatCurrency(stats.outstanding)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-steel-500/15 text-steel-300">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-steel-500">Total Billed</p>
              <p className="text-lg font-bold text-steel-100">{formatCurrency(stats.totalBilled)}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Work history */}
        <Card>
          <CardHeader title="Order History" subtitle={`${orders.length} order${orders.length !== 1 ? 's' : ''}`} />
          <div className="px-5 pb-5">
            {orders.length === 0 ? (
              <EmptyState icon={<ClipboardList className="h-8 w-8" />} title="No orders" message="This customer has no orders yet" />
            ) : (
              <div className="space-y-2">
                {orders.map((order) => {
                  const sCfg = orderStatusConfig[order.status];
                  const pCfg = orderPriorityConfig[order.priority];
                  return (
                    <div key={order.id} className="flex items-center gap-3 rounded-lg border border-charcoal-700/40 bg-charcoal-800/40 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-steel-100">{order.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge variant={sCfg.badge}>{sCfg.label}</Badge>
                          <Badge variant={pCfg.badge}>{pCfg.label}</Badge>
                          <span className="flex items-center gap-1 text-xs text-steel-500">
                            <Calendar className="h-3 w-3" /> {formatRelativeDate(order.due_date)}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-steel-100">{formatCurrency(order.total_amount)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {/* Payment history */}
        <Card>
          <CardHeader title="Payment History" subtitle={`${payments.length} payment${payments.length !== 1 ? 's' : ''}`} />
          <div className="px-5 pb-5">
            {payments.length === 0 ? (
              <EmptyState icon={<CreditCard className="h-8 w-8" />} title="No payments" message="This customer has no payment records yet" />
            ) : (
              <div className="space-y-2">
                {payments.map((p) => {
                  const sCfg = paymentStatusConfig[p.status];
                  return (
                    <div key={p.id} className="flex items-center gap-3 rounded-lg border border-charcoal-700/40 bg-charcoal-800/40 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-steel-100">
                          {p.order?.title ?? 'Standalone payment'}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge variant={sCfg.badge}>{sCfg.label}</Badge>
                          <span className="text-xs text-steel-500">{paymentMethodConfig[p.method]}</span>
                          {p.due_date && (
                            <span className="flex items-center gap-1 text-xs text-steel-500">
                              <Calendar className="h-3 w-3" /> {formatDate(p.due_date)}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-steel-100">{formatCurrency(p.amount)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
