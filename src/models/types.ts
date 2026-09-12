export interface TranscriptStep {
  step_index: number;
  source?: 'USER_EXPLICIT' | 'MODEL' | 'SYSTEM' | string;
  type: 'USER_INPUT' | 'PLANNER_RESPONSE' | string;
  status?: 'DONE' | 'ERROR' | string;
  content?: string;
  tool_calls?: Array<{
    tool_id?: string;
    tool_name?: string;
    arguments?: Record<string, unknown>;
    output?: unknown;
  }>;
  is_truncated?: boolean;
}

export function isValidTranscriptStep(obj: unknown): obj is TranscriptStep {
  if (!obj || typeof obj !== 'object') {
    return false;
  }
  const candidate = obj as Record<string, unknown>;
  return typeof candidate.step_index === 'number' && typeof candidate.type === 'string';
}

export interface PricingRate {
  inputPerMillion: number;
  outputPerMillion: number;
}

export interface TokenMetrics {
  conversationId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  stepCount: number;
  lastUpdated: Date;
}

export interface SessionSummary {
  conversationId: string;
  lastModifiedTime: number;
  metrics: TokenMetrics;
}
