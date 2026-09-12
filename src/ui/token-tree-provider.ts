import { TokenMetrics, SessionSummary } from '../models/types';
import { TranscriptWatcher } from '../watcher/transcript-watcher';

export interface MinimalTreeItem {
  label: string;
  description?: string;
  collapsibleState?: number;
  contextValue?: string;
  iconPath?: string;
}

export class TokenTreeItem implements MinimalTreeItem {
  constructor(
    public readonly label: string,
    public readonly description?: string,
    public readonly collapsibleState: number = 0,
    public readonly contextValue?: string,
    public readonly iconPath?: string
  ) {}
}

export class TokenTreeDataProvider {
  private _onDidChangeTreeData: any[] = [];
  private activeMetrics: TokenMetrics | null = null;

  constructor(private watcher: TranscriptWatcher) {}

  public setActiveMetrics(metrics: TokenMetrics | null): void {
    this.activeMetrics = metrics;
    this.refresh();
  }

  public refresh(): void {
    for (const listener of this._onDidChangeTreeData) {
      if (typeof listener === 'function') listener();
    }
  }

  public getTreeItem(element: TokenTreeItem): TokenTreeItem {
    return element;
  }

  public async getChildren(element?: TokenTreeItem): Promise<TokenTreeItem[]> {
    if (!element) {
      return [
        new TokenTreeItem('Active Session', this.activeMetrics ? this.activeMetrics.conversationId.slice(0, 8) + '...' : 'No session', 1),
        new TokenTreeItem('Recent Sessions', undefined, 1)
      ];
    }

    if (element.label === 'Active Session') {
      if (!this.activeMetrics) {
        return [new TokenTreeItem('No active conversation detected')];
      }
      return [
        new TokenTreeItem(`Total: ${this.activeMetrics.totalTokens.toLocaleString()} tokens`),
        new TokenTreeItem(`Prompt (Input): ${this.activeMetrics.promptTokens.toLocaleString()} tokens`),
        new TokenTreeItem(`Completion (Output): ${this.activeMetrics.completionTokens.toLocaleString()} tokens`),
        new TokenTreeItem(`Cost: $${this.activeMetrics.estimatedCostUsd.toFixed(4)}`),
        new TokenTreeItem(`Steps: ${this.activeMetrics.stepCount} turns`)
      ];
    }

    if (element.label === 'Recent Sessions') {
      const recent = this.watcher.listRecentSessions ? this.watcher.listRecentSessions(10) : [];
      if (recent.length === 0) {
        return [new TokenTreeItem('No previous sessions recorded')];
      }
      return recent.map(s => {
        const cost = s.metrics.estimatedCostUsd.toFixed(3);
        const timeAgo = Math.max(0, Math.round((Date.now() - s.lastModifiedTime) / 60000));
        return new TokenTreeItem(
          `${s.conversationId.slice(0, 8)}...`,
          `${s.metrics.totalTokens.toLocaleString()} tok (~$${cost}) • ${timeAgo}m ago`
        );
      });
    }

    return [];
  }
}
