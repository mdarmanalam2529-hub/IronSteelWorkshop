import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Payment, Customer, Order, PaymentStatus, PaymentMethod } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { StatCard } from '@/components/dashboard/StatCard';
import { CreditCard, Plus, Pencil, Trash2, X, IndianRupee, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatDate, paymentStatusConfig, paymentMethodConfig } from '@/utils/format';

interface PaymentsPageProps {
  search: string;
}

interface PayForm {
  customer_id: string;
  order_id: string;
  amount: string;
  status: PaymentStatus;
  method: PaymentMethod;
  due_date: string;
  paid_date: string;
  notes: string;
}

const emptyForm: PayForm = {
  customer_id: '',
  order_id: '',
  amount: '',
  status: 'pending',
  method: 'transfer',
  due_date: '',
  paid_date: '',
  notes: '',
};

const statusFilters: { label: string; value: PaymentStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Paid', value: 'paid' },
  { label: 'Overdue', value: 'overdue' },
];

export function PaymentsPage({ search }: PaymentsPageProps) {
  const [payments, setPayments] = useState<(Payment & { customer?: Customer; order?: Pick<Order, 'id' | 'title'> })[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [form, setForm] = useState<PayForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof PayForm, string>>>({});
  const [saving, setSaving] = useState(false);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [paymentsData, customersData, ordersData] = await Promise.all([
        api.get('payments'),
        api.get('customers'),
        api.get('orders')
      ]);
      setCustomers(customersData);
      setOrders(ordersData);
      
      const paymentsWithRelations = paymentsData.map((p: any) => ({
        ...p,
        customer: customersData.find((c: any) => c.id === p.customer_id),
        order: ordersData.find((o: any) => o.id === p.order_id)
      }));
      setPayments(paymentsWithRelations);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const filtered = payments.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (p.customer?.name.toLowerCase().includes(q) ?? false) ||
      (p.customer?.company?.toLowerCase().includes(q) ?? false) ||
      (p.order?.title.toLowerCase().includes(q) ?? false) ||
      (p.notes?.toLowerCase().includes(q) ?? false)
    );
  });

  const totalReceived = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0);
  const totalPending = payments.filter((p) => p.status === 'pending').reduce((s, p) => s + Number(p.amount), 0);
  const totalOverdue = payments.filter((p) => p.status === 'overdue').reduce((s, p) => s + Number(p.amount), 0);

  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm, customer_id: customers[0]?.id ?? '' });
    setFormErrors({});
    setModalOpen(true);
  }

  function openEdit(p: Payment) {
    setEditing(p);
    setForm({
      customer_id: p.customer_id,
      order_id: p.order_id ?? '',
      amount: String(p.amount),
      status: p.status,
      method: p.method,
      due_date: p.due_date ?? '',
      paid_date: p.paid_date ?? '',
      notes: p.notes ?? '',
    });
    setFormErrors({});
    setModalOpen(true);
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof PayForm, string>> = {};
    if (!form.customer_id) errs.customer_id = 'Customer is required';
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)
      errs.amount = 'Valid amount required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    const payload = {
      customer_id: form.customer_id,
      order_id: form.order_id || null,
      amount: Number(form.amount),
      status: form.status,
      method: form.method,
      due_date: form.due_date || null,
      paid_date: form.status === 'paid' ? (form.paid_date || new Date().toISOString().slice(0, 10)) : null,
      notes: form.notes.trim() || null,
    };
    try {
      if (editing) {
        await api.patch(`payments/${editing.id}`, payload);
      } else {
        await api.post('payments', payload);
      }
      setModalOpen(false);
      fetchPayments();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: Payment) {
    if (!confirm('Delete this payment record?')) return;
    try {
      await api.delete(`payments/${p.id}`);
      fetchPayments();
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (loading) return <LoadingState label="Loading payments…" />;
  if (error) return <ErrorState message={error} onRetry={fetchPayments} />;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Received" value={formatCurrency(totalReceived)} icon={CheckCircle2} variant="green" />
        <StatCard label="Pending" value={formatCurrency(totalPending)} icon={IndianRupee} variant="amber" />
        <StatCard label="Overdue" value={formatCurrency(totalOverdue)} icon={AlertCircle} variant="red" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={
                statusFilter === f.value
                  ? 'rounded-lg bg-amber-500/15 px-3 py-1.5 text-sm font-medium text-amber-300 ring-1 ring-amber-500/20'
                  : 'rounded-lg px-3 py-1.5 text-sm font-medium text-steel-400 hover:bg-charcoal-700/60 hover:text-steel-200'
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button onClick={openAdd} size="sm" disabled={customers.length === 0}>
          <Plus className="h-4 w-4" /> Add Payment
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CreditCard className="h-10 w-10" />}
            title={search || statusFilter !== 'all' ? 'No matching payments' : 'No payments yet'}
            message={search || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Record your first payment'}
            action={
              !search && statusFilter === 'all' && customers.length > 0 && (
                <Button onClick={openAdd} size="sm" className="mt-2">
                  <Plus className="h-4 w-4" /> Add Payment
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal-700/60 text-left text-xs uppercase tracking-wider text-steel-500">
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="hidden px-5 py-3 font-medium lg:table-cell">Order</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                  <th className="hidden px-5 py-3 font-medium sm:table-cell">Method</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="hidden px-5 py-3 font-medium md:table-cell">Due Date</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-700/40">
                {filtered.map((p) => {
                  const statusCfg = paymentStatusConfig[p.status];
                  return (
                    <tr key={p.id} className="hover:bg-charcoal-700/20 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-steel-100">{p.customer?.name ?? '—'}</p>
                        {p.customer?.company && <p className="text-xs text-steel-500">{p.customer.company}</p>}
                      </td>
                      <td className="hidden px-5 py-3 text-steel-400 lg:table-cell">{p.order?.title ?? '—'}</td>
                      <td className="px-5 py-3 text-right font-semibold text-steel-100">{formatCurrency(p.amount)}</td>
                      <td className="hidden px-5 py-3 text-steel-400 sm:table-cell">{paymentMethodConfig[p.method]}</td>
                      <td className="px-5 py-3"><Badge variant={statusCfg.badge}>{statusCfg.label}</Badge></td>
                      <td className="hidden px-5 py-3 text-steel-400 md:table-cell">{formatDate(p.due_date)}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-steel-500 hover:bg-charcoal-700 hover:text-steel-100 transition-colors">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(p)} className="rounded-lg p-1.5 text-steel-500 hover:bg-red-500/10 hover:text-red-400 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-charcoal-700 bg-charcoal-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-charcoal-700 px-5 py-4">
              <h3 className="text-base font-semibold text-steel-100">{editing ? 'Edit Payment' : 'Add Payment'}</h3>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-steel-500 hover:bg-charcoal-700 hover:text-steel-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-steel-300">Customer *</label>
                <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value, order_id: '' })}
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30">
                  <option value="">Select a customer…</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>)}
                </select>
                {formErrors.customer_id && <p className="mt-1 text-xs text-red-400">{formErrors.customer_id}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-steel-300">Linked Order (optional)</label>
                <select value={form.order_id} onChange={(e) => setForm({ ...form, order_id: e.target.value })}
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30">
                  <option value="">No linked order</option>
                  {orders.filter((order) => !form.customer_id || order.customer_id === form.customer_id).map((order) => (
                    <option key={order.id} value={order.id}>{order.title}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-steel-300">Amount *</label>
                  <div className="relative">
                    <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-600" />
                    <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 py-2 pl-9 pr-3 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                      placeholder="0.00" min="0" step="0.01" />
                  </div>
                  {formErrors.amount && <p className="mt-1 text-xs text-red-400">{formErrors.amount}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-steel-300">Method</label>
                  <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as PaymentMethod })}
                    className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30">
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                    <option value="transfer">Transfer</option>
                    <option value="card">Card</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-steel-300">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PaymentStatus })}
                    className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30">
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-steel-300">Due Date</label>
                  <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30" />
                </div>
              </div>
              {form.status === 'paid' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-steel-300">Paid Date</label>
                  <input type="date" value={form.paid_date} onChange={(e) => setForm({ ...form, paid_date: e.target.value })}
                    className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30" />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-steel-300">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                  placeholder="Deposit, balance, terms…" />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-charcoal-700 px-5 py-4">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>{editing ? 'Save Changes' : 'Add Payment'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
