/*
# SteelWorks Manager — Initial Schema

## Overview
Creates the core database tables for a steel/iron workshop business management
system: customers, jobs/orders, inventory items, payments, and staff users.
Seeds realistic sample data so the dashboard is visually useful on first load.

## New Tables
1. `customers` — workshop clients (individuals or companies)
   - id (uuid pk), name, company, email, phone, address, notes, created_at
2. `jobs` — fabrication orders linked to a customer
   - id (uuid pk), customer_id (fk -> customers), title, description,
     status (pending|active|completed|cancelled), priority (low|medium|high|urgent),
     due_date, total_amount, created_at, updated_at
3. `inventory` — raw materials and stock items
   - id (uuid pk), name, category, sku, quantity, unit, reorder_level,
     price_per_unit, supplier, created_at, updated_at
4. `payments` — payments tied to a job and customer
   - id (uuid pk), job_id (fk -> jobs), customer_id (fk -> customers),
     amount, status (pending|paid|overdue), method (cash|check|transfer|card),
     due_date, paid_date, notes, created_at
5. `users` — staff members who operate the system (not auth users)
   - id (uuid pk), name, email, phone, role (admin|manager|worker),
     active (bool), created_at

## Security
- RLS enabled on every table.
- Single-tenant no-auth app: policies allow anon + authenticated full CRUD
  (USING (true) / WITH CHECK (true)) because the data is intentionally shared.

## Notes
1. All tables use gen_random_uuid() defaults.
2. Timestamps default to now().
3. Foreign keys use ON DELETE CASCADE for child rows.
4. Indexes added for frequently-queried columns (status, customer_id, job_id).
5. Sample data inserted for all five tables.
*/

-- ============================================================
-- customers
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_customers" ON customers;
CREATE POLICY "anon_select_customers" ON customers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_customers" ON customers;
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_customers" ON customers;
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_customers" ON customers;
CREATE POLICY "anon_delete_customers" ON customers FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- jobs
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','completed','cancelled')),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','urgent')),
  due_date date,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON jobs(customer_id);

DROP POLICY IF EXISTS "anon_select_jobs" ON jobs;
CREATE POLICY "anon_select_jobs" ON jobs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_jobs" ON jobs;
CREATE POLICY "anon_insert_jobs" ON jobs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_jobs" ON jobs;
CREATE POLICY "anon_update_jobs" ON jobs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_jobs" ON jobs;
CREATE POLICY "anon_delete_jobs" ON jobs FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- inventory
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  sku text,
  quantity numeric(12,2) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'kg',
  reorder_level numeric(12,2) NOT NULL DEFAULT 0,
  price_per_unit numeric(12,2) NOT NULL DEFAULT 0,
  supplier text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);

DROP POLICY IF EXISTS "anon_select_inventory" ON inventory;
CREATE POLICY "anon_select_inventory" ON inventory FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_inventory" ON inventory;
CREATE POLICY "anon_insert_inventory" ON inventory FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_inventory" ON inventory;
CREATE POLICY "anon_update_inventory" ON inventory FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_inventory" ON inventory;
CREATE POLICY "anon_delete_inventory" ON inventory FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- payments
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','overdue')),
  method text NOT NULL DEFAULT 'transfer'
    CHECK (method IN ('cash','check','transfer','card')),
  due_date date,
  paid_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_job_id ON payments(job_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);

