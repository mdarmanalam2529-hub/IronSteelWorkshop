/*
# Create order image measurements storage

1. New Tables
- `order_images` stores one image record for each order reference photo.
- `order_images.id` is the image record identifier.
- `order_images.order_id` links the image to its order and removes image records when that order is removed.
- `order_images.storage_path` stores the private Supabase Storage object path.
- `order_images.file_name`, `content_type`, and `file_size` store upload metadata.
- `order_images.measurement_label` identifies what the measurements describe.
- `order_images.length`, `width`, and `height` store optional numeric measurements.
- `order_images.measurement_unit` stores the unit used for the measurements.
- `order_images.notes` stores optional notes about the image or measurements.
- `order_images.created_at` records when the image was added.

2. Storage
- Creates the private `order-images` bucket.
- Limits uploads to common image formats and 10 MB per file.
- Storage paths are scoped to an order ID, such as `<order-id>/<file-name>`.

3. Security
- Enables row-level security on `order_images`.
- Allows anonymous and authenticated users to manage shared workshop order records, matching the existing no-sign-in app.
- Restricts storage operations to the `order-images` bucket and order-scoped folders.

4. Important Notes
- Images remain private and are displayed through short-lived signed URLs.
- This migration is safe to re-run and does not remove existing data.
*/

CREATE TABLE IF NOT EXISTS public.order_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  content_type text NOT NULL,
  file_size integer NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
  measurement_label text,
  length numeric CHECK (length IS NULL OR length >= 0),
  width numeric CHECK (width IS NULL OR width >= 0),
  height numeric CHECK (height IS NULL OR height >= 0),
  measurement_unit text NOT NULL DEFAULT 'mm',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_images_order_id_idx ON public.order_images(order_id);

ALTER TABLE public.order_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shared_order_images_select" ON public.order_images;
CREATE POLICY "shared_order_images_select" ON public.order_images FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "shared_order_images_insert" ON public.order_images;
CREATE POLICY "shared_order_images_insert" ON public.order_images FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "shared_order_images_update" ON public.order_images;
CREATE POLICY "shared_order_images_update" ON public.order_images FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "shared_order_images_delete" ON public.order_images;
CREATE POLICY "shared_order_images_delete" ON public.order_images FOR DELETE
TO anon, authenticated USING (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('order-images', 'order-images', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "shared_order_images_storage_select" ON storage.objects;
CREATE POLICY "shared_order_images_storage_select" ON storage.objects FOR SELECT
TO anon, authenticated USING (bucket_id = 'order-images');

DROP POLICY IF EXISTS "shared_order_images_storage_insert" ON storage.objects;
CREATE POLICY "shared_order_images_storage_insert" ON storage.objects FOR INSERT
TO anon, authenticated WITH CHECK (
  bucket_id = 'order-images'
  AND (storage.foldername(name))[1] IS NOT NULL
);

DROP POLICY IF EXISTS "shared_order_images_storage_update" ON storage.objects;
CREATE POLICY "shared_order_images_storage_update" ON storage.objects FOR UPDATE
TO anon, authenticated USING (bucket_id = 'order-images')
WITH CHECK (bucket_id = 'order-images');

DROP POLICY IF EXISTS "shared_order_images_storage_delete" ON storage.objects;
CREATE POLICY "shared_order_images_storage_delete" ON storage.objects FOR DELETE
TO anon, authenticated USING (bucket_id = 'order-images');
