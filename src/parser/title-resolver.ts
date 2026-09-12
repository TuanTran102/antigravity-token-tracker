import * as cp from 'node:child_process';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';

export class TitleResolver {
  private titleCache: Map<string, string> = new Map();
  private cacheLoaded = false;
  private customDbPath?: string;

  constructor(customDbPath?: string) {
    this.customDbPath = customDbPath;
  }

  private ensureCacheLoaded(): void {
    if (this.cacheLoaded) return;
    this.cacheLoaded = true;

    const dbPath = this.customDbPath || path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'Antigravity IDE',
      'User',
      'globalStorage',
      'state.vscdb'
    );

    if (!fs.existsSync(dbPath)) return;

    try {
      const raw = cp.execFileSync('sqlite3', [
        dbPath,
        "SELECT value FROM ItemTable WHERE key = 'antigravityUnifiedStateSync.trajectorySummaries';"
      ], { encoding: 'utf8', timeout: 3000 }).trim();

      if (!raw) return;

      const outerBuf = Buffer.from(raw, 'base64');
      const outerText = outerBuf.toString('utf8');
      const lines = outerText.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const uuidMatch = line.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/);
        if (uuidMatch && i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          try {
            const decodedBuf = Buffer.from(nextLine, 'base64');
            if (decodedBuf[0] === 0x0a) {
              const len = decodedBuf[1];
              const title = decodedBuf.slice(2, 2 + len).toString('utf8');
              if (title && title.trim()) {
                this.titleCache.set(uuidMatch[1], title.trim());
              }
            }
          } catch {
            // Skip unparseable line
          }
        }
      }
    } catch {
      // Fallback gracefully if sqlite3 or state.vscdb cannot be accessed
    }
  }

  public extractPromptTitle(transcriptPath: string): string | null {
    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
      return null;
    }
    try {
      const content = fs.readFileSync(transcriptPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'USER_INPUT' || parsed.source === 'USER_EXPLICIT') {
            const text = parsed.content || '';
            const match = text.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
            let rawTitle = match ? match[1].trim() : text.trim();
            // Remove leading slash command e.g. /spec, /plan
            rawTitle = rawTitle.replace(/^\/[a-zA-Z0-9_-]+\s*/, '').trim();
            if (rawTitle) {
              const firstLine = rawTitle.split('\n')[0].trim();
              return firstLine.slice(0, 50);
            }
          }
        } catch {
          // Skip invalid JSON
        }
      }
    } catch {
      // Return null on read error
    }
    return null;
  }

  public resolveTitle(conversationId: string, transcriptPath?: string): string {
    this.ensureCacheLoaded();

    if (this.titleCache.has(conversationId)) {
      return this.titleCache.get(conversationId)!;
    }

    if (transcriptPath) {
      const promptTitle = this.extractPromptTitle(transcriptPath);
      if (promptTitle) {
        this.titleCache.set(conversationId, promptTitle);
        return promptTitle;
      }
    }

    const fallback = `Session ${conversationId.slice(0, 8)}`;
    return fallback;
  }
}
