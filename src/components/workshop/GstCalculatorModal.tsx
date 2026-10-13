import { useState, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  calculateGstTax,
  INDIAN_STATES,
  STANDARD_GST_RATES,
  COMMON_WORKSHOP_HSN_SAC,
  determineGstTypeFromStates,
  type WorkshopHsnSac,
} from '@/utils/gstCalculator';
import { formatCurrency } from '@/utils/format';
import {
  Calculator,
  IndianRupee,
  Check,
  Copy,
  ArrowRightLeft,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface GstCalculatorModalProps {
  open: boolean;
  onClose: () => void;
  initialAmount?: number;
  initialRate?: number;
  initialGstType?: 'cgst_sgst' | 'igst';
  workshopStateCode?: string;
  onApply?: (result: {
    amount: number;
    taxableAmount: number;
    rate: number;
    gstType: 'cgst_sgst' | 'igst';
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalTax: number;
    grandTotal: number;
    hsnCode?: string;
  }) => void;
}

export function GstCalculatorModal({
  open,
  onClose,
  initialAmount = 10000,
  initialRate = 18,
  initialGstType = 'cgst_sgst',
  workshopStateCode = '27',
  onApply,
}: GstCalculatorModalProps) {
  const [amountStr, setAmountStr] = useState<string>(String(initialAmount || 10000));
  const [rate, setRate] = useState<number>(initialRate || 18);
  const [customRate, setCustomRate] = useState<string>('');
  const [isInclusive, setIsInclusive] = useState<boolean>(false);
  const [taxMode, setTaxMode] = useState<'cgst_sgst' | 'igst' | 'auto'>('cgst_sgst');
  const [workshopState, setWorkshopState] = useState<string>(workshopStateCode || '27');
  const [customerState, setCustomerState] = useState<string>(workshopStateCode || '27');
  const [selectedHsn, setSelectedHsn] = useState<WorkshopHsnSac | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Compute effective GST Type
  const effectiveGstType: 'cgst_sgst' | 'igst' = useMemo(() => {
    if (taxMode === 'auto') {
      return determineGstTypeFromStates(workshopState, customerState);
    }
    return taxMode;
  }, [taxMode, workshopState, customerState]);

  const parsedAmount = Math.max(0, Number(amountStr) || 0);

  // Live GST Calculation
  const result = useMemo(() => {
    return calculateGstTax({
      amount: parsedAmount,
      rate,
      isInclusive,
      gstType: effectiveGstType,
      roundOffResult: true,
    });
  }, [parsedAmount, rate, isInclusive, effectiveGstType]);

  function handleRateSelect(r: number) {
    setRate(r);
    setCustomRate('');
  }

  function handleCustomRateChange(val: string) {
    setCustomRate(val);
    const n = Number(val);
    if (!Number.isNaN(n) && n >= 0) {
      setRate(n);
    }
  }

  function handleSelectHsn(item: WorkshopHsnSac) {
    setSelectedHsn(item);
    setRate(item.defaultRate);
    setCustomRate('');
    toast.success(`Selected HSN ${item.code} (${item.defaultRate}% GST)`);
  }

  function handleCopy() {
    const text = `--- GST Calculation Breakdown ---
Mode: ${isInclusive ? 'Tax Inclusive (Reverse GST)' : 'Tax Exclusive'}
Taxable Amount: ₹${result.taxableAmount.toLocaleString('en-IN')}
GST Rate: ${result.gstRate}%
${
  result.gstType === 'cgst_sgst'
    ? `CGST (${result.cgstRate}%): ₹${result.cgstAmount.toLocaleString('en-IN')}
SGST (${result.sgstRate}%): ₹${result.sgstAmount.toLocaleString('en-IN')}`
    : `IGST (${result.igstRate}%): ₹${result.igstAmount.toLocaleString('en-IN')}`
}
Total Tax: ₹${result.totalTax.toLocaleString('en-IN')}
Round Off: ₹${result.roundOff > 0 ? '+' : ''}${result.roundOff}
Grand Total: ₹${result.grandTotal.toLocaleString('en-IN')}
--------------------------------`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('GST Breakdown copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  }

  function handleApply() {
    if (onApply) {
      onApply({
        amount: parsedAmount,
        taxableAmount: result.taxableAmount,
        rate: result.gstRate,
        gstType: result.gstType,
        cgstAmount: result.cgstAmount,
        sgstAmount: result.sgstAmount,
        igstAmount: result.igstAmount,
        totalTax: result.totalTax,
        grandTotal: result.grandTotal,
        hsnCode: selectedHsn?.code,
      });
      onClose();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Dynamic GST Calculator & Simulator"
      maxWidth="max-w-3xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="secondary" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy Summary'}
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {onApply && (
              <Button onClick={handleApply}>
                <Sparkles className="h-4 w-4" /> Apply to Invoice
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Top Input & Mode Selector */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-steel-200">
              {isInclusive ? 'Gross Total Amount (Inclusive of GST)' : 'Base Amount (Exclusive of GST)'}
            </label>
            <div className="relative">
              <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
              <input
                type="number"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 py-2.5 pl-9 pr-3 text-base font-semibold text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                placeholder="10000"
                min="0"
                step="100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-steel-200">Calculation Method</label>
            <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-charcoal-700 bg-charcoal-900 p-1">
              <button
                type="button"
                onClick={() => setIsInclusive(false)}
                className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  !isInclusive
                    ? 'bg-amber-500 text-charcoal-950 font-semibold shadow-sm'
                    : 'text-steel-400 hover:text-steel-200'
                }`}
              >
                <span>Exclusive (+ GST)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsInclusive(true)}
                className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  isInclusive
                    ? 'bg-amber-500 text-charcoal-950 font-semibold shadow-sm'
                    : 'text-steel-400 hover:text-steel-200'
                }`}
              >
                <ArrowRightLeft className="h-3 w-3" />
                <span>Inclusive (Reverse)</span>
              </button>
            </div>
          </div>
        </div>

        {/* GST Rate Slabs */}
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-steel-400">
            GST Tax Slab Rate
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {STANDARD_GST_RATES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRateSelect(r)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
                  rate === r && customRate === ''
                    ? 'bg-amber-500 text-charcoal-950 shadow-md ring-1 ring-amber-400 font-bold'
                    : 'border border-charcoal-700 bg-charcoal-800 text-steel-300 hover:border-amber-500/30 hover:bg-charcoal-700'
                }`}
              >
                {r}% {r === 18 ? '(Fabrication)' : r === 0 ? '(Exempt)' : ''}
              </button>
            ))}

            <div className="flex items-center gap-1">
              <input
                type="number"
                placeholder="Custom %"
                value={customRate}
                onChange={(e) => handleCustomRateChange(e.target.value)}
                className="w-24 rounded-lg border border-charcoal-700 bg-charcoal-900 px-2.5 py-1.5 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                min="0"
                max="100"
                step="0.5"
              />
            </div>
          </div>
        </div>

        {/* GST Type & State Matching */}
        <div className="rounded-lg border border-charcoal-700/60 bg-charcoal-900/40 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-steel-400">Tax Breakdown Option</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setTaxMode('cgst_sgst')}
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  taxMode === 'cgst_sgst'
                    ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                    : 'text-steel-400 hover:text-steel-200'
                }`}
              >
                CGST + SGST (Intra-state)
              </button>
              <button
                type="button"
                onClick={() => setTaxMode('igst')}
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  taxMode === 'igst'
                    ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                    : 'text-steel-400 hover:text-steel-200'
                }`}
              >
                IGST (Inter-state)
              </button>
              <button
                type="button"
                onClick={() => setTaxMode('auto')}
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  taxMode === 'auto'
                    ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                    : 'text-steel-400 hover:text-steel-200'
                }`}
              >
                Auto by State
              </button>
            </div>
          </div>

          {taxMode === 'auto' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2 border-t border-charcoal-700/40">
              <div>
                <label className="mb-1 block text-xs text-steel-400">Workshop State</label>
                <select
                  value={workshopState}
                  onChange={(e) => setWorkshopState(e.target.value)}
                  className="w-full rounded-md border border-charcoal-700 bg-charcoal-900 px-2 py-1.5 text-xs text-steel-200"
                >
                  {INDIAN_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-steel-400">Customer State / Supply Location</label>
                <select
                  value={customerState}
                  onChange={(e) => setCustomerState(e.target.value)}
                  className="w-full rounded-md border border-charcoal-700 bg-charcoal-900 px-2 py-1.5 text-xs text-steel-200"
                >
                  {INDIAN_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Visual Results Cards */}
        <div className="rounded-xl border border-charcoal-700/70 bg-charcoal-900/70 p-4 shadow-inner">
          <div className="flex items-center justify-between mb-3 border-b border-charcoal-700/40 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Calculation Summary</span>
            <Badge variant={effectiveGstType === 'cgst_sgst' ? 'amber' : 'blue'}>
              {effectiveGstType === 'cgst_sgst' ? 'Intra-State (CGST + SGST)' : 'Inter-State (IGST)'}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
            <div className="rounded-lg border border-charcoal-700/40 bg-charcoal-800/40 p-3">
              <span className="text-xs text-steel-400">Taxable Base</span>
              <p className="mt-1 text-base font-semibold text-steel-100">
                {formatCurrency(result.taxableAmount)}
              </p>
              <span className="text-[10px] text-steel-500">
                {isInclusive ? 'Extracted from gross' : 'Before tax'}
              </span>
            </div>

            {result.gstType === 'cgst_sgst' ? (
              <>
                <div className="rounded-lg border border-charcoal-700/40 bg-charcoal-800/40 p-3">
                  <span className="text-xs text-steel-400">CGST ({result.cgstRate}%)</span>
                  <p className="mt-1 text-base font-semibold text-amber-300">
                    {formatCurrency(result.cgstAmount)}
                  </p>
                  <span className="text-[10px] text-steel-500">Central Tax</span>
                </div>
                <div className="rounded-lg border border-charcoal-700/40 bg-charcoal-800/40 p-3">
                  <span className="text-xs text-steel-400">SGST ({result.sgstRate}%)</span>
                  <p className="mt-1 text-base font-semibold text-amber-300">
                    {formatCurrency(result.sgstAmount)}
                  </p>
                  <span className="text-[10px] text-steel-500">State Tax</span>
                </div>
              </>
            ) : (
              <div className="col-span-2 rounded-lg border border-charcoal-700/40 bg-charcoal-800/40 p-3">
                <span className="text-xs text-steel-400">IGST ({result.igstRate}%)</span>
                <p className="mt-1 text-base font-semibold text-sky-300">
                  {formatCurrency(result.igstAmount)}
                </p>
                <span className="text-[10px] text-steel-500">Integrated Interstate Tax</span>
              </div>
            )}

            <div className="rounded-lg border border-charcoal-700/40 bg-charcoal-800/40 p-3">
              <span className="text-xs text-steel-400">Total Tax ({result.gstRate}%)</span>
              <p className="mt-1 text-base font-semibold text-amber-400">
                {formatCurrency(result.totalTax)}
              </p>
              <span className="text-[10px] text-steel-500">GST Sum</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between border-t border-charcoal-700/50 pt-3">
            <div className="text-xs text-steel-400">
              Round Off:{' '}
              <span className="font-mono text-steel-200">
                {result.roundOff >= 0 ? `+₹${result.roundOff}` : `-₹${Math.abs(result.roundOff)}`}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-steel-400 mr-2">Grand Total:</span>
              <span className="text-xl font-bold text-amber-400">
                {formatCurrency(result.grandTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* HSN / SAC Presets Reference */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <BookOpen className="h-3.5 w-3.5 text-steel-400" />
            <span className="text-xs font-medium uppercase tracking-wider text-steel-400">
              Common Workshop HSN/SAC Codes (Click to apply rate)
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-36 overflow-y-auto pr-1">
            {COMMON_WORKSHOP_HSN_SAC.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => handleSelectHsn(item)}
                className={`flex items-start justify-between rounded-lg border p-2 text-left transition-colors ${
                  selectedHsn?.code === item.code
                    ? 'border-amber-500/50 bg-amber-500/10'
                    : 'border-charcoal-700/40 bg-charcoal-800/30 hover:border-charcoal-600'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-amber-300">
                      {item.type} {item.code}
                    </span>
                    <span className="text-[10px] text-steel-500">({item.defaultRate}% GST)</span>
                  </div>
                  <p className="truncate text-[11px] text-steel-400">{item.description}</p>
                </div>
                {selectedHsn?.code === item.code && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-amber-400 mt-0.5" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
