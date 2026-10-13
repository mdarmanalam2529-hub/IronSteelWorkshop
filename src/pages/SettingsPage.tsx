import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/session';
import type { User, WorkshopSettings } from '@/types';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { Settings as SettingsIcon, Sliders, Cloud, Calculator, Users } from 'lucide-react';
import { DataBackupTab } from '@/components/settings/DataBackupTab';
import { StaffManagementTab } from '@/components/settings/StaffManagementTab';
import { GstCalculatorModal } from '@/components/workshop/GstCalculatorModal';
import { INDIAN_STATES, COMMON_WORKSHOP_HSN_SAC, STANDARD_GST_RATES, getStateFromGstin } from '@/utils/gstCalculator';
import { clsx } from '@/utils/clsx';

interface SettingsPageProps {
  currentUser?: User | null;
}

export function SettingsPage({ currentUser: propUser }: SettingsPageProps = {}) {
  const currentUser = propUser || getSession();
  const [activeTab, setActiveTab] = useState<'general' | 'staff' | 'backup'>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'staff') return 'staff';
    return params.get('tab') === 'backup' || params.get('backup_auth') ? 'backup' : 'general';
  });
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);

  const [workshopName, setWorkshopName] = useState('');
  const [workshopPhone, setWorkshopPhone] = useState('');
  const [workshopAddress, setWorkshopAddress] = useState('');
  const [workshopGstEnabled, setWorkshopGstEnabled] = useState(false);
  const [workshopGstin, setWorkshopGstin] = useState('');
  const [workshopGstRate, setWorkshopGstRate] = useState(18);
  const [workshopGstType, setWorkshopGstType] = useState<'cgst_sgst'|'igst'>('cgst_sgst');
  const [workshopStateCode, setWorkshopStateCode] = useState('27');
  const [workshopTaxInclusive, setWorkshopTaxInclusive] = useState(false);
  const [workshopDefaultHsn, setWorkshopDefaultHsn] = useState('7308');
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [workshopSaving, setWorkshopSaving] = useState(false);
  const [workshopSaved, setWorkshopSaved] = useState(false);

  const fetchWorkshop = useCallback(async () => {
    try {
      const { data, error: queryError } = await supabase.from('workshop_settings').select('*').eq('id', 1).maybeSingle();
      if (!queryError && data) {
        const ws = data as WorkshopSettings;
        setWorkshopName(ws.name);
        setWorkshopPhone(ws.phone ?? '');
        setWorkshopAddress(ws.address ?? '');
        setWorkshopGstEnabled(ws.gst_enabled ?? false);
        setWorkshopGstin(ws.gstin ?? '');
        setWorkshopGstRate(ws.gst_rate ?? 18);
        setWorkshopGstType(ws.gst_type ?? 'cgst_sgst');
        setWorkshopStateCode(ws.state_code ?? '27');
        setWorkshopTaxInclusive(ws.tax_inclusive ?? false);
        setWorkshopDefaultHsn(ws.default_hsn ?? '7308');
        return;
      }
    } catch {
      // Fallback
    }

    try {
      const res = await fetch('/api/workshop_settings');
      if (res.ok) {
        const ws = await res.json();
        if (ws) {
          setWorkshopName(ws.name || '');
          setWorkshopPhone(ws.phone ?? '');
          setWorkshopAddress(ws.address ?? '');
          setWorkshopGstEnabled(Boolean(ws.gst_enabled));
          setWorkshopGstin(ws.gstin ?? '');
          setWorkshopGstRate(ws.gst_rate ?? 18);
          setWorkshopGstType(ws.gst_type ?? 'cgst_sgst');
          setWorkshopStateCode(ws.state_code ?? '27');
          setWorkshopTaxInclusive(Boolean(ws.tax_inclusive));
          setWorkshopDefaultHsn(ws.default_hsn ?? '7308');
        }
      }
    } catch (e) {
      console.warn('Failed to load workshop settings from backend:', e);
    }
  }, []);

  function handleGstinChange(val: string) {
    setWorkshopGstin(val);
    const detected = getStateFromGstin(val);
    if (detected) {
      setWorkshopStateCode(detected.code);
    }
  }

  useEffect(() => {
    setLoading(true);
    fetchWorkshop().finally(() => setLoading(false));
  }, [fetchWorkshop]);

  async function handleWorkshopSave() {
    setWorkshopSaving(true);
    const payload = {
      name: workshopName.trim(),
      phone: workshopPhone.trim() || null,
      address: workshopAddress.trim() || null,
      gst_enabled: workshopGstEnabled ? 1 : 0,
      gstin: workshopGstin.trim() || null,
      gst_rate: Number(workshopGstRate) || 0,
      gst_type: workshopGstType,
      state_code: workshopStateCode,
      state_name: INDIAN_STATES.find(s => s.code === workshopStateCode)?.name || null,
      tax_inclusive: workshopTaxInclusive ? 1 : 0,
      default_hsn: workshopDefaultHsn.trim() || null,
      updated_at: new Date().toISOString(),
    };

    try {
      await fetch('/api/workshop_settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // Ignore local API failure
    }

    try {
      await supabase.from('workshop_settings').update({
        ...payload,
        gst_enabled: workshopGstEnabled,
        tax_inclusive: workshopTaxInclusive,
      }).eq('id', 1);
    } catch {
      // Ignore Supabase update failure
    }

    setWorkshopSaving(false);
    setWorkshopSaved(true);
    setTimeout(() => setWorkshopSaved(false), 2500);
  }

  if (loading) return <LoadingState label="Loading settings…" />;
  if (error) return <ErrorState message={error} onRetry={() => { fetchWorkshop(); }} />;

  return (
    <div className="space-y-6">
      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-charcoal-700/60 pb-3">
        <button
          onClick={() => setActiveTab('general')}
          className={clsx(
            'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all',
            activeTab === 'general'
              ? 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20'
              : 'text-steel-400 hover:bg-charcoal-800 hover:text-steel-200'
          )}
        >
          <Sliders className="h-4 w-4" /> General Settings
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={clsx(
            'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all',
            activeTab === 'staff'
              ? 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20'
              : 'text-steel-400 hover:bg-charcoal-800 hover:text-steel-200'
          )}
        >
          <Users className="h-4 w-4" /> Staff & Users
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={clsx(
            'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all',
            activeTab === 'backup'
              ? 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20'
              : 'text-steel-400 hover:bg-charcoal-800 hover:text-steel-200'
          )}
        >
          <Cloud className="h-4 w-4" /> Data Backup
        </button>
      </div>

      {activeTab === 'staff' ? (
        <StaffManagementTab currentUser={currentUser} />
      ) : activeTab === 'backup' ? (
        <DataBackupTab currentUser={currentUser} />
      ) : (
        <>
          {/* Workshop settings */}
          <Card>
            <CardHeader title="Workshop Information" subtitle="General details about your business" />
            <div className="grid grid-cols-1 gap-4 p-5 pt-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-steel-300">Workshop Name</label>
                <input type="text" value={workshopName} onChange={(e) => setWorkshopName(e.target.value)}
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-steel-300">Phone</label>
                <input type="text" value={workshopPhone} onChange={(e) => setWorkshopPhone(e.target.value)}
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-steel-300">Address</label>
                <input type="text" value={workshopAddress} onChange={(e) => setWorkshopAddress(e.target.value)}
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30" />
              </div>
            </div>

            <div className="border-t border-charcoal-700/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h4 className="text-sm font-semibold text-steel-200">Dynamic GST & Tax Settings</h4>
                  <p className="text-xs text-steel-400">Configure Indian GST rules, state place of supply, and calculation methods</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setCalculatorOpen(true)}
                  className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                >
                  <Calculator className="h-4 w-4" /> Open GST Calculator
                </Button>
              </div>

              <label className="mb-4 flex items-center gap-2 text-sm font-medium text-steel-200">
                <input
                  type="checkbox"
                  checked={workshopGstEnabled}
                  onChange={(e) => setWorkshopGstEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-charcoal-600 bg-charcoal-900 text-amber-500 focus:ring-amber-500/30"
                />
                Enable GST on Invoices & Quotations
              </label>

              {workshopGstEnabled && (
                <div className="space-y-4 rounded-xl border border-charcoal-700/40 bg-charcoal-900/30 p-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-medium text-steel-300">Workshop GSTIN</label>
                        {getStateFromGstin(workshopGstin) && (
                          <span className="text-[10px] font-semibold text-amber-400">
                            State: {getStateFromGstin(workshopGstin)?.name}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={workshopGstin}
                        onChange={(e) => handleGstinChange(e.target.value)}
                        className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm uppercase text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                        placeholder="27AAAAA0000A1Z5"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-steel-300">Workshop State (Place of Business)</label>
                      <select
                        value={workshopStateCode}
                        onChange={(e) => setWorkshopStateCode(e.target.value)}
                        className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                      >
                        {INDIAN_STATES.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.code} - {s.name} ({s.type.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-steel-300">Tax Breakdown Type</label>
                      <select
                        value={workshopGstType}
                        onChange={(e) => setWorkshopGstType(e.target.value as 'cgst_sgst' | 'igst')}
                        className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                      >
                        <option value="cgst_sgst">Split: CGST (50%) + SGST (50%) [Intra-State]</option>
                        <option value="igst">Combined: IGST (100%) [Inter-State]</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2 border-t border-charcoal-700/40">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-steel-300">Default GST Rate (%)</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={workshopGstRate}
                          onChange={(e) => setWorkshopGstRate(Number(e.target.value) || 0)}
                          className="w-24 rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                          min="0"
                          step="0.5"
                        />
                        <div className="flex flex-wrap gap-1">
                          {STANDARD_GST_RATES.map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setWorkshopGstRate(r)}
                              className={`rounded px-1.5 py-1 text-[11px] font-medium transition-colors ${
                                workshopGstRate === r
                                  ? 'bg-amber-500 text-charcoal-950 font-bold'
                                  : 'bg-charcoal-800 text-steel-400 hover:text-steel-200'
                              }`}
                            >
                              {r}%
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-steel-300">Default Pricing Mode</label>
                      <select
                        value={workshopTaxInclusive ? 'inclusive' : 'exclusive'}
                        onChange={(e) => setWorkshopTaxInclusive(e.target.value === 'inclusive')}
                        className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                      >
                        <option value="exclusive">Tax Exclusive (Prices + GST added)</option>
                        <option value="inclusive">Tax Inclusive (Prices include GST / Reverse calc)</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-steel-300">Default HSN/SAC Code</label>
                      <input
                        type="text"
                        value={workshopDefaultHsn}
                        onChange={(e) => setWorkshopDefaultHsn(e.target.value)}
                        className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                        placeholder="7308"
                      />
                    </div>
                  </div>

                  {/* Common HSN quick suggestions */}
                  <div className="pt-2">
                    <span className="text-[11px] text-steel-500 mr-2">Quick Fabrication HSN:</span>
                    <div className="inline-flex flex-wrap gap-1.5">
                      {COMMON_WORKSHOP_HSN_SAC.slice(0, 4).map((h) => (
                        <button
                          key={h.code}
                          type="button"
                          onClick={() => {
                            setWorkshopDefaultHsn(h.code);
                            setWorkshopGstRate(h.defaultRate);
                          }}
                          className={`rounded border px-2 py-0.5 text-[10px] font-mono transition-colors ${
                            workshopDefaultHsn === h.code
                              ? 'border-amber-500 bg-amber-500/20 text-amber-300 font-bold'
                              : 'border-charcoal-700 bg-charcoal-800 text-steel-400 hover:text-steel-200'
                          }`}
                        >
                          {h.code} ({h.defaultRate}%)
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 px-5 pb-5">
              <Button onClick={handleWorkshopSave} size="sm" loading={workshopSaving}><Sliders className="h-4 w-4" /> Save Changes</Button>
              {workshopSaved && <span className="text-sm text-emerald-400">Saved!</span>}
            </div>
          </Card>

          {/* Staff directory teaser banner */}
          <Card className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/20">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-steel-100">Workshop Staff & User Directory</h4>
                  <p className="text-xs text-steel-400">
                    Manage team roles (Admin, Manager, Worker), toggle active status, and reset employee passwords
                  </p>
                </div>
              </div>
              <Button onClick={() => setActiveTab('staff')} size="sm">
                Open Staff Directory & Roles →
              </Button>
            </div>
          </Card>

          {/* About */}
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-charcoal-700/60 text-steel-400">
                <SettingsIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-steel-100">SteelWorks Manager v1.0</p>
                <p className="text-xs text-steel-500">Business management system for steel fabrication workshops</p>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Dynamic GST Calculator Modal */}
      <GstCalculatorModal
        open={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
        workshopStateCode={workshopStateCode}
        initialRate={workshopGstRate}
        initialGstType={workshopGstType}
      />
    </div>
  );
}
