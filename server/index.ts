import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import { backupApiMiddleware } from './apiMiddleware';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(backupApiMiddleware as any);

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

// Ensure table exists for order images
db.exec(`
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
`);

// Helper for dynamic queries with column verification
function getTableColumns(table: string): Set<string> {
  try {
    const cols = db.pragma(`table_info(${table})`) as any[];
    return new Set(cols.map((c) => c.name));
  } catch {
    return new Set();
  }
}

function buildUpdateQuery(table: string, id: string, payload: any) {
  const allowed = getTableColumns(table);
  const keys = Object.keys(payload).filter((k) => allowed.has(k) && k !== 'id');
  const setString = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => payload[k]);
  return {
    sql: `UPDATE ${table} SET ${setString}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    values: [...values, id]
  };
}

function buildInsertQuery(table: string, payload: any) {
  const allowed = getTableColumns(table);
  const keys = Object.keys(payload).filter((k) => allowed.has(k));
  const placeholders = keys.map(() => '?').join(', ');
  const values = keys.map((k) => payload[k]);
  return {
    sql: `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
    values
  };
}

// Customers
app.get('/api/customers', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all();
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/customers/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Customer not found' });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/customers/:id/detail', (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const orders = db.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC').all(req.params.id);
    const payments = db.prepare(`
      SELECT p.*, COALESCE(p.order_id, p.job_id) as order_id, o.title as order_title
      FROM payments p
      LEFT JOIN orders o ON (p.job_id = o.id OR p.order_id = o.id)
      WHERE p.customer_id = ?
      ORDER BY p.created_at DESC
    `).all(req.params.id) as any[];

    const mappedPayments = payments.map((p) => ({
      ...p,
      order: p.order_title ? { id: p.order_id, title: p.order_title } : undefined,
    }));

    res.json({ customer, orders, payments: mappedPayments });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/customers', (req, res) => {
  try {
    const payload = { ...req.body, id: req.body.id || crypto.randomUUID() };
    const { sql, values } = buildInsertQuery('customers', payload);
    db.prepare(sql).run(...values);
    res.status(201).json(payload);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/customers/:id', (req, res) => {
  try {
    const { sql, values } = buildUpdateQuery('customers', req.params.id, req.body);
    db.prepare(sql).run(...values);
    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    res.json(updated || { success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/customers/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Orders with customer relation
app.get('/api/orders', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT o.*, 
             c.name as customer_name, c.company as customer_company, 
             c.email as customer_email, c.phone as customer_phone
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      ORDER BY o.created_at DESC
    `).all() as any[];

    const mapped = rows.map((o) => ({
      ...o,
      total_amount: Number(o.total_amount || 0),
      advance_paid: Number(o.advance_paid || 0),
      customer: o.customer_name ? {
        id: o.customer_id,
        name: o.customer_name,
        company: o.customer_company,
        email: o.customer_email,
        phone: o.customer_phone,
      } : undefined,
    }));
    res.json(mapped);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders/:id', (req, res) => {
  try {
    const o = db.prepare(`
      SELECT o.*, 
             c.name as customer_name, c.company as customer_company, 
             c.email as customer_email, c.phone as customer_phone
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `).get(req.params.id) as any;

    if (!o) return res.status(404).json({ error: 'Order not found' });
    res.json({
      ...o,
      total_amount: Number(o.total_amount || 0),
      advance_paid: Number(o.advance_paid || 0),
      customer: o.customer_name ? {
        id: o.customer_id,
        name: o.customer_name,
        company: o.customer_company,
        email: o.customer_email,
        phone: o.customer_phone,
      } : undefined,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/orders', (req, res) => {
  try {
    const payload = { ...req.body, id: req.body.id || crypto.randomUUID() };
    const { sql, values } = buildInsertQuery('orders', payload);
    db.prepare(sql).run(...values);

    const inserted = db.prepare(`
      SELECT o.*, c.name as customer_name, c.company as customer_company
      FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.id = ?
    `).get(payload.id) as any;

    res.status(201).json({
      ...inserted,
      customer: inserted?.customer_name ? {
        id: inserted.customer_id,
        name: inserted.customer_name,
        company: inserted.customer_company,
      } : undefined,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/orders/:id', (req, res) => {
  try {
    const { sql, values } = buildUpdateQuery('orders', req.params.id, req.body);
    db.prepare(sql).run(...values);
    const updated = db.prepare(`
      SELECT o.*, c.name as customer_name, c.company as customer_company
      FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.id = ?
    `).get(req.params.id) as any;

    res.json({
      ...updated,
      customer: updated?.customer_name ? {
        id: updated.customer_id,
        name: updated.customer_name,
        company: updated.customer_company,
      } : undefined,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/orders/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Order Images
app.get('/api/order_images', (req, res) => {
  try {
    const orderId = req.query.order_id as string;
    let rows;
    if (orderId) {
      rows = db.prepare('SELECT * FROM order_images WHERE order_id = ? ORDER BY created_at DESC').all(orderId);
    } else {
      rows = db.prepare('SELECT * FROM order_images ORDER BY created_at DESC').all();
    }
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/order_images', (req, res) => {
  try {
    const payload = { ...req.body, id: req.body.id || crypto.randomUUID() };
    const { sql, values } = buildInsertQuery('order_images', payload);
    db.prepare(sql).run(...values);
    res.status(201).json(payload);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/order_images/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM order_images WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Inventory
app.get('/api/inventory', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM inventory ORDER BY name').all() as any[];
    res.json(rows.map(r => ({
      ...r,
      quantity: Number(r.quantity || 0),
      reorder_level: Number(r.reorder_level || 0),
      price_per_unit: Number(r.price_per_unit || 0),
    })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/inventory', (req, res) => {
  try {
    const payload = { ...req.body, id: req.body.id || crypto.randomUUID() };
    const { sql, values } = buildInsertQuery('inventory', payload);
    db.prepare(sql).run(...values);
    res.status(201).json(payload);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/inventory/:id', (req, res) => {
  try {
    const { sql, values } = buildUpdateQuery('inventory', req.params.id, req.body);
    db.prepare(sql).run(...values);
    const updated = db.prepare('SELECT * FROM inventory WHERE id = ?').get(req.params.id);
    res.json(updated || { success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/inventory/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM inventory WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Payments
app.get('/api/payments', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT p.*, 
             COALESCE(p.order_id, p.job_id) as order_id, 
             o.title as order_title, 
             c.name as customer_name, c.company as customer_company
      FROM payments p
      LEFT JOIN orders o ON (p.job_id = o.id OR p.order_id = o.id)
      LEFT JOIN customers c ON p.customer_id = c.id
      ORDER BY p.created_at DESC
    `).all() as any[];

    const mapped = rows.map((p) => ({
      ...p,
      amount: Number(p.amount || 0),
      order_id: p.order_id || p.job_id,
      order: p.order_title ? { id: p.order_id || p.job_id, title: p.order_title } : undefined,
      customer: p.customer_name ? { id: p.customer_id, name: p.customer_name, company: p.customer_company } : undefined,
    }));
    res.json(mapped);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/payments', (req, res) => {
  try {
    const effectiveOrderId = req.body.order_id || req.body.job_id;
    const payload = {
      ...req.body,
      id: req.body.id || crypto.randomUUID(),
      job_id: effectiveOrderId,
      order_id: effectiveOrderId,
    };
    const { sql, values } = buildInsertQuery('payments', payload);
    db.prepare(sql).run(...values);

    // Also update order advance_paid if needed
    if (effectiveOrderId) {
      const allPaid = db.prepare("SELECT SUM(amount) as total FROM payments WHERE (job_id = ? OR order_id = ?) AND status = 'paid'").get(effectiveOrderId, effectiveOrderId) as any;
      if (allPaid?.total !== undefined) {
        db.prepare('UPDATE orders SET advance_paid = ? WHERE id = ?').run(allPaid.total, effectiveOrderId);
      }
    }

    res.status(201).json(payload);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/payments/:id', (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.order_id && !updates.job_id) updates.job_id = updates.order_id;
    if (updates.job_id && !updates.order_id) updates.order_id = updates.job_id;

    const { sql, values } = buildUpdateQuery('payments', req.params.id, updates);
    db.prepare(sql).run(...values);
    const updated = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
    res.json(updated || { success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/payments/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Helper for formatting invoices
function formatInvoiceRow(inv: any) {
  let items = [];
  if (typeof inv.items === 'string') {
    try { items = JSON.parse(inv.items); } catch { items = []; }
  } else if (Array.isArray(inv.items)) {
    items = inv.items;
  }

  const grandTotal = Number(inv.grand_total || inv.total_amount || 0);
  const totalPaid = Number(inv.total_paid || inv.amount_paid || 0);
  const balanceDue = Number(inv.balance_due ?? Math.max(0, grandTotal - totalPaid));

  let paymentStatus = inv.payment_status;
  if (!paymentStatus || paymentStatus === 'draft' || paymentStatus === 'partial') {
    if (totalPaid >= grandTotal && grandTotal > 0) paymentStatus = 'paid';
    else if (totalPaid > 0) paymentStatus = 'partially_paid';
    else paymentStatus = 'unpaid';
  }

  return {
    ...inv,
    items,
    customer_id: inv.customer_id || inv.order_customer_id || '',
    customer_name: inv.customer_name || 'Customer',
    customer_company: inv.customer_company || null,
    customer_phone: inv.customer_phone || null,
    customer_address: inv.customer_address || null,
    customer_gstin: inv.customer_gstin || null,
    order_title: inv.order_title || 'Metal Fabrication',
    invoice_date: inv.invoice_date || inv.issue_date || inv.created_at,
    subtotal: Number(inv.subtotal || 0),
    discount: Number(inv.discount || inv.discount_amount || 0),
    gst_enabled: Boolean(inv.gst_enabled),
    gst_rate: Number(inv.gst_rate ?? 18),
    gst_amount: Number(inv.gst_amount || inv.tax_amount || 0),
    gst_type: inv.gst_type || 'cgst_sgst',
    cgst_amount: Number(inv.cgst_amount || 0),
    sgst_amount: Number(inv.sgst_amount || 0),
    igst_amount: Number(inv.igst_amount || 0),
    tax_inclusive: Boolean(inv.tax_inclusive),
    round_off: Number(inv.round_off || 0),
    grand_total: grandTotal,
    total_paid: totalPaid,
    balance_due: balanceDue,
    payment_status: paymentStatus,
    version: Number(inv.version || 1),
    is_archived: Boolean(inv.is_archived),
  };
}

// Invoices
app.get('/api/invoices', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT i.*, 
             o.title as order_title, o.customer_id as order_customer_id,
             c.name as customer_name, c.company as customer_company, 
             c.phone as customer_phone, c.address as customer_address
      FROM invoices i
      LEFT JOIN orders o ON i.order_id = o.id
      LEFT JOIN customers c ON o.customer_id = c.id
      ORDER BY i.created_at DESC
    `).all() as any[];

    res.json(rows.map(formatInvoiceRow));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/invoices/:id', (req, res) => {
  try {
    const row = db.prepare(`
      SELECT i.*, 
             o.title as order_title, o.customer_id as order_customer_id,
             c.name as customer_name, c.company as customer_company, 
             c.phone as customer_phone, c.address as customer_address
      FROM invoices i
      LEFT JOIN orders o ON i.order_id = o.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE i.id = ?
    `).get(req.params.id) as any;

    if (!row) return res.status(404).json({ error: 'Invoice not found' });
    res.json(formatInvoiceRow(row));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/invoices', (req, res) => {
  try {
    const payload = { ...req.body, id: req.body.id || crypto.randomUUID() };
    if (payload.items && typeof payload.items !== 'string') {
      payload.items = JSON.stringify(payload.items);
    }
    const { sql, values } = buildInsertQuery('invoices', payload);
    db.prepare(sql).run(...values);

    const inserted = db.prepare('SELECT * FROM invoices WHERE id = ?').get(payload.id);
    res.status(201).json(formatInvoiceRow(inserted));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/invoices/:id', (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.items && typeof updates.items !== 'string') {
      updates.items = JSON.stringify(updates.items);
    }
    const { sql, values } = buildUpdateQuery('invoices', req.params.id, updates);
    db.prepare(sql).run(...values);

    const updated = db.prepare(`
      SELECT i.*, 
             o.title as order_title, o.customer_id as order_customer_id,
             c.name as customer_name, c.company as customer_company, 
             c.phone as customer_phone, c.address as customer_address
      FROM invoices i
      LEFT JOIN orders o ON i.order_id = o.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE i.id = ?
    `).get(req.params.id);

    res.json(formatInvoiceRow(updated));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/invoices/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Invoice versions
app.get('/api/invoice_versions', (req, res) => {
  try {
    const { invoice_id } = req.query;
    let rows: any[];
    if (invoice_id) {
      rows = db.prepare('SELECT * FROM invoice_versions WHERE invoice_id = ? ORDER BY version DESC').all(invoice_id);
    } else {
      rows = db.prepare('SELECT * FROM invoice_versions ORDER BY created_at DESC').all();
    }
    const mapped = rows.map((r) => {
      let snapshot = r.snapshot;
      if (typeof snapshot === 'string') {
        try { snapshot = JSON.parse(snapshot); } catch {}
      }
      return { ...r, snapshot };
    });
    res.json(mapped);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/invoice_versions', (req, res) => {
  try {
    const payload = {
      id: req.body.id || crypto.randomUUID(),
      invoice_id: req.body.invoice_id,
      version: req.body.version,
      snapshot: typeof req.body.snapshot === 'string' ? req.body.snapshot : JSON.stringify(req.body.snapshot),
      created_at: new Date().toISOString(),
    };
    db.prepare('INSERT INTO invoice_versions (id, invoice_id, version, snapshot, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(payload.id, payload.invoice_id, payload.version, payload.snapshot, payload.created_at);
    res.status(201).json(payload);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ---- Users CRUD ----
// ---- Users CRUD ----
app.get('/api/users', (req, res) => {
  try {
    const rows = db.prepare('SELECT id, name, email, phone, role, active, created_at FROM users ORDER BY name').all() as any[];
    const mapped = rows.map((u) => ({
      ...u,
      active: Boolean(u.active),
      created_at: u.created_at || new Date().toISOString(),
    }));
    res.json(mapped);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users', (req, res) => {
  try {
    const { name, email, phone, role, password, active } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    
    const cleanEmail = email ? email.trim().toLowerCase() : null;
    if (cleanEmail) {
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
      if (existing) return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const payload = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: cleanEmail,
      phone: phone ? phone.trim() : null,
      role: role || 'worker',
      password: password && password.trim() ? password.trim() : 'password123',
      active: active !== false && active !== 0 ? 1 : 0,
    };

    db.prepare(`
      INSERT INTO users (id, name, email, phone, role, password, active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(payload.id, payload.name, payload.email, payload.phone, payload.role, payload.password, payload.active);

    const created = db.prepare('SELECT id, name, email, phone, role, active, created_at FROM users WHERE id = ?').get(payload.id) as any;
    res.status(201).json({ ...created, active: Boolean(created.active) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/users/:id', (req, res) => {
  try {
    const { name, email, phone, role, active, password } = req.body;
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) updates.email = email ? email.trim().toLowerCase() : null;
    if (phone !== undefined) updates.phone = phone ? phone.trim() : null;
    if (role !== undefined) updates.role = role;
    if (active !== undefined) updates.active = active ? 1 : 0;
    if (password !== undefined && password.trim()) updates.password = password.trim();

    const keys = Object.keys(updates);
    if (keys.length > 0) {
      const setStr = keys.map((k) => `${k} = ?`).join(', ');
      const vals = keys.map((k) => updates[k]);
      db.prepare(`UPDATE users SET ${setStr} WHERE id = ?`).run(...vals, req.params.id);
    }

    const updated = db.prepare('SELECT id, name, email, phone, role, active, created_at FROM users WHERE id = ?').get(req.params.id) as any;
    res.json({ ...updated, active: Boolean(updated.active) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/:id/reset-password', (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newPassword.trim(), req.params.id);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ---- Register endpoint ----
app.post('/api/users/register', (req, res) => {
  try {
    const { name, email, phone, role, password } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });
    if (!email || !email.trim()) return res.status(400).json({ error: 'Email is required.' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const cleanEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const newUser = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: cleanEmail,
      phone: phone ? phone.trim() : null,
      role: role || 'worker',
      password: password,
      active: 1,
    };

    db.prepare(`
      INSERT INTO users (id, name, email, phone, role, password, active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(newUser.id, newUser.name, newUser.email, newUser.phone, newUser.role, newUser.password, newUser.active);

    const created = db.prepare('SELECT id, name, email, phone, role, active, created_at FROM users WHERE id = ?').get(newUser.id);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---- Login endpoint ----
app.post('/api/users/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });
    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(cleanEmail) as any;
    if (!user) return res.status(404).json({ error: 'No active account found with that email.' });

    // If user has a stored password and password was provided, verify it
    if (user.password && password && user.password !== password) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    const { password: _, ...userSafe } = user;
    res.json(userSafe);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ---- Workshop Settings ----
app.get('/api/workshop_settings', (req, res) => {
  const row = db.prepare('SELECT * FROM workshop_settings WHERE id = 1').get();
  res.json(row || null);
});
app.patch('/api/workshop_settings', (req, res) => {
  try {
    const keys = Object.keys(req.body);
    const setStr = keys.map((k) => `${k} = ?`).join(', ');
    const vals = keys.map((k) => (req.body as any)[k]);
    db.prepare(`UPDATE workshop_settings SET ${setStr}, updated_at = CURRENT_TIMESTAMP WHERE id = 1`).run(...vals);
    const updated = db.prepare('SELECT * FROM workshop_settings WHERE id = 1').get();
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ---- Support Requests ----
app.get('/api/support_requests', (req, res) => {
  const rows = db.prepare('SELECT * FROM support_requests ORDER BY created_at DESC').all();
  res.json(rows);
});
app.post('/api/support_requests', (req, res) => {
  try {
    const payload = { ...req.body, id: crypto.randomUUID() };
    const { sql, values } = buildInsertQuery('support_requests', payload);
    db.prepare(sql).run(...values);
    res.json(payload);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Special endpoints for dashboard stats and joined queries
app.get('/api/dashboard/stats', (req, res) => {
  try {
    const activeJobs = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'active'").get() as any;
    const pendingInvoices = db.prepare("SELECT SUM(total_amount - amount_paid) as total FROM invoices WHERE status != 'paid'").get() as any;
    const recentActivity = db.prepare("SELECT * FROM orders ORDER BY updated_at DESC LIMIT 5").all();
    res.json({
      activeJobsCount: activeJobs?.count || 0,
      pendingInvoicesTotal: pendingInvoices?.total || 0,
      recentActivity
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Start the server
app.listen(port, () => {
  console.log(`SQLite Backend server running at http://localhost:${port}`);
});
