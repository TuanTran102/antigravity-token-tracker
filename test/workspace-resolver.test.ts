import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { WorkspaceResolver } from '../src/parser/workspace-resolver';

describe('Workspace Resolver', () => {
  let tempDir: string;
  let customWsStorageDir: string;

  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-ws-test-'));
    customWsStorageDir = path.join(tempDir, 'workspaceStorage');
    fs.mkdirSync(customWsStorageDir, { recursive: true });

    // Mock a known workspace
    const ws1 = path.join(customWsStorageDir, 'hash1');
    fs.mkdirSync(ws1, { recursive: true });
    fs.writeFileSync(
      path.join(ws1, 'workspace.json'),
      JSON.stringify({ folder: 'file:///Volumes/KIOXIA/Projects/hozilo-tv' })
    );

    const ws2 = path.join(customWsStorageDir, 'hash2');
    fs.mkdirSync(ws2, { recursive: true });
    fs.writeFileSync(
      path.join(ws2, 'workspace.json'),
      JSON.stringify({ folder: 'file:///Volumes/KIOXIA/Projects/agy-eval' })
    );
  });

  after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should resolve workspace from Active Document matching known workspaceStorage', () => {
    const transcriptPath = path.join(tempDir, 'transcript-active-doc.jsonl');
    fs.writeFileSync(
      transcriptPath,
      JSON.stringify({
        step_index: 0,
        type: 'USER_INPUT',
        content: 'hello\nActive Document: /Volumes/KIOXIA/Projects/hozilo-tv/package.json (LANGUAGE_JSON)'
      }) + '\n'
    );

    const resolver = new WorkspaceResolver({ customWorkspaceStorageDir: customWsStorageDir });
    const ws = resolver.resolveWorkspace('conv-1', transcriptPath);
    assert.strictEqual(ws, 'hozilo-tv');
  });

  it('should resolve workspace from tool call Cwd or AbsolutePath', () => {
    const transcriptPath = path.join(tempDir, 'transcript-tool-call.jsonl');
    fs.writeFileSync(
      transcriptPath,
      JSON.stringify({
        step_index: 0,
        type: 'PLANNER_RESPONSE',
        tool_calls: [
          {
            name: 'run_command',
            args: { Cwd: '/Volumes/KIOXIA/Projects/agy-eval', CommandLine: 'git status' }
          }
        ]
      }) + '\n'
    );

    const resolver = new WorkspaceResolver({ customWorkspaceStorageDir: customWsStorageDir });
    const ws = resolver.resolveWorkspace('conv-2', transcriptPath);
    assert.strictEqual(ws, 'agy-eval');
  });

  it('should resolve workspace using path regex fallback when workspaceStorage does not have it', () => {
    const transcriptPath = path.join(tempDir, 'transcript-fallback.jsonl');
    fs.writeFileSync(
      transcriptPath,
      JSON.stringify({
        step_index: 0,
        type: 'USER_INPUT',
        content: 'Fix bug\nActive Document: /Users/developer/Projects/open-power/src/index.ts (LANGUAGE_TS)'
      }) + '\n'
    );

    const resolver = new WorkspaceResolver({ customWorkspaceStorageDir: customWsStorageDir });
    const ws = resolver.resolveWorkspace('conv-3', transcriptPath);
    assert.strictEqual(ws, 'open-power');
  });

  it('should resolve workspace from URI to CorpusName mapping', () => {
    const transcriptPath = path.join(tempDir, 'transcript-corpus.jsonl');
    fs.writeFileSync(
      transcriptPath,
      JSON.stringify({
        step_index: 0,
        type: 'USER_INPUT',
        content: 'Test [URI] -> [CorpusName]: /Users/developer/workspace/custom-app -> MyCorpus'
      }) + '\n'
    );

    const resolver = new WorkspaceResolver({ customWorkspaceStorageDir: customWsStorageDir });
    const ws = resolver.resolveWorkspace('conv-4', transcriptPath);
    assert.strictEqual(ws, 'custom-app');
  });

  it('should cache resolved workspace by conversationId', () => {
    const transcriptPath = path.join(tempDir, 'transcript-cached.jsonl');
    fs.writeFileSync(
      transcriptPath,
      JSON.stringify({
        step_index: 0,
        type: 'USER_INPUT',
        content: 'Active Document: /Volumes/KIOXIA/Projects/hozilo-tv/app.json'
      }) + '\n'
    );

    const resolver = new WorkspaceResolver({ customWorkspaceStorageDir: customWsStorageDir });
    const ws1 = resolver.resolveWorkspace('conv-cache', transcriptPath);
    assert.strictEqual(ws1, 'hozilo-tv');

    // Remove file to ensure cache is hit
    fs.unlinkSync(transcriptPath);
    const ws2 = resolver.resolveWorkspace('conv-cache', transcriptPath);
    assert.strictEqual(ws2, 'hozilo-tv');
  });

  it('should return undefined gracefully when no workspace info can be found', () => {
    const transcriptPath = path.join(tempDir, 'transcript-empty.jsonl');
    fs.writeFileSync(
      transcriptPath,
      JSON.stringify({
        step_index: 0,
        type: 'USER_INPUT',
        content: 'Hello world without any paths'
      }) + '\n'
    );

    const resolver = new WorkspaceResolver({ customWorkspaceStorageDir: customWsStorageDir });
    const ws = resolver.resolveWorkspace('conv-5', transcriptPath);
    assert.strictEqual(ws, undefined);
  });
});
