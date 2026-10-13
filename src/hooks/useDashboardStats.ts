import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { DashboardStats } from '@/types';

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        customersData,
        ordersData,
        paymentsData,
        inventoryData,
      ] = await Promise.all([
        api.get('customers'),
        api.get('orders'),
        api.get('payments'),
        api.get('inventory'),
      ]);

      const totalPaid = paymentsData
        .filter((p: any) => p.status === 'paid')
        .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        
      const totalOutstanding = paymentsData
        .filter((p: any) => p.status === 'pending' || p.status === 'overdue')
        .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      const recentOrders = ordersData
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6)
        .map((o: any) => ({
          ...o,
          customer: customersData.find((c: any) => c.id === o.customer_id)
        }));

      const today = new Date();
      const chartData = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toISOString().split('T')[0];
        
        const dayRevenue = paymentsData
          .filter((p: any) => p.status === 'paid' && p.created_at.startsWith(dateStr))
          .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
          
        const dayOrders = ordersData
          .filter((o: any) => o.created_at.startsWith(dateStr))
          .length;
          
        return {
          date: d.toLocaleDateString('en-US', { weekday: 'short' }),
          revenue: dayRevenue,
          orders: dayOrders,
        };
      });

      setStats({
        totalCustomers: customersData.length,
        activeOrders: ordersData.filter((o: any) => o.status === 'active').length,
        pendingOrders: ordersData.filter((o: any) => o.status === 'pending').length,
        completedOrders: ordersData.filter((o: any) => o.status === 'completed').length,
        totalPaymentsReceived: totalPaid,
        outstandingPayments: totalOutstanding,
        lowStockItems: inventoryData.filter((i: any) => Number(i.quantity) < Number(i.reorder_level)),
        recentOrders,
        chartData,
      });
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
