const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

function addColumnIfNotExists(table, col, def) {
  const info = db.pragma(`table_info(${table})`);
  if (!info.some(c => c.name === col)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`).run();
    console.log(`Added ${col} to ${table}`);
  }
}

// Invoices columns
addColumnIfNotExists('invoices', 'customer_id', 'TEXT');
addColumnIfNotExists('invoices', 'customer_name', 'TEXT');
addColumnIfNotExists('invoices', 'customer_company', 'TEXT');
addColumnIfNotExists('invoices', 'customer_phone', 'TEXT');
addColumnIfNotExists('invoices', 'customer_address', 'TEXT');
addColumnIfNotExists('invoices', 'customer_gstin', 'TEXT');
addColumnIfNotExists('invoices', 'order_title', 'TEXT');
addColumnIfNotExists('invoices', 'discount', 'REAL DEFAULT 0');
addColumnIfNotExists('invoices', 'payment_status', "TEXT DEFAULT 'unpaid'");
addColumnIfNotExists('invoices', 'invoice_date', 'TEXT');

// Order images columns
addColumnIfNotExists('order_images', 'storage_path', 'TEXT');
addColumnIfNotExists('order_images', 'file_name', "TEXT DEFAULT ''");
addColumnIfNotExists('order_images', 'content_type', 'TEXT');
addColumnIfNotExists('order_images', 'file_size', 'INTEGER');
addColumnIfNotExists('order_images', 'measurement_label', 'TEXT');
addColumnIfNotExists('order_images', 'length', 'REAL');
addColumnIfNotExists('order_images', 'width', 'REAL');
addColumnIfNotExists('order_images', 'height', 'REAL');
addColumnIfNotExists('order_images', 'measurement_unit', "TEXT DEFAULT 'mm'");
addColumnIfNotExists('order_images', 'notes', 'TEXT');

console.log('Migration successfully completed.');
db.close();
