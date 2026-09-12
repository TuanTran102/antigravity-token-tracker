import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { TranscriptWatcher } from '../src/watcher/transcript-watcher';
import { formatStatusBarText, formatStatusBarTooltip } from '../src/ui/status-bar-manager';
import { TokenTreeDataProvider } from '../src/ui/token-tree-provider';

describe('End-to-End Token Tracking Pipeline', () => {
  let tempBrain: string;

  before(() => {
    tempBrain = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-e2e-brain-'));
    const logDir = path.join(tempBrain, 'session-abc-12345678', '.system_generated', 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    
    // Simulate step 0: user input
    const line1 = JSON.stringify({
      step_index: 0,
      source: 'USER_EXPLICIT',
      type: 'USER_INPUT',
      status: 'DONE',
      content: 'Hello Antigravity'
    }) + '\n';

    // Simulate step 1: model planner response with tool calls
    const line2 = JSON.stringify({
      step_index: 1,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      status: 'DONE',
      content: 'I will inspect the workspace now.',
      tool_calls: [{ tool_name: 'list_dir', arguments: { DirectoryPath: '/workspace' } }]
    }) + '\n';

    fs.writeFileSync(path.join(logDir, 'transcript.jsonl'), line1 + line2);
  });

  after(() => {
    fs.rmSync(tempBrain, { recursive: true, force: true });
  });

  it('should accurately run from log write to metrics to UI text', async () => {
    const watcher = new TranscriptWatcher({ customBrainPath: tempBrain });
    const active = watcher.findActiveConversation();
    assert.ok(active, 'Active conversation must be found');

    const metrics = watcher.parseConversationFile(active.transcriptPath, active.conversationId);
    assert.ok(metrics, 'Metrics must be generated');
    assert.strictEqual(metrics.conversationId, 'session-abc-12345678');
    assert.strictEqual(metrics.stepCount, 2);
    assert.ok(metrics.promptTokens > 0, 'Prompt tokens must be > 0');
    assert.ok(metrics.completionTokens > 0, 'Completion tokens must be > 0');
    assert.strictEqual(metrics.totalTokens, metrics.promptTokens + metrics.completionTokens);
    assert.ok(metrics.estimatedCostUsd >= 0);

    const statusText = formatStatusBarText(metrics);
    assert.ok(statusText.includes('tok'), 'Status bar text must contain token abbreviation');
    assert.ok(statusText.includes('$'), 'Status bar text must contain cost estimate');

    const tooltip = formatStatusBarTooltip(metrics);
    assert.ok(tooltip.includes('session-abc-12345678'));
    assert.ok(tooltip.includes('Prompt (Input):'));
    assert.ok(tooltip.includes('Completion (Output):'));

    const provider = new TokenTreeDataProvider(watcher);
    provider.setActiveMetrics(metrics);

    const roots = await provider.getChildren();
    assert.strictEqual(roots.length, 2);
    const activeChildren = await provider.getChildren(roots[0]);
    assert.strictEqual(activeChildren.length, 5);
  });
});
