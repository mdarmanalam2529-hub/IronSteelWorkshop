import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

console.log('Initializing SQLite database...');

// Ensure foreign keys are enabled
db.pragma('foreign_keys = ON');

const schema = `
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    city TEXT,
    whatsapp_number TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    priority TEXT NOT NULL DEFAULT 'medium',
    due_date TEXT,
    total_amount REAL NOT NULL DEFAULT 0,
    advance_paid REAL NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    sku TEXT,
    quantity REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'kg',
    reorder_level REAL NOT NULL DEFAULT 0,
    price_per_unit REAL NOT NULL DEFAULT 0,
    supplier TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    job_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    method TEXT NOT NULL DEFAULT 'transfer',
    due_date TEXT,
    paid_date TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
    customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL UNIQUE,
    issue_date TEXT NOT NULL,
    due_date TEXT,
    subtotal REAL NOT NULL DEFAULT 0,
    tax_rate REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL DEFAULT 0,
    amount_paid REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT,
    terms TEXT,
    items TEXT DEFAULT '[]',
    gst_enabled INTEGER DEFAULT 0,
    gst_rate REAL DEFAULT 18,
    gst_amount REAL DEFAULT 0,
    gst_type TEXT DEFAULT 'cgst_sgst',
    cgst_amount REAL DEFAULT 0,
    sgst_amount REAL DEFAULT 0,
    igst_amount REAL DEFAULT 0,
    tax_inclusive INTEGER DEFAULT 0,
    place_of_supply TEXT DEFAULT '27',
    round_off REAL DEFAULT 0,
    grand_total REAL DEFAULT 0,
    total_paid REAL DEFAULT 0,
    balance_due REAL DEFAULT 0,
    version INTEGER DEFAULT 1,
    is_archived INTEGER DEFAULT 0,
    customer_name TEXT,
    customer_company TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    customer_gstin TEXT,
    order_title TEXT,
    discount REAL DEFAULT 0,
    payment_status TEXT DEFAULT 'unpaid',
    invoice_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'worker',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS workshop_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    name TEXT NOT NULL DEFAULT 'SteelWorks',
    address TEXT,
    phone TEXT,
    email TEXT,
    working_hours TEXT DEFAULT '9:00 AM - 6:00 PM',
    gst_enabled INTEGER DEFAULT 0,
    gstin TEXT DEFAULT '',
    gst_rate REAL DEFAULT 18,
    gst_type TEXT DEFAULT 'cgst_sgst',
    state_code TEXT DEFAULT '27',
    state_name TEXT DEFAULT 'Maharashtra',
    tax_inclusive INTEGER DEFAULT 0,
    default_hsn TEXT DEFAULT '7308',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS support_requests (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_images (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    storage_path TEXT,
    image_url TEXT,
    file_name TEXT NOT NULL,
    content_type TEXT,
    file_size INTEGER,
    measurement_label TEXT,
    length REAL,
    width REAL,
    height REAL,
    measurement_unit TEXT DEFAULT 'mm',
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`;

db.exec(schema);

