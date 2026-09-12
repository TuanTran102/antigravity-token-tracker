import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as cp from 'node:child_process';

export interface WorkspaceResolverOptions {
  customConversationsDir?: string;
  customGlobalStorageDbPath?: string;
  customWorkspaceStorageDir?: string;
}

export class WorkspaceResolver {
  private workspaceCache: Map<string, string | undefined> = new Map();
  private customConversationsDir?: string;
  private customGlobalStorageDbPath?: string;
  private globalCacheLoaded = false;
  private globalSummariesCache: Map<string, string> = new Map();

  constructor(options: WorkspaceResolverOptions = {}) {
    this.customConversationsDir = options.customConversationsDir;
    this.customGlobalStorageDbPath = options.customGlobalStorageDbPath;
  }

  private extractFromConversationDb(conversationId: string): string | undefined {
    const convDir = this.customConversationsDir || path.join(
      os.homedir(),
      '.gemini',
      'antigravity-ide',
      'conversations'
    );
    const dbPath = path.join(convDir, `${conversationId}.db`);
    if (!fs.existsSync(dbPath)) {
      return undefined;
    }

    try {
      const raw = cp.execFileSync('sqlite3', [
        dbPath,
        'SELECT quote(data) FROM trajectory_metadata_blob WHERE id="main";'
      ], { encoding: 'utf8', timeout: 2000 }).trim();

      if (raw.startsWith("X'") && raw.endsWith("'")) {
        const hex = raw.slice(2, -1);
        const buf = Buffer.from(hex, 'hex');
        const text = buf.toString('utf8');
        const m = text.match(/file:\/\/\/([^\x00-\x1f\x7f-\xff\"'\s\)\:\;]+)/);
        if (m) {
          const decoded = decodeURIComponent(m[1]).replace(/\/+$/, '');
          const wsName = path.basename(decoded);
          if (wsName) return wsName;
        }
      }
    } catch {
      // Graceful fallback if db is locked or unreadable
    }
    return undefined;
  }

  private ensureGlobalStorageLoaded(): void {
    if (this.globalCacheLoaded) return;
    this.globalCacheLoaded = true;

    const stateDbPath = this.customGlobalStorageDbPath || path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'Antigravity IDE',
      'User',
      'globalStorage',
      'state.vscdb'
    );

    if (!fs.existsSync(stateDbPath)) return;

    try {
      const raw = cp.execFileSync('sqlite3', [
        stateDbPath,
        "SELECT value FROM ItemTable WHERE key = 'antigravityUnifiedStateSync.trajectorySummaries';"
      ], { encoding: 'utf8', timeout: 3000 }).trim();

      if (!raw) return;

      const outerBuf = Buffer.from(raw, 'base64');
      const lines = outerBuf.toString('utf8').split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const idMatch = line.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
          || line.trim().match(/^([a-zA-Z0-9_\-]+)$/);
        if (idMatch && i + 1 < lines.length) {
          const id = idMatch[1];
          const nextLine = lines[i + 1];
          const b64Regex = /[A-Za-z0-9+/=]{20,}/g;
          let b64Match;
          while ((b64Match = b64Regex.exec(nextLine)) !== null) {
            try {
              const decodedBuf = Buffer.from(b64Match[0], 'base64');
              const text = decodedBuf.toString('utf8');
              const m = text.match(/file:\/\/\/([^\x00-\x1f\x7f-\xff\"'\s\)\:\;]+)/);
              if (m) {
                const full = '/' + decodeURIComponent(m[1]).replace(/\/+$/, '');
                const wsName = path.basename(full);
                if (wsName) {
                  this.globalSummariesCache.set(id, wsName);
                  break;
                }
              }
            } catch {
              // Skip line parse error
            }
          }
        }
      }
    } catch {
      // Graceful fallback
    }
  }

  public resolveWorkspace(conversationId: string, _transcriptPath?: string): string | undefined {
    if (this.workspaceCache.has(conversationId)) {
      return this.workspaceCache.get(conversationId);
    }

    // Priority 1: Read real-time conversation db
    const convWs = this.extractFromConversationDb(conversationId);
    if (convWs) {
      this.workspaceCache.set(conversationId, convWs);
      return convWs;
    }

    // Priority 2: Fallback to global state.vscdb
    this.ensureGlobalStorageLoaded();
    if (this.globalSummariesCache.has(conversationId)) {
      const globalWs = this.globalSummariesCache.get(conversationId);
      this.workspaceCache.set(conversationId, globalWs);
      return globalWs;
    }

    // Priority 3: Do NOT guess via regex transcript; return undefined
    this.workspaceCache.set(conversationId, undefined);
    return undefined;
  }
}
