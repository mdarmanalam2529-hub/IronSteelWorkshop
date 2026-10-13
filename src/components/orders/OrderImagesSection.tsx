import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { formatDate } from '@/utils/format';
import { Image, ImagePlus, Ruler, Trash2, X } from 'lucide-react';

interface OrderImage {
  id: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  measurement_label: string | null;
  length: number | null;
  width: number | null;
  height: number | null;
  measurement_unit: string;
  notes: string | null;
  created_at: string;
  previewUrl: string;
}

interface OrderImagesSectionProps {
  orderId: string;
  orderTitle: string;
  onClose: () => void;
}

const inputClass = 'w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30';

export function OrderImagesSection({ orderId, orderTitle, onClose }: OrderImagesSectionProps) {
  const [images, setImages] = useState<OrderImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [unit, setUnit] = useState('mm');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadImages = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/order_images?order_id=${orderId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setImages(data.map((d: any) => ({ ...d, previewUrl: d.image_url || d.storage_path })));
          setLoading(false);
          return;
        }
      }
    } catch {}

    try {
      const { data, error: queryError } = await supabase.from('order_images').select('*').eq('order_id', orderId).order('created_at', { ascending: false });
      if (!queryError && data) {
        const withUrls = (data ?? []).map((image) => {
          const { data: publicUrl } = supabase.storage.from('order-images').getPublicUrl(image.storage_path);
          return { ...image, previewUrl: publicUrl.publicUrl };
        });
        setImages(withUrls);
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { loadImages(); }, [loadImages]);

  async function handleUpload() {
    if (!file) return;
    setSaving(true);
    setError(null);

    const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const storagePath = `${orderId}/${crypto.randomUUID()}.${extension}`;
    let previewUrl = '';

    // 1. Try uploading to Supabase Storage
    try {
      const { error: uploadError } = await supabase.storage
        .from('order-images')
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (!uploadError) {
        const { data: publicUrl } = supabase.storage
          .from('order-images')
          .getPublicUrl(storagePath);
        previewUrl = publicUrl?.publicUrl || '';
      }
    } catch {
      // Supabase storage offline or not configured
    }

    // 2. If no storage URL, create Base64 preview data URL for local storage
    if (!previewUrl) {
      previewUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    }

    const payload = {
      order_id: orderId,
      storage_path: storagePath,
      image_url: previewUrl,
      file_name: file.name,
      content_type: file.type,
      file_size: file.size,
      measurement_label: label.trim() || null,
      length: length ? Number(length) : null,
      width: width ? Number(width) : null,
      height: height ? Number(height) : null,
      measurement_unit: unit,
      notes: notes.trim() || null,
    };

    let savedLocally = false;
    // 3. Save to local SQLite API
    try {
      const res = await fetch('/api/order_images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) savedLocally = true;
    } catch {
      // Local API unavailable
    }

    // 4. Also insert into Supabase if available
    try {
      await supabase.from('order_images').insert({
        order_id: orderId,
        storage_path: storagePath,
        file_name: file.name,
        content_type: file.type,
        file_size: file.size,
        measurement_label: label.trim() || null,
        length: length ? Number(length) : null,
        width: width ? Number(width) : null,
        height: height ? Number(height) : null,
        measurement_unit: unit,
        notes: notes.trim() || null,
      });
    } catch {
      // Supabase offline
    }

    setFile(null);
    setLabel('');
    setLength('');
    setWidth('');
    setHeight('');
    setNotes('');
    setSaving(false);
    loadImages();
  }

  async function handleDelete(image: OrderImage) {
    if (!confirm(`Remove ${image.file_name}?`)) return;

    // Remove from local API
    try {
      await fetch(`/api/order_images/${image.id}`, { method: 'DELETE' });
    } catch {
      // Local fail
    }

    // Remove from Supabase
    try {
      if (image.storage_path) {
        await supabase.storage.from('order-images').remove([image.storage_path]);
      }
      await supabase.from('order_images').delete().eq('id', image.id);
    } catch {
      // Supabase fail
    }

    setImages((current) => current.filter((item) => item.id !== image.id));
  }

  if (loading) return <LoadingState label="Loading order images…" />;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="mx-auto my-4 w-full max-w-5xl rounded-xl border border-charcoal-700 bg-charcoal-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-charcoal-700 px-5 py-4">
          <div><h3 className="text-base font-semibold text-steel-100">Order Images</h3><p className="mt-1 text-xs text-steel-500">{orderTitle}</p></div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-steel-500 hover:bg-charcoal-700 hover:text-steel-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-6 p-5 lg:grid-cols-[320px_1fr]">
          <Card className="h-fit p-4">
            <div className="mb-4 flex items-center gap-2"><ImagePlus className="h-5 w-5 text-amber-400" /><h4 className="font-semibold text-steel-100">Add Image</h4></div>
            <div className="space-y-3">
              <div><label className="mb-1 block text-xs font-medium text-steel-300">Image *</label><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="block w-full text-xs text-steel-400 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500/15 file:px-3 file:py-2 file:text-xs file:font-medium file:text-amber-300 hover:file:bg-amber-500/25" /></div>
              <div><label className="mb-1 block text-xs font-medium text-steel-300">Measurement Label</label><input value={label} onChange={(event) => setLabel(event.target.value)} className={inputClass} placeholder="Main frame" /></div>
              <div className="grid grid-cols-2 gap-2"><div><label className="mb-1 block text-xs font-medium text-steel-300">Length</label><input type="number" min="0" value={length} onChange={(event) => setLength(event.target.value)} className={inputClass} /></div><div><label className="mb-1 block text-xs font-medium text-steel-300">Width</label><input type="number" min="0" value={width} onChange={(event) => setWidth(event.target.value)} className={inputClass} /></div></div>
              <div className="grid grid-cols-2 gap-2"><div><label className="mb-1 block text-xs font-medium text-steel-300">Height</label><input type="number" min="0" value={height} onChange={(event) => setHeight(event.target.value)} className={inputClass} /></div><div><label className="mb-1 block text-xs font-medium text-steel-300">Unit</label><select value={unit} onChange={(event) => setUnit(event.target.value)} className={inputClass}><option value="mm">mm</option><option value="cm">cm</option><option value="m">m</option><option value="in">in</option><option value="ft">ft</option></select></div></div>
              <div><label className="mb-1 block text-xs font-medium text-steel-300">Notes</label><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className={inputClass} placeholder="Additional details…" /></div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <Button onClick={handleUpload} loading={saving} disabled={!file} className="w-full"><ImagePlus className="h-4 w-4" /> Save Image</Button>
            </div>
          </Card>
          <div>
            <div className="mb-3 flex items-center gap-2"><Image className="h-5 w-5 text-steel-400" /><h4 className="font-semibold text-steel-100">Saved Images</h4><span className="text-xs text-steel-500">({images.length})</span></div>
            {images.length === 0 ? <Card><EmptyState icon={<Ruler className="h-8 w-8" />} title="No images yet" message="Add a reference image and its measurements." /></Card> : <div className="grid gap-4 sm:grid-cols-2">{images.map((image) => <Card key={image.id} className="overflow-hidden"><div className="aspect-video bg-charcoal-900">{image.previewUrl ? <img src={image.previewUrl} alt={image.measurement_label ?? image.file_name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-steel-600"><Image className="h-8 w-8" /></div>}</div><div className="space-y-2 p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-medium text-steel-100">{image.measurement_label ?? image.file_name}</p><p className="text-xs text-steel-500">{formatDate(image.created_at)}</p></div><button onClick={() => handleDelete(image)} className="rounded-lg p-1.5 text-steel-500 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button></div>{(image.length !== null || image.width !== null || image.height !== null) && <p className="flex items-center gap-1.5 text-sm text-amber-300"><Ruler className="h-4 w-4" />{image.length ?? '—'} × {image.width ?? '—'} × {image.height ?? '—'} {image.measurement_unit}</p>}{image.notes && <p className="text-xs leading-5 text-steel-400">{image.notes}</p>}</div></Card>)}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
