import { clsx } from '@/utils/clsx';

type Variant =
  | 'neutral'
  | 'blue'
  | 'amber'
  | 'green'
  | 'red'
  | 'purple'
  | 'gray';

interface BadgeProps {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}

const variantClasses: Record<Variant, string> = {
  neutral: 'bg-charcoal-700 text-steel-300 border-charcoal-600',
  blue: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  red: 'bg-red-500/15 text-red-300 border-red-500/30',
  purple: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  gray: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
};

export function Badge({ variant = 'neutral', className, children }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
