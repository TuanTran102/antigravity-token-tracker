import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TokenWebviewViewProvider } from '../src/ui/token-webview-provider';
import { TokenMetrics } from '../src/models/types';

describe('TokenWebviewViewProvider', () => {
  const metrics: TokenMetrics = {
    conversationId: 'test-session-12345678',
    title: 'Hỗ Trợ Tính Năng',
    promptTokens: 1000,
    completionTokens: 200,
    totalTokens: 1200,
    estimatedCostUsd: 0.0003,
    stepCount: 3,
    lastUpdated: new Date()
  };

  it('should generate valid HTML containing active session info and recent table', () => {
    const mockWatcher: any = {
      findActiveConversation: () => null,
      listRecentSessions: () => [
        {
          conversationId: 'session-old-87654321',
          title: 'Fix WebView Remote Focus',
          workspace: 'open-power',
          transcriptPath: '/tmp/transcript.jsonl',
          lastModifiedTime: Date.now() - 300000,
          metrics: {
            conversationId: 'session-old-87654321',
            promptTokens: 500,
            completionTokens: 500,
            totalTokens: 1000,
            estimatedCostUsd: 0.0002,
            stepCount: 2,
            lastUpdated: new Date()
          }
        }
      ]
    };

    const provider = new TokenWebviewViewProvider({ fsPath: '/test' } as any, mockWatcher);
    provider.setActiveMetrics(metrics);

    const html = provider.getHtmlForWebview();
    assert.ok(html.includes('Hỗ Trợ Tính Năng'), 'Must include active session title');
    assert.ok(html.includes('Fix WebView Remote Focus'), 'Must include recent session title from list');
    assert.ok(html.includes('<table'), 'Must include table element');
    assert.ok(html.includes('Tên Session'), 'Must have Tên Session header');
    assert.ok(html.includes('Workspace'), 'Must have Workspace header');
    assert.ok(html.includes('col-workspace'), 'Must have col-workspace class');
    assert.ok(html.includes('open-power'), 'Must include workspace name in table row');
    assert.ok(html.includes('Tokens'), 'Must have Tokens header');
    assert.ok(html.includes('Chi phí'), 'Must have Chi phí header');
  });
});
