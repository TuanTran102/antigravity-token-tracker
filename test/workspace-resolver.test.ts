import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import cp from 'node:child_process';
import { WorkspaceResolver } from '../src/parser/workspace-resolver';

describe('Workspace Resolver (SQLite-based)', () => {
  let tempDir: string;
  let customConvDir: string;
  let customStateDbPath: string;

  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-ws-sql-test-'));
    customConvDir = path.join(tempDir, 'conversations');
    fs.mkdirSync(customConvDir, { recursive: true });

    // 1. Create a mock conversation db with trajectory_metadata_blob
    const convId1 = 'conv-realtime-1';
    const dbPath1 = path.join(customConvDir, `${convId1}.db`);
    const hexBlob1 = Buffer.from('\n)file:///Volumes/KIOXIA/Projects/agy-eval\x12)file:///Volumes/KIOXIA/Projects/agy-eval\x1aETuanTran102/antigravity-token-tracker').toString('hex');
    cp.execFileSync('sqlite3', [
      dbPath1,
      `CREATE TABLE trajectory_metadata_blob (id text PRIMARY KEY, data blob);
       INSERT INTO trajectory_metadata_blob (id, data) VALUES ('main', X'${hexBlob1}');`
    ]);

    // 2. Create mock state.vscdb for fallback
    customStateDbPath = path.join(tempDir, 'state.vscdb');
    const convId2 = 'conv-fallback-2';
    const innerBuf = Buffer.concat([
      Buffer.from([0x0a, 0x0c]),
      Buffer.from('Test Session'),
      Buffer.from('\n)file:///Volumes/KIOXIA/Projects/hozilo-tv')
    ]);
    const nextLineBase64 = innerBuf.toString('base64');
    const summariesText = `${convId2}\n${nextLineBase64}\n`;
    const summariesBase64 = Buffer.from(summariesText).toString('base64');

    cp.execFileSync('sqlite3', [
      customStateDbPath,
      `CREATE TABLE ItemTable (key text PRIMARY KEY, value text);
       INSERT INTO ItemTable (key, value) VALUES ('antigravityUnifiedStateSync.trajectorySummaries', '${summariesBase64}');`
    ]);
  });

  after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should resolve workspace from conversation db (Priority 1)', () => {
    const resolver = new WorkspaceResolver({
      customConversationsDir: customConvDir,
      customGlobalStorageDbPath: customStateDbPath
    });
    const ws = resolver.resolveWorkspace('conv-realtime-1');
    assert.strictEqual(ws, 'agy-eval');
  });

  it('should fallback to state.vscdb when conversation db is absent (Priority 2)', () => {
    const resolver = new WorkspaceResolver({
      customConversationsDir: customConvDir,
      customGlobalStorageDbPath: customStateDbPath
    });
    const ws = resolver.resolveWorkspace('conv-fallback-2');
    assert.strictEqual(ws, 'hozilo-tv');
  });

  it('should NOT read workspace from transcript paths even if transcript has foreign paths', () => {
    const transcriptPath = path.join(tempDir, 'fake-transcript.jsonl');
    fs.writeFileSync(
      transcriptPath,
      JSON.stringify({
        step_index: 0,
        type: 'USER_INPUT',
        content: 'Active Document: /Volumes/KIOXIA/Projects/foreign-project/index.ts'
      }) + '\n'
    );

    const resolver = new WorkspaceResolver({
      customConversationsDir: customConvDir,
      customGlobalStorageDbPath: customStateDbPath
    });
    // conv-realtime-1 is agy-eval in DB, but transcript says foreign-project
    const ws = resolver.resolveWorkspace('conv-realtime-1', transcriptPath);
    assert.strictEqual(ws, 'agy-eval');
  });

  it('should return undefined when conversation is not found in either db', () => {
    const resolver = new WorkspaceResolver({
      customConversationsDir: customConvDir,
      customGlobalStorageDbPath: customStateDbPath
    });
    const ws = resolver.resolveWorkspace('non-existent-conv');
    assert.strictEqual(ws, undefined);
  });
});