DROP POLICY IF EXISTS "anon_select_payments" ON payments;
CREATE POLICY "anon_select_payments" ON payments FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_payments" ON payments;
CREATE POLICY "anon_insert_payments" ON payments FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_payments" ON payments;
CREATE POLICY "anon_update_payments" ON payments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_payments" ON payments;
CREATE POLICY "anon_delete_payments" ON payments FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- users (staff — not auth users)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  role text NOT NULL DEFAULT 'worker'
    CHECK (role IN ('admin','manager','worker')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_users" ON users;
CREATE POLICY "anon_select_users" ON users FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_users" ON users;
CREATE POLICY "anon_insert_users" ON users FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_users" ON users;
CREATE POLICY "anon_update_users" ON users FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_users" ON users;
CREATE POLICY "anon_delete_users" ON users FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jobs_updated_at ON jobs;
CREATE TRIGGER trg_jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_inventory_updated_at ON inventory;
CREATE TRIGGER trg_inventory_updated_at BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Sample data
-- ============================================================
INSERT INTO customers (name, company, email, phone, address, notes) VALUES
('James Whitfield','Whitfield Construction','james@whitfieldco.com','555-0142','48 Forge Street, Pittsburgh PA','Long-term client, bulk orders'),
('Maria Gonzalez','Gonzalez Steel Erectors','maria@gse.com','555-0188','12 Industrial Blvd, Cleveland OH','Prefers galvanized finish'),
('Robert Chen','Chen Fabrication LLC','robert@chenfab.com','555-0193','770 Mill Road, Detroit MI','Net-30 payment terms'),
('Sarah O''Brien','O''Brien Mechanical','sarah@obmech.com','555-0177','305 Welding Ave, Chicago IL','Rush jobs accepted with surcharge'),
('David Kowalski','Kowalski Heavy Industries','david@khi.com','555-0150','920 Steel Way, Buffalo NY','Annual maintenance contract'),
('Linda Park','Park Engineering','linda@parkeng.com','555-0166','44 Foundry Lane, Milwaukee WI','Custom fabrication specialist'),
('Michael Torres','Torres Metal Works','mike@torresmetal.com','555-0121','618 Iron Court, Gary IN','Walk-in retail customers'),
('Jennifer Adams','Adams Roofing Co','jen@adamsroof.com','555-0149','230 Beam Street, Akron OH','Structural beams and trusses')
ON CONFLICT DO NOTHING;

INSERT INTO jobs (customer_id, title, description, status, priority, due_date, total_amount)
SELECT c.id, x.title, x.description, x.status, x.priority, x.due_date, x.total_amount
FROM customers c
JOIN (VALUES
  ('Whitfield Construction','Steel Beam Fabrication - Warehouse Frame','Fabricate 40 I-beams for warehouse extension','active','high','2026-09-20'::date,48500.00),
  ('Whitfield Construction','Custom Staircase Railings','Stainless steel railings for 3-floor staircase','pending','medium','2026-10-05'::date,12700.00),
  ('Gonzalez Steel Erectors','Galvanized Pipe Order - 200 units','Cut and galvanize 200 Schedule 40 pipes','active','urgent','2026-09-12'::date,23400.00),
  ('Chen Fabrication LLC','Heavy-Duty Workbench Frames','Weld 15 reinforced workbench frames','completed','low','2026-08-28'::date,8900.00),
  ('O''Brien Mechanical','Pressure Vessel Repair','Repair and recertify 2 pressure vessels','active','high','2026-09-15'::date,31500.00),
  ('Kowalski Heavy Industries','Conveyor Support Structure','Build support frame for conveyor system','pending','medium','2026-10-20'::date,56200.00),
  ('Park Engineering','Precision Shaft Machining','Machine 12 drive shafts to spec','active','urgent','2026-09-10'::date,18900.00),
  ('Torres Metal Works','Decorative Gate Fabrication','Custom wrought-iron driveway gate','completed','low','2026-08-15'::date,5400.00),
  ('Adams Roofing Co','Roof Truss Set - Building A','Fabricate 24 roof trusses','pending','high','2026-10-01'::date,42300.00),
  ('Adams Roofing Co','Roof Truss Set - Building B','Fabricate 18 roof trusses','pending','medium','2026-10-30'::date,33800.00),
  ('Whitfield Construction','Mezzanine Platform','Steel mezzanine floor 200 sqm','completed','medium','2026-08-10'::date,27500.00),
  ('Gonzalez Steel Erectors','Catwalk and Handrails','Access catwalk with OSHA handrails','active','high','2026-09-25'::date,19800.00)
) AS x(company, title, description, status, priority, due_date, total_amount)
ON c.company = x.company
ON CONFLICT DO NOTHING;

INSERT INTO inventory (name, category, sku, quantity, unit, reorder_level, price_per_unit, supplier) VALUES
('Mild Steel Plate 6mm','Plates','PL-MS-06',480.00,'kg',200.00,1.85,'SteelMart Inc'),
('Mild Steel Plate 10mm','Plates','PL-MS-10',150.00,'kg',200.00,2.10,'SteelMart Inc'),
('Stainless Steel Sheet 3mm','Sheets','SH-SS-03',85.00,'kg',100.00,6.40,'Premium Metals Co'),
('I-Beam 200mm','Beams','BM-I-200',42.00,'pcs',20.00,145.00,'Structural Supply Ltd'),
('I-Beam 300mm','Beams','BM-I-300',8.00,'pcs',15.00,210.00,'Structural Supply Ltd'),
('Angle Iron 50x50','Angles','AN-5050',320.00,'m',150.00,4.20,'SteelMart Inc'),
('Schedule 40 Pipe 2in','Pipes','PP-S40-2',180.00,'m',100.00,7.80,'Tube & Pipe Co'),
('Schedule 40 Pipe 4in','Pipes','PP-S40-4',65.00,'m',80.00,14.50,'Tube & Pipe Co'),
('Round Bar 25mm','Bars','RB-25',540.00,'kg',250.00,1.55,'SteelMart Inc'),
('Round Bar 50mm','Bars','RB-50',95.00,'kg',200.00,2.30,'SteelMart Inc'),
('Welding Rod E7018','Consumables','WR-7018',12.00,'kg',25.00,5.90,'WeldPro Supply'),
('Argon Gas Cylinder','Consumables','GA-40L',6.00,'pcs',8.00,85.00,'GasTech'),
('Galvanizing Compound','Finishes','GC-ZN',28.00,'L',40.00,18.75,'ProFinish Chemicals'),
('Structural Bolts M20','Fasteners','FB-M20',850.00,'pcs',500.00,0.95,'FastenerWorld'),
('Flat Bar 40x6','Bars','FB-406',210.00,'m',120.00,3.10,'SteelMart Inc')
ON CONFLICT DO NOTHING;

INSERT INTO payments (job_id, customer_id, amount, status, method, due_date, paid_date, notes)
SELECT j.id, j.customer_id, x.amount, x.status, x.method, x.due_date, x.paid_date, x.notes
FROM jobs j
JOIN (VALUES
  ('Steel Beam Fabrication - Warehouse Frame',24250.00,'paid','transfer','2026-09-01'::date,'2026-08-30'::date,'50% deposit'),
  ('Steel Beam Fabrication - Warehouse Frame',24250.00,'pending','transfer','2026-10-01'::date,NULL,'50% balance on completion'),
  ('Galvanized Pipe Order - 200 units',23400.00,'pending','check','2026-09-20'::date,NULL,'Net-30'),
  ('Heavy-Duty Workbench Frames',8900.00,'paid','cash','2026-08-28'::date,'2026-08-28'::date,'Paid on delivery'),
  ('Pressure Vessel Repair',15750.00,'paid','card','2026-09-01'::date,'2026-08-31'::date,'50% deposit'),
  ('Pressure Vessel Repair',15750.00,'overdue','transfer','2026-09-05'::date,NULL,'50% balance - overdue'),
  ('Precision Shaft Machining',18900.00,'pending','transfer','2026-09-15'::date,NULL,'Due on completion'),
  ('Decorative Gate Fabrication',5400.00,'paid','cash','2026-08-15'::date,'2026-08-15'::date,'Paid in full'),
  ('Mezzanine Platform',27500.00,'paid','transfer','2026-08-10'::date,'2026-08-08'::date,'Paid in full'),
  ('Roof Truss Set - Building A',21150.00,'pending','check','2026-10-15'::date,NULL,'50% deposit'),
  ('Catwalk and Handrails',9900.00,'paid','card','2026-09-01'::date,'2026-08-29'::date,'50% deposit'),
  ('Catwalk and Handrails',9900.00,'pending','transfer','2026-09-30'::date,NULL,'50% balance')
) AS x(title, amount, status, method, due_date, paid_date, notes)
ON j.title = x.title
ON CONFLICT DO NOTHING;

INSERT INTO users (name, email, phone, role, active) VALUES
('Frank Reynolds','frank@steelworks.com','555-1001','admin',true),
('Alice Mitchell','alice@steelworks.com','555-1002','manager',true),
('Tom Bradley','tom@steelworks.com','555-1003','worker',true),
('Nina Petrova','nina@steelworks.com','555-1004','worker',true),
('Carlos Mendez','carlos@steelworks.com','555-1005','manager',true)
ON CONFLICT DO NOTHING;