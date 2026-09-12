import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getPricingRate, calculateCost, DEFAULT_RATES } from '../src/engine/pricing';

describe('Pricing Engine', () => {
  it('should return correct pricing for gemini-2.5-flash', () => {
    const rate = getPricingRate('gemini-2.5-flash');
    assert.strictEqual(rate.inputPerMillion, 0.15);
    assert.strictEqual(rate.outputPerMillion, 0.60);
  });

  it('should fallback to default for unknown model', () => {
    const rate = getPricingRate('unknown-model');
    assert.strictEqual(rate.inputPerMillion, 0.15);
    assert.strictEqual(rate.outputPerMillion, 0.60);
  });

  it('should calculate accurate cost for given token counts', () => {
    const rate = { inputPerMillion: 0.15, outputPerMillion: 0.60 };
    // 20,000 prompt tokens = (20000 / 1e6) * 0.15 = 0.003
    // 5,000 completion tokens = (5000 / 1e6) * 0.60 = 0.003
    // Total = 0.006
    const cost = calculateCost(20000, 5000, rate);
    assert.ok(Math.abs(cost - 0.006) < 0.00001);
  });
});
