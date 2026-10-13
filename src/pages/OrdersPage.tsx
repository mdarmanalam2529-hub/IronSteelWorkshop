import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Order, Customer, OrderStatus, OrderPriority, WorkshopSettings } from '@/types';
import { Card } from '@/components/ui/Card';
import { OrderImagesSection } from '@/components/orders/OrderImagesSection';
import { InventoryDeductionModal } from '@/components/orders/InventoryDeductionModal';
import { OrderInvoiceModal } from '@/components/orders/OrderInvoiceModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { ClipboardList, Plus, Pencil, Trash2, X, IndianRupee, Filter, Image, FileText, MessageCircle } from 'lucide-react';
import { formatCurrency, formatRelativeDate, orderStatusConfig, orderPriorityConfig } from '@/utils/format';

interface OrdersPageProps { search: string; }
interface OrderForm {
  customer_id: string;
  title: string;
  description: string;
  status: OrderStatus;
  priority: OrderPriority;
  due_date: string;
  total_amount: string;
  advance_paid: string;
}

const emptyForm: OrderForm = { customer_id: '', title: '', description: '', status: 'pending', priority: 'medium', due_date: '', total_amount: '', advance_paid: '' };
const statusFilters: { label: string; value: OrderStatus | 'all' }[] = [
  { label: 'All', value: 'all' }, { label: 'Pending', value: 'pending' }, { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' }, { label: 'Cancelled', value: 'cancelled' },
];
const inputClass = 'w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30';

export function OrdersPage({ search }: OrdersPageProps) {
  const [orders, setOrders] = useState<(Order & { customer?: Customer })[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [form, setForm] = useState<OrderForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof OrderForm, string>>>({});
  const [saving, setSaving] = useState(false);
  const [imagesOrder, setImagesOrder] = useState<Order | null>(null);
  const [deductionOrderTitle, setDeductionOrderTitle] = useState<string | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<(Order & { customer?: Customer }) | null>(null);
  const [workshop, setWorkshop] = useState<WorkshopSettings | null>(null);

  useEffect(() => {
    fetch('/api/workshop_settings')
      .then((r) => r.json())
      .then((ws) => { if (ws) setWorkshop(ws); })
      .catch(() => {});
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [ordersData, customersData] = await Promise.all([
        api.get('orders'),
        api.get('customers')
      ]);
      setCustomers(customersData);
      
      const ordersWithCustomers = ordersData.map((o: any) => {
        const foundCustomer = customersData.find((c: any) => c.id === o.customer_id);
        return {
          ...o,
          customer: foundCustomer || (o.customer_name ? {
            id: o.customer_id,
            name: o.customer_name,
            company: o.customer_company,
            email: o.customer_email,
            phone: o.customer_phone
          } : undefined)
        };
      });
      setOrders(ordersWithCustomers);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const filtered = orders.filter((order) => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (order.title?.toLowerCase().includes(q) ?? false) ||
      (order.description?.toLowerCase().includes(q) ?? false) ||
      (order.customer?.name?.toLowerCase().includes(q) ?? false) ||
      (order.customer?.company?.toLowerCase().includes(q) ?? false)
    );
  });
  function openAdd() { setEditing(null); setForm({ ...emptyForm, customer_id: customers[0]?.id ?? '' }); setFormErrors({}); setModalOpen(true); }
  function openEdit(order: Order) { setEditing(order); setForm({ customer_id: order.customer_id, title: order.title, description: order.description ?? '', status: order.status, priority: order.priority, due_date: order.due_date ?? '', total_amount: String(order.total_amount), advance_paid: String(order.advance_paid ?? 0) }); setFormErrors({}); setModalOpen(true); }
  function validate() {
    const errors: Partial<Record<keyof OrderForm, string>> = {};
    if (!form.customer_id) errors.customer_id = 'Customer is required';
    if (!form.title.trim()) errors.title = 'Title is required';
    if (!form.total_amount || Number.isNaN(Number(form.total_amount)) || Number(form.total_amount) < 0) errors.total_amount = 'Valid amount required';
    if (form.advance_paid && (Number.isNaN(Number(form.advance_paid)) || Number(form.advance_paid) < 0)) errors.advance_paid = 'Valid amount required';
    setFormErrors(errors); return Object.keys(errors).length === 0;
  }
  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    const payload = { customer_id: form.customer_id, title: form.title.trim(), description: form.description.trim() || null, status: form.status, priority: form.priority, due_date: form.due_date || null, total_amount: Number(form.total_amount), advance_paid: Number(form.advance_paid || 0) };
    try {
      if (editing) {
        await api.patch(`orders/${editing.id}`, payload);
        // If status changed to completed, show deduction modal
        if (payload.status === 'completed' && editing.status !== 'completed') {
          setDeductionOrderTitle(payload.title);
        }
      } else {
        const created = await api.post('orders', payload);
        if (payload.advance_paid > 0 && created?.id) {
          try {
            await api.post('payments', {
              customer_id: payload.customer_id,
              order_id: created.id,
              amount: payload.advance_paid,
              status: 'paid',
              method: 'transfer',
              paid_date: new Date().toISOString().slice(0, 10),
              notes: `Initial advance for order "${payload.title}"`,
            });
          } catch {}
        }
        if (payload.status === 'completed') {
          setDeductionOrderTitle(payload.title);
        }
      }
      setModalOpen(false);
      fetchOrders();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleShareWhatsApp(order: Order & { customer?: Customer }) {
    const custName = order.customer?.name || 'Customer';
    const rawPhone = order.customer?.whatsapp_number || order.customer?.phone || '';
    const phone = rawPhone.replace(/[^0-9+]/g, '');
    const wsName = workshop?.name || 'SteelWorks';
    const balance = Math.max(0, Number(order.total_amount || 0) - Number(order.advance_paid || 0));
    const statusLabel = orderStatusConfig[order.status]?.label || order.status;

    const message = encodeURIComponent(
      `Hello ${custName},\n\n` +
      `Here is an update on your order with ${wsName}:\n\n` +
      `📦 Order: ${order.title}\n` +
      `⚙️ Status: ${statusLabel}\n` +
      `💰 Total: ₹${Number(order.total_amount || 0).toLocaleString('en-IN')}\n` +
      `✅ Advance Paid: ₹${Number(order.advance_paid || 0).toLocaleString('en-IN')}\n` +
      `📊 Balance Due: ₹${balance.toLocaleString('en-IN')}\n\n` +
      `Thank you for choosing ${wsName}!`
    );

    const whatsappUrl = phone
      ? `https://wa.me/${phone.startsWith('+') ? phone.slice(1) : phone}?text=${message}`
      : `https://wa.me/?text=${message}`;

    window.open(whatsappUrl, '_blank');
  }
  async function handleDelete(order: Order) {
    if (!confirm(`Delete order "${order.title}"?`)) return;
    try {
      await api.delete(`orders/${order.id}`);
      fetchOrders();
    } catch (e: any) {
      setError(e.message);
    }
  }
  if (loading) return <LoadingState label="Loading orders…" />;
  if (error) return <ErrorState message={error} onRetry={fetchOrders} />;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-steel-500" />
          <div className="flex flex-wrap gap-1">
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={
                  statusFilter === filter.value
                    ? 'rounded-lg bg-amber-500/15 px-3 py-1.5 text-sm font-medium text-amber-300 ring-1 ring-amber-500/20'
                    : 'rounded-lg px-3 py-1.5 text-sm font-medium text-steel-400 hover:bg-charcoal-700/60 hover:text-steel-200'
                }
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={openAdd} size="sm" disabled={customers.length === 0}>
          <Plus className="h-4 w-4" /> Add Order
        </Button>
      </div>

      {customers.length === 0 && (
        <Card className="p-4">
          <p className="text-sm text-amber-300">
            You need at least one customer before creating an order. Go to the Customers page to add one.
          </p>
        </Card>
      )}

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList className="h-10 w-10" />}
            title={search || statusFilter !== 'all' ? 'No matching orders' : 'No orders yet'}
            message={search || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first order'}
            action={
              !search && statusFilter === 'all' && customers.length > 0 && (
                <Button onClick={openAdd} size="sm" className="mt-2">
                  <Plus className="h-4 w-4" /> Add Order
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
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="hidden px-5 py-3 font-medium lg:table-cell">Priority</th>
                  <th className="hidden px-5 py-3 font-medium sm:table-cell">Status</th>
                  <th className="hidden px-5 py-3 font-medium md:table-cell">Due Date</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                  <th className="hidden px-5 py-3 text-right font-medium md:table-cell">Advance</th>
                  <th className="hidden px-5 py-3 text-right font-medium lg:table-cell">Balance</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-700/40">
                {filtered.map((order) => {
                  const status = orderStatusConfig[order.status] ?? {
                    label: order.status || 'Pending',
                    badge: 'amber' as const,
                  };
                  const priority = orderPriorityConfig[order.priority] ?? {
                    label: order.priority || 'Medium',
                    badge: 'neutral' as const,
                  };
                  const customerDisplay =
                    order.customer?.company ||
                    order.customer?.name ||
                    (order as any).customer_company ||
                    (order as any).customer_name ||
                    '—';
                  const balanceDue = Number(order.total_amount || 0) - Number(order.advance_paid || 0);

                  return (
                    <tr key={order.id} className="transition-colors hover:bg-charcoal-700/20">
                      <td className="px-5 py-3">
                        <p className="font-medium text-steel-100">{order.title}</p>
                        {order.description && (
                          <p className="mt-0.5 max-w-xs truncate text-xs text-steel-500">{order.description}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-steel-300">{customerDisplay}</td>
                      <td className="hidden px-5 py-3 lg:table-cell">
                        <Badge variant={priority.badge}>{priority.label}</Badge>
                      </td>
                      <td className="hidden px-5 py-3 sm:table-cell">
                        <Badge variant={status.badge}>{status.label}</Badge>
                      </td>
                      <td className="hidden px-5 py-3 text-steel-400 md:table-cell">
                        {formatRelativeDate(order.due_date)}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-steel-100">
                        {formatCurrency(Number(order.total_amount || 0))}
                      </td>
                      <td className="hidden px-5 py-3 text-right text-steel-300 md:table-cell">
                        {formatCurrency(Number(order.advance_paid || 0))}
                      </td>
                      <td className="hidden px-5 py-3 text-right font-semibold text-amber-300 lg:table-cell">
                        {formatCurrency(Math.max(0, balanceDue))}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleShareWhatsApp(order)}
                            className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-500/15 hover:text-emerald-300 transition-colors"
                            title="Share Order Update on WhatsApp"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setInvoiceOrder(order)}
                            className="rounded-lg p-1.5 text-amber-500/80 hover:bg-amber-500/15 hover:text-amber-300 transition-colors"
                            title="Download Full / Partial Invoice"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setImagesOrder(order)}
                            className="rounded-lg p-1.5 text-steel-500 hover:bg-charcoal-700 hover:text-steel-100"
                            title="Order images"
                          >
                            <Image className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEdit(order)}
                            className="rounded-lg p-1.5 text-steel-500 hover:bg-charcoal-700 hover:text-steel-100"
                            title="Edit order"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(order)}
                            className="rounded-lg p-1.5 text-steel-500 hover:bg-red-500/10 hover:text-red-400"
                            title="Delete order"
                          >
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

      {imagesOrder && (
        <OrderImagesSection
          orderId={imagesOrder.id}
          orderTitle={imagesOrder.title}
          onClose={() => setImagesOrder(null)}
        />
      )}

      <InventoryDeductionModal
        open={!!deductionOrderTitle}
        onClose={() => setDeductionOrderTitle(null)}
        orderTitle={deductionOrderTitle || ''}
      />

      {invoiceOrder && (
        <OrderInvoiceModal
          open={!!invoiceOrder}
          onClose={() => setInvoiceOrder(null)}
          order={invoiceOrder}
          workshop={workshop}
        />
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-charcoal-700 bg-charcoal-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-charcoal-700 px-5 py-4">
              <h3 className="text-base font-semibold text-steel-100">
                {editing ? 'Edit Order' : 'Add Order'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-steel-500 hover:bg-charcoal-700 hover:text-steel-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-steel-300">Customer *</label>
                <select
                  value={form.customer_id}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Select a customer…</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                      {customer.company ? ` — ${customer.company}` : ''}
                    </option>
                  ))}
                </select>
                {formErrors.customer_id && (
                  <p className="mt-1 text-xs text-red-400">{formErrors.customer_id}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-steel-300">Order Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={inputClass}
                  placeholder="Steel Beam Fabrication"
                />
                {formErrors.title && (
                  <p className="mt-1 text-xs text-red-400">{formErrors.title}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-steel-300">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className={inputClass}
                  placeholder="Order details and specifications…"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-steel-300">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as OrderStatus })}
                    className={inputClass}
                  >
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-steel-300">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as OrderPriority })}
                    className={inputClass}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-steel-300">Due Date</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-steel-300">Total Amount *</label>
                  <div className="relative">
                    <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-600" />
                    <input
                      type="number"
                      value={form.total_amount}
                      onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
                      className={`${inputClass} pl-9`}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  {formErrors.total_amount && (
                    <p className="mt-1 text-xs text-red-400">{formErrors.total_amount}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-steel-300">Advance Paid</label>
                  <div className="relative">
                    <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-600" />
                    <input
                      type="number"
                      value={form.advance_paid}
                      onChange={(e) => setForm({ ...form, advance_paid: e.target.value })}
                      className={`${inputClass} pl-9`}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  {formErrors.advance_paid && (
                    <p className="mt-1 text-xs text-red-400">{formErrors.advance_paid}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-charcoal-700 px-5 py-4">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} loading={saving}>
                {editing ? 'Save Changes' : 'Add Order'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
