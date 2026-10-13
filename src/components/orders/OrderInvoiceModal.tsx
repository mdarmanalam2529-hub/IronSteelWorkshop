import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { downloadInvoicePdf, printInvoicePdf, shareInvoiceOnWhatsApp } from '@/utils/invoicePdf';
import { calculateGstTax } from '@/utils/gstCalculator';
import { api } from '@/lib/api';
import { formatCurrency } from '@/utils/format';
import type { Order, Customer, WorkshopSettings } from '@/types';
import type { Invoice, InvoiceItem } from '@/types/invoice';
import toast from 'react-hot-toast';
import {
  Download,
  Printer,
  MessageCircle,
  Save,
  FileText,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
  Receipt,
  Layers,
  Sparkles,
} from 'lucide-react';

interface OrderInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  order: (Order & { customer?: Customer }) | null;
  workshop: WorkshopSettings | null;
}

type InvoiceType = 'full' | 'advance' | 'balance' | 'custom';

export function OrderInvoiceModal({ open, onClose, order, workshop }: OrderInvoiceModalProps) {
  const totalAmount = Number(order?.total_amount || 0);
  const advancePaid = Number(order?.advance_paid || 0);
  const remainingBalance = Math.max(0, totalAmount - advancePaid);

  // Invoice Mode
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('full');

  // Form Fields
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => order?.due_date || '');

  // Amounts
  const [customBilledAmount, setCustomBilledAmount] = useState<number>(0);
  const [customPaidAmount, setCustomPaidAmount] = useState<number>(0);
  const [itemDescription, setItemDescription] = useState('');

  // GST controls
  const [gstEnabled, setGstEnabled] = useState(Boolean((workshop as any)?.gst_enabled));
  const [gstRate, setGstRate] = useState<number>(Number((workshop as any)?.gst_rate || 18));
  const [gstType, setGstType] = useState<'cgst_sgst' | 'igst'>(((workshop as any)?.gst_type as any) || 'cgst_sgst');
  const [taxInclusive, setTaxInclusive] = useState(Boolean((workshop as any)?.tax_inclusive));

  // Action status
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');

  // Initialize values when modal opens or order changes
  useEffect(() => {
    if (open && order) {
      const prefix = order.title
        ? order.title.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'ORD')
        : 'INV';
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      setInvoiceNumber(`INV-${prefix}-${randomSuffix}`);
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      setDueDate(order.due_date || '');

      setGstEnabled(Boolean((workshop as any)?.gst_enabled));
      setGstRate(Number((workshop as any)?.gst_rate || 18));
      setGstType(((workshop as any)?.gst_type as any) || 'cgst_sgst');
      setTaxInclusive(Boolean((workshop as any)?.tax_inclusive));

      // Default to advance receipt if order is still pending/active with advance, else full
      if (advancePaid > 0 && advancePaid < totalAmount) {
        setInvoiceType('full');
      } else {
        setInvoiceType('full');
      }

      setCustomBilledAmount(totalAmount);
      setCustomPaidAmount(advancePaid);
    }
  }, [open, order, workshop]);

  // Adjust item description and amounts based on invoice type
  useEffect(() => {
    if (!order) return;
    if (invoiceType === 'full') {
      setItemDescription(`Order Fulfillment: ${order.title}`);
      setCustomBilledAmount(totalAmount);
      setCustomPaidAmount(advancePaid);
      setNotes(
        advancePaid > 0
          ? `Order Total: ${formatCurrency(totalAmount)} | Advance Paid: ${formatCurrency(advancePaid)} | Balance Due: ${formatCurrency(remainingBalance)}`
          : `Full payment due for order: ${order.title}`
      );
    } else if (invoiceType === 'advance') {
      const adv = advancePaid > 0 ? advancePaid : Math.round(totalAmount * 0.5);
      setItemDescription(`Advance / Partial Payment Receipt: ${order.title}`);
      setCustomBilledAmount(adv);
      setCustomPaidAmount(adv); // Since this receipt documents the advance received
      setNotes(`Advance payment receipt for Order "${order.title}". Total order value: ${formatCurrency(totalAmount)}. Remaining balance after advance: ${formatCurrency(Math.max(0, totalAmount - adv))}.`);
    } else if (invoiceType === 'balance') {
      setItemDescription(`Final Balance Payment: ${order.title}`);
      setCustomBilledAmount(remainingBalance);
      setCustomPaidAmount(0);
      setNotes(`Final balance payment for Order "${order.title}". Previous advance received: ${formatCurrency(advancePaid)}.`);
    } else if (invoiceType === 'custom') {
      setItemDescription(`Partial / Milestone Billing: ${order.title}`);
      setNotes(`Milestone billing for Order "${order.title}". Total Order Value: ${formatCurrency(totalAmount)}.`);
    }
  }, [invoiceType, order, totalAmount, advancePaid, remainingBalance]);

  // Calculations
  const calculations = useMemo(() => {
    const rawSubtotal = Math.max(0, Number(customBilledAmount) || 0);

    let taxable = rawSubtotal;
    let gstAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    let grandTotal = rawSubtotal;
    let roundOff = 0;

    if (gstEnabled && gstRate > 0) {
      const calc = calculateGstTax({
        amount: rawSubtotal,
        rate: gstRate,
        isInclusive: taxInclusive,
        gstType,
        roundOffResult: true,
      });

      taxable = calc.taxableAmount;
      gstAmount = calc.totalTax;
      cgstAmount = calc.cgstAmount;
      sgstAmount = calc.sgstAmount;
      igstAmount = calc.igstAmount;
      grandTotal = calc.grandTotal;
      roundOff = calc.roundOff;
    }

    const paid = Math.max(0, Number(customPaidAmount) || 0);
    const balance = Math.max(0, grandTotal - paid);

    let paymentStatus: 'paid' | 'partially_paid' | 'unpaid' = 'unpaid';
    if (paid >= grandTotal && grandTotal > 0) {
      paymentStatus = 'paid';
    } else if (paid > 0) {
      paymentStatus = 'partially_paid';
    }

    return {
      subtotal: taxable,
      gstAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      grandTotal,
      roundOff,
      totalPaid: paid,
      balanceDue: balance,
      paymentStatus,
    };
  }, [customBilledAmount, customPaidAmount, gstEnabled, gstRate, gstType, taxInclusive]);

  // Build the complete Invoice object for PDF generation and DB saving
  function buildInvoiceObject(): Invoice {
    if (!order) {
      throw new Error('Order not found');
    }

    const items: InvoiceItem[] = [
      {
        description: itemDescription.trim() || order.title,
        hsn_sac: (workshop as any)?.default_hsn || '7308',
        quantity: 1,
        unit: 'lot',
        rate: calculations.subtotal,
        amount: calculations.subtotal,
      },
    ];

    const customer = order.customer;

    return {
      id: crypto.randomUUID(),
      invoice_number: invoiceNumber.trim() || `INV-${Date.now().toString().slice(-6)}`,
      order_id: order.id,
      customer_id: order.customer_id,
      customer_name: customer?.name || 'Customer',
      customer_company: customer?.company || null,
      customer_phone: customer?.phone || customer?.whatsapp_number || null,
      customer_address: customer?.address || customer?.city || null,
      customer_gstin: null,
      place_of_supply: (workshop as any)?.state_code || '27',
      order_title: order.title,
      items,
      subtotal: calculations.subtotal,
      discount: 0,
      gst_enabled: gstEnabled,
      gst_rate: gstRate,
      gst_amount: calculations.gstAmount,
      gst_type: gstType,
      cgst_amount: calculations.cgstAmount,
      sgst_amount: calculations.sgstAmount,
      igst_amount: calculations.igstAmount,
      tax_inclusive: taxInclusive,
      round_off: calculations.roundOff,
      grand_total: calculations.grandTotal,
      total_paid: calculations.totalPaid,
      balance_due: calculations.balanceDue,
      payment_status: calculations.paymentStatus,
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      notes: notes.trim() || null,
      version: 1,
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // Handlers
  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      const inv = buildInvoiceObject();
      await downloadInvoicePdf(inv, workshop as any);
      toast.success(`Invoice ${inv.invoice_number} downloaded successfully!`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to download PDF invoice');
    } finally {
      setDownloading(false);
    }
  }

  async function handlePrintPdf() {
    setPrinting(true);
    try {
      const inv = buildInvoiceObject();
      await printInvoicePdf(inv, workshop as any);
    } catch (e: any) {
      toast.error(e.message || 'Failed to prepare invoice for printing');
    } finally {
      setPrinting(false);
    }
  }

  function handleShareWhatsApp() {
    const inv = buildInvoiceObject();
    shareInvoiceOnWhatsApp(inv, workshop as any);
  }

  async function handleSaveToInvoices() {
    setSaving(true);
    try {
      const inv = buildInvoiceObject();
      await api.post('invoices', inv);
      toast.success(`Invoice ${inv.invoice_number} saved to Invoices records!`);
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save invoice record');
    } finally {
      setSaving(false);
    }
  }

  if (!order) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate & Download Order Invoice"
      maxWidth="max-w-3xl"
      footer={
        <div className="flex flex-wrap items-center justify-between w-full gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleShareWhatsApp}
              title="Share invoice breakdown on WhatsApp"
            >
              <MessageCircle className="h-4 w-4 text-emerald-400" />
              WhatsApp
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrintPdf}
              loading={printing}
              title="Print invoice directly"
            >
              <Printer className="h-4 w-4 text-steel-300" />
              Print
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSaveToInvoices}
              loading={saving}
              title="Save invoice record to the Invoices database"
            >
              <Save className="h-4 w-4 text-steel-300" />
              Save Record
            </Button>
            <Button
              onClick={handleDownloadPdf}
              loading={downloading}
              size="sm"
              className="bg-amber-500 hover:bg-amber-400 text-charcoal-950 font-semibold"
            >
              <Download className="h-4 w-4" />
              Download PDF Invoice
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Order Summary Header Bar */}
        <div className="rounded-xl border border-charcoal-700 bg-charcoal-900/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-charcoal-700/60 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-amber-400" />
                <h3 className="font-semibold text-steel-100">{order.title}</h3>
              </div>
              <p className="text-xs text-steel-400 mt-0.5">
                Customer: <span className="text-steel-200 font-medium">{order.customer?.name}</span>
                {order.customer?.company ? ` (${order.customer.company})` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3 text-right">
              <div>
                <p className="text-xs text-steel-500">Order Total</p>
                <p className="text-sm font-semibold text-steel-100">{formatCurrency(totalAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-steel-500">Advance Paid</p>
                <p className="text-sm font-semibold text-emerald-400">{formatCurrency(advancePaid)}</p>
              </div>
              <div>
                <p className="text-xs text-steel-500">Balance</p>
                <p className="text-sm font-semibold text-amber-400">{formatCurrency(remainingBalance)}</p>
              </div>
            </div>
          </div>

          {/* Invoice Scope / Type Selector */}
          <div className="mt-3">
            <label className="block text-xs font-medium text-steel-400 mb-2">
              Select Invoice Scope:
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => setInvoiceType('full')}
                className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-all ${
                  invoiceType === 'full'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30'
                    : 'border-charcoal-700 bg-charcoal-800/80 text-steel-300 hover:border-charcoal-600'
                }`}
              >
                <span className="text-xs font-semibold">Full Order</span>
                <span className="text-[11px] text-steel-400">Total {formatCurrency(totalAmount)}</span>
              </button>

              <button
                type="button"
                onClick={() => setInvoiceType('advance')}
                className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-all ${
                  invoiceType === 'advance'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30'
                    : 'border-charcoal-700 bg-charcoal-800/80 text-steel-300 hover:border-charcoal-600'
                }`}
              >
                <span className="text-xs font-semibold">Partial / Advance</span>
                <span className="text-[11px] text-steel-400">
                  Receipt {formatCurrency(advancePaid > 0 ? advancePaid : totalAmount * 0.5)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setInvoiceType('balance')}
                className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-all ${
                  invoiceType === 'balance'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30'
                    : 'border-charcoal-700 bg-charcoal-800/80 text-steel-300 hover:border-charcoal-600'
                }`}
              >
                <span className="text-xs font-semibold">Remaining Balance</span>
                <span className="text-[11px] text-steel-400">Due {formatCurrency(remainingBalance)}</span>
              </button>

              <button
                type="button"
                onClick={() => setInvoiceType('custom')}
                className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-all ${
                  invoiceType === 'custom'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30'
                    : 'border-charcoal-700 bg-charcoal-800/80 text-steel-300 hover:border-charcoal-600'
                }`}
              >
                <span className="text-xs font-semibold">Custom Amount</span>
                <span className="text-[11px] text-steel-400">Milestone / Partial</span>
              </button>
            </div>
          </div>
        </div>

        {/* Invoice Configuration Fields */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-steel-300 mb-1">Invoice Number</label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 focus:border-amber-500/50 focus:outline-none"
              placeholder="INV-001"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-steel-300 mb-1">Invoice Date</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 focus:border-amber-500/50 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-steel-300 mb-1">Payment Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 focus:border-amber-500/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Billing Breakdown & Amount inputs */}
        <div className="rounded-lg border border-charcoal-700 bg-charcoal-800/60 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-steel-400">
              Invoice Items & Amounts
            </span>
            <Badge
              variant={
                calculations.paymentStatus === 'paid'
                  ? 'green'
                  : calculations.paymentStatus === 'partially_paid'
                  ? 'amber'
                  : 'red'
              }
            >
              {calculations.paymentStatus === 'paid'
                ? '🟢 PAID'
                : calculations.paymentStatus === 'partially_paid'
                ? '🟡 PARTIALLY PAID'
                : '🔴 UNPAID'}
            </Badge>
          </div>

          <div>
            <label className="block text-xs font-medium text-steel-300 mb-1">Item Description</label>
            <input
              type="text"
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 focus:border-amber-500/50 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-steel-300 mb-1">
                Billed Amount (Before Tax) *
              </label>
              <div className="relative">
                <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={customBilledAmount}
                  onChange={(e) => setCustomBilledAmount(Number(e.target.value))}
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 pl-9 pr-3 py-2 text-sm text-steel-100 focus:border-amber-500/50 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-steel-300 mb-1">
                Amount Paid on this Invoice
              </label>
              <div className="relative">
                <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={customPaidAmount}
                  onChange={(e) => setCustomPaidAmount(Number(e.target.value))}
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 pl-9 pr-3 py-2 text-sm text-steel-100 focus:border-amber-500/50 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* GST Configuration */}
          <div className="pt-2 border-t border-charcoal-700/60">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-steel-200">
                <input
                  type="checkbox"
                  checked={gstEnabled}
                  onChange={(e) => setGstEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-charcoal-700 bg-charcoal-900 text-amber-500 focus:ring-amber-500/20"
                />
                Apply GST / Taxes to Invoice
              </label>

              {gstEnabled && (
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer text-steel-300">
                    <input
                      type="radio"
                      name="gstType"
                      checked={gstType === 'cgst_sgst'}
                      onChange={() => setGstType('cgst_sgst')}
                      className="text-amber-500"
                    />
                    CGST + SGST (Intra-state)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-steel-300">
                    <input
                      type="radio"
                      name="gstType"
                      checked={gstType === 'igst'}
                      onChange={() => setGstType('igst')}
                      className="text-amber-500"
                    />
                    IGST (Inter-state)
                  </label>
                </div>
              )}
            </div>

            {gstEnabled && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="block text-[11px] text-steel-400 mb-1">GST Rate</label>
                  <select
                    value={gstRate}
                    onChange={(e) => setGstRate(Number(e.target.value))}
                    className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-2.5 py-1.5 text-xs text-steel-100"
                  >
                    <option value={0}>0% GST</option>
                    <option value={5}>5% GST</option>
                    <option value={12}>12% GST</option>
                    <option value={18}>18% GST (Standard)</option>
                    <option value={28}>28% GST</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-steel-400 mb-1">Pricing Mode</label>
                  <select
                    value={taxInclusive ? 'inclusive' : 'exclusive'}
                    onChange={(e) => setTaxInclusive(e.target.value === 'inclusive')}
                    className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-2.5 py-1.5 text-xs text-steel-100"
                  >
                    <option value="exclusive">Tax Exclusive (Base + GST)</option>
                    <option value="inclusive">Tax Inclusive (GST included)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-steel-400 mb-1">GST Tax Amount</label>
                  <p className="px-2.5 py-1.5 text-xs font-semibold text-amber-300 bg-charcoal-900 rounded-lg border border-charcoal-700/60">
                    {formatCurrency(calculations.gstAmount)}
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] text-steel-400 mb-1">Grand Total</label>
                  <p className="px-2.5 py-1.5 text-xs font-bold text-steel-100 bg-charcoal-900 rounded-lg border border-charcoal-700/60">
                    {formatCurrency(calculations.grandTotal)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Calculation Preview Card */}
        <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-charcoal-900 p-4">
          <div className="flex items-center justify-between text-xs text-steel-400 pb-2 border-b border-charcoal-700/50">
            <span>Summary for Invoice #{invoiceNumber || 'INV-DRAFT'}</span>
            <span className="capitalize text-amber-400 font-medium">{invoiceType} Invoice Scope</span>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-3 sm:grid-cols-4 text-center">
            <div className="rounded-lg bg-charcoal-800/80 p-2.5">
              <p className="text-[11px] text-steel-500">Subtotal</p>
              <p className="text-sm font-semibold text-steel-200">{formatCurrency(calculations.subtotal)}</p>
            </div>
            <div className="rounded-lg bg-charcoal-800/80 p-2.5">
              <p className="text-[11px] text-steel-500">GST ({gstEnabled ? `${gstRate}%` : 'None'})</p>
              <p className="text-sm font-semibold text-amber-400">{formatCurrency(calculations.gstAmount)}</p>
            </div>
            <div className="rounded-lg bg-charcoal-800/80 p-2.5">
              <p className="text-[11px] text-steel-500">Amount Paid</p>
              <p className="text-sm font-semibold text-emerald-400">{formatCurrency(calculations.totalPaid)}</p>
            </div>
            <div className="rounded-lg bg-charcoal-800/80 p-2.5">
              <p className="text-[11px] text-steel-500">Balance Due</p>
              <p className="text-sm font-bold text-amber-300">{formatCurrency(calculations.balanceDue)}</p>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-steel-300 mb-1">
            Invoice Notes & Payment Instructions
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-xs text-steel-200 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none"
            placeholder="Add payment terms, bank details, or balance notice..."
          />
        </div>
      </div>
    </Modal>
  );
}
