import * as vscode from 'vscode';
import { TokenMetrics, SessionSummary } from '../models/types';
import { TranscriptWatcher } from '../watcher/transcript-watcher';
import { formatTokenNumber } from './status-bar-manager';

export class TokenWebviewViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private activeMetrics: TokenMetrics | null = null;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly watcher: TranscriptWatcher
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    webviewView.webview.html = this.getHtmlForWebview();

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.command) {
        case 'refresh': {
          const current = this.watcher.findActiveConversation();
          if (current) {
            const metrics = this.watcher.parseConversationFile(current.transcriptPath, current.conversationId);
            this.setActiveMetrics(metrics);
          }
          this.refresh();
          break;
        }
        case 'openTranscript': {
          if (data.path) {
            const doc = await vscode.workspace.openTextDocument(data.path);
            await vscode.window.showTextDocument(doc);
          }
          break;
        }
      }
    });
  }

  public setActiveMetrics(metrics: TokenMetrics | null): void {
    this.activeMetrics = metrics;
    this.refresh();
  }

  public refresh(): void {
    if (this._view) {
      this._view.webview.html = this.getHtmlForWebview();
    }
  }

  public getHtmlForWebview(): string {
    const recentSessions = this.watcher.listRecentSessions(20);
    const active = this.activeMetrics;

    const activeTitle = active?.title || (active ? `Session ${active.conversationId.slice(0, 8)}` : 'Chưa phát hiện session');
    const activeTotalTokens = active ? active.totalTokens.toLocaleString() : '0';
    const activePromptTokens = active ? active.promptTokens.toLocaleString() : '0';
    const activeCompletionTokens = active ? active.completionTokens.toLocaleString() : '0';
    const activeCost = active ? `$${active.estimatedCostUsd.toFixed(4)}` : '$0.0000';
    const activeSteps = active ? active.stepCount : 0;

    const rowsHtml = recentSessions.map((session, index) => {
      const title = session.title || `Session ${session.conversationId.slice(0, 8)}`;
      const tokensFormatted = formatTokenNumber(session.metrics.totalTokens);
      const costFormatted = `$${session.metrics.estimatedCostUsd.toFixed(3)}`;
      const minutesAgo = Math.max(0, Math.round((Date.now() - session.lastModifiedTime) / 60000));
      const timeStr = minutesAgo < 60 ? `${minutesAgo}m trước` : `${Math.round(minutesAgo / 60)}h trước`;
      const isCurrent = active && active.conversationId === session.conversationId;

      return `
        <tr class="session-row ${isCurrent ? 'active-row' : ''}" data-path="${session.transcriptPath}" title="ID: ${session.conversationId}\nClick để mở transcript file">
          <td class="col-name">
            <div class="name-wrapper">
              <span class="status-indicator ${isCurrent ? 'indicator-active' : ''}"></span>
              <span class="session-title">${this.escapeHtml(title)}</span>
            </div>
          </td>
          <td class="col-tokens font-mono">${tokensFormatted}</td>
          <td class="col-cost font-mono">${costFormatted}</td>
          <td class="col-time">${timeStr}</td>
        </tr>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Antigravity Token Tracker</title>
  <style>
    :root {
      --font-size-sm: 11px;
      --font-size-base: 12px;
      --font-size-lg: 14px;
      --radius: 6px;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      font-size: var(--font-size-base);
      color: var(--vscode-foreground);
      background-color: var(--vscode-sideBar-background);
      padding: 10px;
      line-height: 1.4;
    }
    .card {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.2));
      border-radius: var(--radius);
      padding: 10px;
      margin-bottom: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .card-title {
      font-size: var(--font-size-sm);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
    }
    .btn-refresh {
      background: var(--vscode-button-secondaryBackground, rgba(128, 128, 128, 0.2));
      color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
      border: 1px solid var(--vscode-button-border, rgba(128, 128, 128, 0.25));
      border-radius: var(--radius);
      padding: 4px 10px;
      cursor: pointer;
      font-size: var(--font-size-base);
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: background 0.15s ease;
    }
    .btn-refresh:hover {
      background: var(--vscode-button-secondaryHoverBackground, rgba(128, 128, 128, 0.3));
    }
    .active-session-name {
      font-size: var(--font-size-base);
      font-weight: 600;
      color: var(--vscode-editor-foreground);
      margin-bottom: 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .metric-box {
      background: var(--vscode-sideBar-background);
      padding: 6px 8px;
      border-radius: 4px;
    }
    .metric-label {
      font-size: var(--font-size-sm);
      color: var(--vscode-descriptionForeground);
    }
    .metric-val {
      font-size: var(--font-size-lg);
      font-weight: 600;
      margin-top: 2px;
    }
    .font-mono {
      font-family: var(--vscode-editor-font-family, monospace);
    }
    .section-title {
      font-size: var(--font-size-sm);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin: 12px 0 6px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .search-box {
      width: 100%;
      padding: 6px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, rgba(128, 128, 128, 0.3));
      border-radius: 4px;
      font-size: var(--font-size-sm);
      margin-bottom: 8px;
      outline: none;
    }
    .search-box:focus {
      border-color: var(--vscode-focusBorder);
    }
    .table-container {
      border: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.2));
      border-radius: var(--radius);
      overflow-x: auto;
      background: var(--vscode-editor-background);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: var(--font-size-sm);
    }
    th {
      background: var(--vscode-sideBarSectionHeader-background, rgba(128, 128, 128, 0.1));
      padding: 6px 8px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      border-bottom: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.2));
      white-space: nowrap;
    }
    td {
      padding: 6px 8px;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.1));
    }
    .session-row {
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .session-row:hover {
      background-color: var(--vscode-list-hoverBackground, rgba(128, 128, 128, 0.15));
    }
    .active-row {
      background-color: var(--vscode-list-activeSelectionBackground, rgba(0, 120, 215, 0.15));
    }
    .name-wrapper {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .status-indicator {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: transparent;
      flex-shrink: 0;
    }
    .indicator-active {
      background: #4caf50;
      box-shadow: 0 0 5px #4caf50;
    }
    .session-title {
      max-width: 130px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: inline-block;
      font-weight: 500;
    }
    .col-tokens, .col-cost {
      text-align: right;
      white-space: nowrap;
    }
    .col-time {
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
      font-size: 10px;
      text-align: right;
    }
    .empty-state {
      text-align: center;
      padding: 16px;
      color: var(--vscode-descriptionForeground);
      font-size: var(--font-size-sm);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-header">
      <span class="card-title">Active Session</span>
      <button class="btn-refresh" id="refreshBtn">↻ Làm mới</button>
    </div>
    <div class="active-session-name" title="${this.escapeHtml(activeTitle)}">
      ${this.escapeHtml(activeTitle)}
    </div>
    <div class="metrics-grid">
      <div class="metric-box">
        <div class="metric-label">Tổng Tokens</div>
        <div class="metric-val font-mono">${activeTotalTokens}</div>
      </div>
      <div class="metric-box">
        <div class="metric-label">Chi phí ước tính</div>
        <div class="metric-val font-mono">${activeCost}</div>
      </div>
      <div class="metric-box">
        <div class="metric-label">Prompt (Input)</div>
        <div class="metric-val font-mono" style="font-size: 11px;">${activePromptTokens}</div>
      </div>
      <div class="metric-box">
        <div class="metric-label">Output / Steps</div>
        <div class="metric-val font-mono" style="font-size: 11px;">${activeCompletionTokens} (${activeSteps} steps)</div>
      </div>
    </div>
  </div>

  <div class="section-title">
    <span>Recent Sessions</span>
    <span style="font-size: 10px;">${recentSessions.length} sessions</span>
  </div>

  <input type="text" class="search-box" id="searchInput" placeholder="Tìm theo tên session..." />

  <div class="table-container">
    <table id="sessionsTable">
      <thead>
        <tr>
          <th>Tên Session</th>
          <th style="text-align: right;">Tokens</th>
          <th style="text-align: right;">Chi phí</th>
          <th style="text-align: right;">Thời gian</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="4" class="empty-state">Chưa có lịch sử session</td></tr>'}
      </tbody>
    </table>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    document.getElementById('refreshBtn')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'refresh' });
    });

    document.querySelectorAll('.session-row').forEach(row => {
      row.addEventListener('click', () => {
        const path = row.getAttribute('data-path');
        if (path) {
          vscode.postMessage({ command: 'openTranscript', path });
        }
      });
    });

    document.getElementById('searchInput')?.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      document.querySelectorAll('#sessionsTable tbody tr.session-row').forEach(row => {
        const titleEl = row.querySelector('.session-title');
        const text = titleEl ? titleEl.textContent.toLowerCase() : '';
        row.style.display = text.includes(term) ? '' : 'none';
      });
    });
  </script>
</body>
</html>`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
