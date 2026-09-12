import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { TokenEngine } from '../engine/token-engine';
import { parseTranscriptLine } from '../parser/transcript-parser';
import { TitleResolver } from '../parser/title-resolver';
import { TokenMetrics, SessionSummary } from '../models/types';

export interface WatcherOptions {
  customBrainPath?: string;
  customDbPath?: string;
  model?: string;
  onUpdate?: (metrics: TokenMetrics) => void;
}

export class TranscriptWatcher {
  private brainPath: string;
  private model: string;
  private onUpdate?: (metrics: TokenMetrics) => void;
  private currentWatcher?: fs.FSWatcher;
  private currentActiveConvId?: string;
  private titleResolver: TitleResolver;

  constructor(options: WatcherOptions = {}) {
    this.brainPath = options.customBrainPath || path.join(os.homedir(), '.gemini', 'antigravity-ide', 'brain');
    this.model = options.model || 'gemini-2.5-flash';
    this.onUpdate = options.onUpdate;
    this.titleResolver = new TitleResolver(options.customDbPath);
  }

  public getBrainPath(): string {
    return this.brainPath;
  }

  public getTitleResolver(): TitleResolver {
    return this.titleResolver;
  }

  public findActiveConversation(): { conversationId: string; transcriptPath: string; mtime: number } | null {
    if (!fs.existsSync(this.brainPath)) {
      return null;
    }

    const entries = fs.readdirSync(this.brainPath, { withFileTypes: true });
    let latest: { conversationId: string; transcriptPath: string; mtime: number } | null = null;

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const transcriptPath = path.join(this.brainPath, entry.name, '.system_generated', 'logs', 'transcript.jsonl');
        if (fs.existsSync(transcriptPath)) {
          const stat = fs.statSync(transcriptPath);
          if (!latest || stat.mtimeMs > latest.mtime) {
            latest = {
              conversationId: entry.name,
              transcriptPath,
              mtime: stat.mtimeMs
            };
          }
        }
      }
    }
    return latest;
  }

  public parseConversationFile(filePath: string, convId?: string): TokenMetrics | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const resolvedId = convId || path.basename(path.resolve(filePath, '..', '..', '..'));
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const engine = new TokenEngine(resolvedId, this.model);

    for (const line of lines) {
      const step = parseTranscriptLine(line);
      if (step) {
        engine.processStep(step);
      }
    }
    const metrics = engine.getMetrics();
    metrics.title = this.titleResolver.resolveTitle(resolvedId, filePath);
    return metrics;
  }

  public listRecentSessions(limit = 15): SessionSummary[] {
    if (!fs.existsSync(this.brainPath)) return [];
    const entries = fs.readdirSync(this.brainPath, { withFileTypes: true });
    const sessions: SessionSummary[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const transcriptPath = path.join(this.brainPath, entry.name, '.system_generated', 'logs', 'transcript.jsonl');
        if (fs.existsSync(transcriptPath)) {
          const stat = fs.statSync(transcriptPath);
          const metrics = this.parseConversationFile(transcriptPath, entry.name);
          if (metrics) {
            const title = this.titleResolver.resolveTitle(entry.name, transcriptPath);
            metrics.title = title;
            sessions.push({
              conversationId: entry.name,
              title,
              transcriptPath,
              lastModifiedTime: stat.mtimeMs,
              metrics
            });
          }
        }
      }
    }
    return sessions.sort((a, b) => b.lastModifiedTime - a.lastModifiedTime).slice(0, limit);
  }

  public startWatching(): void {
    const active = this.findActiveConversation();
    if (!active) return;
    this.currentActiveConvId = active.conversationId;

    if (this.currentWatcher) {
      this.currentWatcher.close();
    }

    try {
      this.currentWatcher = fs.watch(active.transcriptPath, (eventType: string) => {
        if (eventType === 'change' || eventType === 'rename') {
          const updated = this.parseConversationFile(active.transcriptPath, active.conversationId);
          if (updated && this.onUpdate) {
            this.onUpdate(updated);
          }
        }
      });
    } catch {
      // Graceful fallback for non-existing or locked paths
    }
  }

  public stopWatching(): void {
    if (this.currentWatcher) {
      this.currentWatcher.close();
      this.currentWatcher = undefined;
    }
  }
}
