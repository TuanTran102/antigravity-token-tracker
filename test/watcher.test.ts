import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import cp from 'node:child_process';
import { TranscriptWatcher } from '../src/watcher/transcript-watcher';

describe('Transcript Watcher', () => {
  let tempBaseDir: string;
  let tempConvDir: string;

  before(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-test-brain-'));
    tempConvDir = path.join(tempBaseDir, 'conversations');
    fs.mkdirSync(tempConvDir, { recursive: true });

    // Setup mock conversation DB for conv-newer
    const convNewerDb = path.join(tempConvDir, 'conv-newer.db');
    const hexBlob = Buffer.from('\n)file:///Volumes/KIOXIA/Projects/test-project\x12)file:///Volumes/KIOXIA/Projects/test-project').toString('hex');
    cp.execFileSync('sqlite3', [
      convNewerDb,
      `CREATE TABLE trajectory_metadata_blob (id text PRIMARY KEY, data blob);
       INSERT INTO trajectory_metadata_blob (id, data) VALUES ('main', X'${hexBlob}');`
    ]);

    // Setup 2 mock conversation dirs
    const conv1 = path.join(tempBaseDir, 'conv-older', '.system_generated', 'logs');
    const conv2 = path.join(tempBaseDir, 'conv-newer', '.system_generated', 'logs');
    fs.mkdirSync(conv1, { recursive: true });
    fs.mkdirSync(conv2, { recursive: true });

    fs.writeFileSync(path.join(conv1, 'transcript.jsonl'), '{"step_index":0,"type":"USER_INPUT","content":"Older"}\n');
    // Set older mtime
    const oldTime = new Date(Date.now() - 60000);
    fs.utimesSync(path.join(conv1, 'transcript.jsonl'), oldTime, oldTime);

    fs.writeFileSync(
      path.join(conv2, 'transcript.jsonl'),
      '{"step_index":0,"type":"USER_INPUT","content":"Newer hello"}\n'
    );
  });

  after(() => {
    fs.rmSync(tempBaseDir, { recursive: true, force: true });
  });

  it('should find the conversation with the newest transcript.jsonl mtime', () => {
    const watcher = new TranscriptWatcher({ customBrainPath: tempBaseDir, customConversationsDir: tempConvDir });
    const active = watcher.findActiveConversation();
    assert.ok(active);
    assert.strictEqual(active.conversationId, 'conv-newer');
  });

  it('should parse transcript lines incrementally and produce metrics', () => {
    const watcher = new TranscriptWatcher({ customBrainPath: tempBaseDir, customConversationsDir: tempConvDir });
    const conv = watcher.findActiveConversation();
    assert.ok(conv);
    const metrics = watcher.parseConversationFile(conv.transcriptPath);
    assert.ok(metrics);
    assert.strictEqual(metrics.conversationId, 'conv-newer');
    assert.ok(metrics.promptTokens > 0);
    assert.strictEqual(metrics.workspace, 'test-project');
  });

  it('should list recent sessions sorted by last modified time with workspace', () => {
    const watcher = new TranscriptWatcher({ customBrainPath: tempBaseDir, customConversationsDir: tempConvDir });
    const recent = watcher.listRecentSessions();
    assert.strictEqual(recent.length, 2);
    assert.strictEqual(recent[0].conversationId, 'conv-newer');
    assert.strictEqual(recent[0].workspace, 'test-project');
    assert.strictEqual(recent[1].conversationId, 'conv-older');
  });
});
