import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import type { Invoice, InvoiceItem, InvoiceVersion } from '@/types/invoice';
import type { WorkshopSettings } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { downloadInvoicePdf, printInvoicePdf, shareInvoiceOnWhatsApp } from '@/utils/invoicePdf';
import { formatCurrency } from '@/utils/format';
import {
  Download, MessageCircle, Plus, Trash2, Save, History, IndianRupee,
  FileText, AlertCircle, Pencil, ChevronDown, ChevronUp, Calculator, ArrowRightLeft, Sparkles, Printer,
} from 'lucide-react';
import {
  calculateGstTax,
  INDIAN_STATES,
  STANDARD_GST_RATES,
} from '@/utils/gstCalculator';
import { GstCalculatorModal } from '@/components/workshop/GstCalculatorModal';

interface InvoiceModalProps {
  open: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onSaved: () => void;
}

const inputClass = 'w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30';

const defaultItem: InvoiceItem = { description: '', quantity: 1, unit: 'pcs', rate: 0, amount: 0 };

function computePaymentStatus(totalPaid: number, grandTotal: number): 'paid' | 'partially_paid' | 'unpaid' {
  if (totalPaid >= grandTotal && grandTotal > 0) return 'paid';
  if (totalPaid > 0) return 'partially_paid';
  return 'unpaid';
}

