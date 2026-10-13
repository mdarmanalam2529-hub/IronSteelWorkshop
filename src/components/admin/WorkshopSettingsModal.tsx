import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { WorkshopSettings } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Building2, MapPin, Phone, Mail, Clock } from 'lucide-react';

interface WorkshopSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const inputClass = 'w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30';

export function WorkshopSettingsModal({ open, onClose }: WorkshopSettingsModalProps) {
  const [settings, setSettings] = useState<WorkshopSettings | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from('workshop_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (queryError || !data) {
      setError('Could not load workshop settings.');
      setLoading(false);
      return;
    }

    const s = data as WorkshopSettings;
    setSettings(s);
    setName(s.name);
    setAddress(s.address ?? '');
    setPhone(s.phone ?? '');
    setEmail(s.email ?? '');
    setWorkingHours(s.working_hours);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      setError(null);
      setSaved(false);
      fetchSettings();
    }
  }, [open, fetchSettings]);

  async function handleSave() {
    if (!name.trim()) {
      setError('Workshop name is required.');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      name: name.trim(),
      address: address.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      working_hours: workingHours.trim(),
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('workshop_settings')
      .update(payload)
      .eq('id', 1);

    if (updateError) {
      setError('Could not save workshop settings.');
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => onClose(), 800);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Workshop Settings"
      maxWidth="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving || loading} disabled={loading}>
            {saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </>
      }
    >
      {loading ? (
        <p className="py-8 text-center text-sm text-steel-500">Loading settings…</p>
      ) : (
        <>
          {error && <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-steel-300">Workshop Name</label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} pl-9`} placeholder="SteelWorks Workshop" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-steel-300">Address</label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={`${inputClass} pl-9`} placeholder="48 Forge Street, Pittsburgh PA" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-steel-300">Phone</label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={`${inputClass} pl-9`} placeholder="555-1000" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-steel-300">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} pl-9`} placeholder="info@steelworks.com" />
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-steel-300">Working Hours</label>
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-steel-500" />
                <textarea value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} rows={3} className={`${inputClass} pl-9`} placeholder="Mon–Fri 6:00–16:00&#10;Sat 7:00–12:00" />
              </div>
              <p className="mt-1 text-xs text-steel-500">Use one line per schedule entry.</p>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
