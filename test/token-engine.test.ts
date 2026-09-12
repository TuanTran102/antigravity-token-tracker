import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TokenEngine } from '../src/engine/token-engine';
import { TranscriptStep } from '../src/models/types';

describe('Token Calculation Engine', () => {
  it('should estimate token counts for English and Vietnamese text', () => {
    const engine = new TokenEngine('conv-1', 'gemini-2.5-flash');
    const enTokens = engine.estimateTokens('Hello world, this is a test.');
    assert.ok(enTokens >= 6 && enTokens <= 12);
    const vnTokens = engine.estimateTokens('Xin chào thế giới Antigravity');
    assert.ok(vnTokens >= 5);
  });

  it('should return 0 for empty or whitespace text', () => {
    const engine = new TokenEngine('conv-1', 'gemini-2.5-flash');
    assert.strictEqual(engine.estimateTokens(''), 0);
    assert.strictEqual(engine.estimateTokens('   '), 0);
  });

  it('should aggregate prompt and completion tokens correctly across turns', () => {
    const engine = new TokenEngine('conv-1', 'gemini-2.5-flash');
    
    const userInput: TranscriptStep = {
      step_index: 0,
      source: 'USER_EXPLICIT',
      type: 'USER_INPUT',
      content: 'Can you analyze the logs?'
    };
    engine.processStep(userInput);

    const modelResponse: TranscriptStep = {
      step_index: 1,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      content: 'Sure! Reading the log files now...',
      tool_calls: [{ tool_name: 'view_file', arguments: { AbsolutePath: '/var/log.txt' } }]
    };
    engine.processStep(modelResponse);

    const metrics = engine.getMetrics();
    assert.strictEqual(metrics.conversationId, 'conv-1');
    assert.strictEqual(metrics.stepCount, 2);
    assert.ok(metrics.promptTokens > 0, 'Prompt tokens must be > 0');
    assert.ok(metrics.completionTokens > 0, 'Completion tokens must be > 0');
    assert.strictEqual(metrics.totalTokens, metrics.promptTokens + metrics.completionTokens);
    assert.ok(metrics.estimatedCostUsd >= 0);
  });
});