export function InvoiceModal({ open, onClose, invoice, onSaved }: InvoiceModalProps) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstRate, setGstRate] = useState(18);
  const [gstType, setGstType] = useState<'cgst_sgst' | 'igst'>('cgst_sgst');
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [placeOfSupply, setPlaceOfSupply] = useState('27');
  const [calcModalOpen, setCalcModalOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workshop, setWorkshop] = useState<(WorkshopSettings & { gst_enabled?: boolean; gstin?: string; gst_rate?: number }) | null>(null);
  const [versions, setVersions] = useState<InvoiceVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [printingPdf, setPrintingPdf] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<'cash' | 'transfer' | 'card' | 'check'>('cash');
  const [payNotes, setPayNotes] = useState<string>('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  const fetchWorkshop = useCallback(async () => {
    try {
      const res = await fetch('/api/workshop_settings');
      if (res.ok) {
        const ws = await res.json();
        if (ws) {
          setWorkshop(ws);
          return;
        }
      }
    } catch {}

    try {
      const { data } = await supabase.from('workshop_settings').select('*').eq('id', 1).maybeSingle();
      if (data) {
        setWorkshop(data as WorkshopSettings & { gst_enabled?: boolean; gstin?: string; gst_rate?: number });
      }
    } catch {}
  }, []);

  const fetchVersions = useCallback(async () => {
    if (!invoice) return;
    try {
      const res = await fetch(`/api/invoice_versions?invoice_id=${invoice.id}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setVersions(data);
          return;
        }
      }
    } catch {}

    try {
      const { data } = await supabase
        .from('invoice_versions')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('version', { ascending: false });
      setVersions((data as InvoiceVersion[] | null) ?? []);
    } catch {}
  }, [invoice]);

  useEffect(() => {
    if (open && invoice) {
      setItems(Array.isArray(invoice.items) ? invoice.items : []);
      setDiscount(invoice!.discount);
      setGstEnabled(invoice!.gst_enabled);
      setGstRate(invoice!.gst_rate);
      setGstType(invoice!.gst_type || (workshop?.gst_type ?? 'cgst_sgst'));
      setTaxInclusive(invoice!.tax_inclusive ?? false);
      setPlaceOfSupply(invoice!.place_of_supply || (workshop?.state_code ?? '27'));
      setNotes(invoice!.notes ?? '');
      setDueDate(invoice!.due_date ?? '');
      setEditing(false);
      setShowPayForm(false);
      setPayAmount(String(Math.max(0, invoice!.balance_due || (invoice!.grand_total - invoice!.total_paid))));
      setPayNotes('');
      setError(null);
      fetchWorkshop();
      fetchVersions();
    }
  }, [open, invoice, workshop?.gst_type, workshop?.state_code, fetchWorkshop, fetchVersions]);

  if (!invoice) return null;

  // Dynamic calculations
  const subtotal = items.reduce((s, item) => s + item.amount, 0);
  const afterDiscount = Math.max(0, subtotal - discount);

  const isEditingOrCurrentGst = editing ? gstEnabled : invoice.gst_enabled;
  const currentRate = editing ? gstRate : invoice.gst_rate;
  const currentType = editing ? gstType : (invoice.gst_type || workshop?.gst_type || 'cgst_sgst');
  const currentInclusive = editing ? taxInclusive : (invoice.tax_inclusive ?? false);

  const gstCalc = calculateGstTax({
    amount: afterDiscount,
    rate: currentRate,
    isInclusive: currentInclusive,
    gstType: currentType,
    roundOffResult: true,
  });

  const effectiveTaxable = isEditingOrCurrentGst ? gstCalc.taxableAmount : afterDiscount;
  const effectiveGstAmount = isEditingOrCurrentGst ? gstCalc.totalTax : 0;
  const effectiveCgst = isEditingOrCurrentGst ? gstCalc.cgstAmount : 0;
  const effectiveSgst = isEditingOrCurrentGst ? gstCalc.sgstAmount : 0;
  const effectiveIgst = isEditingOrCurrentGst ? gstCalc.igstAmount : 0;
  const effectiveRoundOff = isEditingOrCurrentGst ? gstCalc.roundOff : 0;
  const grandTotal = isEditingOrCurrentGst ? gstCalc.grandTotal : afterDiscount;
  const paymentStatus = computePaymentStatus(invoice.total_paid, grandTotal);

  function updateItem(index: number, field: keyof InvoiceItem, value: string | number) {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };
      if (field === 'description') item.description = value as string;
      else if (field === 'hsn_sac') item.hsn_sac = value as string;
      else if (field === 'unit') item.unit = value as string;
      else if (field === 'quantity') { item.quantity = Number(value) || 0; item.amount = item.quantity * item.rate; }
      else if (field === 'rate') { item.rate = Number(value) || 0; item.amount = item.quantity * item.rate; }
      updated[index] = item;
      return updated;
    });
  }

  function addItem() {
    setItems(prev => [...prev, { ...defaultItem, hsn_sac: workshop?.default_hsn || '7308' }]);
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (items.length === 0) { setError('Add at least one item.'); return; }
    if (items.some(it => !it.description.trim())) { setError('All items need a description.'); return; }

    setSaving(true);
    setError(null);

    try {
      // Archive current version
      const versionSnapshot = {
        invoice_number: invoice!.invoice_number,
        order_id: invoice!.order_id,
        customer_id: invoice!.customer_id,
        customer_name: invoice!.customer_name,
        customer_company: invoice!.customer_company,
        customer_phone: invoice!.customer_phone,
        customer_address: invoice!.customer_address,
        order_title: invoice!.order_title,
        items: invoice!.items,
        subtotal: invoice!.subtotal,
        discount: invoice!.discount,
        gst_enabled: invoice!.gst_enabled,
        gst_rate: invoice!.gst_rate,
        gst_amount: invoice!.gst_amount,
        gst_type: invoice!.gst_type,
        cgst_amount: invoice!.cgst_amount,
        sgst_amount: invoice!.sgst_amount,
        igst_amount: invoice!.igst_amount,
        tax_inclusive: invoice!.tax_inclusive,
        place_of_supply: invoice!.place_of_supply,
        round_off: invoice!.round_off,
        grand_total: invoice!.grand_total,
        total_paid: invoice!.total_paid,
        balance_due: invoice!.balance_due,
        payment_status: invoice!.payment_status,
        invoice_date: invoice!.invoice_date,
        due_date: invoice!.due_date,
        notes: invoice!.notes,
        version: invoice!.version,
      };

      // 1. Save version snapshot
      try {
        await fetch('/api/invoice_versions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoice_id: invoice!.id,
            version: invoice!.version,
            snapshot: versionSnapshot,
          }),
        });
      } catch {}

      try {
        await supabase.from('invoice_versions').insert({
          invoice_id: invoice!.id,
          version: invoice!.version,
          snapshot: versionSnapshot,
        });
      } catch {}

      const newVersion = invoice!.version + 1;
      const balanceDue = grandTotal - invoice!.total_paid;
      const updatePayload = {
        items,
        subtotal,
        discount,
        gst_enabled: gstEnabled,
        gst_rate: gstRate,
        gst_amount: effectiveGstAmount,
        gst_type: gstType,
        cgst_amount: effectiveCgst,
        sgst_amount: effectiveSgst,
        igst_amount: effectiveIgst,
        tax_inclusive: taxInclusive,
        place_of_supply: placeOfSupply,
        round_off: effectiveRoundOff,
        grand_total: grandTotal,
        balance_due: balanceDue,
        payment_status: computePaymentStatus(invoice!.total_paid, grandTotal),
        due_date: dueDate || null,
        notes: notes.trim() || null,
        version: newVersion,
        updated_at: new Date().toISOString(),
      };

      let saved = false;
      // 2. Save via local API
      try {
        const res = await fetch(`/api/invoices/${invoice!.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload),
        });
        if (res.ok) saved = true;
      } catch {}

      // 3. Save via Supabase
      try {
        const { error: updateError } = await supabase.from('invoices').update(updatePayload).eq('id', invoice!.id);
        if (!updateError) saved = true;
      } catch {}

      if (!saved) throw new Error('Failed to save invoice update');

      setSaving(false);
      setEditing(false);
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    try {
      const currentInvoice = editing ? {
        ...invoice!,
        items, subtotal, discount,
        gst_enabled: gstEnabled,
        gst_rate: gstRate,
        gst_amount: effectiveGstAmount,
        gst_type: gstType,
        cgst_amount: effectiveCgst,
        sgst_amount: effectiveSgst,
        igst_amount: effectiveIgst,
        tax_inclusive: taxInclusive,
        place_of_supply: placeOfSupply,
        round_off: effectiveRoundOff,
        grand_total: grandTotal,
        balance_due: grandTotal - invoice!.total_paid,
        payment_status: paymentStatus,
        notes: notes || null,
        due_date: dueDate || null,
      } : {
        ...invoice!,
        gst_type: invoice!.gst_type || workshop?.gst_type || 'cgst_sgst',
        cgst_amount: invoice!.cgst_amount ?? (invoice!.gst_type === 'igst' ? 0 : invoice!.gst_amount / 2),
        sgst_amount: invoice!.sgst_amount ?? (invoice!.gst_type === 'igst' ? 0 : invoice!.gst_amount / 2),
        igst_amount: invoice!.igst_amount ?? (invoice!.gst_type === 'igst' ? invoice!.gst_amount : 0),
        place_of_supply: invoice!.place_of_supply || workshop?.state_code || '27',
      };
      await downloadInvoicePdf(currentInvoice, workshop);
    } catch (err) {
      console.error('PDF generation failed:', err);
    }
    setDownloadingPdf(false);
  }

  async function handlePrintPdf() {
    setPrintingPdf(true);
    try {
      const currentInvoice = editing ? {
        ...invoice!,
        items,
        subtotal,
        discount,
        gst_enabled: gstEnabled,
        gst_rate: gstRate,
        gst_amount: effectiveGstAmount,
        gst_type: gstType,
        cgst_amount: effectiveCgst,
        sgst_amount: effectiveSgst,
        igst_amount: effectiveIgst,
        tax_inclusive: taxInclusive,
        place_of_supply: placeOfSupply,
        round_off: effectiveRoundOff,
        grand_total: grandTotal,
        balance_due: grandTotal - invoice!.total_paid,
        payment_status: paymentStatus,
        notes: notes || null,
        due_date: dueDate || null,
      } : {
        ...invoice!,
        gst_type: invoice!.gst_type || workshop?.gst_type || 'cgst_sgst',
        cgst_amount: invoice!.cgst_amount ?? (invoice!.gst_type === 'igst' ? 0 : invoice!.gst_amount / 2),
        sgst_amount: invoice!.sgst_amount ?? (invoice!.gst_type === 'igst' ? 0 : invoice!.gst_amount / 2),
        igst_amount: invoice!.igst_amount ?? (invoice!.gst_type === 'igst' ? invoice!.gst_amount : 0),
        place_of_supply: invoice!.place_of_supply || workshop?.state_code || '27',
      };
      await printInvoicePdf(currentInvoice, workshop);
    } catch (err) {
      console.error('Print generation failed:', err);
    }
    setPrintingPdf(false);
  }

  function handleWhatsApp() {
    shareInvoiceOnWhatsApp(invoice!, workshop);
  }

  async function handleRecordPayment() {
    const amountNum = Number(payAmount);
    if (!amountNum || amountNum <= 0) {
      setError('Please enter a valid payment amount greater than zero.');
      return;
    }

    setRecordingPayment(true);
    setError(null);

    try {
      const currentPaid = Number(invoice!.total_paid || 0);
      const newTotalPaid = currentPaid + amountNum;
      const effectiveTotal = Number(invoice!.grand_total || 0);
      const newBalance = Math.max(0, effectiveTotal - newTotalPaid);
      const newStatus = computePaymentStatus(newTotalPaid, effectiveTotal);

      // 1. Create a payment ledger entry
      const paymentRecord = {
        id: crypto.randomUUID(),
        customer_id: invoice!.customer_id,
        order_id: invoice!.order_id || null,
        amount: amountNum,
        status: 'paid',
        method: payMethod,
        due_date: invoice!.due_date || null,
        paid_date: new Date().toISOString().split('T')[0],
        notes: `Payment for Invoice #${invoice!.invoice_number}${payNotes ? ` — ${payNotes}` : ''}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      try {
        await api.post('payments', paymentRecord);
      } catch {}

      // 2. Update the invoice record
      const invoiceUpdate = {
        total_paid: newTotalPaid,
        balance_due: newBalance,
        payment_status: newStatus,
        updated_at: new Date().toISOString(),
      };

      await api.patch(`invoices/${invoice!.id}`, invoiceUpdate);

      // 3. Update parent order advance_paid if linked to an order
      if (invoice!.order_id) {
        try {
          const ord = await api.get(`orders/${invoice!.order_id}`);
          if (ord) {
            const updatedAdv = Number(ord.advance_paid || 0) + amountNum;
            await api.patch(`orders/${invoice!.order_id}`, {
              advance_paid: updatedAdv,
            });
          }
        } catch {}
      }

      setShowPayForm(false);
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'Failed to record payment');
    } finally {
      setRecordingPayment(false);
    }
  }

  const statusBadge = {
    paid: { variant: 'green' as const, label: '🟢 Paid' },
    partially_paid: { variant: 'amber' as const, label: '🟡 Partially Paid' },
    unpaid: { variant: 'red' as const, label: '🔴 Unpaid' },
  }[invoice.payment_status];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Invoice ${invoice.invoice_number}`}
      maxWidth="max-w-3xl"
      footer={
        <>
          {editing ? (
            <>
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancel Edit</Button>
              <Button onClick={handleSave} loading={saving}><Save className="h-4 w-4" /> Save Changes</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setShowVersions(!showVersions)}>
                <History className="h-4 w-4" /> History ({versions.length})
              </Button>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button variant="secondary" onClick={handleWhatsApp}>
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
              <Button variant="secondary" onClick={handlePrintPdf} loading={printingPdf}>
                <Printer className="h-4 w-4" /> Print
              </Button>
              <Button onClick={handleDownloadPdf} loading={downloadingPdf}>
                <Download className="h-4 w-4" /> Download PDF
              </Button>
            </>
          )}
        </>
      }
    >
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Invoice header summary */}
      <div className="mb-5 grid grid-cols-2 gap-4 rounded-lg border border-charcoal-700/40 bg-charcoal-900/40 p-4">
        <div>
          <p className="text-xs text-steel-500">Customer</p>
          <p className="font-medium text-steel-100">{invoice.customer_name}</p>
          {invoice.customer_company && <p className="text-sm text-steel-400">{invoice.customer_company}</p>}
        </div>
        <div>
          <p className="text-xs text-steel-500">Order</p>
          <p className="font-medium text-steel-100">{invoice.order_title}</p>
        </div>
        <div>
          <p className="text-xs text-steel-500">Date</p>
          <p className="text-sm text-steel-300">{new Date(invoice.invoice_date).toLocaleDateString('en-IN')}</p>
        </div>
        <div>
          <p className="text-xs text-steel-500">Payment Status</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
            {!editing && invoice.payment_status !== 'paid' && (
              <button
                type="button"
                onClick={() => setShowPayForm(!showPayForm)}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline"
              >
                {showPayForm ? 'Cancel Payment' : '+ Record Payment'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Record Payment Interactive Card */}
      {showPayForm && (
        <div className="mb-5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
            <h4 className="text-sm font-semibold text-emerald-300 flex items-center gap-1.5">
              <IndianRupee className="h-4 w-4" /> Record Customer Payment
            </h4>
            <span className="text-xs text-steel-400">
              Outstanding: <strong className="text-amber-300">{formatCurrency(invoice.balance_due)}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-steel-300">
                Amount Paid (₹) *
              </label>
              <div className="relative">
                <IndianRupee className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-steel-500" />
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className={`${inputClass} pl-8 py-1.5 text-xs`}
                  min="1"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-steel-300">
                Payment Method
              </label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as any)}
                className={`${inputClass} py-1.5 text-xs`}
              >
                <option value="cash">Cash</option>
                <option value="transfer">Bank Transfer / UPI</option>
                <option value="card">Card</option>
                <option value="check">Cheque</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-steel-300">
                Notes / Reference
              </label>
              <input
                type="text"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className={`${inputClass} py-1.5 text-xs`}
                placeholder="UPI ref, Cheque no., etc."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowPayForm(false)}
              disabled={recordingPayment}
              className="text-xs py-1"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRecordPayment}
              loading={recordingPayment}
              className="bg-emerald-500 hover:bg-emerald-400 text-charcoal-950 font-semibold text-xs py-1"
            >
              Confirm & Save Payment
            </Button>
          </div>
        </div>
      )}

      {/* Items */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-steel-200">
            <FileText className="mr-1 inline h-4 w-4" /> Line Items
          </h4>
          {editing && (
            <button onClick={addItem} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/10">
              <Plus className="h-3.5 w-3.5" /> Add Item
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-charcoal-700/60 text-left text-xs uppercase tracking-wider text-steel-500">
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium w-20">HSN/SAC</th>
                <th className="px-3 py-2 font-medium w-16 text-center">Qty</th>
                <th className="px-3 py-2 font-medium w-16 text-center">Unit</th>
                <th className="px-3 py-2 font-medium w-24 text-right">Rate</th>
                <th className="px-3 py-2 font-medium w-24 text-right">Amount</th>
                {editing && <th className="px-2 py-2 w-8"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-700/30">
              {(editing ? items : invoice.items).map((item, idx) => (
                <tr key={idx} className="hover:bg-charcoal-700/10">
                  <td className="px-3 py-2">
                    {editing ? (
                      <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} className={inputClass} placeholder="Item description" />
                    ) : (
                      <span className="text-steel-200">{item.description}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editing ? (
                      <input value={item.hsn_sac ?? ''} onChange={e => updateItem(idx, 'hsn_sac', e.target.value)} className={`${inputClass} font-mono text-xs`} placeholder="7308" />
                    ) : (
                      <span className="font-mono text-xs text-steel-400">{item.hsn_sac || '—'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editing ? (
                      <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className={`${inputClass} text-center`} min="0" step="1" />
                    ) : (
                      <span className="block text-center text-steel-300">{item.quantity}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editing ? (
                      <input value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className={`${inputClass} text-center`} placeholder="pcs" />
                    ) : (
                      <span className="block text-center text-steel-400">{item.unit}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {editing ? (
                      <input type="number" value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)} className={`${inputClass} text-right`} min="0" step="0.01" />
                    ) : (
                      <span className="text-steel-300">{formatCurrency(item.rate)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-steel-100">
                    {formatCurrency(item.amount)}
                  </td>
                  {editing && (
                    <td className="px-2 py-2">
                      <button onClick={() => removeItem(idx)} className="rounded-lg p-1 text-steel-500 hover:bg-red-500/10 hover:text-red-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dynamic GST Settings in Edit Mode */}
      {editing && (
        <div className="mb-4 rounded-xl border border-charcoal-700/60 bg-charcoal-900/40 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-charcoal-700/40 pb-2.5">
            <label className="flex items-center gap-2 text-sm font-semibold text-steel-200">
              <input
                type="checkbox"
                checked={gstEnabled}
                onChange={e => setGstEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-charcoal-600 bg-charcoal-900 text-amber-500 focus:ring-amber-500/30"
              />
              Enable GST on this Invoice
            </label>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCalcModalOpen(true)}
              className="text-xs text-amber-300 border-amber-500/30 hover:bg-amber-500/10 py-1"
            >
              <Calculator className="h-3.5 w-3.5 mr-1" /> Quick GST Calculator
            </Button>
          </div>

          {gstEnabled && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
              <div>
                <label className="mb-1 block text-xs font-medium text-steel-400">Tax Type (Split / Combined)</label>
                <select
                  value={gstType}
                  onChange={e => setGstType(e.target.value as 'cgst_sgst' | 'igst')}
                  className={inputClass}
                >
                  <option value="cgst_sgst">Split (CGST 50% + SGST 50%)</option>
                  <option value="igst">Combined (IGST 100%)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-steel-400">Calculation Method</label>
                <select
                  value={taxInclusive ? 'inclusive' : 'exclusive'}
                  onChange={e => setTaxInclusive(e.target.value === 'inclusive')}
                  className={inputClass}
                >
                  <option value="exclusive">Tax Exclusive (+ GST added)</option>
                  <option value="inclusive">Tax Inclusive (Reverse GST)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-steel-400">Place of Supply (State)</label>
                <select
                  value={placeOfSupply}
                  onChange={e => setPlaceOfSupply(e.target.value)}
                  className={inputClass}
                >
                  {INDIAN_STATES.map(s => (
                    <option key={s.code} value={s.code}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3 pt-1 flex flex-wrap items-center gap-2">
                <span className="text-xs text-steel-400">GST Slab:</span>
                <div className="flex items-center gap-1">
                  {STANDARD_GST_RATES.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setGstRate(r)}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                        gstRate === r
                          ? 'bg-amber-500 text-charcoal-950 font-bold'
                          : 'bg-charcoal-800 text-steel-400 hover:text-steel-200'
                      }`}
                    >
                      {r}%
                    </button>
                  ))}
                  <input
                    type="number"
                    value={gstRate}
                    onChange={e => setGstRate(Number(e.target.value) || 0)}
                    className={`${inputClass} w-20 text-center text-xs py-1`}
                    min="0"
                    step="0.5"
                    placeholder="Rate %"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Totals & Tax Breakdown */}
      <div className="mb-4 space-y-2 rounded-lg border border-charcoal-700/40 bg-charcoal-900/30 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-steel-400">Subtotal</span>
          <span className="font-medium text-steel-200">{formatCurrency(editing ? subtotal : invoice.subtotal)}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-steel-400">Discount</span>
          {editing ? (
            <div className="relative w-28">
              <IndianRupee className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-steel-600" />
              <input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value) || 0)} className={`${inputClass} pl-7 text-right`} min="0" step="0.01" />
            </div>
          ) : (
            <span className="text-steel-300">- {formatCurrency(invoice.discount)}</span>
          )}
        </div>

        {/* Detailed GST breakdown */}
        {isEditingOrCurrentGst && (
          <div className="rounded-lg border border-charcoal-700/30 bg-charcoal-800/30 p-3 my-2 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-steel-400">
                Taxable Value {currentInclusive ? '(Base from Inclusive)' : ''}
              </span>
              <span className="font-medium text-steel-200">{formatCurrency(effectiveTaxable)}</span>
            </div>

            {currentType === 'cgst_sgst' ? (
              <>
                <div className="flex justify-between text-xs">
                  <span className="text-steel-400">CGST ({currentRate / 2}%)</span>
                  <span className="font-medium text-amber-300">{formatCurrency(effectiveCgst)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-steel-400">SGST ({currentRate / 2}%)</span>
                  <span className="font-medium text-amber-300">{formatCurrency(effectiveSgst)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-xs">
                <span className="text-steel-400">IGST ({currentRate}%)</span>
                <span className="font-medium text-sky-300">{formatCurrency(effectiveIgst)}</span>
              </div>
            )}

            <div className="flex justify-between text-xs border-t border-charcoal-700/30 pt-1 text-steel-300">
              <span className="font-medium">Total GST ({currentRate}%)</span>
              <span className="font-semibold text-amber-400">{formatCurrency(effectiveGstAmount)}</span>
            </div>

            {effectiveRoundOff !== 0 && (
              <div className="flex justify-between text-xs text-steel-400">
                <span>Round Off Adjustment</span>
                <span>{effectiveRoundOff >= 0 ? `+${formatCurrency(effectiveRoundOff)}` : `-${formatCurrency(Math.abs(effectiveRoundOff))}`}</span>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-charcoal-700/40 pt-2 flex justify-between text-sm font-semibold">
          <span className="text-steel-200">Grand Total</span>
          <span className="text-amber-300">{formatCurrency(grandTotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-steel-400">Total Paid</span>
          <span className="text-emerald-300">{formatCurrency(invoice.total_paid)}</span>
        </div>
        <div className="flex justify-between text-sm font-semibold">
          <span className="text-steel-200">Balance Due</span>
          <span className="text-red-300">{formatCurrency(grandTotal - invoice.total_paid)}</span>
        </div>
      </div>

      {/* Notes */}
      {editing ? (
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-steel-300">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} rows={2} placeholder="Additional notes..." />
        </div>
      ) : invoice.notes ? (
        <div className="mb-4 rounded-lg border border-charcoal-700/30 bg-charcoal-900/20 p-3">
          <p className="text-xs font-medium text-steel-400 mb-1">Notes</p>
          <p className="text-sm text-steel-300">{invoice.notes}</p>
        </div>
      ) : null}

      {/* Due Date */}
      {editing && (
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-steel-300">Due Date</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputClass} />
        </div>
      )}

      {/* Version History */}
      {showVersions && versions.length > 0 && (
        <div className="mt-4 rounded-lg border border-charcoal-700/40 bg-charcoal-900/30 p-4">
          <button onClick={() => setShowVersions(!showVersions)} className="flex w-full items-center justify-between text-sm font-semibold text-steel-200">
            <span><History className="mr-1 inline h-4 w-4" /> Version History</span>
            {showVersions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <div className="mt-3 space-y-2">
            {versions.map(v => (
              <div key={v.id} className="flex items-center justify-between rounded-lg border border-charcoal-700/30 bg-charcoal-800/30 px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-steel-200">Version {v.version}</span>
                  <span className="ml-2 text-xs text-steel-500">
                    {new Date(v.created_at).toLocaleString('en-IN')}
                  </span>
                </div>
                <Badge variant="gray">v{v.version}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick GST Calculator Modal */}
      <GstCalculatorModal
        open={calcModalOpen}
        onClose={() => setCalcModalOpen(false)}
        initialAmount={afterDiscount}
        initialRate={gstRate}
        initialGstType={gstType}
        workshopStateCode={placeOfSupply}
        onApply={(calc) => {
          setGstEnabled(true);
          setGstRate(calc.rate);
          setGstType(calc.gstType);
        }}
      />
    </Modal>
  );
}
