import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Order, Payment, InventoryItem, Customer } from '@/types';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { BarChart3, TrendingUp, Package, ClipboardList } from 'lucide-react';
import { formatCurrency, orderStatusConfig, paymentStatusConfig } from '@/utils/format';

export function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersData, paymentsData, inventoryData, customersData] = await Promise.all([
        api.get('orders'),
        api.get('payments'),
        api.get('inventory'),
        api.get('customers'),
      ]);
      setOrders(ordersData ?? []);
      setPayments(paymentsData ?? []);
      setInventory(inventoryData ?? []);
      setCustomers(customersData ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return <LoadingState label="Generating reports…" />;
  if (error) return <ErrorState message={error} onRetry={fetchAll} />;

  // Order status breakdown
  const orderStatusCounts = orders.reduce<Record<string, number>>((acc, j) => {
    acc[j.status] = (acc[j.status] ?? 0) + 1;
    return acc;
  }, {});

  // Order value by status
  const orderValueByStatus = orders.reduce<Record<string, number>>((acc, j) => {
    acc[j.status] = (acc[j.status] ?? 0) + Number(j.total_amount);
    return acc;
  }, {});

  // Payment summary
  const paidTotal = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0);
  const pendingTotal = payments.filter((p) => p.status === 'pending').reduce((s, p) => s + Number(p.amount), 0);
  const overdueTotal = payments.filter((p) => p.status === 'overdue').reduce((s, p) => s + Number(p.amount), 0);

  // Inventory value
  const inventoryValue = inventory.reduce((s, i) => s + Number(i.quantity) * Number(i.price_per_unit), 0);
  const lowStockCount = inventory.filter((i) => i.quantity < i.reorder_level).length;

  // Top customers by order value
  const customerOrderValue: Record<string, { name: string; total: number; count: number }> = {};
  orders.forEach((j) => {
    const c = customers.find((c) => c.id === j.customer_id);
    const key = j.customer_id;
    if (!customerOrderValue[key]) {
      customerOrderValue[key] = { name: c?.company ?? c?.name ?? 'Unknown', total: 0, count: 0 };
    }
    customerOrderValue[key].total += Number(j.total_amount);
    customerOrderValue[key].count += 1;
  });
  const topCustomers = Object.values(customerOrderValue).sort((a, b) => b.total - a.total).slice(0, 5);

  const maxOrderValue = Math.max(...Object.values(orderValueByStatus), 1);
  const maxCustomerValue = Math.max(...topCustomers.map((c) => c.total), 1);

  return (
    <div className="space-y-6">
      {/* Financial summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-steel-400">Revenue Collected</p>
              <p className="text-xl font-bold text-steel-100">{formatCurrency(paidTotal)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-steel-400">Outstanding</p>
              <p className="text-xl font-bold text-steel-100">{formatCurrency(pendingTotal + overdueTotal)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-steel-400">Inventory Value</p>
              <p className="text-xl font-bold text-steel-100">{formatCurrency(inventoryValue)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/15 text-red-400">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-steel-400">Low Stock Items</p>
              <p className="text-xl font-bold text-steel-100">{lowStockCount}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Order value by status */}
        <Card>
          <CardHeader title="Order Value by Status" subtitle="Total contract value grouped by status" />
          <div className="space-y-4 p-5 pt-3">
            {Object.entries(orderValueByStatus).length === 0 ? (
              <EmptyState icon={<BarChart3 className="h-8 w-8" />} title="No data" />
            ) : (
              (['pending', 'active', 'completed', 'cancelled'] as const).map((status) => {
                const value = orderValueByStatus[status] ?? 0;
                const count = orderStatusCounts[status] ?? 0;
                const cfg = orderStatusConfig[status];
                const pct = (value / maxOrderValue) * 100;
                return (
                  <div key={status}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant={cfg.badge}>{cfg.label}</Badge>
                        <span className="text-steel-500">{count} orders</span>
                      </div>
                      <span className="font-semibold text-steel-100">{formatCurrency(value)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-charcoal-700/60">
                      <div
                        className="h-full rounded-full bg-amber-400 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Payment breakdown */}
        <Card>
          <CardHeader title="Payment Breakdown" subtitle="Status of all payment records" />
          <div className="space-y-4 p-5 pt-3">
            {(['paid', 'pending', 'overdue'] as const).map((status) => {
              const cfg = paymentStatusConfig[status];
              const total = status === 'paid' ? paidTotal : status === 'pending' ? pendingTotal : overdueTotal;
              const count = payments.filter((p) => p.status === status).length;
              const maxTotal = Math.max(paidTotal, pendingTotal, overdueTotal, 1);
              const pct = (total / maxTotal) * 100;
              const barColor = status === 'paid' ? 'bg-emerald-400' : status === 'pending' ? 'bg-amber-400' : 'bg-red-400';
              return (
                <div key={status}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant={cfg.badge}>{cfg.label}</Badge>
                      <span className="text-steel-500">{count} payments</span>
                    </div>
                    <span className="font-semibold text-steel-100">{formatCurrency(total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-charcoal-700/60">
                    <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Top customers */}
      <Card>
        <CardHeader title="Top Customers by Order Value" subtitle="Highest-value clients across all orders" />
        <div className="p-5 pt-3">
          {topCustomers.length === 0 ? (
            <EmptyState icon={<BarChart3 className="h-8 w-8" />} title="No customer data" />
          ) : (
            <div className="space-y-3">
              {topCustomers.map((c, idx) => {
                const pct = (c.total / maxCustomerValue) * 100;
                return (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-charcoal-700/60 text-sm font-bold text-steel-300">
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="truncate font-medium text-steel-100">{c.name}</span>
                        <span className="shrink-0 font-semibold text-steel-100">{formatCurrency(c.total)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-charcoal-700/60">
                        <div className="h-full rounded-full bg-blue-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-0.5 text-xs text-steel-500">{c.count} order{c.count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
