import React from 'react';
import { clsx } from '@/utils/clsx';

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

export function FormField({ label, required, error, className, children }: FormFieldProps) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-steel-300">
        {label} {required && <span className="text-amber-400">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ComponentType<{ className?: string }>;
}

export const FormInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ icon: Icon, className, ...props }, ref) => {
    if (Icon) {
      return (
        <div className="relative">
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-600" />
          <input className={clsx(inputClass, 'pl-9', className)} ref={ref} {...props} />
        </div>
      );
    }
    return <input className={clsx(inputClass, className)} ref={ref} {...props} />;
  }
);
FormInput.displayName = 'FormInput';

export const FormSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <select className={clsx(inputClass, className)} ref={ref} {...props}>
        {children}
      </select>
    );
  }
);
FormSelect.displayName = 'FormSelect';

export const FormTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return <textarea className={clsx(inputClass, className)} ref={ref} {...props} />;
  }
);
FormTextarea.displayName = 'FormTextarea';
