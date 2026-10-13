import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { InventoryItem } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { Package, Plus, Pencil, Trash2, X, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/utils/format';

interface InventoryPageProps {
  search: string;
}

interface InvForm {
  name: string;
  category: string;
  sku: string;
  quantity: string;
  unit: string;
  reorder_level: string;
  price_per_unit: string;
  supplier: string;
}

const emptyForm: InvForm = {
  name: '',
  category: '',
  sku: '',
  quantity: '',
  unit: 'kg',
  reorder_level: '',
  price_per_unit: '',
  supplier: '',
};

export function InventoryPage({ search }: InventoryPageProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<InvForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof InvForm, string>>>({});
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('inventory');
      setItems(data ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filtered = items.filter((i) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      i.name.toLowerCase().includes(q) ||
      (i.category?.toLowerCase().includes(q) ?? false) ||
      (i.sku?.toLowerCase().includes(q) ?? false) ||
      (i.supplier?.toLowerCase().includes(q) ?? false)
    );
  });

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setFormErrors({});
    setModalOpen(true);
  }

  function openEdit(i: InventoryItem) {
    setEditing(i);
    setForm({
      name: i.name,
      category: i.category ?? '',
      sku: i.sku ?? '',
      quantity: String(i.quantity),
      unit: i.unit,
      reorder_level: String(i.reorder_level),
      price_per_unit: String(i.price_per_unit),
      supplier: i.supplier ?? '',
    });
    setFormErrors({});
    setModalOpen(true);
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof InvForm, string>> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.quantity || isNaN(Number(form.quantity)) || Number(form.quantity) < 0)
      errs.quantity = 'Valid quantity required';
    if (!form.reorder_level || isNaN(Number(form.reorder_level)))
      errs.reorder_level = 'Valid reorder level required';
    if (!form.price_per_unit || isNaN(Number(form.price_per_unit)) || Number(form.price_per_unit) < 0)
      errs.price_per_unit = 'Valid price required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || null,
      sku: form.sku.trim() || null,
      quantity: Number(form.quantity),
      unit: form.unit,
      reorder_level: Number(form.reorder_level),
      price_per_unit: Number(form.price_per_unit),
      supplier: form.supplier.trim() || null,
    };
    try {
      if (editing) {
        await api.patch(`inventory/${editing.id}`, payload);
      } else {
        await api.post('inventory', payload);
      }
      setModalOpen(false);
      fetchItems();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(i: InventoryItem) {
    if (!confirm(`Delete "${i.name}" from inventory?`)) return;
    try {
      await api.delete(`inventory/${i.id}`);
      fetchItems();
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (loading) return <LoadingState label="Loading inventory…" />;
  if (error) return <ErrorState message={error} onRetry={fetchItems} />;

  const lowStockCount = items.filter((i) => i.quantity < i.reorder_level).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-steel-400">{filtered.length} items</p>
          {lowStockCount > 0 && (
            <Badge variant="red">
              <AlertTriangle className="h-3 w-3" /> {lowStockCount} low stock
            </Badge>
          )}
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="h-4 w-4" /> Add Item
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package className="h-10 w-10" />}
            title={search ? 'No matching items' : 'No inventory items'}
            message={search ? 'Try a different search' : 'Add your first material to track stock'}
            action={
              !search && (
                <Button onClick={openAdd} size="sm" className="mt-2">
                  <Plus className="h-4 w-4" /> Add Item
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
                  <th className="px-5 py-3 font-medium">Item</th>
                  <th className="hidden px-5 py-3 font-medium md:table-cell">Category</th>
                  <th className="hidden px-5 py-3 font-medium lg:table-cell">SKU</th>
                  <th className="px-5 py-3 text-right font-medium">Stock</th>
                  <th className="hidden px-5 py-3 text-right font-medium sm:table-cell">Reorder At</th>
                  <th className="hidden px-5 py-3 text-right font-medium md:table-cell">Unit Price</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-700/40">
                {filtered.map((i) => {
                  const low = i.quantity < i.reorder_level;
                  return (
                    <tr key={i.id} className="hover:bg-charcoal-700/20 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className={
                            'flex h-8 w-8 items-center justify-center rounded-lg ' +
                            (low ? 'bg-red-500/10 text-red-400' : 'bg-charcoal-700/60 text-steel-400')
                          }>
                            <Package className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-steel-100">{i.name}</p>
                            {i.supplier && <p className="text-xs text-steel-500">{i.supplier}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-5 py-3 md:table-cell">
                        {i.category && <Badge variant="neutral">{i.category}</Badge>}
                      </td>
                      <td className="hidden px-5 py-3 text-steel-400 lg:table-cell">{i.sku ?? '—'}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={low ? 'font-semibold text-red-300' : 'text-steel-100'}>
                          {i.quantity} {i.unit}
                        </span>
                        {low && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs text-red-400">
                            <AlertTriangle className="h-3 w-3" /> Low
                          </span>
                        )}
                      </td>
                      <td className="hidden px-5 py-3 text-right text-steel-400 sm:table-cell">
                        {i.reorder_level} {i.unit}
                      </td>
                      <td className="hidden px-5 py-3 text-right text-steel-300 md:table-cell">
                        {formatCurrency(i.price_per_unit)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(i)} className="rounded-lg p-1.5 text-steel-500 hover:bg-charcoal-700 hover:text-steel-100 transition-colors">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(i)} className="rounded-lg p-1.5 text-steel-500 hover:bg-red-500/10 hover:text-red-400 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
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

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-charcoal-700 bg-charcoal-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-charcoal-700 px-5 py-4">
              <h3 className="text-base font-semibold text-steel-100">
                {editing ? 'Edit Item' : 'Add Inventory Item'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-steel-500 hover:bg-charcoal-700 hover:text-steel-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-steel-300">Item Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                  placeholder="Mild Steel Plate 6mm" />
                {formErrors.name && <p className="mt-1 text-xs text-red-400">{formErrors.name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-steel-300">Category</label>
                  <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                    placeholder="Plates" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-steel-300">SKU</label>
                  <input type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                    placeholder="PL-MS-06" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-steel-300">Quantity *</label>
                  <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                    placeholder="0" min="0" step="0.01" />
                  {formErrors.quantity && <p className="mt-1 text-xs text-red-400">{formErrors.quantity}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-steel-300">Unit</label>
                  <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30">
                    <option value="kg">kg</option>
                    <option value="m">m</option>
                    <option value="pcs">pcs</option>
                    <option value="L">L</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-steel-300">Reorder At *</label>
                  <input type="number" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
                    className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                    placeholder="0" min="0" step="0.01" />
                  {formErrors.reorder_level && <p className="mt-1 text-xs text-red-400">{formErrors.reorder_level}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-steel-300">Unit Price *</label>
                  <input type="number" value={form.price_per_unit} onChange={(e) => setForm({ ...form, price_per_unit: e.target.value })}
                    className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                    placeholder="0.00" min="0" step="0.01" />
                  {formErrors.price_per_unit && <p className="mt-1 text-xs text-red-400">{formErrors.price_per_unit}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-steel-300">Supplier</label>
                  <input type="text" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                    className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                    placeholder="SteelMart Inc" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-charcoal-700 px-5 py-4">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>{editing ? 'Save Changes' : 'Add Item'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
