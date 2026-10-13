import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, UserRole } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { User as UserIcon, Mail, Phone, Shield } from 'lucide-react';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  user: User;
  onSaved: (updated: User) => void;
}

const roleConfig: Record<UserRole, { label: string; badge: 'blue' | 'amber' | 'gray' }> = {
  admin: { label: 'Admin', badge: 'amber' },
  manager: { label: 'Manager', badge: 'blue' },
  worker: { label: 'Worker', badge: 'gray' },
};

const inputClass = 'w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30';

export function ProfileModal({ open, onClose, user, onSaved }: ProfileModalProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setName(user.name);
      setEmail(user.email ?? '');
      setPhone(user.phone ?? '');
      setError(null);
      setSaved(false);
    }
  }, [open, user]);

  async function handleSave() {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
    };
    const { data, error: updateError } = await supabase
      .from('users')
      .update(payload)
      .eq('id', user.id)
      .select()
      .maybeSingle();

    if (updateError || !data) {
      setError('Could not save profile changes.');
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
    onSaved(data as User);
    setTimeout(() => onClose(), 800);
  }

  const cfg = roleConfig[user.role];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="My Profile"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>
            {saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </>
      }
    >
      {error && <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      <div className="mb-5 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-lg font-bold text-charcoal-950">
          {name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="text-base font-semibold text-steel-100">{user.name}</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={cfg.badge}>{cfg.label}</Badge>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-steel-300">Full Name</label>
          <div className="relative">
            <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} pl-9`} placeholder="Your name" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-steel-300">Email</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} pl-9`} placeholder="you@steelworks.com" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-steel-300">Phone</label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={`${inputClass} pl-9`} placeholder="555-0100" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-steel-300">Role</label>
          <div className="relative">
            <Shield className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
            <input type="text" value={cfg.label} disabled className={`${inputClass} pl-9 opacity-60`} />
          </div>
          <p className="mt-1 text-xs text-steel-500">Role can only be changed by another admin from Settings.</p>
        </div>
      </div>
    </Modal>
  );
}
