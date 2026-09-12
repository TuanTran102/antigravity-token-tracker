import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TokenTreeDataProvider, TokenTreeItem } from '../src/ui/token-tree-provider';
import { TokenMetrics } from '../src/models/types';

describe('Sidebar TreeDataProvider', () => {
  const metrics: TokenMetrics = {
    conversationId: 'test-session-12345678',
    promptTokens: 1000,
    completionTokens: 200,
    totalTokens: 1200,
    estimatedCostUsd: 0.0003,
    stepCount: 3,
    lastUpdated: new Date()
  };

  it('should return root items: Active Session and Recent Sessions', async () => {
    const provider = new TokenTreeDataProvider({
      findActiveConversation: () => null,
      listRecentSessions: () => []
    } as any);
    provider.setActiveMetrics(metrics);

    const roots = await provider.getChildren();
    assert.strictEqual(roots.length, 2);
    assert.strictEqual(roots[0].label, 'Active Session');
    assert.strictEqual(roots[1].label, 'Recent Sessions');
  });

  it('should expand Active Session into metric leaves', async () => {
    const provider = new TokenTreeDataProvider({
      findActiveConversation: () => null,
      listRecentSessions: () => []
    } as any);
    provider.setActiveMetrics(metrics);

    const roots = await provider.getChildren();
    const children = await provider.getChildren(roots[0]);
    assert.strictEqual(children.length, 5);
    assert.ok(children.some(c => c.label?.includes('Total: 1,200')));
    assert.ok(children.some(c => c.label?.includes('Cost: $0.0003')));
  });

  it('should display Recent Sessions items', async () => {
    const provider = new TokenTreeDataProvider({
      findActiveConversation: () => null,
      listRecentSessions: () => [
        {
          conversationId: 'session-old-87654321',
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
    } as any);

    const roots = await provider.getChildren();
    const recentLeaves = await provider.getChildren(roots[1]);
    assert.strictEqual(recentLeaves.length, 1);
    assert.ok(recentLeaves[0].label.includes('session-'));
  });
});