// ----------- Sample data (customers, orders, inventory, payments, invoices) -----------
const existingCount = (db.prepare('SELECT COUNT(*) as count FROM customers').get() as { count: number })?.count || 0;
if (existingCount === 0) {
  // Customers
  const sampleCustomers = [
    { id: randomUUID(), name: 'Alice', company: 'Acme Corp', email: 'alice@acme.com', phone: '+1234567890', address: '123 Main St', notes: '', city: 'Metropolis', whatsapp_number: '+1234567890' },
    { id: randomUUID(), name: 'Bob', company: 'Beta Ltd', email: 'bob@beta.com', phone: '+1987654321', address: '456 Oak Ave', notes: '', city: 'Gotham', whatsapp_number: '+1987654321' },
  ];
  for (const c of sampleCustomers) {
    db.prepare(`INSERT OR IGNORE INTO customers (id, name, company, email, phone, address, notes, city, whatsapp_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(c.id, c.name, c.company, c.email, c.phone, c.address, c.notes, c.city, c.whatsapp_number);
  }

  // Orders
  const sampleOrders = [
    { id: randomUUID(), customer_id: sampleCustomers[0].id, title: 'Website redesign', description: 'Redesign corporate site', status: 'active', priority: 'high', due_date: '2027-01-01', total_amount: 5000, advance_paid: 1000 },
    { id: randomUUID(), customer_id: sampleCustomers[1].id, title: 'Mobile app', description: 'Develop e‑commerce app', status: 'pending', priority: 'medium', due_date: '2027-02-15', total_amount: 8000, advance_paid: 0 },
  ];
  for (const o of sampleOrders) {
    db.prepare(`INSERT OR IGNORE INTO orders (id, customer_id, title, description, status, priority, due_date, total_amount, advance_paid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(o.id, o.customer_id, o.title, o.description, o.status, o.priority, o.due_date, o.total_amount, o.advance_paid);
  }

  // Inventory
  const sampleInventory = [
    { id: randomUUID(), name: 'Steel Rods', category: 'Materials', sku: 'STL-001', quantity: 100, unit: 'kg', reorder_level: 20, price_per_unit: 5, supplier: 'MetalWorks' },
    { id: randomUUID(), name: 'Red Paint', category: 'Supplies', sku: 'PNT-RED', quantity: 50, unit: 'L', reorder_level: 10, price_per_unit: 12, supplier: 'ColorCo' },
  ];
  for (const i of sampleInventory) {
    db.prepare(`INSERT OR IGNORE INTO inventory (id, name, category, sku, quantity, unit, reorder_level, price_per_unit, supplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(i.id, i.name, i.category, i.sku, i.quantity, i.unit, i.reorder_level, i.price_per_unit, i.supplier);
  }

  // Payments
  const samplePayments = [
    { id: randomUUID(), job_id: sampleOrders[0].id, customer_id: sampleCustomers[0].id, amount: 1000, status: 'paid', method: 'transfer', due_date: '2026-11-01', paid_date: '2026-10-15' },
  ];
  for (const p of samplePayments) {
    db.prepare(`INSERT OR IGNORE INTO payments (id, job_id, customer_id, amount, status, method, due_date, paid_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(p.id, p.job_id, p.customer_id, p.amount, p.status, p.method, p.due_date, p.paid_date);
  }

  // Invoices
  const sampleInvoices = [
    { id: randomUUID(), order_id: sampleOrders[0].id, invoice_number: 'INV-001', issue_date: '2026-10-10', due_date: '2026-11-10', subtotal: 5000, tax_rate: 0.1, tax_amount: 500, discount_amount: 0, total_amount: 5500, amount_paid: 1000, status: 'partial' },
  ];
  for (const inv of sampleInvoices) {
    db.prepare(`INSERT OR IGNORE INTO invoices (id, order_id, invoice_number, issue_date, due_date, subtotal, tax_rate, tax_amount, discount_amount, total_amount, amount_paid, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(inv.id, inv.order_id, inv.invoice_number, inv.issue_date, inv.due_date, inv.subtotal, inv.tax_rate, inv.tax_amount, inv.discount_amount, inv.total_amount, inv.amount_paid, inv.status);
  }
}

// Users (demo login account)
const sampleUsers = [
  { id: randomUUID(), name: 'Frank Miller', email: 'frank@steelworks.com', phone: '+1555000111', role: 'admin', active: 1 },
  { id: randomUUID(), name: 'Jane Worker', email: 'jane@steelworks.com', phone: '+1555000222', role: 'worker', active: 1 },
];
for (const u of sampleUsers) {
  db.prepare(`INSERT OR IGNORE INTO users (id, name, email, phone, role, active) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(u.id, u.name, u.email, u.phone, u.role, u.active);
}

// Default workshop settings
db.prepare(`INSERT OR IGNORE INTO workshop_settings (id, name, address, phone, email, working_hours) VALUES (?, ?, ?, ?, ?, ?)`)
  .run(1, 'SteelWorks', '123 Industrial Blvd, Steel City', '+1555000000', 'info@steelworks.com', '9:00 AM - 6:00 PM');

console.log('Database initialized successfully with sample data.');
db.close();
