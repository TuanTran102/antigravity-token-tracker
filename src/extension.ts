import * as vscode from 'vscode';
import { TranscriptWatcher } from './watcher/transcript-watcher';
import { StatusBarManager } from './ui/status-bar-manager';
import { TokenTreeDataProvider } from './ui/token-tree-provider';

let watcher: TranscriptWatcher | undefined;
let statusBar: StatusBarManager | undefined;
let treeProvider: TokenTreeDataProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration('antigravityTokenTracker');
  const customBrainPath = config.get<string>('brainPath') || undefined;
  const model = config.get<string>('model') || 'gemini-2.5-flash';

  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar = new StatusBarManager(statusItem);
  context.subscriptions.push(statusItem);

  watcher = new TranscriptWatcher({
    customBrainPath,
    model,
    onUpdate: (metrics) => {
      statusBar?.update(metrics);
      treeProvider?.setActiveMetrics(metrics);
    }
  });

  treeProvider = new TokenTreeDataProvider(watcher);
  vscode.window.registerTreeDataProvider('antigravity-token-tracker.sidebar', treeProvider as any);

  // Initial scan
  const active = watcher.findActiveConversation();
  if (active) {
    const initialMetrics = watcher.parseConversationFile(active.transcriptPath, active.conversationId);
    statusBar.update(initialMetrics);
    treeProvider.setActiveMetrics(initialMetrics);
  }

  watcher.startWatching();

  const refreshCommand = vscode.commands.registerCommand('antigravityTokenTracker.refresh', () => {
    const current = watcher?.findActiveConversation();
    if (current) {
      const metrics = watcher?.parseConversationFile(current.transcriptPath, current.conversationId);
      statusBar?.update(metrics || null);
      treeProvider?.setActiveMetrics(metrics || null);
    }
    vscode.window.showInformationMessage('Antigravity Token Tracker refreshed.');
  });

  const openTranscriptCommand = vscode.commands.registerCommand('antigravityTokenTracker.openTranscript', async () => {
    const current = watcher?.findActiveConversation();
    if (current) {
      const doc = await vscode.workspace.openTextDocument(current.transcriptPath);
      await vscode.window.showTextDocument(doc);
    } else {
      vscode.window.showWarningMessage('No active Antigravity transcript found.');
    }
  });

  context.subscriptions.push(refreshCommand, openTranscriptCommand);
}

export function deactivate(): void {
  if (watcher) {
    watcher.stopWatching();
  }
  if (statusBar) {
    statusBar.dispose();
  }
}
