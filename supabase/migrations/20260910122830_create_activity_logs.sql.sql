/*
# Create activity logging system

1. New Tables
- `activity_logs` stores a running audit trail of every change to customers, orders, inventory, payments, and users.
- `activity_logs.id` is the log entry identifier.
- `activity_logs.table_name` records which table was changed.
- `activity_logs.record_id` stores the primary key of the affected row.
- `activity_logs.action` records whether the change was an INSERT, UPDATE, or DELETE.
- `activity_logs.description` stores a human-readable summary of the change.
- `activity_logs.changes` stores a JSONB diff of old vs new values (null for deletes).
- `activity_logs.created_at` records when the log entry was created.

2. Functions
- `log_activity()` is a generic trigger function that creates an `activity_logs` row on any INSERT, UPDATE, or DELETE.
- It derives a description from the table name and action type.
- For UPDATE, it computes the set of changed columns and stores them in `changes`.

3. Triggers
- Triggers are installed on `customers`, `orders`, `inventory`, `payments`, and `users`.
- Each runs AFTER INSERT OR UPDATE OR DELETE, calling `log_activity()`.

4. Security
- Enables RLS on `activity_logs`.
- Allows anonymous and authenticated users to read and manage shared workshop log records, matching the existing no-sign-in app.

5. Important Notes
- This migration is safe to re-run and does not remove existing data.
- Existing rows in tracked tables are not retroactively logged — only future changes are captured.
*/

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  description text NOT NULL,
  changes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_table_name_idx ON public.activity_logs(table_name);
CREATE INDEX IF NOT EXISTS activity_logs_action_idx ON public.activity_logs(action);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shared_activity_logs_select" ON public.activity_logs;
CREATE POLICY "shared_activity_logs_select" ON public.activity_logs FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "shared_activity_logs_insert" ON public.activity_logs;
CREATE POLICY "shared_activity_logs_insert" ON public.activity_logs FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "shared_activity_logs_update" ON public.activity_logs;
CREATE POLICY "shared_activity_logs_update" ON public.activity_logs FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "shared_activity_logs_delete" ON public.activity_logs;
CREATE POLICY "shared_activity_logs_delete" ON public.activity_logs FOR DELETE
TO anon, authenticated USING (true);

-- Generic trigger function
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_record_id text;
  v_description text;
  v_changes jsonb;
  v_old_data jsonb;
  v_new_data jsonb;
BEGIN
  v_old_data := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END;
  v_new_data := CASE WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW) WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END;

  v_record_id := CASE
    WHEN TG_OP = 'DELETE' THEN (v_old_data ->> 'id')
    ELSE (v_new_data ->> 'id')
  END;

  v_description := CASE TG_OP
    WHEN 'INSERT' THEN 'Created ' || TG_TABLE_NAME || (CASE WHEN v_new_data ? 'name' THEN ' "' || (v_new_data ->> 'name') || '"' WHEN v_new_data ? 'title' THEN ' "' || (v_new_data ->> 'title') || '"' ELSE '' END)
    WHEN 'UPDATE' THEN 'Updated ' || TG_TABLE_NAME || (CASE WHEN v_new_data ? 'name' THEN ' "' || (v_new_data ->> 'name') || '"' WHEN v_new_data ? 'title' THEN ' "' || (v_new_data ->> 'title') || '"' ELSE '' END)
    WHEN 'DELETE' THEN 'Deleted ' || TG_TABLE_NAME || (CASE WHEN v_old_data ? 'name' THEN ' "' || (v_old_data ->> 'name') || '"' WHEN v_old_data ? 'title' THEN ' "' || (v_old_data ->> 'title') || '"' ELSE '' END)
  END;

  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(key, value) INTO v_changes
    FROM jsonb_each(v_new_data)
    WHERE key IN (SELECT key FROM jsonb_object_keys(v_new_data) INTERSECT SELECT key FROM jsonb_object_keys(v_old_data))
      AND v_new_data -> key IS DISTINCT FROM v_old_data -> key;
  ELSIF TG_OP = 'INSERT' THEN
    v_changes := v_new_data;
  ELSIF TG_OP = 'DELETE' THEN
    v_changes := v_old_data;
  END IF;

  INSERT INTO public.activity_logs (table_name, record_id, action, description, changes)
  VALUES (TG_TABLE_NAME, v_record_id, TG_OP, v_description, v_changes);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Install triggers on all main tables
DROP TRIGGER IF EXISTS activity_log_customers ON public.customers;
CREATE TRIGGER activity_log_customers
  AFTER INSERT OR UPDATE OR DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS activity_log_orders ON public.orders;
CREATE TRIGGER activity_log_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS activity_log_inventory ON public.inventory;
CREATE TRIGGER activity_log_inventory
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS activity_log_payments ON public.payments;
CREATE TRIGGER activity_log_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS activity_log_users ON public.users;
CREATE TRIGGER activity_log_users
  AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
