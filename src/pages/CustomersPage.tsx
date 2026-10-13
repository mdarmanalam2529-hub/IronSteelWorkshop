import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import type { Customer } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { CustomerFormModal, type CustomerFormValues } from '@/components/customers/CustomerFormModal';
import {
  Users,
  Plus,
  Mail,
  Phone,
  MapPin,
  Building2,
  Pencil,
  Trash2,
  ArrowRight,
  Filter,
  MessageCircle,
} from 'lucide-react';
import { formatDate } from '@/utils/format';

interface CustomersPageProps {
  search: string;
  onSelectCustomer: (id: string) => void;
}

type SortMode = 'recent' | 'name' | 'city';

const sortOptions: { label: string; value: SortMode }[] = [
  { label: 'Most Recent', value: 'recent' },
  { label: 'Name (A–Z)', value: 'name' },
  { label: 'City', value: 'city' },
];

export function CustomersPage({ search, onSelectCustomer }: CustomersPageProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('customers');
      setCustomers(data ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.company?.toLowerCase().includes(q) ?? false) ||
      (c.email?.toLowerCase().includes(q) ?? false) ||
      (c.phone?.toLowerCase().includes(q) ?? false) ||
      (c.whatsapp_number?.toLowerCase().includes(q) ?? false) ||
      (c.city?.toLowerCase().includes(q) ?? false)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'name') return a.name.localeCompare(b.name);
    if (sortMode === 'city') return (a.city ?? '').localeCompare(b.city ?? '');
    return 0;
  });

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setModalOpen(true);
  }

  async function handleSave(values: CustomerFormValues) {
    setSaving(true);
    const payload = {
      name: values.name.trim(),
      company: values.company?.trim() || null,
      email: values.email?.trim() || null,
      phone: values.phone?.trim() || null,
      whatsapp_number: values.whatsapp_number?.trim() || null,
      address: values.address?.trim() || null,
      city: values.city?.trim() || null,
      notes: values.notes?.trim() || null,
    };
    try {
      if (editing) {
        await api.patch(`customers/${editing.id}`, payload);
        toast.success('Customer updated successfully');
      } else {
        await api.post('customers', payload);
        toast.success('Customer added successfully');
      }
      setModalOpen(false);
      fetchCustomers();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save customer');
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: Customer) {
    if (!confirm(`Delete customer "${c.name}"? This will also delete their jobs and payments.`)) return;
    try {
      await api.delete(`customers/${c.id}`);
      toast.success('Customer deleted successfully');
      fetchCustomers();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete customer');
      setError(e.message);
    }
  }

  if (loading) return <LoadingState label="Loading customers…" />;
  if (error) return <ErrorState message={error} onRetry={fetchCustomers} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-steel-400">
            {sorted.length} customer{sorted.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-steel-500" />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="rounded-lg border border-charcoal-700 bg-charcoal-800 px-2.5 py-1.5 text-sm text-steel-200 focus:border-amber-500/50 focus:outline-none"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="h-4 w-4" /> Add Customer
        </Button>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            title={search ? 'No matching customers' : 'No customers yet'}
            message={search ? 'Try a different search term' : 'Add your first customer to get started'}
            action={
              !search && (
                <Button onClick={openAdd} size="sm" className="mt-2">
                  <Plus className="h-4 w-4" /> Add Customer
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((c) => (
            <Card key={c.id} className="group p-5 transition-all hover:border-charcoal-600">
              <div className="flex items-start justify-between gap-3">
                <button
                  onClick={() => onSelectCustomer(c.id)}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-steel-100 group-hover:text-amber-300 transition-colors">
                      {c.name}
                    </h3>
                    {c.company && (
                      <p className="flex items-center gap-1 text-xs text-steel-500">
                        <Building2 className="h-3 w-3" /> {c.company}
                      </p>
                    )}
                  </div>
                </button>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(c)}
                    className="rounded-lg p-1.5 text-steel-500 hover:bg-charcoal-700 hover:text-steel-100 transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    className="rounded-lg p-1.5 text-steel-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <button
                onClick={() => onSelectCustomer(c.id)}
                className="mt-4 w-full space-y-2 text-left"
              >
                {c.email && (
                  <p className="flex items-center gap-2 text-sm text-steel-400">
                    <Mail className="h-4 w-4 text-steel-600" /> <span className="truncate">{c.email}</span>
                  </p>
                )}
                {c.phone && (
                  <p className="flex items-center gap-2 text-sm text-steel-400">
                    <Phone className="h-4 w-4 text-steel-600" /> {c.phone}
                  </p>
                )}
                {c.whatsapp_number && (
                  <p className="flex items-center gap-2 text-sm text-steel-400">
                    <MessageCircle className="h-4 w-4 text-steel-600" /> {c.whatsapp_number}
                  </p>
                )}
                {(c.address || c.city) && (
                  <p className="flex items-start gap-2 text-sm text-steel-400">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-steel-600" />
                    {[c.address, c.city].filter(Boolean).join(', ')}
                  </p>
                )}
              </button>

              <div className="mt-4 flex items-center justify-between border-t border-charcoal-700/40 pt-3">
                <Badge variant="gray">Since {formatDate(c.created_at)}</Badge>
                <button
                  onClick={() => onSelectCustomer(c.id)}
                  className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                >
                  View Profile <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CustomerFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        editing={editing}
        saving={saving}
      />
    </div>
  );
}
