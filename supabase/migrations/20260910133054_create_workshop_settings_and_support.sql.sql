/*
# Create workshop_settings and support_requests tables

1. New Tables
- `workshop_settings` — single-row table storing workshop business details.
  - id (int, primary key, always 1), name, address, phone, email, working_hours (text), updated_at.
- `support_requests` — support/bug reports submitted from the Help & Support modal.
  - id (uuid pk), subject, message, status (open/in_progress/resolved), created_at.

2. Security
- RLS enabled on both tables.
- Single-tenant no-auth app: policies allow anon + authenticated full CRUD
  (USING (true) / WITH CHECK (true)) because the data is intentionally shared.

3. Seed Data
- Inserts a default workshop_settings row (id=1) with placeholder values.

4. Important Notes
- workshop_settings is constrained to a single row via PRIMARY KEY default 1.
- This migration is safe to re-run and does not remove existing data.
*/

CREATE TABLE IF NOT EXISTS public.workshop_settings (
  id int PRIMARY KEY DEFAULT 1,
  name text NOT NULL DEFAULT 'SteelWorks Workshop',
  address text,
  phone text,
  email text,
  working_hours text NOT NULL DEFAULT 'Mon–Fri 6:00–16:00\nSat 7:00–12:00',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workshop_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_workshop_settings" ON public.workshop_settings;
CREATE POLICY "anon_select_workshop_settings" ON public.workshop_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_workshop_settings" ON public.workshop_settings;
CREATE POLICY "anon_insert_workshop_settings" ON public.workshop_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_workshop_settings" ON public.workshop_settings;
CREATE POLICY "anon_update_workshop_settings" ON public.workshop_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_workshop_settings" ON public.workshop_settings;
CREATE POLICY "anon_delete_workshop_settings" ON public.workshop_settings FOR DELETE
  TO anon, authenticated USING (true);

-- Trigger for updated_at on workshop_settings
DROP TRIGGER IF EXISTS trg_workshop_settings_updated_at ON public.workshop_settings;
CREATE TRIGGER trg_workshop_settings_updated_at BEFORE UPDATE ON public.workshop_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default row
INSERT INTO public.workshop_settings (id, name, address, phone, email)
VALUES (1, 'SteelWorks Workshop', '48 Forge Street, Pittsburgh PA', '555-1000', 'info@steelworks.com')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- support_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_support_requests_status ON public.support_requests(status);
CREATE INDEX IF NOT EXISTS idx_support_requests_created_at ON public.support_requests(created_at DESC);

DROP POLICY IF EXISTS "anon_select_support_requests" ON public.support_requests;
CREATE POLICY "anon_select_support_requests" ON public.support_requests FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_support_requests" ON public.support_requests;
CREATE POLICY "anon_insert_support_requests" ON public.support_requests FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_support_requests" ON public.support_requests;
CREATE POLICY "anon_update_support_requests" ON public.support_requests FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_support_requests" ON public.support_requests;
CREATE POLICY "anon_delete_support_requests" ON public.support_requests FOR DELETE
  TO anon, authenticated USING (true);
