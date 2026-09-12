import { TranscriptStep, TokenMetrics } from '../models/types';
import { getPricingRate, calculateCost } from './pricing';

export class TokenEngine {
  private promptTokens = 0;
  private completionTokens = 0;
  private stepCount = 0;
  private lastUpdated = new Date();

  constructor(
    public readonly conversationId: string,
    private model: string = 'gemini-2.5-flash'
  ) {}

  public estimateTokens(text: string): number {
    if (!text) return 0;
    const cleaned = text.trim();
    if (!cleaned) return 0;
    const charCount = cleaned.length;
    const wordCount = cleaned.split(/\s+/).length;
    // High accuracy tokenization heuristic (~3.8 characters per token for code & multilingual)
    const tokenEst = Math.ceil(Math.max(charCount / 3.8, wordCount * 1.25));
    return Math.max(1, tokenEst);
  }

  public processStep(step: TranscriptStep): void {
    this.stepCount++;
    this.lastUpdated = new Date();

    let contentTokens = 0;
    if (step.content) {
      contentTokens += this.estimateTokens(step.content);
    }
    if (step.tool_calls && step.tool_calls.length > 0) {
      const toolPayload = JSON.stringify(step.tool_calls);
      contentTokens += this.estimateTokens(toolPayload);
    }

    if (step.type === 'USER_INPUT' || step.source === 'USER_EXPLICIT') {
      this.promptTokens += contentTokens;
    } else {
      this.completionTokens += contentTokens;
    }
  }

  public setModel(model: string): void {
    this.model = model;
  }

  public getMetrics(): TokenMetrics {
    const rate = getPricingRate(this.model);
    const totalTokens = this.promptTokens + this.completionTokens;
    const estimatedCostUsd = calculateCost(this.promptTokens, this.completionTokens, rate);

    return {
      conversationId: this.conversationId,
      promptTokens: this.promptTokens,
      completionTokens: this.completionTokens,
      totalTokens,
      estimatedCostUsd,
      stepCount: this.stepCount,
      lastUpdated: this.lastUpdated
    };
  }
}
