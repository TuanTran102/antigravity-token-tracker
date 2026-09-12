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

describe('Dynamic Active Session Tracking & Detection', () => {
  let dynamicBaseDir: string;
  let dynamicConvDir: string;

  before(() => {
    dynamicBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-test-dynamic-brain-'));
    dynamicConvDir = path.join(dynamicBaseDir, 'conversations');
    fs.mkdirSync(dynamicConvDir, { recursive: true });

    const conv1 = path.join(dynamicBaseDir, 'conv-initial', '.system_generated', 'logs');
    fs.mkdirSync(conv1, { recursive: true });
    fs.writeFileSync(path.join(conv1, 'transcript.jsonl'), '{"step_index":0,"type":"USER_INPUT","content":"Initial"}\n');
  });

  after(() => {
    fs.rmSync(dynamicBaseDir, { recursive: true, force: true });
  });

  it('should detect newly created session and trigger onUpdate via checkActiveConversation', () => {
    let updatedMetrics: any = null;
    const watcher = new TranscriptWatcher({
      customBrainPath: dynamicBaseDir,
      customConversationsDir: dynamicConvDir,
      pollIntervalMs: 0,
      onUpdate: (metrics) => {
        updatedMetrics = metrics;
      }
    });

    try {
      watcher.startWatching();
      assert.strictEqual(watcher.getActiveConversationId(), 'conv-initial');

      // Create new session directory and transcript with newer mtime
      const conv2 = path.join(dynamicBaseDir, 'conv-created-later', '.system_generated', 'logs');
      fs.mkdirSync(conv2, { recursive: true });
      const futureTime = new Date(Date.now() + 2000);
      fs.writeFileSync(
        path.join(conv2, 'transcript.jsonl'),
        '{"step_index":0,"type":"USER_INPUT","content":"New session prompt"}\n'
      );
      fs.utimesSync(path.join(conv2, 'transcript.jsonl'), futureTime, futureTime);

      const detected = watcher.checkActiveConversation();
      assert.ok(detected);
      assert.strictEqual(detected.conversationId, 'conv-created-later');
      assert.ok(updatedMetrics);
      assert.strictEqual(updatedMetrics.conversationId, 'conv-created-later');
      assert.strictEqual(watcher.getActiveConversationId(), 'conv-created-later');
    } finally {
      watcher.stopWatching();
    }
  });

  it('should switch active session when an older session receives newer updates', () => {
    let updatedMetrics: any = null;
    const watcher = new TranscriptWatcher({
      customBrainPath: dynamicBaseDir,
      customConversationsDir: dynamicConvDir,
      pollIntervalMs: 0,
      onUpdate: (metrics) => {
        updatedMetrics = metrics;
      }
    });

    try {
      watcher.startWatching();
      assert.strictEqual(watcher.getActiveConversationId(), 'conv-created-later');

      // Update conv-initial with newest mtime and additional content
      const conv1 = path.join(dynamicBaseDir, 'conv-initial', '.system_generated', 'logs');
      const newestTime = new Date(Date.now() + 5000);
      fs.appendFileSync(path.join(conv1, 'transcript.jsonl'), '{"step_index":1,"type":"USER_INPUT","content":"More input"}\n');
      fs.utimesSync(path.join(conv1, 'transcript.jsonl'), newestTime, newestTime);

      const switched = watcher.checkActiveConversation();
      assert.ok(switched);
      assert.strictEqual(switched.conversationId, 'conv-initial');
      assert.strictEqual(watcher.getActiveConversationId(), 'conv-initial');
      assert.ok(updatedMetrics);
      assert.strictEqual(updatedMetrics.conversationId, 'conv-initial');
    } finally {
      watcher.stopWatching();
    }
  });

  it('should handle startup when brainPath does not exist and recover when created', () => {
    const nonExistentPath = path.join(dynamicBaseDir, 'late-brain');
    let updatedMetrics: any = null;
    const watcher = new TranscriptWatcher({
      customBrainPath: nonExistentPath,
      customConversationsDir: dynamicConvDir,
      pollIntervalMs: 0,
      onUpdate: (metrics) => {
        updatedMetrics = metrics;
      }
    });

    try {
      // Must not throw
      watcher.startWatching();
      assert.strictEqual(watcher.getActiveConversationId(), undefined);

      // Now create folder and session
      const newConv = path.join(nonExistentPath, 'conv-recovered', '.system_generated', 'logs');
      fs.mkdirSync(newConv, { recursive: true });
      fs.writeFileSync(path.join(newConv, 'transcript.jsonl'), '{"step_index":0,"type":"USER_INPUT","content":"Hello"}\n');

      const detected = watcher.checkActiveConversation();
      assert.ok(detected);
      assert.strictEqual(detected.conversationId, 'conv-recovered');
      assert.strictEqual(watcher.getActiveConversationId(), 'conv-recovered');
    } finally {
      watcher.stopWatching();
    }
  });
});

