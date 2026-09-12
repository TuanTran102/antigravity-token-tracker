import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatStatusBarText, formatStatusBarTooltip, formatTokenNumber } from '../src/ui/status-bar-manager';
import { TokenMetrics } from '../src/models/types';

describe('Status Bar Formatting', () => {
  const metrics: TokenMetrics = {
    conversationId: 'de78ab90-test',
    promptTokens: 18200,
    completionTokens: 6300,
    totalTokens: 24500,
    estimatedCostUsd: 0.0185,
    stepCount: 14,
    lastUpdated: new Date()
  };

  it('should format token numbers with k and m suffixes', () => {
    assert.strictEqual(formatTokenNumber(500), '500');
    assert.strictEqual(formatTokenNumber(24500), '24.5k');
    assert.strictEqual(formatTokenNumber(1500000), '1.5m');
  });

  it('should format status bar text concisely in k units', () => {
    const text = formatStatusBarText(metrics);
    assert.strictEqual(text, '$(pulse) 24.5k tok (~$0.02)');
  });

  it('should format tooltip with detailed breakdown', () => {
    const tooltip = formatStatusBarTooltip(metrics);
    assert.ok(tooltip.includes('de78ab90-test'));
    assert.ok(tooltip.includes('18,200'));
    assert.ok(tooltip.includes('6,300'));
    assert.ok(tooltip.includes('$0.0185'));
  });

  it('should handle null metrics gracefully', () => {
    assert.strictEqual(formatStatusBarText(null), '$(pulse) 0 tok');
    assert.ok(formatStatusBarTooltip(null).includes('No active conversation'));
  });
});
