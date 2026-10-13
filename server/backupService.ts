import fs from 'fs';
import path from 'path';
import stream from 'stream';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

const DATA_DIR = path.resolve(process.cwd(), '.data');
const TOKENS_PATH = path.join(DATA_DIR, 'google_tokens.json');
const HISTORY_PATH = path.join(DATA_DIR, 'backup_history.json');
const LOCAL_BACKUPS_DIR = path.join(DATA_DIR, 'local_backups');

// Ensure data directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(LOCAL_BACKUPS_DIR)) {
  fs.mkdirSync(LOCAL_BACKUPS_DIR, { recursive: true });
}

// Supabase client for server-side database export/restore
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

// Minimum least-privilege scope: access only files created by this app
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
];

export interface BackupHistoryItem {
  id: string;
  name: string;
  status: 'success' | 'failed';
  type: 'manual' | 'automatic';
  startedAt: string;
  completedAt?: string;
  fileSize?: number;
  driveFileId?: string;
  driveViewLink?: string;
  errorMessage?: string;
  initiatedBy: string;
  counts?: Record<string, number>;
}

export interface BackupPackage {
  metadata: {
    backupId: string;
    name: string;
    createdAt: string;
    appVersion: string;
    schemaVersion: string;
    backupType: 'manual' | 'automatic' | 'safety_pre_restore';
    initiatedBy: string;
  };
  manifest: {
    backupDate: string;
    appVersion: string;
    schemaVersion: string;
    counts: {
      customers: number;
      orders: number;
      inventoryItems: number;
      inventoryTransactions: number;
      payments: number;
      workers: number;
      suppliers: number;
      expenses: number;
      workshopSettings: number;
      orderImages: number;
      activityLogs: number;
    };
    notes: Record<string, string>;
  };
  data: {
    customers: any[];
    orders: any[];
    inventory: any[];
    payments: any[];
    users: any[];
    workshop_settings: any[];
    order_images: any[];
    activity_logs: any[];
  };
}

/**
 * Creates Google OAuth2 Client
 */
