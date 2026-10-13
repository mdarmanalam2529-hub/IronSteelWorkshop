import { clsx } from '@/utils/clsx';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, children, footer, maxWidth = 'max-w-lg' }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className={clsx('w-full rounded-xl border border-charcoal-700 bg-charcoal-800 shadow-2xl', maxWidth)}>
        <div className="flex items-center justify-between border-b border-charcoal-700 px-5 py-4">
          <h3 className="text-base font-semibold text-steel-100">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-steel-500 hover:bg-charcoal-700 hover:text-steel-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 border-t border-charcoal-700 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
