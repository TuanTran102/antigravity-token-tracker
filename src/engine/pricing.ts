import { PricingRate } from '../models/types';

export const DEFAULT_RATES: Record<string, PricingRate> = {
  'gemini-2.5-flash': { inputPerMillion: 0.15, outputPerMillion: 0.60 },
  'gemini-2.5-pro': { inputPerMillion: 1.25, outputPerMillion: 5.00 },
  'gemini-1.5-flash': { inputPerMillion: 0.075, outputPerMillion: 0.30 },
  'gemini-1.5-pro': { inputPerMillion: 1.25, outputPerMillion: 5.00 },
  'default': { inputPerMillion: 0.15, outputPerMillion: 0.60 }
};

export function getPricingRate(model: string): PricingRate {
  return DEFAULT_RATES[model] || DEFAULT_RATES['default'];
}

export function calculateCost(promptTokens: number, completionTokens: number, rate: PricingRate): number {
  const inputCost = (promptTokens / 1_000_000) * rate.inputPerMillion;
  const outputCost = (completionTokens / 1_000_000) * rate.outputPerMillion;
  return Number((inputCost + outputCost).toFixed(6));
}
