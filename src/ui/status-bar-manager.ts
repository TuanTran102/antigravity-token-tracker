import { TokenMetrics } from '../models/types';

export function formatTokenNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'm';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'k';
  }
  return num.toString();
}

export function formatStatusBarText(metrics: TokenMetrics | null): string {
  if (!metrics) {
    return '$(pulse) 0 tok';
  }
  const tokStr = formatTokenNumber(metrics.totalTokens);
  const costStr = metrics.estimatedCostUsd.toFixed(2);
  return `$(pulse) ${tokStr} tok (~$${costStr})`;
}

export function formatStatusBarTooltip(metrics: TokenMetrics | null): string {
  if (!metrics) {
    return 'Antigravity Token Tracker: No active conversation detected.';
  }
  return [
    `Conversation: ${metrics.conversationId}`,
    `Total Tokens: ${metrics.totalTokens.toLocaleString()}`,
    `  • Prompt (Input): ${metrics.promptTokens.toLocaleString()}`,
    `  • Completion (Output): ${metrics.completionTokens.toLocaleString()}`,
    `Estimated Cost: $${metrics.estimatedCostUsd.toFixed(4)}`,
    `Steps Recorded: ${metrics.stepCount}`,
    '',
    'Click to focus sidebar details'
  ].join('\n');
}

export class StatusBarManager {
  private item?: any; // vscode.StatusBarItem

  constructor(statusBarItem?: any) {
    this.item = statusBarItem;
    if (this.item) {
      this.item.command = 'antigravity-token-tracker.sidebar.focus';
      this.update(null);
      this.item.show();
    }
  }

  public update(metrics: TokenMetrics | null): void {
    if (!this.item) return;
    this.item.text = formatStatusBarText(metrics);
    this.item.tooltip = formatStatusBarTooltip(metrics);
  }

  public dispose(): void {
    if (this.item) {
      this.item.dispose();
    }
  }
}
