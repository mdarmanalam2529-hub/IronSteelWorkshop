import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { formatCurrency } from '@/utils/format';
import { calculateGstTax, INDIAN_STATES, STANDARD_GST_RATES } from '@/utils/gstCalculator';
import type { Customer, Order, WorkshopSettings } from '@/types';
import type { Invoice, InvoiceItem } from '@/types/invoice';
import toast from 'react-hot-toast';
import {
  FileText,
  Plus,
  Trash2,
  IndianRupee,
  Layers,
  Sparkles,
} from 'lucide-react';

interface CreateInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (createdInvoice: Invoice) => void;
  workshop: WorkshopSettings | null;
}

const inputClass =
  'w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30';

export function CreateInvoiceModal({
  open,
  onClose,
  onCreated,
  workshop,
}: CreateInvoiceModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState((workshop as any)?.state_code || '27');

  // Items
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      description: 'Fabrication Services',
      hsn_sac: (workshop as any)?.default_hsn || '7308',
      quantity: 1,
      unit: 'pcs',
      rate: 1000,
      amount: 1000,
    },
  ]);

  // Discount & GST
  const [discount, setDiscount] = useState(0);
  const [gstEnabled, setGstEnabled] = useState(Boolean((workshop as any)?.gst_enabled));
  const [gstRate, setGstRate] = useState<number>(Number((workshop as any)?.gst_rate || 18));
  const [gstType, setGstType] = useState<'cgst_sgst' | 'igst'>(((workshop as any)?.gst_type as any) || 'cgst_sgst');
  const [taxInclusive, setTaxInclusive] = useState(Boolean((workshop as any)?.tax_inclusive));

  // Payment initial recording
  const [advancePaid, setAdvancePaid] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Customers and Orders
  useEffect(() => {
    if (open) {
      setLoadingOptions(true);
      Promise.all([api.get('customers'), api.get('orders')])
        .then(([custData, ordData]) => {
          setCustomers(custData || []);
          setOrders(ordData || []);
          if (custData && custData.length > 0) {
            setSelectedCustomerId(custData[0].id);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingOptions(false));

      // Generate invoice number
      const rand = Math.floor(1000 + Math.random() * 9000);
      setInvoiceNumber(`INV-${new Date().getFullYear()}-${rand}`);
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      setDueDate('');
      setGstEnabled(Boolean((workshop as any)?.gst_enabled));
      setGstRate(Number((workshop as any)?.gst_rate || 18));
      setGstType(((workshop as any)?.gst_type as any) || 'cgst_sgst');
      setPlaceOfSupply((workshop as any)?.state_code || '27');
      setTaxInclusive(Boolean((workshop as any)?.tax_inclusive));
      setAdvancePaid(0);
      setError(null);
    }
  }, [open, workshop]);

  // When customer changes, filter available orders
  const customerOrders = useMemo(() => {
    if (!selectedCustomerId) return orders;
    return orders.filter((o) => o.customer_id === selectedCustomerId);
  }, [orders, selectedCustomerId]);

  // Auto-fill order details if an order is chosen
  useEffect(() => {
    if (selectedOrderId) {
      const order = orders.find((o) => o.id === selectedOrderId);
      if (order) {
        setItems([
          {
            description: `Order: ${order.title}`,
            hsn_sac: (workshop as any)?.default_hsn || '7308',
            quantity: 1,
            unit: 'lot',
            rate: Number(order.total_amount) || 0,
            amount: Number(order.total_amount) || 0,
          },
        ]);
        if (order.due_date) {
          setDueDate(order.due_date);
        }
        if (order.advance_paid) {
          setAdvancePaid(Number(order.advance_paid));
        }
      }
    }
  }, [selectedOrderId, orders, workshop]);

  // Line item manipulation
  function updateItem(index: number, field: keyof InvoiceItem, value: any) {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      if (field === 'description') item.description = value;
      else if (field === 'hsn_sac') item.hsn_sac = value;
      else if (field === 'unit') item.unit = value;
      else if (field === 'quantity') {
        item.quantity = Math.max(0, Number(value) || 0);
        item.amount = item.quantity * item.rate;
      } else if (field === 'rate') {
        item.rate = Math.max(0, Number(value) || 0);
        item.amount = item.quantity * item.rate;
      }
      updated[index] = item;
      return updated;
    });
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        description: '',
        hsn_sac: (workshop as any)?.default_hsn || '7308',
        quantity: 1,
        unit: 'pcs',
        rate: 0,
        amount: 0,
      },
    ]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) {
      toast.error('Invoice requires at least one item');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  // Live Calculations
  const calculations = useMemo(() => {
    const subtotal = items.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
    const taxableBase = Math.max(0, subtotal - (Number(discount) || 0));

    let taxable = taxableBase;
    let gstAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    let grandTotal = taxableBase;
    let roundOff = 0;

    if (gstEnabled && gstRate > 0) {
      const calc = calculateGstTax({
        amount: taxableBase,
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

    const paid = Math.max(0, Number(advancePaid) || 0);
    const balance = Math.max(0, grandTotal - paid);

    let paymentStatus: 'paid' | 'partially_paid' | 'unpaid' = 'unpaid';
    if (paid >= grandTotal && grandTotal > 0) {
      paymentStatus = 'paid';
    } else if (paid > 0) {
      paymentStatus = 'partially_paid';
    }

    return {
      subtotal,
      taxable,
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
  }, [items, discount, gstEnabled, gstRate, gstType, taxInclusive, advancePaid]);

  async function handleCreate() {
    if (!selectedCustomerId) {
      setError('Please select a customer.');
      return;
    }
    if (!invoiceNumber.trim()) {
      setError('Invoice number is required.');
      return;
    }
    if (items.some((i) => !i.description.trim())) {
      setError('All items must have a description.');
      return;
    }

    setSaving(true);
    setError(null);

    const customer = customers.find((c) => c.id === selectedCustomerId);
    const order = orders.find((o) => o.id === selectedOrderId);

    const newInvoice: Invoice = {
      id: crypto.randomUUID(),
      invoice_number: invoiceNumber.trim(),
      order_id: selectedOrderId || null,
      customer_id: selectedCustomerId,
      customer_name: customer?.name || 'Customer',
      customer_company: customer?.company || null,
      customer_phone: customer?.phone || customer?.whatsapp_number || null,
      customer_address: customer?.address || customer?.city || null,
      customer_gstin: null,
      place_of_supply: placeOfSupply,
      order_title: order?.title || 'General Workshop Order',
      items,
      subtotal: calculations.subtotal,
      discount: Number(discount) || 0,
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

    try {
      await api.post('invoices', newInvoice);
      toast.success(`Invoice ${newInvoice.invoice_number} created successfully!`);
      onCreated(newInvoice);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to create invoice');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create New Tax Invoice"
      maxWidth="max-w-3xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            loading={saving}
            className="bg-amber-500 hover:bg-amber-400 text-charcoal-950 font-semibold"
          >
            <Sparkles className="h-4 w-4" /> Save & Issue Invoice
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Customer & Order Association */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-charcoal-700 bg-charcoal-900/60 p-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-steel-300">
              Customer *
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className={inputClass}
              disabled={loadingOptions}
            >
              <option value="">Select a customer...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company ? `(${c.company})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-steel-300">
              Link to Order (Optional)
            </label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className={inputClass}
              disabled={loadingOptions}
            >
              <option value="">None (Standalone Invoice)</option>
              {customerOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title} — {formatCurrency(Number(o.total_amount))}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-steel-300">
              Invoice Number *
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className={inputClass}
              placeholder="INV-2026-001"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-steel-300">
                Invoice Date
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-steel-300">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-steel-200 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-amber-400" /> Line Items
            </h4>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addItem}
              className="text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Add Item
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-charcoal-700 bg-charcoal-900/40">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal-700/60 text-left text-xs uppercase text-steel-500">
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 w-20">HSN</th>
                  <th className="px-3 py-2 w-16 text-center">Qty</th>
                  <th className="px-3 py-2 w-20">Unit</th>
                  <th className="px-3 py-2 w-28 text-right">Rate (₹)</th>
                  <th className="px-3 py-2 w-28 text-right">Amount (₹)</th>
                  <th className="px-2 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-700/40">
                {items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-2">
                      <input
                        value={it.description}
                        onChange={(e) => updateItem(idx, 'description', e.target.value)}
                        className={inputClass}
                        placeholder="Description"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={it.hsn_sac || ''}
                        onChange={(e) => updateItem(idx, 'hsn_sac', e.target.value)}
                        className={`${inputClass} text-xs font-mono`}
                        placeholder="7308"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={it.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                        className={`${inputClass} text-center`}
                        min="1"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={it.unit}
                        onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                        className={inputClass}
                      >
                        <option value="pcs">pcs</option>
                        <option value="kg">kg</option>
                        <option value="ton">ton</option>
                        <option value="lot">lot</option>
                        <option value="meter">meter</option>
                        <option value="sqft">sqft</option>
                      </select>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        value={it.rate}
                        onChange={(e) => updateItem(idx, 'rate', e.target.value)}
                        className={`${inputClass} text-right`}
                        min="0"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-steel-200">
                      {formatCurrency(it.amount)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="rounded p-1 text-steel-500 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* GST & Discount Section */}
        <div className="rounded-xl border border-charcoal-700 bg-charcoal-900/60 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-steel-200 cursor-pointer">
              <input
                type="checkbox"
                checked={gstEnabled}
                onChange={(e) => setGstEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-charcoal-600 bg-charcoal-900 text-amber-500 focus:ring-amber-500/30"
              />
              Enable GST Compliance
            </label>

            <div className="flex items-center gap-2">
              <span className="text-xs text-steel-400">Discount:</span>
              <div className="relative w-28">
                <IndianRupee className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-steel-500" />
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                  className={`${inputClass} pl-7 text-right py-1 text-xs`}
                  min="0"
                />
              </div>
            </div>
          </div>

          {gstEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-charcoal-700/60 pt-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-steel-400">
                  GST Rate Slab
                </label>
                <div className="flex gap-1">
                  {STANDARD_GST_RATES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setGstRate(r)}
                      className={`flex-1 rounded py-1 text-xs font-semibold ${
                        gstRate === r
                          ? 'bg-amber-500 text-charcoal-950'
                          : 'bg-charcoal-800 text-steel-300 hover:bg-charcoal-700'
                      }`}
                    >
                      {r}%
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-steel-400">
                  GST Type
                </label>
                <select
                  value={gstType}
                  onChange={(e) => setGstType(e.target.value as any)}
                  className={`${inputClass} text-xs py-1.5`}
                >
                  <option value="cgst_sgst">Intrastate (CGST + SGST)</option>
                  <option value="igst">Interstate (IGST)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-steel-400">
                  Place of Supply
                </label>
                <select
                  value={placeOfSupply}
                  onChange={(e) => setPlaceOfSupply(e.target.value)}
                  className={`${inputClass} text-xs py-1.5`}
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

        {/* Totals & Initial Paid Payment */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-charcoal-700 bg-charcoal-900/60 p-4 space-y-2">
            <label className="block text-sm font-medium text-steel-300">
              Payment / Advance Collected (₹)
            </label>
            <div className="relative">
              <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
              <input
                type="number"
                value={advancePaid}
                onChange={(e) => setAdvancePaid(Math.max(0, Number(e.target.value) || 0))}
                className={`${inputClass} pl-9`}
                placeholder="0.00"
                min="0"
              />
            </div>
            <p className="text-xs text-steel-500">
              Entering amount paid marks the invoice as Paid or Partially Paid immediately.
            </p>

            <div className="pt-2">
              <label className="mb-1 block text-xs font-medium text-steel-400">Notes & Terms</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className={inputClass}
                placeholder="Payment terms, bank details, delivery notes..."
              />
            </div>
          </div>

          <div className="rounded-xl border border-charcoal-700 bg-charcoal-900/60 p-4 space-y-2 text-sm">
            <div className="flex justify-between text-steel-400">
              <span>Subtotal:</span>
              <span className="text-steel-200">{formatCurrency(calculations.subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-steel-400">
                <span>Discount:</span>
                <span className="text-emerald-400">- {formatCurrency(discount)}</span>
              </div>
            )}
            {gstEnabled && (
              <div className="flex justify-between text-steel-400">
                <span>GST Tax ({gstRate}%):</span>
                <span className="text-amber-300">+ {formatCurrency(calculations.gstAmount)}</span>
              </div>
            )}
            <div className="border-t border-charcoal-700 pt-2 flex justify-between font-semibold text-base">
              <span className="text-steel-100">Grand Total:</span>
              <span className="text-amber-400">{formatCurrency(calculations.grandTotal)}</span>
            </div>
            <div className="flex justify-between text-steel-400">
              <span>Amount Paid:</span>
              <span className="text-emerald-400">{formatCurrency(calculations.totalPaid)}</span>
            </div>
            <div className="border-t border-charcoal-700/60 pt-1 flex justify-between font-semibold">
              <span className="text-steel-300">Balance Due:</span>
              <span className="text-red-400">{formatCurrency(calculations.balanceDue)}</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
