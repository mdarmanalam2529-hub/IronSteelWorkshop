import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import type { InventoryItem } from '@/types';
import { AlertCircle, Minus, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface InventoryDeductionModalProps {
  open: boolean;
  onClose: () => void;
  orderTitle: string;
}

export function InventoryDeductionModal({ open, onClose, orderTitle }: InventoryDeductionModalProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [deductions, setDeductions] = useState<{ id: string; itemId: string; qty: number }[]>([]);

  useEffect(() => {
    if (open) {
      loadInventory();
      setDeductions([]);
    }
  }, [open]);

  async function loadInventory() {
    setLoading(true);
    try {
      const items = await api.get('inventory');
      setInventory(items);
    } catch (e) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }

  function addDeduction() {
    setDeductions(prev => [...prev, { id: Math.random().toString(), itemId: '', qty: 1 }]);
  }

  function removeDeduction(id: string) {
    setDeductions(prev => prev.filter(d => d.id !== id));
  }

  function updateDeduction(id: string, field: 'itemId' | 'qty', value: any) {
    setDeductions(prev => prev.map(d => {
      if (d.id === id) {
        return { ...d, [field]: value };
      }
      return d;
    }));
  }

  async function handleSave() {
    const validDeductions = deductions.filter(d => d.itemId && d.qty > 0);
    if (validDeductions.length === 0) {
      onClose(); // Just close if nothing to deduct
      return;
    }

    setSaving(true);
    try {
      for (const d of validDeductions) {
        const item = inventory.find(i => i.id === d.itemId);
        if (item) {
          const newQty = Math.max(0, item.quantity - d.qty);
          await api.patch(`inventory/${item.id}`, { quantity: newQty });
        }
      }
      toast.success('Inventory deducted successfully');
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Failed to deduct inventory');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Deduct Used Materials"
      maxWidth="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Skip</Button>
          <Button onClick={handleSave} loading={saving}>Deduct Materials</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex gap-3 text-amber-200 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>Order <strong>{orderTitle}</strong> was marked as Completed. Would you like to deduct the materials used for this job from your inventory?</p>
        </div>

        <div className="space-y-3">
          {deductions.map((d, index) => (
            <div key={d.id} className="flex items-center gap-3">
              <select
                value={d.itemId}
                onChange={e => updateDeduction(d.id, 'itemId', e.target.value)}
                className="flex-1 rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100"
              >
                <option value="">Select Material...</option>
                {inventory.map(i => (
                  <option key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit} in stock)</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={d.qty}
                  onChange={e => updateDeduction(d.id, 'qty', Number(e.target.value))}
                  className="w-20 rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100"
                />
                <span className="text-steel-400 text-sm w-8">
                  {inventory.find(i => i.id === d.itemId)?.unit || ''}
                </span>
              </div>
              <button onClick={() => removeDeduction(d.id)} className="p-2 text-steel-500 hover:text-red-400">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <button onClick={addDeduction} className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300">
          <Plus className="h-4 w-4" /> Add Material
        </button>
      </div>
    </Modal>
  );
}
