import type { IncomingMessage, ServerResponse } from 'http';
import { google } from 'googleapis';
import {
  getOAuth2Client,
  getStoredTokens,
  saveStoredTokens,
  clearStoredTokens,
  getBackupHistory,
  createLocalBackup,
  runManualBackup,
  exportDatabase,
  getBackupContent,
  validateBackupPackage,
  restoreDatabase,
  type BackupPackage,
} from './backupService';

/**
 * Helper to read JSON request body
 */
function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      // Limit to 25MB for backup files
      if (body.length > 25 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        if (!body.trim()) resolve({});
        else resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Helper to send JSON response
 */
function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

/**
 * API Middleware handler for Vite / Node HTTP
 */
export async function backupApiMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
) {
  const reqUrl = req.url || '';
  if (!reqUrl.startsWith('/api/backup') && !reqUrl.startsWith('/api/auth/google')) {
    return next();
  }

  const parsedUrl = new URL(reqUrl, 'http://localhost');
  const pathname = parsedUrl.pathname;
  const method = req.method || 'GET';

  // Role validation helper (allows admin or internal calls)
  const roleHeader = (req.headers['x-user-role'] as string) || '';

  try {
    // ----------------------------------------------------
    // GET /api/backup/status
    // ----------------------------------------------------
    if (pathname === '/api/backup/status' && method === 'GET') {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri =
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173/api/auth/google/callback';
      const isConfigured = Boolean(clientId && clientSecret);

      const stored = getStoredTokens();
      const isConnected = Boolean(stored && stored.tokens);
      const email = stored?.email || null;

      const history = getBackupHistory();
      const lastBackup = history[0] || null;
      const lastSuccessfulBackup =
        history.find((h) => h.status === 'success') || null;

      return sendJson(res, 200, {
        isConfigured,
        isConnected,
        email,
        redirectUri,
        lastBackup,
        lastSuccessfulBackup,
      });
    }

    // ----------------------------------------------------
    // GET /api/auth/google/url
    // ----------------------------------------------------
    if (pathname === '/api/auth/google/url' && method === 'GET') {
      const oauth2Client = getOAuth2Client();
      if (!oauth2Client) {
        return sendJson(res, 400, {
          error:
            'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the environment (.env).',
        });
      }

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/userinfo.email',
        ],
      });

      return sendJson(res, 200, { url: authUrl });
    }

    // ----------------------------------------------------
    // GET /api/auth/google/callback
    // ----------------------------------------------------
    if (pathname === '/api/auth/google/callback' && method === 'GET') {
      const code = parsedUrl.searchParams.get('code');
      const error = parsedUrl.searchParams.get('error');

      if (error) {
        res.writeHead(302, { Location: '/?backup_auth=denied' });
        return res.end();
      }

      if (!code) {
        return sendJson(res, 400, { error: 'Missing authorization code from Google.' });
      }

      const oauth2Client = getOAuth2Client();
      if (!oauth2Client) {
        return sendJson(res, 500, { error: 'OAuth client not initialized.' });
      }

      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // Fetch user's Google email for display
      let userEmail: string | undefined;
      try {
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        userEmail = userInfo.data.email ?? undefined;
      } catch (e) {
        console.warn('Could not fetch userinfo email from Google:', e);
      }

      saveStoredTokens(tokens, userEmail);

      // Redirect back to app settings page with success flag
      res.writeHead(302, { Location: '/?backup_auth=success' });
      return res.end();
    }

    // ----------------------------------------------------
    // POST /api/auth/google/disconnect
    // ----------------------------------------------------
    if (pathname === '/api/auth/google/disconnect' && method === 'POST') {
      clearStoredTokens();
      return sendJson(res, 200, { success: true });
    }

    // ----------------------------------------------------
    // POST /api/backup/create & POST /api/backup/run
    // ----------------------------------------------------
    if ((pathname === '/api/backup/create' || pathname === '/api/backup/run') && method === 'POST') {
      const body = await readJsonBody(req);
      const initiatedBy = body.initiatedBy || 'Administrator';

      // Always create and validate structured local backup (100% free, zero cloud billing)
      const result = await createLocalBackup(initiatedBy);
      return sendJson(res, 200, { success: true, backup: result });
    }

    // ----------------------------------------------------
    // GET /api/backup/history
    // ----------------------------------------------------
    if (pathname === '/api/backup/history' && method === 'GET') {
      const history = getBackupHistory();
      return sendJson(res, 200, { history });
    }

    // ----------------------------------------------------
    // GET /api/backup/export (Direct download of live DB)
    // ----------------------------------------------------
    if (pathname === '/api/backup/export' && method === 'GET') {
      const backupPkg = await exportDatabase('Administrator', 'manual');
      const filename = `${backupPkg.metadata.name}.json`;
      const json = JSON.stringify(backupPkg, null, 2);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.end(json);
    }

    // ----------------------------------------------------
    // GET /api/backup/download
    // ----------------------------------------------------
    if (pathname === '/api/backup/download' && method === 'GET') {
      const id = parsedUrl.searchParams.get('id') || '';
      if (!id) {
        return sendJson(res, 400, { error: 'Missing backup ID parameter.' });
      }

      const { filename, content } = await getBackupContent(id);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.end(content);
    }

    // ----------------------------------------------------
    // POST /api/backup/preview (Validate backup before restore)
    // ----------------------------------------------------
    if (pathname === '/api/backup/preview' && method === 'POST') {
      const body = await readJsonBody(req);
      let pkg: BackupPackage;

      if (body.backupId) {
        const { content } = await getBackupContent(body.backupId);
        pkg = JSON.parse(content);
      } else if (body.backup) {
        pkg = body.backup;
      } else {
        return sendJson(res, 400, { error: 'Please provide either backupId or backup payload.' });
      }

      validateBackupPackage(pkg);

      return sendJson(res, 200, {
        valid: true,
        metadata: pkg.metadata,
        manifest: pkg.manifest,
      });
    }

    // ----------------------------------------------------
    // POST /api/backup/restore (Strictly controlled restore)
    // ----------------------------------------------------
    if (pathname === '/api/backup/restore' && method === 'POST') {
      const body = await readJsonBody(req);

      // Enforce exact confirmation phrase
      const REQUIRED_PHRASE = 'YES, RESTORE THIS BACKUP';
      if (body.confirmation !== REQUIRED_PHRASE) {
        return sendJson(res, 400, {
          error: `Restore cancelled: Confirmation phrase does not match exactly. Must be "${REQUIRED_PHRASE}".`,
        });
      }

      let pkg: BackupPackage;
      if (body.backupId) {
        const { content } = await getBackupContent(body.backupId);
        pkg = JSON.parse(content);
      } else if (body.backup) {
        pkg = body.backup;
      } else {
        return sendJson(res, 400, { error: 'Missing backup payload or backupId.' });
      }

      const initiatedBy = body.initiatedBy || 'Administrator';
      const restoreResult = await restoreDatabase(pkg, initiatedBy);

      return sendJson(res, 200, {
        success: true,
        message: 'Database successfully restored from backup package.',
        ...restoreResult,
      });
    }

    // 404 for unknown /api/backup routes
    return sendJson(res, 404, { error: 'Not Found' });
  } catch (err: any) {
    console.error('Backup API error:', err);
    return sendJson(res, 500, {
      error: err.message || 'An internal server error occurred in Backup Service.',
    });
  }
}
