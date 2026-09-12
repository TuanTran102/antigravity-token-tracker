import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { TitleResolver } from '../src/parser/title-resolver';

describe('Title Resolver', () => {
  let tempDir: string;

  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-title-test-'));
  });

  after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should extract title from transcript prompt when db is empty', () => {
    const transcriptPath = path.join(tempDir, 'transcript.jsonl');
    const content = JSON.stringify({
      step_index: 0,
      type: 'USER_INPUT',
      content: '<USER_REQUEST>\n/spec hãy làm tính năng giỏ hàng\n</USER_REQUEST>'
    }) + '\n';
    fs.writeFileSync(transcriptPath, content);

    const resolver = new TitleResolver(path.join(tempDir, 'nonexistent.db'));
    const title = resolver.resolveTitle('conv-abc-12345678', transcriptPath);
    assert.strictEqual(title, 'hãy làm tính năng giỏ hàng');
  });

  it('should fallback to short UUID when no prompt exists', () => {
    const transcriptPath = path.join(tempDir, 'empty-transcript.jsonl');
    fs.writeFileSync(transcriptPath, '');

    const resolver = new TitleResolver(path.join(tempDir, 'nonexistent.db'));
    const title = resolver.resolveTitle('12345678-abcd-ef00-1122-334455667788', transcriptPath);
    assert.strictEqual(title, 'Session 12345678');
  });
});
