import { useDashboardStats } from '@/hooks/useDashboardStats';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import {
  Users,
  ClipboardList,
  Clock,
  CheckCircle2,
  IndianRupee,
  AlertCircle,
  Package,
  ArrowRight,
  Calendar,
} from 'lucide-react';
import {
  formatCurrency,
  formatDate,
  orderStatusConfig,
  orderPriorityConfig,
} from '@/utils/format';
import type { PageId } from '@/components/layout/Sidebar';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DashboardPageProps {
  onNavigate: (page: PageId) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { stats, loading, error, refetch } = useDashboardStats();

  if (loading) return <LoadingState label="Loading dashboard…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total Customers"
          value={String(stats.totalCustomers)}
          icon={Users}
          variant="blue"
        />
        <StatCard
          label="Active Orders"
          value={String(stats.activeOrders)}
          icon={ClipboardList}
          variant="amber"
        />
        <StatCard
          label="Pending Orders"
          value={String(stats.pendingOrders)}
          icon={Clock}
          variant="default"
        />
        <StatCard
          label="Completed Orders"
          value={String(stats.completedOrders)}
          icon={CheckCircle2}
          variant="green"
        />
        <StatCard
          label="Payments Received"
          value={formatCurrency(stats.totalPaymentsReceived)}
          icon={IndianRupee}
          variant="green"
        />
        <StatCard
          label="Outstanding Payments"
          value={formatCurrency(stats.outstandingPayments)}
          icon={AlertCircle}
          variant="red"
        />
      </div>

      {/* Analytics Chart */}
      <Card className="p-5">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-steel-100">Revenue & Orders (Last 7 Days)</h3>
          <p className="text-sm text-steel-500">Daily performance metrics</p>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value.toLocaleString('en-IN')}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '0.5rem', color: '#f8fafc' }}
                itemStyle={{ color: '#10b981' }}
              />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Recent orders */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Recent Orders"
            subtitle="Latest orders and their status"
            action={
              <button
                onClick={() => onNavigate('orders')}
                className="flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300 transition-colors"
              >
                View all <ArrowRight className="h-4 w-4" />
              </button>
            }
          />
          <div className="px-5 pb-5">
            {stats.recentOrders.length === 0 ? (
              <EmptyState title="No orders yet" message="Orders will appear here once created" />
            ) : (
              <div className="space-y-2">
                {stats.recentOrders.map((order) => {
                  const statusCfg = orderStatusConfig[order.status];
                  const priorityCfg = orderPriorityConfig[order.priority];
                  return (
                    <div
                      key={order.id}
                      className="flex items-center gap-4 rounded-lg border border-charcoal-700/40 bg-charcoal-800/40 p-3 transition-colors hover:border-charcoal-600"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-steel-100">{order.title}</p>
                        <p className="mt-0.5 truncate text-xs text-steel-500">
                          {order.customer?.company ?? order.customer?.name ?? '—'}
                        </p>
                      </div>
                      <div className="hidden items-center gap-2 sm:flex">
                        <Badge variant={priorityCfg.badge}>{priorityCfg.label}</Badge>
                        <Badge variant={statusCfg.badge}>{statusCfg.label}</Badge>
                      </div>
                      <div className="hidden items-center gap-1.5 text-xs text-steel-500 md:flex">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(order.due_date)}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-steel-100">
                          {formatCurrency(order.total_amount)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {/* Low stock */}
        <Card>
          <CardHeader
            title="Low-Stock Materials"
            subtitle="Items below reorder level"
            action={
              <button
                onClick={() => onNavigate('inventory')}
                className="flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300 transition-colors"
              >
                View all <ArrowRight className="h-4 w-4" />
              </button>
            }
          />
          <div className="px-5 pb-5">
            {stats.lowStockItems.length === 0 ? (
              <EmptyState
                icon={<Package className="h-8 w-8" />}
                title="All stock healthy"
                message="No materials below reorder level"
              />
            ) : (
              <div className="space-y-2">
                {stats.lowStockItems.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border border-charcoal-700/40 bg-charcoal-800/40 p-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                      <Package className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-steel-100">{item.name}</p>
                      <p className="text-xs text-steel-500">{item.sku ?? 'No SKU'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-red-300">
                        {item.quantity} {item.unit}
                      </p>
                      <p className="text-xs text-steel-500">
                        Reorder at {item.reorder_level}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
