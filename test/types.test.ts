import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TranscriptStep, TokenMetrics, PricingRate, isValidTranscriptStep } from '../src/models/types';

describe('Data Models Contracts', () => {
  it('should instantiate TokenMetrics with required fields', () => {
    const metrics: TokenMetrics = {
      conversationId: 'conv-123',
      promptTokens: 1000,
      completionTokens: 500,
      totalTokens: 1500,
      estimatedCostUsd: 0.00045,
      stepCount: 4,
      lastUpdated: new Date()
    };
    assert.strictEqual(metrics.conversationId, 'conv-123');
    assert.strictEqual(metrics.totalTokens, 1500);
    assert.strictEqual(metrics.promptTokens, 1000);
    assert.strictEqual(metrics.completionTokens, 500);
  });

  it('should validate TranscriptStep using isValidTranscriptStep', () => {
    const validStep = {
      step_index: 2,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      status: 'DONE',
      content: 'I will inspect files.'
    };
    assert.strictEqual(isValidTranscriptStep(validStep), true);
    assert.strictEqual(isValidTranscriptStep(null), false);
    assert.strictEqual(isValidTranscriptStep({}), false);
  });
});
