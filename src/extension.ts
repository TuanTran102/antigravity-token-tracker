import * as vscode from 'vscode';
import { TranscriptWatcher } from './watcher/transcript-watcher';
import { StatusBarManager } from './ui/status-bar-manager';
import { TokenWebviewViewProvider } from './ui/token-webview-provider';

let watcher: TranscriptWatcher | undefined;
let statusBar: StatusBarManager | undefined;
let webviewProvider: TokenWebviewViewProvider | undefined;

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
      webviewProvider?.setActiveMetrics(metrics);
    }
  });

  const extUri = context.extensionUri || vscode.Uri.file(__dirname);
  webviewProvider = new TokenWebviewViewProvider(extUri, watcher);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('antigravity-token-tracker.sidebar', webviewProvider as any)
  );

  // Initial scan
  const active = watcher.findActiveConversation();
  if (active) {
    const initialMetrics = watcher.parseConversationFile(active.transcriptPath, active.conversationId);
    statusBar.update(initialMetrics);
    webviewProvider.setActiveMetrics(initialMetrics);
  }

  watcher.startWatching();

  const windowStateListener = vscode.window.onDidChangeWindowState((e) => {
    if (e.focused) {
      watcher?.checkActiveConversation();
    }
  });

  const refreshCommand = vscode.commands.registerCommand('antigravityTokenTracker.refresh', () => {
    const detected = watcher?.checkActiveConversation();
    if (!detected) {
      const current = watcher?.findActiveConversation();
      if (current) {
        const metrics = watcher?.parseConversationFile(current.transcriptPath, current.conversationId);
        statusBar?.update(metrics || null);
        webviewProvider?.setActiveMetrics(metrics || null);
      }
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

  context.subscriptions.push(windowStateListener, refreshCommand, openTranscriptCommand);
}

export function deactivate(): void {
  if (watcher) {
    watcher.stopWatching();
  }
  if (statusBar) {
    statusBar.dispose();
  }
}
