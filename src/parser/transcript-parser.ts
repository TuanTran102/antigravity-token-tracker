import { TranscriptStep } from '../models/types';

export function parseTranscriptLine(line: string): TranscriptStep | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'object' && parsed !== null && 'type' in parsed) {
      return parsed as TranscriptStep;
    }
    return null;
  } catch {
    return null;
  }
}

export function parseTranscriptChunk(content: string): TranscriptStep[] {
  const lines = content.split('\n');
  const steps: TranscriptStep[] = [];
  for (const line of lines) {
    const step = parseTranscriptLine(line);
    if (step) {
      steps.push(step);
    }
  }
  return steps;
}
