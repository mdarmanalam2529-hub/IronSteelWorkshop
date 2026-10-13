import { clsx } from '@/utils/clsx';

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className, children }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-charcoal-700/60 bg-charcoal-800/60 backdrop-blur-sm',
        'shadow-lg shadow-black/20',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={clsx('flex items-start justify-between gap-4 p-5 pb-3', className)}>
      <div>
        <h3 className="text-base font-semibold text-steel-100">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-steel-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
