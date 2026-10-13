import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Invoice } from '@/types/invoice';
import type { WorkshopSettings } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { InvoiceModal } from '@/components/invoices/InvoiceModal';
import { CreateInvoiceModal } from '@/components/invoices/CreateInvoiceModal';
import { downloadInvoicePdf, shareInvoiceOnWhatsApp } from '@/utils/invoicePdf';
import { formatCurrency, formatDate } from '@/utils/format';
import {
  FileText, Download, MessageCircle, Archive, RotateCcw,
  Filter, Trash2, Eye, Calculator, Plus,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { GstCalculatorModal } from '@/components/workshop/GstCalculatorModal';

interface InvoicesPageProps {
  search: string;
}

type TabId = 'active' | 'archived';
type PaymentFilter = 'all' | 'paid' | 'partially_paid' | 'unpaid';

const paymentFilters: { label: string; value: PaymentFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Paid', value: 'paid' },
  { label: 'Partial', value: 'partially_paid' },
  { label: 'Unpaid', value: 'unpaid' },
];

const paymentStatusBadge: Record<string, { variant: 'green' | 'amber' | 'red'; label: string }> = {
  paid: { variant: 'green', label: '🟢 Paid' },
  partially_paid: { variant: 'amber', label: '🟡 Partial' },
  unpaid: { variant: 'red', label: '🔴 Unpaid' },
};

export function InvoicesPage({ search }: InvoicesPageProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('active');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [workshop, setWorkshop] = useState<(WorkshopSettings & { gst_enabled?: boolean; gstin?: string; gst_rate?: number }) | null>(null);
  const [gstCalcOpen, setGstCalcOpen] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('invoices');
      setInvoices(data ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWorkshop = useCallback(async () => {
    try {
      const { data } = await supabase.from('workshop_settings').select('*').eq('id', 1).maybeSingle();
      if (data) {
        setWorkshop(data as any);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
    fetchWorkshop();
  }, [fetchInvoices, fetchWorkshop]);

  const filtered = invoices.filter(inv => {
    if (tab === 'active' && inv.is_archived) return false;
    if (tab === 'archived' && !inv.is_archived) return false;
    if (paymentFilter !== 'all' && inv.payment_status !== paymentFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        inv.invoice_number.toLowerCase().includes(q) ||
        inv.customer_name.toLowerCase().includes(q) ||
        (inv.customer_company?.toLowerCase().includes(q) ?? false) ||
        inv.order_title.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeCount = invoices.filter(i => !i.is_archived).length;
  const archivedCount = invoices.filter(i => i.is_archived).length;

  // Stats
  const activeInvoices = invoices.filter(i => !i.is_archived);
  const totalBilled = activeInvoices.reduce((s, i) => s + Number(i.grand_total), 0);
  const totalCollected = activeInvoices.reduce((s, i) => s + Number(i.total_paid), 0);
  const totalOutstanding = activeInvoices.reduce((s, i) => s + Number(i.balance_due), 0);

  async function handleArchive(inv: Invoice) {
    try {
      await api.patch(`invoices/${inv.id}`, { is_archived: true, updated_at: new Date().toISOString() });
      fetchInvoices();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleRecover(inv: Invoice) {
    try {
      await api.patch(`invoices/${inv.id}`, { is_archived: false, updated_at: new Date().toISOString() });
      fetchInvoices();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleDelete(inv: Invoice) {
    if (!confirm(`Permanently delete invoice ${inv.invoice_number}? This cannot be undone.`)) return;
    try {
      await api.delete(`invoices/${inv.id}`);
      fetchInvoices();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleDownload(inv: Invoice) {
    try {
      await downloadInvoicePdf(inv, workshop);
    } catch (err) {
      console.error('PDF generation failed:', err);
    }
  }

  function openInvoice(inv: Invoice) {
    setSelectedInvoice(inv);
    setModalOpen(true);
  }

  if (loading) return <LoadingState label="Loading invoices…" />;
  if (error) return <ErrorState message={error} onRetry={fetchInvoices} />;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-steel-500">Total Billed</p>
          <p className="mt-1 text-xl font-bold text-steel-100">{formatCurrency(totalBilled)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">Collected</p>
          <p className="mt-1 text-xl font-bold text-emerald-300">{formatCurrency(totalCollected)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-400">Outstanding</p>
          <p className="mt-1 text-xl font-bold text-amber-300">{formatCurrency(totalOutstanding)}</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('active')}
            className={tab === 'active'
              ? 'rounded-lg bg-amber-500/15 px-3.5 py-2 text-sm font-medium text-amber-300 ring-1 ring-amber-500/20'
              : 'rounded-lg px-3.5 py-2 text-sm font-medium text-steel-400 hover:bg-charcoal-800 hover:text-steel-200'}
          >
            Active Invoices ({activeCount})
          </button>
          <button
            onClick={() => setTab('archived')}
            className={tab === 'archived'
              ? 'rounded-lg bg-amber-500/15 px-3.5 py-2 text-sm font-medium text-amber-300 ring-1 ring-amber-500/20'
              : 'rounded-lg px-3.5 py-2 text-sm font-medium text-steel-400 hover:bg-charcoal-800 hover:text-steel-200'}
          >
            Archived ({archivedCount})
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-400 text-charcoal-950 font-semibold"
          >
            <Plus className="h-4 w-4" /> Create Invoice
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setGstCalcOpen(true)}
            className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
          >
            <Calculator className="h-4 w-4" /> GST Calculator
          </Button>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-steel-500" />
            <div className="flex flex-wrap gap-1">
              {paymentFilters.map(f => (
                <button
                  key={f.value}
                  onClick={() => setPaymentFilter(f.value)}
                  className={paymentFilter === f.value
                    ? 'rounded-lg bg-amber-500/15 px-3 py-1.5 text-sm font-medium text-amber-300 ring-1 ring-amber-500/20'
                    : 'rounded-lg px-3 py-1.5 text-sm font-medium text-steel-400 hover:bg-charcoal-700/60 hover:text-steel-200'}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Invoice List */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="h-10 w-10" />}
            title={search || paymentFilter !== 'all' ? 'No matching invoices' : tab === 'archived' ? 'No archived invoices' : 'No invoices yet'}
            message={search || paymentFilter !== 'all' ? 'Try adjusting your filters' : 'Create an invoice directly or generate one from the Orders page'}
            action={
              !search && paymentFilter === 'all' && tab === 'active' && (
                <Button onClick={() => setCreateModalOpen(true)} size="sm" className="mt-2 bg-amber-500 text-charcoal-950 font-semibold">
                  <Plus className="h-4 w-4" /> Create Invoice
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal-700/60 text-left text-xs uppercase tracking-wider text-steel-500">
                  <th className="px-5 py-3 font-medium">Invoice</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="hidden px-5 py-3 font-medium lg:table-cell">Order</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                  <th className="hidden px-5 py-3 text-right font-medium md:table-cell">Paid</th>
                  <th className="hidden px-5 py-3 text-right font-medium md:table-cell">Balance</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="hidden px-5 py-3 font-medium sm:table-cell">Date</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-700/40">
                {filtered.map(inv => {
                  const sb = paymentStatusBadge[inv.payment_status] ?? paymentStatusBadge.unpaid;
                  return (
                    <tr key={inv.id} className="transition-colors hover:bg-charcoal-700/20">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openInvoice(inv)} className="font-medium text-amber-300 hover:text-amber-200 hover:underline">
                            {inv.invoice_number}
                          </button>
                          {inv.gst_enabled && (
                            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-500/25">
                              {inv.gst_rate}% {inv.gst_type === 'igst' ? 'IGST' : 'CGST+SGST'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-steel-500">v{inv.version}</p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-steel-100">{inv.customer_name}</p>
                        {inv.customer_company && <p className="text-xs text-steel-500">{inv.customer_company}</p>}
                      </td>
                      <td className="hidden px-5 py-3 text-steel-300 lg:table-cell">{inv.order_title}</td>
                      <td className="px-5 py-3 text-right font-semibold text-steel-100">{formatCurrency(Number(inv.grand_total))}</td>
                      <td className="hidden px-5 py-3 text-right text-emerald-300 md:table-cell">{formatCurrency(Number(inv.total_paid))}</td>
                      <td className="hidden px-5 py-3 text-right font-semibold text-amber-300 md:table-cell">{formatCurrency(Number(inv.balance_due))}</td>
                      <td className="px-5 py-3"><Badge variant={sb.variant}>{sb.label}</Badge></td>
                      <td className="hidden px-5 py-3 text-steel-400 sm:table-cell">{formatDate(inv.invoice_date)}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openInvoice(inv)} className="rounded-lg p-1.5 text-steel-500 hover:bg-charcoal-700 hover:text-steel-100 transition-colors" title="View Invoice">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDownload(inv)} className="rounded-lg p-1.5 text-steel-500 hover:bg-charcoal-700 hover:text-steel-100 transition-colors" title="Download PDF">
                            <Download className="h-4 w-4" />
                          </button>
                          <button onClick={() => shareInvoiceOnWhatsApp(inv, workshop)} className="rounded-lg p-1.5 text-steel-500 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors" title="Share on WhatsApp">
                            <MessageCircle className="h-4 w-4" />
                          </button>
                          {tab === 'active' ? (
                            <button onClick={() => handleArchive(inv)} className="rounded-lg p-1.5 text-steel-500 hover:bg-amber-500/10 hover:text-amber-400 transition-colors" title="Archive">
                              <Archive className="h-4 w-4" />
                            </button>
                          ) : (
                            <>
                              <button onClick={() => handleRecover(inv)} className="rounded-lg p-1.5 text-steel-500 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors" title="Recover">
                                <RotateCcw className="h-4 w-4" />
                              </button>
                              <button onClick={() => handleDelete(inv)} className="rounded-lg p-1.5 text-steel-500 hover:bg-red-500/10 hover:text-red-400 transition-colors" title="Delete permanently">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Invoice Detail Modal */}
      <InvoiceModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedInvoice(null); }}
        invoice={selectedInvoice}
        onSaved={() => { fetchInvoices(); setModalOpen(false); setSelectedInvoice(null); }}
      />

      {/* Create New Invoice Modal */}
      <CreateInvoiceModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={() => { fetchInvoices(); setCreateModalOpen(false); }}
        workshop={workshop}
      />

      {/* Dynamic GST Calculator Modal */}
      <GstCalculatorModal
        open={gstCalcOpen}
        onClose={() => setGstCalcOpen(false)}
        workshopStateCode={workshop?.state_code}
        initialRate={workshop?.gst_rate}
        initialGstType={workshop?.gst_type}
      />
    </div>
  );
}