export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173/api/auth/google/callback';

  if (!clientId || !clientSecret) {
    return null;
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Gets saved tokens from disk
 */
export function getStoredTokens(): { tokens: any; email?: string } | null {
  try {
    if (!fs.existsSync(TOKENS_PATH)) return null;
    const raw = fs.readFileSync(TOKENS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading stored tokens:', err);
    return null;
  }
}

/**
 * Saves tokens to disk
 */
export function saveStoredTokens(tokens: any, email?: string) {
  const data = { tokens, email, updatedAt: new Date().toISOString() };
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Deletes stored tokens (disconnect)
 */
export function clearStoredTokens() {
  if (fs.existsSync(TOKENS_PATH)) {
    fs.unlinkSync(TOKENS_PATH);
  }
}

/**
 * Reads backup history log
 */
export function getBackupHistory(): BackupHistoryItem[] {
  try {
    if (!fs.existsSync(HISTORY_PATH)) return [];
    const raw = fs.readFileSync(HISTORY_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Appends or updates an item in backup history
 */
export function recordBackupHistory(item: BackupHistoryItem) {
  const history = getBackupHistory();
  const existingIdx = history.findIndex((h) => h.id === item.id);
  if (existingIdx >= 0) {
    history[existingIdx] = item;
  } else {
    history.unshift(item);
  }
  // Keep max 50 historical entries
  const trimmed = history.slice(0, 50);
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(trimmed, null, 2), 'utf-8');
}

/**
 * Returns authenticated Google Drive client if connected
 */
export async function getAuthenticatedDrive() {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) {
    throw new Error('Google OAuth credentials not configured in environment variables (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).');
  }

  const stored = getStoredTokens();
  if (!stored || !stored.tokens) {
    throw new Error('Google Drive account is not connected.');
  }

  oauth2Client.setCredentials(stored.tokens);

  // Listen for refreshed tokens and save them
  oauth2Client.on('tokens', (newTokens) => {
    saveStoredTokens({ ...stored.tokens, ...newTokens }, stored.email);
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * Finds or creates the dedicated "SteelWorks Backups" folder
 */
export async function getOrCreateBackupFolder(drive: any): Promise<string> {
  const folderName = 'SteelWorks Backups';

  // Search for existing active folder
  const response = await drive.files.list({
    q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0].id;
  }

  // Create folder if not found
  const createRes = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Automated and manual backups for SteelWorks Manager',
    },
    fields: 'id, name',
  });

  if (!createRes.data.id) {
    throw new Error('Failed to create backup folder on Google Drive');
  }

  return createRes.data.id;
}

/**
 * Reads all live tables from Supabase and packages into structured backup
 */
export async function exportDatabase(initiatedBy = 'Administrator', backupType: 'manual' | 'automatic' | 'safety_pre_restore' = 'manual'): Promise<BackupPackage> {
  const now = new Date();
  const timestampStr = now.toISOString().replace(/[:.]/g, '-');
  const backupName = `SteelWorks_Backup_${timestampStr.slice(0, 10)}_${timestampStr.slice(11, 19)}`;
  const backupId = `bk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // Query actual existing tables in parallel
  const [
    customersRes,
    ordersRes,
    inventoryRes,
    paymentsRes,
    usersRes,
    workshopRes,
    orderImagesRes,
    activityLogsRes,
  ] = await Promise.all([
    supabase.from('customers').select('*').order('created_at'),
    supabase.from('orders').select('*').order('created_at'),
    supabase.from('inventory').select('*').order('created_at'),
    supabase.from('payments').select('*').order('created_at'),
    supabase.from('users').select('*').order('created_at'),
    supabase.from('workshop_settings').select('*'),
    supabase.from('order_images').select('*').order('created_at'),
    supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(200),
  ]);

  if (customersRes.error) throw new Error(`Failed to read customers: ${customersRes.error.message}`);
  if (ordersRes.error) throw new Error(`Failed to read orders: ${ordersRes.error.message}`);
  if (inventoryRes.error) throw new Error(`Failed to read inventory: ${inventoryRes.error.message}`);
  if (paymentsRes.error) throw new Error(`Failed to read payments: ${paymentsRes.error.message}`);
  if (usersRes.error) throw new Error(`Failed to read users: ${usersRes.error.message}`);

  const customers = customersRes.data ?? [];
  const orders = ordersRes.data ?? [];
  const inventory = inventoryRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const users = usersRes.data ?? [];
  const workshop_settings = workshopRes.data ?? [];
  const order_images = orderImagesRes.data ?? [];
  const activity_logs = activityLogsRes.data ?? [];

  const backupPackage: BackupPackage = {
    metadata: {
      backupId,
      name: backupName,
      createdAt: now.toISOString(),
      appVersion: '1.0.0',
      schemaVersion: '20260910133054',
      backupType,
      initiatedBy,
    },
    manifest: {
      backupDate: now.toISOString(),
      appVersion: '1.0.0',
      schemaVersion: '20260910133054',
      counts: {
        customers: customers.length,
        orders: orders.length,
        inventoryItems: inventory.length,
        inventoryTransactions: 0,
        payments: payments.length,
        workers: users.length,
        suppliers: 0,
        expenses: 0,
        workshopSettings: workshop_settings.length,
        orderImages: order_images.length,
        activityLogs: activity_logs.length,
      },
      notes: {
        inventoryTransactions: 'Entity not present in current application schema',
        suppliers: 'Supplier details are maintained as attributes in inventory items',
        expenses: 'Entity not present in current application schema',
      },
    },
    data: {
      customers,
      orders,
      inventory,
      payments,
      users,
      workshop_settings,
      order_images,
      activity_logs,
    },
  };

  // Validate package structure before returning
  validateBackupPackage(backupPackage);

  // Save a local copy in .data/local_backups/
  const localFilePath = path.join(LOCAL_BACKUPS_DIR, `${backupName}.json`);
  fs.writeFileSync(localFilePath, JSON.stringify(backupPackage, null, 2), 'utf-8');

  return backupPackage;
}

/**
 * Validates the structure and consistency of a backup package
 */
export function validateBackupPackage(pkg: any): { valid: boolean; error?: string } {
  if (!pkg || typeof pkg !== 'object') {
    throw new Error('Invalid backup file: Root must be a JSON object.');
  }

  if (!pkg.metadata || !pkg.metadata.backupId || !pkg.metadata.createdAt) {
    throw new Error('Invalid backup file: Missing metadata block (backupId, createdAt).');
  }

  if (!pkg.manifest || !pkg.manifest.counts) {
    throw new Error('Invalid backup file: Missing manifest block.');
  }

  if (!pkg.data || typeof pkg.data !== 'object') {
    throw new Error('Invalid backup file: Missing data object.');
  }

  const requiredTables = ['customers', 'orders', 'inventory', 'payments', 'users'];
  for (const table of requiredTables) {
    if (!Array.isArray(pkg.data[table])) {
      throw new Error(`Invalid backup data: Table "${table}" is missing or is not an array.`);
    }
  }

  // Check counts consistency
  const counts = pkg.manifest.counts;
  if (counts.customers !== pkg.data.customers.length) {
    throw new Error('Manifest mismatch: customers count does not match data records.');
  }
  if (counts.orders !== pkg.data.orders.length) {
    throw new Error('Manifest mismatch: orders count does not match data records.');
  }
  if (counts.payments !== pkg.data.payments.length) {
    throw new Error('Manifest mismatch: payments count does not match data records.');
  }

  return { valid: true };
}

/**
 * Creates, validates, and records a local structured backup (100% free, no cloud/billing needed)
 */
export async function createLocalBackup(initiatedBy = 'Administrator'): Promise<BackupHistoryItem> {
  const startedAt = new Date().toISOString();
  const backupPkg = await exportDatabase(initiatedBy, 'manual');

  const localFile = path.join(LOCAL_BACKUPS_DIR, `${backupPkg.metadata.name}.json`);
  let fileSize = 0;
  if (fs.existsSync(localFile)) {
    fileSize = fs.statSync(localFile).size;
  }

  const historyItem: BackupHistoryItem = {
    id: backupPkg.metadata.backupId,
    name: backupPkg.metadata.name,
    status: 'success',
    type: 'manual',
    startedAt,
    completedAt: new Date().toISOString(),
    fileSize,
    initiatedBy,
    counts: backupPkg.manifest.counts,
  };

  recordBackupHistory(historyItem);
  return historyItem;
}

/**
 * Executes a full manual backup:
 * 1. Exports database
 * 2. Validates package
 * 3. Uploads to Google Drive folder "SteelWorks Backups"
 * 4. Verifies upload
 * 5. Records history
 */
export async function runManualBackup(initiatedBy = 'Administrator'): Promise<BackupHistoryItem> {
  const startedAt = new Date().toISOString();
  const backupId = `bk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const backupName = `SteelWorks_Backup_${startedAt.slice(0, 10)}_${startedAt.slice(11, 19).replace(/:/g, '-')}`;

  const historyItem: BackupHistoryItem = {
    id: backupId,
    name: backupName,
    status: 'failed',
    type: 'manual',
    startedAt,
    initiatedBy,
  };

  try {
    // 1. Export database & generate manifest
    const backupPkg = await exportDatabase(initiatedBy, 'manual');
    historyItem.counts = backupPkg.manifest.counts;
    historyItem.name = backupPkg.metadata.name;

    const fileContent = JSON.stringify(backupPkg, null, 2);
    const buffer = Buffer.from(fileContent, 'utf-8');
    historyItem.fileSize = buffer.length;

    // 2. Connect to Google Drive
    const drive = await getAuthenticatedDrive();

    // 3. Locate or create "SteelWorks Backups" folder
    const folderId = await getOrCreateBackupFolder(drive);

    // 4. Upload backup file
    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);

    const uploadRes = await drive.files.create({
      requestBody: {
        name: `${backupPkg.metadata.name}.json`,
        mimeType: 'application/json',
        parents: [folderId],
        description: `SteelWorks Manager backup. Customers: ${backupPkg.manifest.counts.customers}, Orders: ${backupPkg.manifest.counts.orders}, Inventory: ${backupPkg.manifest.counts.inventoryItems}, Payments: ${backupPkg.manifest.counts.payments}.`,
      },
      media: {
        mimeType: 'application/json',
        body: bufferStream,
      },
      fields: 'id, name, size, webViewLink, createdTime',
    });

    const fileId = uploadRes.data.id;
    if (!fileId) {
      throw new Error('Google Drive upload did not return a valid file ID.');
    }

    // 5. Verification step: Query Drive to verify the uploaded file exists and has size
    const verifyRes = await drive.files.get({
      fileId,
      fields: 'id, name, size, webViewLink',
    });

    if (!verifyRes.data || verifyRes.data.id !== fileId) {
      throw new Error('Google Drive upload verification failed: Uploaded file not found on Drive.');
    }

    historyItem.status = 'success';
    historyItem.completedAt = new Date().toISOString();
    historyItem.driveFileId = fileId;
    historyItem.driveViewLink = verifyRes.data.webViewLink ?? undefined;

    recordBackupHistory(historyItem);
    return historyItem;
  } catch (err: any) {
    historyItem.errorMessage = err.message || 'Unknown error occurred during backup.';
    historyItem.completedAt = new Date().toISOString();
    recordBackupHistory(historyItem);
    throw err;
  }
}

/**
 * Downloads a backup from Google Drive or local storage by file/backup ID
 */
export async function getBackupContent(backupIdOrFileId: string): Promise<{ filename: string; content: string }> {
  // Check if it's in local storage
  const localFile = path.join(LOCAL_BACKUPS_DIR, `${backupIdOrFileId}.json`);
  if (fs.existsSync(localFile)) {
    return {
      filename: `${backupIdOrFileId}.json`,
      content: fs.readFileSync(localFile, 'utf-8'),
    };
  }

  // Check history to see if it has a driveFileId
  const history = getBackupHistory();
  const item = history.find((h) => h.id === backupIdOrFileId || h.name === backupIdOrFileId || h.driveFileId === backupIdOrFileId);

  const driveFileId = item?.driveFileId || backupIdOrFileId;
  const drive = await getAuthenticatedDrive();

  const res = await drive.files.get(
    { fileId: driveFileId, alt: 'media' },
    { responseType: 'text' }
  );

  return {
    filename: `${item?.name || 'SteelWorks_Backup'}.json`,
    content: typeof res.data === 'string' ? res.data : JSON.stringify(res.data),
  };
}

/**
 * Restores the database from a backup package with relational safety:
 * 1. Performs validation
 * 2. Creates a safety pre-restore backup of current live database
 * 3. Restores in strictly controlled relational order (customers -> orders -> payments, etc.)
 */
export async function restoreDatabase(backupPkg: BackupPackage, initiatedBy = 'Administrator') {
  // 1. Validate
  validateBackupPackage(backupPkg);

  // 2. Create safety pre-restore backup
  console.log('Creating safety backup of live database before restore...');
  const safetyBackup = await exportDatabase(initiatedBy, 'safety_pre_restore');
  console.log(`Safety backup created: ${safetyBackup.metadata.name}`);

  const data = backupPkg.data;
  const restoredCounts: Record<string, number> = {};

  // 3. Relational restoration order
  // Step A: workshop_settings
  if (data.workshop_settings && data.workshop_settings.length > 0) {
    for (const ws of data.workshop_settings) {
      await supabase.from('workshop_settings').upsert(ws, { onConflict: 'id' });
    }
    restoredCounts.workshopSettings = data.workshop_settings.length;
  }

  // Step B: users (workers/staff)
  if (data.users && data.users.length > 0) {
    for (const u of data.users) {
      await supabase.from('users').upsert(u, { onConflict: 'id' });
    }
    restoredCounts.workers = data.users.length;
  }

  // Step C: customers (parent of orders & payments)
  if (data.customers && data.customers.length > 0) {
    for (const c of data.customers) {
      await supabase.from('customers').upsert(c, { onConflict: 'id' });
    }
    restoredCounts.customers = data.customers.length;
  }

  // Step D: inventory items
  if (data.inventory && data.inventory.length > 0) {
    for (const item of data.inventory) {
      await supabase.from('inventory').upsert(item, { onConflict: 'id' });
    }
    restoredCounts.inventory = data.inventory.length;
  }

  // Step E: orders (child of customers)
  if (data.orders && data.orders.length > 0) {
    for (const ord of data.orders) {
      // Remove any joined customer object if present
      const { customer, ...cleanOrd } = ord;
      await supabase.from('orders').upsert(cleanOrd, { onConflict: 'id' });
    }
    restoredCounts.orders = data.orders.length;
  }

  // Step F: payments (child of orders & customers)
  if (data.payments && data.payments.length > 0) {
    for (const p of data.payments) {
      const { customer, order, ...cleanPayment } = p;
      await supabase.from('payments').upsert(cleanPayment, { onConflict: 'id' });
    }
    restoredCounts.payments = data.payments.length;
  }

  // Step G: order_images (child of orders)
  if (data.order_images && data.order_images.length > 0) {
    for (const img of data.order_images) {
      await supabase.from('order_images').upsert(img, { onConflict: 'id' });
    }
    restoredCounts.orderImages = data.order_images.length;
  }

  return {
    success: true,
    safetyBackupName: safetyBackup.metadata.name,
    restoredCounts,
  };
}
