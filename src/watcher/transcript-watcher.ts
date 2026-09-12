import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { TokenEngine } from '../engine/token-engine';
import { parseTranscriptLine } from '../parser/transcript-parser';
import { TitleResolver } from '../parser/title-resolver';
import { WorkspaceResolver } from '../parser/workspace-resolver';
import { TokenMetrics, SessionSummary } from '../models/types';

export interface WatcherOptions {
  customBrainPath?: string;
  customDbPath?: string;
  customWorkspaceStorageDir?: string;
  customConversationsDir?: string;
  customGlobalStorageDbPath?: string;
  model?: string;
  pollIntervalMs?: number;
  onUpdate?: (metrics: TokenMetrics) => void;
}

export class TranscriptWatcher {
  private brainPath: string;
  private model: string;
  private onUpdate?: (metrics: TokenMetrics) => void;
  private currentWatcher?: fs.FSWatcher;
  private brainWatcher?: fs.FSWatcher;
  private pollInterval?: NodeJS.Timeout;
  private debounceTimer?: NodeJS.Timeout;
  private lastProcessedMtime: number = 0;
  private pollIntervalMs: number;
  private currentActiveConvId?: string;
  private titleResolver: TitleResolver;
  private workspaceResolver: WorkspaceResolver;

  constructor(options: WatcherOptions = {}) {
    this.brainPath = options.customBrainPath || path.join(os.homedir(), '.gemini', 'antigravity-ide', 'brain');
    this.model = options.model || 'gemini-2.5-flash';
    this.pollIntervalMs = options.pollIntervalMs !== undefined ? options.pollIntervalMs : 2000;
    this.onUpdate = options.onUpdate;
    this.titleResolver = new TitleResolver(options.customDbPath);
    this.workspaceResolver = new WorkspaceResolver({
      customWorkspaceStorageDir: options.customWorkspaceStorageDir,
      customConversationsDir: options.customConversationsDir,
      customGlobalStorageDbPath: options.customGlobalStorageDbPath
    });
  }

  public getBrainPath(): string {
    return this.brainPath;
  }

  public getTitleResolver(): TitleResolver {
    return this.titleResolver;
  }

  public getWorkspaceResolver(): WorkspaceResolver {
    return this.workspaceResolver;
  }

  public getActiveConversationId(): string | undefined {
    return this.currentActiveConvId;
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

  public checkActiveConversation(): TokenMetrics | null {
    if (!fs.existsSync(this.brainPath)) {
      return null;
    }

    if (!this.brainWatcher) {
      this.setupBrainWatcher();
    }

    const active = this.findActiveConversation();
    if (!active) {
      return null;
    }

    if (active.conversationId !== this.currentActiveConvId || active.mtime > this.lastProcessedMtime) {
      if (this.currentWatcher) {
        this.currentWatcher.close();
        this.currentWatcher = undefined;
      }

      this.currentActiveConvId = active.conversationId;
      this.lastProcessedMtime = active.mtime;

      try {
        this.currentWatcher = fs.watch(active.transcriptPath, (eventType: string) => {
          if (eventType === 'change' || eventType === 'rename') {
            const updated = this.parseConversationFile(active.transcriptPath, active.conversationId);
            if (updated) {
              try {
                const stat = fs.statSync(active.transcriptPath);
                this.lastProcessedMtime = stat.mtimeMs;
              } catch {
                // ignore
              }
              if (this.onUpdate) {
                this.onUpdate(updated);
              }
            }
          }
        });
      } catch {
        // Graceful fallback for non-existing or locked paths
      }

      const metrics = this.parseConversationFile(active.transcriptPath, active.conversationId);
      if (metrics && this.onUpdate) {
        this.onUpdate(metrics);
      }
      return metrics;
    }

    return null;
  }

  private setupBrainWatcher(): void {
    if (!fs.existsSync(this.brainPath) || this.brainWatcher) {
      return;
    }
    try {
      this.brainWatcher = fs.watch(this.brainPath, { recursive: false }, () => {
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
          this.checkActiveConversation();
        }, 200);
      });
    } catch {
      // Graceful fallback
    }
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
    metrics.workspace = this.workspaceResolver.resolveWorkspace(resolvedId, filePath);
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
            const workspace = this.workspaceResolver.resolveWorkspace(entry.name, transcriptPath);
            metrics.title = title;
            metrics.workspace = workspace;
            sessions.push({
              conversationId: entry.name,
              title,
              workspace,
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
    this.checkActiveConversation();
    this.setupBrainWatcher();

    if (this.pollIntervalMs > 0 && !this.pollInterval) {
      this.pollInterval = setInterval(() => {
        this.checkActiveConversation();
      }, this.pollIntervalMs);
      if (typeof this.pollInterval.unref === 'function') {
        this.pollInterval.unref();
      }
    }
  }

  public stopWatching(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    if (this.brainWatcher) {
      this.brainWatcher.close();
      this.brainWatcher = undefined;
    }
    if (this.currentWatcher) {
      this.currentWatcher.close();
      this.currentWatcher = undefined;
    }
    this.currentActiveConvId = undefined;
    this.lastProcessedMtime = 0;
  }
}
