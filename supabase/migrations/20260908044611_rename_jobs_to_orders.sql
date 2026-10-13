/*
# Rename jobs table to orders

## Changes
1. Renames the `jobs` table to `orders`.
2. Renames the `job_id` foreign key column in `payments` to `order_id`.
3. Updates associated constraints and triggers.

## Security
- RLS policies are automatically preserved on rename.
- No data is lost — this is a pure rename.
*/

-- Rename the jobs table to orders
ALTER TABLE jobs RENAME TO orders;

-- Rename the foreign key constraint on orders
ALTER TABLE orders RENAME CONSTRAINT jobs_customer_id_fkey TO orders_customer_id_fkey;

-- Rename the payments.job_id column to order_id
ALTER TABLE payments RENAME COLUMN job_id TO order_id;

-- Rename the foreign key constraint on payments
ALTER TABLE payments RENAME CONSTRAINT payments_job_id_fkey TO payments_order_id_fkey;

-- Recreate the updated_at trigger (uses set_updated_at function)
DROP TRIGGER IF EXISTS trg_jobs_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();