import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { clsx } from '@/utils/clsx';
import type { WorkshopSettings } from '@/types';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Package,
  CreditCard,
  FileText,
  BarChart3,
  Settings,
  HardHat,
  X,
} from 'lucide-react';

export type PageId =
  | 'dashboard'
  | 'customers'
  | 'orders'
  | 'inventory'
  | 'payments'
  | 'invoices'
  | 'reports'
  | 'settings';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'orders', label: 'Orders', icon: ClipboardList },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  current: PageId;
  onNavigate: (page: PageId) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ current, onNavigate, mobileOpen, onCloseMobile }: SidebarProps) {
  const [workshop, setWorkshop] = useState<WorkshopSettings | null>(null);

  useEffect(() => {
    Promise.resolve(
      supabase
        .from('workshop_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle()
    )
      .then(({ data }) => {
        if (data) {
          setWorkshop(data as WorkshopSettings);
        } else {
          fetch('/api/workshop_settings')
            .then((r) => r.json())
            .then((ws) => { if (ws) setWorkshop(ws); })
            .catch(() => {});
        }
      })
      .catch(() => {
        fetch('/api/workshop_settings')
          .then((r) => r.json())
          .then((ws) => { if (ws) setWorkshop(ws); })
          .catch(() => {});
      });
  }, []);

  const hoursLines = workshop?.working_hours?.split('\n').filter(Boolean) ?? ['Mon–Fri 6:00–16:00', 'Sat 7:00–12:00'];

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-charcoal-700/60 bg-charcoal-900 transition-transform duration-200 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-charcoal-700/60 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20">
            <HardHat className="h-5 w-5 text-charcoal-950" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-steel-100">SteelWorks</h1>
            <p className="text-xs text-steel-500">Manager</p>
          </div>
          <button
            onClick={onCloseMobile}
            className="ml-auto rounded-lg p-1.5 text-steel-400 hover:bg-charcoal-700 hover:text-steel-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = current === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={clsx(
                  'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-amber-500/10 text-amber-300 shadow-sm ring-1 ring-amber-500/20'
                    : 'text-steel-400 hover:bg-charcoal-700/60 hover:text-steel-100',
                )}
              >
                <Icon
                  className={clsx(
                    'h-5 w-5 shrink-0 transition-colors',
                    active ? 'text-amber-400' : 'text-steel-500 group-hover:text-steel-300',
                  )}
                />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-charcoal-700/60 p-4">
          <div className="rounded-lg bg-charcoal-800/60 p-3">
            <p className="text-xs font-medium text-steel-300">Workshop Hours</p>
            {hoursLines.map((line, i) => (
              <p key={i} className="text-xs text-steel-500">{line}</p>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
