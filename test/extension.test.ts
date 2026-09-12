import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as vscode from './mocks/vscode';
import * as extension from '../src/extension';

describe('Extension Lifecycle Entry Point', () => {
  it('should export activate and deactivate functions', () => {
    assert.strictEqual(typeof extension.activate, 'function');
    assert.strictEqual(typeof extension.deactivate, 'function');
  });

  it('should activate without throwing when context is passed', () => {
    const mockContext: any = {
      subscriptions: []
    };
    assert.doesNotThrow(() => {
      extension.activate(mockContext);
    });
    assert.ok(mockContext.subscriptions.length >= 4);
    assert.doesNotThrow(() => {
      extension.deactivate();
    });
  });

  it('should register onDidChangeWindowState listener in subscriptions', () => {
    let windowStateListenerRegistered = false;
    const origListener = (vscode.window as any).onDidChangeWindowState;
    (vscode.window as any).onDidChangeWindowState = (listener: any) => {
      windowStateListenerRegistered = true;
      return { dispose: () => {} };
    };

    const mockContext: any = {
      subscriptions: []
    };

    try {
      extension.activate(mockContext);
      assert.ok(windowStateListenerRegistered, 'onDidChangeWindowState listener must be registered');
      assert.ok(mockContext.subscriptions.length >= 4);
    } finally {
      (vscode.window as any).onDidChangeWindowState = origListener;
      extension.deactivate();
    }
  });
});
