import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseTranscriptLine, parseTranscriptChunk } from '../src/parser/transcript-parser';

describe('Transcript Parser', () => {
  it('should parse valid USER_INPUT step', () => {
    const raw = JSON.stringify({
      step_index: 0,
      source: 'USER_EXPLICIT',
      type: 'USER_INPUT',
      status: 'DONE',
      content: 'Hello Antigravity'
    });
    const step = parseTranscriptLine(raw);
    assert.ok(step);
    assert.strictEqual(step.step_index, 0);
    assert.strictEqual(step.type, 'USER_INPUT');
    assert.strictEqual(step.content, 'Hello Antigravity');
  });

  it('should parse PLANNER_RESPONSE with tool calls', () => {
    const raw = JSON.stringify({
      step_index: 1,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      status: 'DONE',
      content: 'I will list the files.',
      tool_calls: [{ tool_name: 'list_dir', arguments: { DirectoryPath: '/workspace' } }]
    });
    const step = parseTranscriptLine(raw);
    assert.ok(step);
    assert.strictEqual(step.tool_calls?.length, 1);
    assert.strictEqual(step.tool_calls?.[0].tool_name, 'list_dir');
  });

  it('should ignore empty lines or invalid JSON safely', () => {
    assert.strictEqual(parseTranscriptLine(''), null);
    assert.strictEqual(parseTranscriptLine('   '), null);
    assert.strictEqual(parseTranscriptLine('{invalid-json'), null);
  });

  it('should parse a multiline chunk of transcript JSONL', () => {
    const chunk = [
      JSON.stringify({ step_index: 0, type: 'USER_INPUT', content: 'Step 0' }),
      '',
      JSON.stringify({ step_index: 1, type: 'PLANNER_RESPONSE', content: 'Step 1' })
    ].join('\n');
    const steps = parseTranscriptChunk(chunk);
    assert.strictEqual(steps.length, 2);
    assert.strictEqual(steps[0].content, 'Step 0');
    assert.strictEqual(steps[1].content, 'Step 1');
  });
});
