import { clsx } from '@/utils/clsx';
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: { direction: 'up' | 'down'; value: string };
  variant?: 'default' | 'amber' | 'green' | 'red' | 'blue';
}

const variantStyles: Record<string, string> = {
  default: 'border-charcoal-700/60',
  amber: 'border-amber-500/30 bg-amber-500/5',
  green: 'border-emerald-500/30 bg-emerald-500/5',
  red: 'border-red-500/30 bg-red-500/5',
  blue: 'border-blue-500/30 bg-blue-500/5',
};

const iconBg: Record<string, string> = {
  default: 'bg-charcoal-700/60 text-steel-300',
  amber: 'bg-amber-500/15 text-amber-400',
  green: 'bg-emerald-500/15 text-emerald-400',
  red: 'bg-red-500/15 text-red-400',
  blue: 'bg-blue-500/15 text-blue-400',
};

export function StatCard({ label, value, icon: Icon, trend, variant = 'default' }: StatCardProps) {
  return (
    <div
      className={clsx(
        'rounded-xl border bg-charcoal-800/60 p-5 shadow-lg shadow-black/20 backdrop-blur-sm transition-all duration-200 hover:border-charcoal-600 hover:shadow-xl',
        variantStyles[variant],
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-steel-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-steel-100">{value}</p>
        </div>
        <div
          className={clsx(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            iconBg[variant],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          {trend.direction === 'up' ? (
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-red-400" />
          )}
          <span className={trend.direction === 'up' ? 'text-emerald-400' : 'text-red-400'}>
            {trend.value}
          </span>
        </div>
      )}
    </div>
  );
}
